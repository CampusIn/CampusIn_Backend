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
      required: true,
      unique: true,
    },
    resourceType: {
      type: String,
      required: true,
      enum: ["image", "raw"],
    },
    pageCount: {
      type: Number,
      required: true,
      min: 1,
    },
    checksumSha256: {
      type: String,
      required: true,
      trim: true,
    },
    uploadStatus: {
      type: String,
      enum: ["UPLOADED", "ATTACHED", "EXPIRED", "DELETED"],
      default: "UPLOADED",
      index: true,
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

const printingUploadModel = mongoose.model("PrintingUpload", printingUploadSchema);

export default printingUploadModel;
