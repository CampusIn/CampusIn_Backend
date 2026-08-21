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

const AllowedTypes = ["PERCENTAGE", "FIXED"];
const allowedScopeTypes = ["ALL", "FOOD", "MARKETPLACE_CATEGORY"];
const couponValidationRules = [
  body("code").trim().toUpperCase().notEmpty().withMessage("Code is required"),

  body("discountType")
    .notEmpty()
    .withMessage("Discount type is required")
    .isIn(AllowedTypes)
    .withMessage("Invalid discount type"),

  body("discountValue")
    .isInt({ min: 1 })
    .withMessage("Minimum discount value is 1"),

  body("minimumOrderValue")
    .isInt({ min: 0 })
    .withMessage("Minimum order value cannot be negative"),

  body("maximumDiscount")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Maximum discount value cannot be negative"),

  body("expiryDate")
    .notEmpty()
    .withMessage("Expiry date is required")
    .isISO8601()
    .withMessage("Invalid expiry date"),

  body("usageLimit").isInt({ min: 1 }).withMessage("Minimum usage limit is 1"),

  body("scopeType")
    .optional()
    .isIn(allowedScopeTypes)
    .withMessage("Invalid coupon scope type"),

  body("marketplaceCategory")
    .optional({ nullable: true })
    .isMongoId()
    .withMessage("Marketplace category ID is invalid"),
  validateResult,
];

export default couponValidationRules;
