import mongoose from "mongoose";

const printingPricingSchema = new mongoose.Schema(
  {
    bwPerPage: {
      type: Number,
      required: true,
      min: 0,
      default: 2,
    },
    colorPerPage: {
      type: Number,
      required: true,
      min: 0,
      default: 5,
    },
    duplexMultiplier: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
      default: 1,
    },
  },
  { _id: false },
);

const printingLimitsSchema = new mongoose.Schema(
  {
    maxFilesPerOrder: {
      type: Number,
      required: true,
      min: 1,
      max: 30,
      default: 10,
    },
    maxFileSizeBytes: {
      type: Number,
      required: true,
      min: 1024,
      default: 15 * 1024 * 1024,
    },
    maxTotalSizeBytes: {
      type: Number,
      required: true,
      min: 1024,
      default: 60 * 1024 * 1024,
    },
    maxPagesPerOrder: {
      type: Number,
      required: true,
      min: 1,
      default: 300,
    },
    maxCopies: {
      type: Number,
      required: true,
      min: 1,
      default: 20,
    },
    uploadTtlHours: {
      type: Number,
      required: true,
      min: 1,
      default: 24,
    },
    fileRetentionDays: {
      type: Number,
      required: true,
      min: 1,
      default: 14,
    },
  },
  { _id: false },
);

const printingConfigSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: "default",
    },
    pricing: {
      type: printingPricingSchema,
      required: true,
      default: () => ({}),
    },
    limits: {
      type: printingLimitsSchema,
      required: true,
      default: () => ({}),
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

const printingConfigModel = mongoose.model("PrintingConfig", printingConfigSchema);

export default printingConfigModel;
