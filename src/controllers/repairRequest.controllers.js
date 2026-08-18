import repairRequestModel from "../models/repairRequest.models.js";
import ApiError from "../utils/apiErrors.js";
import ApiResponse from "../utils/apiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import generateRequestNumber from "../utils/requestNumber.utils.js";
import { uploadOnCloudinary } from "../services/cloudinary.services.js";
import mongoose from "mongoose";
import userModel from "../models/user.models.js";
import emailServices from "../services/emailQueue.services.js";
import {
  deleteUserRepairRequestByIdCached,
  deleteUserRepairRequestsCached,
  getUserRepairRequestByIdCached,
  getUserRepairRequestsCached,
  setUserRepairRequestByIdCached,
  setUserRepairRequestsCached,
} from "../services/repairRequestCached.services.js";
import {
  generateAdminRepairRequestSubmittedHTML,
  generateAdminRepairRequestSubmittedText,
  generateAdminRepairPriceDecisionHTML,
  generateAdminRepairPriceDecisionText,
} from "../utils/utils.js";

const createRepairRequest = asyncHandler(async (req, res) => {
  const {
    serviceType,
    description,
    pickupLocation,
    customerPhone,
    deviceCompany,
    modelName,
  } = req.body;
  const uploadedFiles = req.files || [];

  let images = [];
  if (uploadedFiles.length > 0) {
    try {
      images = await Promise.all(
        uploadedFiles.map((file) => uploadOnCloudinary(file.path)),
      );
    } catch (error) {
      throw new ApiError(
        500,
        "We couldn't upload your images right now. Please try again.",
      );
    }
  }

  const requestNumber = generateRequestNumber();

  const repairRequest = await repairRequestModel.create({
    user: req.user.id,
    customerPhone,
    pickupLocation,
    deviceCompany,
    modelName,
    serviceType,
    description,
    damageImages: images,
    requestNumber,
    requestStatus: "SUBMITTED",
  });

  try {
    const admins = await userModel.find({ role: "admin" }).select("email username");
    const adminEmailJobs = admins
      .filter((admin) => admin.email)
      .map((admin) =>
        emailServices.queueAdminRepairRequestSubmittedEmail({
          to: admin.email,
          subject: `New repair request ${repairRequest.requestNumber}`,
          text: generateAdminRepairRequestSubmittedText({
            requestNumber: repairRequest.requestNumber,
            serviceType: repairRequest.serviceType,
            customerPhone: repairRequest.customerPhone,
            pickupLocation: repairRequest.pickupLocation,
          }),
          repairRequestSubmittedHtml: generateAdminRepairRequestSubmittedHTML({
            adminName: admin.username,
            requestNumber: repairRequest.requestNumber,
            serviceType: repairRequest.serviceType,
            customerPhone: repairRequest.customerPhone,
            pickupLocation: repairRequest.pickupLocation,
          }),
        }),
      );

    await Promise.all(adminEmailJobs);
  } catch (error) {
    console.error(
      "Failed to queue admin emails for repair request submission:",
      error.message,
    );
  }

  await deleteUserRepairRequestsCached(req.user.id);

  return res
    .status(201)
    .json(
      new ApiResponse(
        201,
        "Repair request created successfully",
        repairRequest,
      ),
    );
});

