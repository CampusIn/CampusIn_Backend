import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/apiErrors.js";
import ApiResponse from "../utils/apiResponse.js";
import printingOrderModel from "../models/printingOrder.models.js";
import printingConfigModel from "../models/printingConfig.models.js";
import printingUploadModel from "../models/printingUpload.models.js";
import userModel from "../models/user.models.js";
import { ensurePrintingConfig } from "../services/printingConfig.services.js";
import { getSignedPrintingFileUrl } from "../services/printingStorage.services.js";
import emailServices from "../services/emailQueue.services.js";

const FILE_ACCESS_TTL_SECONDS = 5 * 60;

const FINAL_STATUSES = ["COMPLETED", "CANCELLED", "REJECTED"];
const PRINTING_STATUS_TRANSITIONS = {
  PENDING: ["CONFIRMED", "REJECTED", "CANCELLED"],
  CONFIRMED: ["PRINTING", "REJECTED", "CANCELLED"],
  PRINTING: ["READY_FOR_PICKUP", "CANCELLED"],
  READY_FOR_PICKUP: ["COMPLETED", "CANCELLED"],
};

const buildPrintingStatusHtml = ({ username, orderNumber, status, note }) => {
  const noteText = note ? `<p>Note: ${note}</p>` : "";
  return `<p>Hi ${username || "there"},</p><p>Your print order <strong>${orderNumber}</strong> is now <strong>${status}</strong>.</p>${noteText}`;
};

const getRetentionDate = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
};

const getAllPrintingOrdersAdmin = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status, search } = req.query;
  const pageNumber = parseInt(page, 10) || 1;
  const limitNumber = parseInt(limit, 10) || 10;

  if (pageNumber < 1 || limitNumber < 1) {
    throw new ApiError(400, "Invalid page or limit");
  }

  const filter = {};
  if (status) {
    filter.orderStatus = status;
  }
  if (search) {
    filter.orderNumber = { $regex: String(search).trim(), $options: "i" };
  }

  const skip = (pageNumber - 1) * limitNumber;
  const [orders, totalOrders] = await Promise.all([
    printingOrderModel
      .find(filter)
      .populate({ path: "user", select: "username email" })
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

const getPrintingOrderByIdAdmin = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const order = await printingOrderModel
    .findById(orderId)
    .populate({ path: "user", select: "username email" });
  if (!order) {
    throw new ApiError(404, "Printing order not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, "Printing order fetched successfully", order));
});

const updatePrintingOrderStatusAdmin = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { orderStatus, rejectionMsg } = req.body;

  const order = await printingOrderModel.findById(orderId);
  if (!order) {
    throw new ApiError(404, "Printing order not found");
  }

  if (FINAL_STATUSES.includes(order.orderStatus)) {
    throw new ApiError(409, "Order is in a final state");
  }

  const allowedNextStatuses = PRINTING_STATUS_TRANSITIONS[order.orderStatus] || [];
  if (!allowedNextStatuses.includes(orderStatus)) {
    throw new ApiError(
      409,
      `Cannot move order from ${order.orderStatus} to ${orderStatus}`,
    );
  }

  if (orderStatus === "REJECTED" && (!rejectionMsg || !rejectionMsg.trim())) {
    throw new ApiError(400, "rejectionMsg is required when rejecting an order");
  }

  order.orderStatus = orderStatus;
  order.rejectionMsg = orderStatus === "REJECTED" ? rejectionMsg.trim() : null;
  order.statusTimeline.push({
    status: orderStatus,
    at: new Date(),
    by: req.user.id,
    note: order.rejectionMsg,
  });

  if (FINAL_STATUSES.includes(orderStatus)) {
    const config = await ensurePrintingConfig();
    order.fileRetention.deleteAfter = getRetentionDate(config.limits.fileRetentionDays);

    await printingUploadModel.updateMany(
      { printingOrder: order._id },
      {
        $set: {
          expiresAt: getRetentionDate(config.limits.fileRetentionDays),
        },
      },
    );
  }

  await order.save();

  try {
    const owner = await userModel.findById(order.user).select("email username");
    if (owner?.email) {
      await emailServices.queuePrintingOrderStatusUpdatedEmail({
        to: owner.email,
        subject: `Print order ${order.orderNumber} status updated`,
        text: `Your print order ${order.orderNumber} is now ${orderStatus}.`,
        printingOrderStatusHtml: buildPrintingStatusHtml({
          username: owner.username,
          orderNumber: order.orderNumber,
          status: orderStatus,
          note: order.rejectionMsg,
        }),
      });
    }
  } catch (error) {
    console.error("Failed to queue printing status email:", error.message);
  }

  return res.status(200).json(
    new ApiResponse(200, "Printing order status updated successfully", {
      orderNumber: order.orderNumber,
      orderStatus: order.orderStatus,
      rejectionMsg: order.rejectionMsg,
    }),
  );
});

const updatePrintingOrderNotesAdmin = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { adminNotes } = req.body;

  const order = await printingOrderModel.findById(orderId);
  if (!order) {
    throw new ApiError(404, "Printing order not found");
  }

  order.adminNotes = adminNotes?.trim() || null;
  await order.save();

  return res
    .status(200)
    .json(new ApiResponse(200, "Printing order notes updated successfully", order));
});

const updatePrintingPaymentStatusAdmin = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { paymentStatus } = req.body;

  const order = await printingOrderModel.findById(orderId);
  if (!order) {
    throw new ApiError(404, "Printing order not found");
  }

  order.paymentStatus = paymentStatus;
  await order.save();

  return res.status(200).json(
    new ApiResponse(200, "Printing order payment status updated successfully", {
      orderNumber: order.orderNumber,
      paymentStatus: order.paymentStatus,
    }),
  );
});

const getPrintingFileAccessAdmin = asyncHandler(async (req, res) => {
  const { orderId, fileId } = req.params;
  const order = await printingOrderModel.findById(orderId);
  if (!order) {
    throw new ApiError(404, "Printing order not found");
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

const getPrintingConfigAdmin = asyncHandler(async (req, res) => {
  const config = await ensurePrintingConfig();
  return res
    .status(200)
    .json(new ApiResponse(200, "Printing config fetched successfully", config));
});

const updatePrintingConfigAdmin = asyncHandler(async (req, res) => {
  const config = await ensurePrintingConfig();
  const { pricing = {}, limits = {} } = req.body;

  config.pricing = {
    ...config.pricing.toObject(),
    ...pricing,
  };

  config.limits = {
    ...config.limits.toObject(),
    ...limits,
  };

  if (config.limits.maxTotalSizeBytes < config.limits.maxFileSizeBytes) {
    throw new ApiError(
      400,
      "maxTotalSizeBytes cannot be lower than maxFileSizeBytes",
    );
  }

  if (config.pricing.colorPerPage < config.pricing.bwPerPage) {
    throw new ApiError(400, "colorPerPage cannot be lower than bwPerPage");
  }

  config.updatedBy = req.user.id;
  await config.save();

  const refreshed = await printingConfigModel.findById(config._id);
  return res
    .status(200)
    .json(new ApiResponse(200, "Printing config updated successfully", refreshed));
});

export default {
  getAllPrintingOrdersAdmin,
  getPrintingOrderByIdAdmin,
  updatePrintingOrderStatusAdmin,
  updatePrintingOrderNotesAdmin,
  updatePrintingPaymentStatusAdmin,
  getPrintingFileAccessAdmin,
  getPrintingConfigAdmin,
  updatePrintingConfigAdmin,
};
