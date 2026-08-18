import { body, validationResult } from "express-validator";
import ApiError from "../utils/apiErrors.js";

const validateResult = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }

  const extractedErrors = errors.array().map((err) => ({
    field: err.path,
    message: err.msg,
  }));

  throw new ApiError(400, "Validation failed", extractedErrors);
};

const allowedTypes = ["MOBILE", "LAPTOP", "COOLERS", "OTHERS"];
const allowedStatuses = [
  "SUBMITTED",
  "PRICE_SENT",
  "ACCEPTED",
  "REJECTED",
  "FORWARDED",
  "COMPLETED",
];

const createRepairRequestRules = [
  body("user")
    .optional()
    .isMongoId()
    .withMessage("User must be a valid MongoDB ObjectId"),

  body("customerPhone")
    .trim()
    .notEmpty()
    .withMessage("Customer phone number cannot be empty")
    .isMobilePhone("en-IN")
    .withMessage("The phone number provided should be an Indian number"),

  body("pickupLocation")
    .trim()
    .notEmpty()
    .withMessage("Pickup location cannot be empty"),

  body("deviceCompany")
    .trim()
    .notEmpty()
    .withMessage("Device company cannot be empty"),

  body("modelName").trim().notEmpty().withMessage("Model name cannot be empty"),

  body("serviceType")
    .notEmpty()
    .withMessage("Service type cannot be empty")
    .isIn(allowedTypes)
    .withMessage(
      "Service type should be one of MOBILE, LAPTOP, COOLERS, OTHERS",
    ),

  body("description")
    .trim()
    .notEmpty()
    .withMessage("Description cannot be empty"),

  body("estimatedPrice")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Estimated price should be a positive number"),

  body("adminRemarks").optional().trim(),

  body("requestStatus")
    .optional()
    .isIn(allowedStatuses)
    .withMessage("Request status is invalid"),

  body("repairPartner")
    .optional()
    .isMongoId()
    .withMessage("Repair partner must be a valid MongoDB ObjectId"),

  validateResult,
];

const updateRepairRequestRules = [
  body("user")
    .optional()
    .isMongoId()
    .withMessage("User must be a valid MongoDB ObjectId"),

  body("customerPhone")
    .optional()
    .trim()
    .isMobilePhone("en-IN")
    .withMessage("The phone number provided should be an Indian number"),

  body("pickupLocation")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Pickup location cannot be empty"),

  body("deviceCompany")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Device company cannot be empty"),

  body("modelName")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Model name cannot be empty"),

  body("serviceType")
    .optional()
    .isIn(allowedTypes)
    .withMessage(
      "Service type should be one of MOBILE, LAPTOP, COOLERS, OTHERS",
    ),

  body("description")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Description cannot be empty"),

  body("estimatedPrice")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Estimated price should be a positive number"),

  body("adminRemarks").optional().trim(),

  body("estimatedAt")
    .optional()
    .isISO8601()
    .withMessage("EstimatedAt must be a valid date"),

  body("requestStatus")
    .optional()
    .isIn(allowedStatuses)
    .withMessage("Request status is invalid"),

  body("acceptedAt")
    .optional()
    .isISO8601()
    .withMessage("AcceptedAt must be a valid date"),

  body("repairPartner")
    .optional()
    .isMongoId()
    .withMessage("Repair partner must be a valid MongoDB ObjectId"),

  body("forwardedAt")
    .optional()
    .isISO8601()
    .withMessage("ForwardedAt must be a valid date"),

  body("requestNumber")
    .optional()
    .notEmpty()
    .withMessage("Request number cannot be empty"),

  body("completedAt")
    .optional()
    .isISO8601()
    .withMessage("CompletedAt must be a valid date"),

  validateResult,
];

const estimateRepairRequestRules = [
  body("estimatedPrice")
    .notEmpty()
    .withMessage("Estimated price is required")
    .isFloat({ min: 0 })
    .withMessage("Estimated price should be a positive number"),

  body("adminRemarks").optional().trim(),

  validateResult,
];

const assignRepairPartnerRules = [
  body("repairPartner")
    .notEmpty()
    .withMessage("Repair partner is required")
    .isMongoId()
    .withMessage("Repair partner must be a valid MongoDB ObjectId"),

  validateResult,
];

const completeRepairRequestRules = [
  body("adminRemarks").optional().trim(),

  validateResult,
];

export {
  createRepairRequestRules,
  updateRepairRequestRules,
  estimateRepairRequestRules,
  assignRepairPartnerRules,
  completeRepairRequestRules,
};
