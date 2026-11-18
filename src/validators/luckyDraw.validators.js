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

const enableLuckyDrawValidationRules = [
  body("submissionDeadline")
    .notEmpty()
    .withMessage("Submission deadline is required")
    .custom((value) => {
      const deadline = new Date(value);
      if (Number.isNaN(deadline.getTime())) {
        throw new Error("Submission deadline must be a valid date");
      }
      if (deadline.getTime() <= Date.now()) {
        throw new Error("Submission deadline must be in the future");
      }
      return true;
    }),
  body("title")
    .optional()
    .trim()
    .isLength({ min: 1, max: 150 })
    .withMessage("Title must be between 1 and 150 characters"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description cannot exceed 500 characters"),
  body("numberOfWinners")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Number of winners must be at least 1"),
  validateResult,
];

const submitEntryValidationRules = [
  body("name")
    .custom((value, { req }) => {
      const nameVal = value ?? req.body?.userName;
      if (!nameVal || typeof nameVal !== "string" || !nameVal.trim()) {
        throw new Error("User name is required");
      }
      if (nameVal.trim().length < 2 || nameVal.trim().length > 100) {
        throw new Error("User name must be between 2 and 100 characters");
      }
      return true;
    }),
  body("mobileNumber")
    .custom((value, { req }) => {
      const mobileVal = value ?? req.body?.phone ?? req.body?.phoneNumber;
      if (!mobileVal || typeof mobileVal !== "string" || !mobileVal.trim()) {
        throw new Error("Mobile number is required");
      }
      const cleanMobile = mobileVal.trim().replace(/[\s\-()]/g, "");
      const phoneRegex = /^\+?[0-9]{10,15}$/;
      if (!phoneRegex.test(cleanMobile)) {
        throw new Error(
          "Invalid mobile number format. Please provide a valid 10-15 digit phone number",
        );
      }
      return true;
    }),
  validateResult,
];

const drawValidationRules = [
  body("winnerCount")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Winner count must be at least 1"),
  body("luckyDrawId")
    .optional()
    .isMongoId()
    .withMessage("Invalid lucky draw ID format"),
  validateResult,
];

const updateDeadlineValidationRules = [
  body("submissionDeadline")
    .notEmpty()
    .withMessage("Submission deadline is required")
    .custom((value) => {
      const deadline = new Date(value);
      if (Number.isNaN(deadline.getTime())) {
        throw new Error("Submission deadline must be a valid date");
      }
      if (deadline.getTime() <= Date.now()) {
        throw new Error("Submission deadline must be in the future");
      }
      return true;
    }),
  validateResult,
];

export {
  enableLuckyDrawValidationRules,
  submitEntryValidationRules,
  drawValidationRules,
  updateDeadlineValidationRules,
};
