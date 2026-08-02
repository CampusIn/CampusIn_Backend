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

const settingsValidatorsRules = [
  body("deliveryCharge")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Delivery charge cannot be negative"),

  body("minimumOrderValue")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Minimum order value cannot be negative"),

  body("gstPercentage")
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage("GST percentage should be between 0 and 100"),

  body("packagingCharge")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Packaging charges cannot be negative"),

  body("platformCharge")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Platform charges cannot be negative"),

  body("freeDeliveryAbove")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Free delivery amount cannot be negative "),
  validateResult,
];

export default settingsValidatorsRules;
