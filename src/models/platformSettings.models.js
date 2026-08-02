import mongoose from "mongoose";

const platformSettingsSchema = new mongoose.Schema(
  {
    deliveryCharge: {
      type: Number,
      required: true,
      default: 15,
      min: [0, "Delivery charge cannot be negative"],
    },
    freeDeliveryAbove: {
      type: Number,
      required: true,
      default: 399,
      min: [0, "Free delivery amount cannot be negative"],
    },
    minimumOrderValue: {
      type: Number,
      required: true,
      default: 69,
      min: [0, "Minimum order value cannot be negative"],
    },
    gstPercentage: {
      type: Number,
      required: true,
      default: 0,
      min: [0, "GST cannot be negative"],
      max: [100, "GST cannot be more than 100"],
    },
    packagingCharge: {
      type: Number,
      required: true,
      default: 0,
      min: [0, "Packaging charges cannot be negative"],
    },
    platformCharge: {
      type: Number,
      required: true,
      default: 0,
      min: [0, "Platform charges cannot be negative"],
    },
    supportPhone: {
      type: String,
      trim: true,
      default: "",
    },
    supportEmail: {
      type: String,
      trim: true,
      default: "",
      lowercase: true,
    },
    maintainanceMode: {
      type: Boolean,
      default: false,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  },
);

const platformSettingsModel = mongoose.model(
  "PlatformSettings",
  platformSettingsSchema,
);

export default platformSettingsModel;
