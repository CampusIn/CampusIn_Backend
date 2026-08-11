import { body, param, query, validationResult } from "express-validator";
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

const createPrintingOrderRules = [
  body("uploadIds")
    .isArray({ min: 1 })
    .withMessage("uploadIds must be a non-empty array"),
  body("uploadIds.*")
    .isMongoId()
    .withMessage("Each uploadId must be a valid ID"),
  body("printingOptions.copies")
    .isInt({ min: 1 })
    .withMessage("copies must be at least 1"),
  body("printingOptions.colorMode")
    .isIn(["BW", "COLOR"])
    .withMessage("colorMode must be BW or COLOR"),
  body("printingOptions.orientation")
    .isIn(["PORTRAIT", "LANDSCAPE"])
    .withMessage("orientation must be PORTRAIT or LANDSCAPE"),
  body("printingOptions.duplex")
    .optional()
    .isIn(["SINGLE", "DOUBLE"])
    .withMessage("duplex must be SINGLE or DOUBLE"),
  body("contactMobile")
    .trim()
    .notEmpty()
    .withMessage("contactMobile is required")
    .isMobilePhone("en-IN")
    .withMessage("contactMobile must be a valid Indian mobile number"),
  body("paymentMethod")
    .optional()
    .isIn(["COD"])
    .withMessage("Only COD is supported"),
  validateResult,
];

const updatePrintingOrderStatusRules = [
  body("orderStatus")
    .isIn([
      "PENDING",
      "CONFIRMED",
      "PRINTING",
      "READY_FOR_PICKUP",
      "COMPLETED",
      "CANCELLED",
      "REJECTED",
    ])
    .withMessage("Invalid orderStatus"),
  body("rejectionMsg")
    .optional()
    .isString()
    .withMessage("rejectionMsg must be a string"),
  validateResult,
];

const updatePrintingOrderNotesRules = [
  body("adminNotes")
    .optional({ values: "falsy" })
    .isString()
    .withMessage("adminNotes must be a string")
    .isLength({ max: 1500 })
    .withMessage("adminNotes must be under 1500 characters"),
  validateResult,
];

const updatePrintingPaymentStatusRules = [
  body("paymentStatus")
    .isIn(["PENDING", "PAID"])
    .withMessage("paymentStatus must be PENDING or PAID"),
  validateResult,
];

const printingOrderIdParamRules = [
  param("orderId").isMongoId().withMessage("Invalid order ID"),
  validateResult,
];

const printingUploadIdParamRules = [
  param("uploadId").isMongoId().withMessage("Invalid upload ID"),
  validateResult,
];

const printingUploadSessionIdParamRules = [
  param("uploadSessionId").isMongoId().withMessage("Invalid upload session ID"),
  validateResult,
];

const printingFileAccessParamRules = [
  param("orderId").isMongoId().withMessage("Invalid order ID"),
  param("fileId").isMongoId().withMessage("Invalid file ID"),
  validateResult,
];

const printingListQueryRules = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("page must be at least 1"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("limit must be between 1 and 100"),
  query("status")
    .optional()
    .isIn([
      "PENDING",
      "CONFIRMED",
      "PRINTING",
      "READY_FOR_PICKUP",
      "COMPLETED",
      "CANCELLED",
      "REJECTED",
    ])
    .withMessage("Invalid status filter"),
  validateResult,
];

const updatePrintingConfigRules = [
  body("pricing.bwPerPage")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("pricing.bwPerPage must be >= 0"),
  body("pricing.colorPerPage")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("pricing.colorPerPage must be >= 0"),
  body("pricing.duplexMultiplier")
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage("pricing.duplexMultiplier must be between 0 and 1"),
  body("limits.maxFilesPerOrder")
    .optional()
    .isInt({ min: 1, max: 30 })
    .withMessage("limits.maxFilesPerOrder must be between 1 and 30"),
  body("limits.maxFileSizeBytes")
    .optional()
    .isInt({ min: 1024 })
    .withMessage("limits.maxFileSizeBytes must be >= 1024"),
  body("limits.maxTotalSizeBytes")
    .optional()
    .isInt({ min: 1024 })
    .withMessage("limits.maxTotalSizeBytes must be >= 1024"),
  body("limits.maxPagesPerOrder")
    .optional()
    .isInt({ min: 1 })
    .withMessage("limits.maxPagesPerOrder must be >= 1"),
  body("limits.maxCopies")
    .optional()
    .isInt({ min: 1 })
    .withMessage("limits.maxCopies must be >= 1"),
  body("limits.uploadTtlHours")
    .optional()
    .isInt({ min: 1 })
    .withMessage("limits.uploadTtlHours must be >= 1"),
  body("limits.fileRetentionDays")
    .optional()
    .isInt({ min: 1 })
    .withMessage("limits.fileRetentionDays must be >= 1"),
  validateResult,
];

export {
  createPrintingOrderRules,
  updatePrintingOrderStatusRules,
  updatePrintingOrderNotesRules,
  updatePrintingPaymentStatusRules,
  printingOrderIdParamRules,
  printingUploadIdParamRules,
  printingUploadSessionIdParamRules,
  printingFileAccessParamRules,
  printingListQueryRules,
  updatePrintingConfigRules,
};
