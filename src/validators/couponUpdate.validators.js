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

const allowedTypes = ["PERCENTAGE", "FIXED"];
const allowedScopeTypes = ["ALL", "FOOD", "MARKETPLACE_CATEGORY"];
const couponUpdateValidationRules = [
  body("code")
    .optional()
    .trim()
    .toUpperCase()
    .notEmpty()
    .withMessage("Coupon code cannot be empty"),

  body("discountType")
    .optional()
    .isIn(allowedTypes)
    .withMessage("Invalid discount type"),

  body("discountValue")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Discount value must be greater than 0"),

  body("minimumOrderValue")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Minimum order value cannot be negative"),

  body("maximumDiscount")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Maximum discount value cannot be negative"),

  body("expiryDate").optional().isISO8601().withMessage("Must be a valid date"),

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

export default couponUpdateValidationRules;
