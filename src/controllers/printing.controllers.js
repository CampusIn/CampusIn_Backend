import mongoose from "mongoose";
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/apiErrors.js";
import ApiResponse from "../utils/apiResponse.js";
import printingUploadModel from "../models/printingUpload.models.js";
import printingOrderModel from "../models/printingOrder.models.js";
import userModel from "../models/user.models.js";
import { ensurePrintingConfig } from "../services/printingConfig.services.js";
import {
  uploadPrintingBuffer,
  deletePrintingFile,
  getSignedPrintingFileUrl,
} from "../services/printingStorage.services.js";
import {
  getPageCountForFile,
  sha256FromBuffer,
  validateUploadMeta,
} from "../utils/printingFile.utils.js";
import generatePrintingOrderNumber from "../utils/printingOrderNumber.utils.js";
import { redis } from "../config/redis.js";
import emailServices from "../services/emailQueue.services.js";

const ORDER_IDEMPOTENCY_TTL_SECONDS = 10 * 60;
const FILE_ACCESS_TTL_SECONDS = 5 * 60;

const buildPrintingCreatedHtml = ({ username, orderNumber, amount }) => {
  return `<p>Hi ${username || "there"},</p><p>Your print order <strong>${orderNumber}</strong> is created.</p><p>Total: INR ${amount}</p>`;
};

const buildAdminPrintingCreatedHtml = ({
  username,
  orderNumber,
  userName,
  contactMobile,
}) => {
  return `<p>Hi ${username || "admin"},</p><p>New print order <strong>${orderNumber}</strong> was created by ${userName}.</p><p>Contact mobile: ${contactMobile}</p>`;
};

const getIdempotencyCacheKey = (userId, idempotencyKey) => {
  return `printing:idempotency:${userId}:${idempotencyKey}`;
};

const acquireIdempotencySlot = async (cacheKey) => {
  const response = await redis.set(cacheKey, "PENDING", "EX", 120, "NX");
  return response === "OK";
};

const releaseIdempotencySlot = async (cacheKey) => {
  await redis.del(cacheKey);
};

const getRetentionDate = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
};

const getAttachedUploadExpiryDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + 180);
  return date;
};

const calculateOrderPricing = ({ totalPagesToPrint, colorMode, duplex, pricing }) => {
  const pageRate = colorMode === "COLOR" ? pricing.colorPerPage : pricing.bwPerPage;
  const duplexMultiplier = duplex === "DOUBLE" ? pricing.duplexMultiplier : 1;
  const subtotal = Math.round(totalPagesToPrint * pageRate * duplexMultiplier);

  return {
    pageRate,
    subtotal,
    finalAmount: subtotal,
  };
};

const uploadPrintingFiles = asyncHandler(async (req, res) => {
  const files = req.files;
  if (!files || files.length === 0) {
    throw new ApiError(400, "At least one file is required");
  }

  const printingConfig = await ensurePrintingConfig();
  const { limits } = printingConfig;

  if (files.length > limits.maxFilesPerOrder) {
    throw new ApiError(
      400,
      `You can upload up to ${limits.maxFilesPerOrder} files in one request`,
    );
  }

  const totalRequestBytes = files.reduce((sum, file) => sum + Number(file.size || 0), 0);
  if (totalRequestBytes > limits.maxTotalSizeBytes) {
    throw new ApiError(400, "Total upload size exceeded");
  }

  const uploadedRecords = [];
  const uploadedStorageRefs = [];

  try {
    for (const file of files) {
      if (!file.buffer || !file.originalname) {
        throw new ApiError(400, "Invalid uploaded file");
      }

      if (file.size > limits.maxFileSizeBytes) {
        throw new ApiError(400, `File ${file.originalname} is too large`);
      }

      let validated;
      try {
        validated = validateUploadMeta({
          originalName: file.originalname,
          mimeType: file.mimetype,
          buffer: file.buffer,
        });
      } catch (error) {
        throw new ApiError(400, `${file.originalname}: ${error.message}`);
      }

      const pageCount = getPageCountForFile({
        detectedMime: validated.detectedMime,
        buffer: file.buffer,
      });

      const resourceType = validated.detectedMime === "application/pdf" ? "raw" : "image";
      const publicId = `u_${req.user.id}_${Date.now()}_${Math.round(Math.random() * 1e8)}`;
      const storage = await uploadPrintingBuffer({
        buffer: file.buffer,
        mimeType: validated.detectedMime,
        resourceType,
        publicId,
      });

      uploadedStorageRefs.push({
        storageKey: storage.storageKey,
        resourceType: storage.resourceType,
      });

      const expiresAt = new Date(Date.now() + limits.uploadTtlHours * 60 * 60 * 1000);
      const checksumSha256 = sha256FromBuffer(file.buffer);

      const uploadRecord = await printingUploadModel.create({
        user: req.user.id,
        originalName: file.originalname,
        mimeType: validated.detectedMime,
        extension: validated.extension,
        sizeBytes: file.size,
        storageProvider: "cloudinary",
        storageKey: storage.storageKey,
        resourceType: storage.resourceType,
        pageCount,
        checksumSha256,
        uploadStatus: "UPLOADED",
        expiresAt,
      });

      uploadedRecords.push(uploadRecord);
    }
  } catch (error) {
    await Promise.all(
      uploadedStorageRefs.map((ref) =>
        deletePrintingFile({
          storageKey: ref.storageKey,
          resourceType: ref.resourceType,
        }).catch(() => null),
      ),
    );

    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, "Unable to upload files right now");
  }

  return res.status(201).json(
    new ApiResponse(201, "Files uploaded successfully", {
      uploads: uploadedRecords,
    }),
  );
});