const getAllRepairRequests = asyncHandler(async (req, res) => {
  const { search, status, page = 1, limit = 5 } = req.query;
  const pageNumber = parseInt(page) || 1;
  const limitNumber = parseInt(limit) || 5;
  if (pageNumber < 1 || limitNumber < 1) {
    throw new ApiError(400, "Invalid page or limit");
  }
  const skip = (pageNumber - 1) * limitNumber;
  const filter = {
    user: req.user.id,
  };

  if (search) {
    filter.requestNumber = {
      $regex: search,
      $options: "i",
    };
  }
  const allowedStatus = [
    "SUBMITTED",
    "PRICE_SENT",
    "ACCEPTED",
    "REJECTED",
    "FORWARDED",
    "COMPLETED",
  ];

  if (status && !allowedStatus.includes(status)) {
    throw new ApiError(400, "Invalid status");
  }

  if (status) {
    filter.requestStatus = status;
  }

  const cacheParams = {
    userId: req.user.id,
    page: pageNumber,
    limit: limitNumber,
    search,
    status,
  };

  const cachedData = await getUserRepairRequestsCached(cacheParams);
  if (cachedData) {
    const message =
      cachedData.repairRequests.length === 0
        ? "No repair requests to show"
        : "Repair requests fetched successfully";

    return res.status(200).json(new ApiResponse(200, message, cachedData));
  }

  const [repairRequests, totalRequests] = await Promise.all([
    repairRequestModel
      .find(filter)
      .sort({ createdAt: -1 })
      .select(
        "_id requestNumber serviceType deviceCompany modelName estimatedPrice requestStatus createdAt",
      )
      .skip(skip)
      .limit(limitNumber)
      .lean(),

    repairRequestModel.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(totalRequests / limitNumber);

  const responseData = {
    repairRequests,
    pagination: {
      page: pageNumber,
      limit: limitNumber,
      totalPages,
      totalRequests,
    },
  };

  await setUserRepairRequestsCached(cacheParams, responseData);

  if (!repairRequests || repairRequests.length === 0) {
    return res
      .status(200)
      .json(new ApiResponse(200, "No repair requests to show", responseData));
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, "Repair requests fetched successfully", responseData),
    );
});

const getRequestById = asyncHandler(async (req, res) => {
  const { requestId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(requestId)) {
    throw new ApiError(400, "Invalid request ID");
  }

  const cacheParams = { userId: req.user.id, requestId };
  const cachedData = await getUserRepairRequestByIdCached(cacheParams);
  if (cachedData) {
    return res
      .status(200)
      .json(
        new ApiResponse(200, "Repair details fetched successfully", cachedData),
      );
  }

  const repairRequest = await repairRequestModel
    .findOne({
      _id: requestId,
      user: req.user.id,
    })
    .populate({
      path: "repairPartner",
      select: "name phoneNumber",
    })
    .select(
      "requestNumber serviceType description damageImages pickupLocation customerPhone deviceCompany modelName estimatedPrice adminRemarks requestStatus repairPartner createdAt updatedAt",
    );

  if (!repairRequest) {
    throw new ApiError(404, "Repair request not found");
  }

  await setUserRepairRequestByIdCached(cacheParams, repairRequest);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        "Repair details fetched successfully",
        repairRequest,
      ),
    );
});

const customerDecision = asyncHandler(async (req, res) => {
  const { requestId } = req.params;
  const { requestStatus } = req.body;
  if (!mongoose.Types.ObjectId.isValid(requestId)) {
    throw new ApiError(400, "Invalid request ID");
  }
  const allowedStatus = ["ACCEPTED", "REJECTED"];
  if (!allowedStatus.includes(requestStatus)) {
    throw new ApiError(400, "Invalid request status");
  }

  const repairRequest = await repairRequestModel.findOne({
    _id: requestId,
    user: req.user.id,
  });

  if (!repairRequest) {
    throw new ApiError(404, "Repair request not found");
  }
  if (repairRequest.requestStatus !== "PRICE_SENT") {
    throw new ApiError(
      409,
      "Request status can only be updated if the PRICE has been sent by the admin",
    );
  }

  repairRequest.requestStatus = requestStatus;
  repairRequest.acceptedAt = new Date();
  await repairRequest.save();

  await Promise.all([
    deleteUserRepairRequestsCached(req.user.id),
    deleteUserRepairRequestByIdCached({ userId: req.user.id, requestId }),
  ]);

  try {
    const admins = await userModel.find({ role: "admin" }).select("email username");
    const adminEmailJobs = admins
      .filter((admin) => admin.email)
      .map((admin) =>
        emailServices.queueAdminRepairPriceDecisionEmail({
          to: admin.email,
          subject: `Repair estimate ${requestStatus.toLowerCase()} by customer`,
          text: generateAdminRepairPriceDecisionText({
            requestNumber: repairRequest.requestNumber,
            requestStatus,
            customerPhone: repairRequest.customerPhone,
          }),
          repairPriceDecisionHtml: generateAdminRepairPriceDecisionHTML({
            adminName: admin.username,
            requestNumber: repairRequest.requestNumber,
            requestStatus,
            customerPhone: repairRequest.customerPhone,
          }),
        }),
      );

    await Promise.all(adminEmailJobs);
  } catch (error) {
    console.error(
      "Failed to queue admin emails for repair request decision:",
      error.message,
    );
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        "Request status updated successfully",
        repairRequest.requestStatus,
      ),
    );
});

export default {
  createRepairRequest,
  getAllRepairRequests,
  getRequestById,
  customerDecision,
};
