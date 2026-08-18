import mongoose from "mongoose";

const repairRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    customerPhone: {
      type: String,
      trim: true,
      required: [true, "Customer phone number is required"],
    },

    pickupLocation: {
      type: String,
      trim: true,
      required: [true, "Pickup location is required"],
    },

    deviceCompany: {
      type: String,
      trim: true,
      required: [true, "Device company is required"],
    },

    modelName: {
      type: String,
      trim: true,
      required: [true, "Model name is required"],
    },

    serviceType: {
      type: String,
      enum: ["MOBILE", "LAPTOP", "COOLERS", "OTHERS"],
      required: true,
    },
    description: {
      type: String,
      trim: true,
      required: true,
    },
    damageImages: {
      type: [String],
      default: [],
    },
    estimatedPrice: {
      type: Number,
      min: [0, "Estimated price should be a positive number"],
      default: null,
    },
    adminRemarks: {
      type: String,
      trim: true,
      default: null,
    },
    estimatedAt: {
      type: Date,
    },
    requestStatus: {
      type: String,
      enum: [
        "SUBMITTED",
        "PRICE_SENT",
        "ACCEPTED",
        "REJECTED",
        "FORWARDED",
        "COMPLETED",
      ],
      default: "SUBMITTED",
    },
    acceptedAt: {
      type: Date,
    },
    repairPartner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RepairPartner",
      default: null,
    },
    forwardedAt: {
      type: Date,
      default: null,
    },
    requestNumber: {
      type: String,
      required: true,
      unique: true,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

repairRequestSchema.index({
  requestStatus: 1,
});
repairRequestSchema.index({
  user: 1,
  createdAt: -1,
});

repairRequestSchema.index({
  repairPartner: 1,
  requestStatus: 1,
});

const repairRequestModel = mongoose.model("RepairRequest", repairRequestSchema);

export default repairRequestModel;