const deletePrintingUpload = asyncHandler(async (req, res) => {
  const { uploadId } = req.params;
  const upload = await printingUploadModel.findOne({
    _id: uploadId,
    user: req.user.id,
  });

  if (!upload) {
    throw new ApiError(404, "Upload not found");
  }

  if (upload.uploadStatus !== "UPLOADED") {
    throw new ApiError(409, "Upload can no longer be removed");
  }

  await deletePrintingFile({
    storageKey: upload.storageKey,
    resourceType: upload.resourceType,
  });

  upload.uploadStatus = "DELETED";
  upload.deletedAt = new Date();
  await upload.save();

  return res.status(200).json(new ApiResponse(200, "Upload removed successfully"));
});

const createPrintingOrder = asyncHandler(async (req, res) => {
  const {
    uploadIds,
    printingOptions = {},
    paymentMethod = "COD",
    contactMobile,
  } = req.body;
  const idempotencyKey = req.headers["idempotency-key"];
  const normalizedContactMobile =
    typeof contactMobile === "string" ? contactMobile.trim() : "";

  if (paymentMethod !== "COD") {
    throw new ApiError(400, "Only COD is supported for printing orders");
  }

  if (!normalizedContactMobile) {
    throw new ApiError(400, "contactMobile is required");
  }

  const printingConfig = await ensurePrintingConfig();
  const { pricing, limits } = printingConfig;

  if (!Array.isArray(uploadIds) || uploadIds.length < 1) {
    throw new ApiError(400, "uploadIds are required");
  }

  if (uploadIds.length > limits.maxFilesPerOrder) {
    throw new ApiError(400, `Maximum ${limits.maxFilesPerOrder} files allowed`);
  }

  const copies = Number(printingOptions.copies);
  if (!Number.isInteger(copies) || copies < 1 || copies > limits.maxCopies) {
    throw new ApiError(400, `copies must be between 1 and ${limits.maxCopies}`);
  }

  const colorMode = printingOptions.colorMode;
  const orientation = printingOptions.orientation;
  const duplex = printingOptions.duplex || "SINGLE";
  if (!["BW", "COLOR"].includes(colorMode)) {
    throw new ApiError(400, "Invalid colorMode");
  }
  if (!["PORTRAIT", "LANDSCAPE"].includes(orientation)) {
    throw new ApiError(400, "Invalid orientation");
  }
  if (!["SINGLE", "DOUBLE"].includes(duplex)) {
    throw new ApiError(400, "Invalid duplex mode");
  }

  let idempotencyCacheKey = null;
  if (typeof idempotencyKey === "string" && idempotencyKey.trim()) {
    idempotencyCacheKey = getIdempotencyCacheKey(req.user.id, idempotencyKey.trim());
    const existingOrderId = await redis.get(idempotencyCacheKey);
    if (existingOrderId && existingOrderId !== "PENDING") {
      const existingOrder = await printingOrderModel.findOne({
        _id: existingOrderId,
        user: req.user.id,
      });
      if (existingOrder) {
        return res
          .status(200)
          .json(new ApiResponse(200, "Printing order already created", existingOrder));
      }
    }

    const acquired = await acquireIdempotencySlot(idempotencyCacheKey);
    if (!acquired) {
      throw new ApiError(409, "Duplicate request in progress. Please retry shortly.");
    }
  }

  const uniqueUploadIds = [...new Set(uploadIds.map((id) => String(id)))];
  const uploadDocs = await printingUploadModel.find({
    _id: { $in: uniqueUploadIds },
    user: req.user.id,
    uploadStatus: "UPLOADED",
    expiresAt: { $gt: new Date() },
  });

  if (uploadDocs.length !== uniqueUploadIds.length) {
    if (idempotencyCacheKey) {
      await releaseIdempotencySlot(idempotencyCacheKey);
    }
    throw new ApiError(400, "One or more uploads are invalid or already attached");
  }

  const totalSizeBytes = uploadDocs.reduce((sum, doc) => sum + doc.sizeBytes, 0);
  if (totalSizeBytes > limits.maxTotalSizeBytes) {
    if (idempotencyCacheKey) {
      await releaseIdempotencySlot(idempotencyCacheKey);
    }
    throw new ApiError(400, "Total file size limit exceeded");
  }

  const basePages = uploadDocs.reduce((sum, doc) => sum + doc.pageCount, 0);
  const totalPagesToPrint = basePages * copies;
  if (totalPagesToPrint > limits.maxPagesPerOrder) {
    if (idempotencyCacheKey) {
      await releaseIdempotencySlot(idempotencyCacheKey);
    }
    throw new ApiError(400, "Total page limit exceeded for this order");
  }

  const calculatedPricing = calculateOrderPricing({
    totalPagesToPrint,
    colorMode,
    duplex,
    pricing,
  });

  const filesSnapshot = uploadDocs.map((doc) => ({
    uploadId: doc._id,
    originalName: doc.originalName,
    mimeType: doc.mimeType,
    extension: doc.extension,
    sizeBytes: doc.sizeBytes,
    storageProvider: doc.storageProvider,
    storageKey: doc.storageKey,
    resourceType: doc.resourceType,
    pageCount: doc.pageCount,
    checksumSha256: doc.checksumSha256,
  }));

  const session = await mongoose.startSession();
  let createdOrder;

  try {
    session.startTransaction();

    [createdOrder] = await printingOrderModel.create(
      [
        {
          user: req.user.id,
          orderNumber: generatePrintingOrderNumber(),
          contactMobile: normalizedContactMobile,
          files: filesSnapshot,
          printingOptions: {
            copies,
            colorMode,
            orientation,
            duplex,
            paperSize: "A4",
          },
          pricingSnapshot: {
            currency: "INR",
            bwPerPage: pricing.bwPerPage,
            colorPerPage: pricing.colorPerPage,
            duplexMultiplier: pricing.duplexMultiplier,
            subtotal: calculatedPricing.subtotal,
            finalAmount: calculatedPricing.finalAmount,
          },
          totals: {
            basePages,
            totalPagesToPrint,
          },
          paymentMethod: "COD",
          paymentStatus: "PENDING",
          orderStatus: "PENDING",
          statusTimeline: [{ status: "PENDING", at: new Date(), by: req.user.id, note: null }],
          fileRetention: {
            deleteAfter: null,
            deletedAt: null,
          },
        },
      ],
      { session },
    );

    await printingUploadModel.updateMany(
      {
        _id: { $in: uploadDocs.map((doc) => doc._id) },
        user: req.user.id,
      },
      {
        $set: {
          uploadStatus: "ATTACHED",
          printingOrder: createdOrder._id,
          expiresAt: getAttachedUploadExpiryDate(),
        },
      },
      { session },
    );

    await session.commitTransaction();
  } catch {
    await session.abortTransaction();
    if (idempotencyCacheKey) {
      await releaseIdempotencySlot(idempotencyCacheKey);
    }
    throw new ApiError(500, "Unable to place your printing order right now.");
  } finally {
    session.endSession();
  }

  if (idempotencyCacheKey) {
    await redis.set(
      idempotencyCacheKey,
      String(createdOrder._id),
      "EX",
      ORDER_IDEMPOTENCY_TTL_SECONDS,
    );
  }

  try {
    const user = await userModel.findById(req.user.id).select("email username");
    if (user?.email) {
      await emailServices.queuePrintingOrderCreatedEmail({
        to: user.email,
        subject: `Print order ${createdOrder.orderNumber} created`,
        text: `Your print order ${createdOrder.orderNumber} has been created.`,
        printingOrderCreatedHtml: buildPrintingCreatedHtml({
          username: user.username,
          orderNumber: createdOrder.orderNumber,
          amount: createdOrder.pricingSnapshot.finalAmount,
        }),
      });
    }

    const admins = await userModel.find({ role: "admin" }).select("email username");
    await Promise.all(
      admins
        .filter((admin) => admin.email)
        .map((admin) =>
          emailServices.queueAdminPrintingOrderCreatedEmail({
            to: admin.email,
            subject: `New print order ${createdOrder.orderNumber}`,
            text: `A new print order ${createdOrder.orderNumber} has been placed.`,
            adminPrintingOrderCreatedHtml: buildAdminPrintingCreatedHtml({
              username: admin.username,
              orderNumber: createdOrder.orderNumber,
              userName: user?.username || "user",
              contactMobile: createdOrder.contactMobile,
            }),
          }),
        ),
    );
  } catch (error) {
    console.error("Failed to queue printing order emails:", error.message);
  }

  return res
    .status(201)
    .json(new ApiResponse(201, "Printing order created successfully", createdOrder));
});

