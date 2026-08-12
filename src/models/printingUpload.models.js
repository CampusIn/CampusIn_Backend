import mongoose from "mongoose";

const printingUploadSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    originalName: {
      type: String,
      required: true,
      trim: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    extension: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    sizeBytes: {
      type: Number,
      required: true,
      min: 1,
    },
    storageProvider: {
      type: String,
      required: true,
      enum: ["cloudinary"],
      default: "cloudinary",
    },
    storageKey: {
      type: String,
      required: false,
      default: undefined,
    },
    resourceType: {
      type: String,
      required: false,
      enum: ["image", "raw"],
      default: null,
    },
    pageCount: {
      type: Number,
      required: false,
      min: 1,
      default: null,
    },
    checksumSha256: {
      type: String,
      required: false,
      trim: true,
      default: null,
    },
    uploadStatus: {
      type: String,
      enum: ["QUEUED", "PROCESSING", "UPLOADED", "FAILED", "ATTACHED", "DELETED"],
      default: "QUEUED",
      index: true,
    },
    uploadSessionId: {
      type: String,
      required: true,
      index: true,
    },
    queueJobId: {
      type: String,
      default: null,
      index: true,
    },
    stagingFileId: {
      type: String,
      default: null,
    },
    processingStartedAt: {
      type: Date,
      default: null,
    },
    processedAt: {
      type: Date,
      default: null,
    },
    failureReason: {
      type: String,
      default: null,
      trim: true,
    },
    printingOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PrintingOrder",
      default: null,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

printingUploadSchema.index(
  { storageKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      storageKey: { $type: "string" },
    },
  },
);

const printingUploadModel = mongoose.model("PrintingUpload", printingUploadSchema);

export default printingUploadModel;