const getMyPrintingOrders = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status } = req.query;
  const pageNumber = parseInt(page, 10) || 1;
  const limitNumber = parseInt(limit, 10) || 10;
  if (pageNumber < 1 || limitNumber < 1) {
    throw new ApiError(400, "Invalid page or limit");
  }

  const filter = { user: req.user.id };
  if (status) {
    filter.orderStatus = status;
  }

  const skip = (pageNumber - 1) * limitNumber;
  const [orders, totalOrders] = await Promise.all([
    printingOrderModel
      .find(filter)
      .select(
        "orderNumber totals pricingSnapshot.finalAmount paymentStatus orderStatus createdAt rejectionMsg",
      )
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNumber),
    printingOrderModel.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(totalOrders / limitNumber);
  return res.status(200).json(
    new ApiResponse(200, "Printing orders fetched successfully", {
      orders,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        totalOrders,
        totalPages,
      },
    }),
  );
});

const getMyPrintingOrderById = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const order = await printingOrderModel.findById(orderId);
  if (!order) {
    throw new ApiError(404, "Printing order not found");
  }
  if (String(order.user) !== String(req.user.id)) {
    throw new ApiError(403, "Forbidden");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, "Printing order fetched successfully", order));
});

const cancelMyPrintingOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const order = await printingOrderModel.findById(orderId);
  if (!order) {
    throw new ApiError(404, "Printing order not found");
  }
  if (String(order.user) !== String(req.user.id)) {
    throw new ApiError(403, "Forbidden");
  }

  if (!["PENDING", "CONFIRMED"].includes(order.orderStatus)) {
    throw new ApiError(409, "Only pending or confirmed orders can be cancelled");
  }

  const printingConfig = await ensurePrintingConfig();
  order.orderStatus = "CANCELLED";
  order.statusTimeline.push({
    status: "CANCELLED",
    at: new Date(),
    by: req.user.id,
    note: "Cancelled by user",
  });
  order.fileRetention.deleteAfter = getRetentionDate(
    printingConfig.limits.fileRetentionDays,
  );
  await order.save();

  await printingUploadModel.updateMany(
    { printingOrder: order._id },
    {
      $set: {
        expiresAt: getRetentionDate(printingConfig.limits.fileRetentionDays),
      },
    },
  );

  return res
    .status(200)
    .json(new ApiResponse(200, "Printing order cancelled successfully", order));
});

const getPrintingFileAccess = asyncHandler(async (req, res) => {
  const { orderId, fileId } = req.params;
  const order = await printingOrderModel.findById(orderId);
  if (!order) {
    throw new ApiError(404, "Printing order not found");
  }
  if (String(order.user) !== String(req.user.id)) {
    throw new ApiError(403, "Forbidden");
  }

  const file = order.files.id(fileId);
  if (!file || file.deletedAt) {
    throw new ApiError(404, "File not found");
  }

  const { signedUrl, expiresAt } = getSignedPrintingFileUrl({
    storageKey: file.storageKey,
    resourceType: file.resourceType,
    extension: file.extension,
    expiresInSeconds: FILE_ACCESS_TTL_SECONDS,
  });

  return res.status(200).json(
    new ApiResponse(200, "Signed file URL generated", {
      signedUrl,
      expiresAt,
    }),
  );
});

const getPrintingConfigForUser = asyncHandler(async (req, res) => {
  const printingConfig = await ensurePrintingConfig();
  return res.status(200).json(
    new ApiResponse(200, "Printing config fetched successfully", {
      pricing: printingConfig.pricing,
      limits: printingConfig.limits,
      paymentMethods: ["COD"],
      supportedFileTypes: ["image/jpeg", "image/png", "application/pdf"],
    }),
  );
});

export default {
  uploadPrintingFiles,
  deletePrintingUpload,
  createPrintingOrder,
  getMyPrintingOrders,
  getMyPrintingOrderById,
  cancelMyPrintingOrder,
  getPrintingFileAccess,
  getPrintingConfigForUser,
};
