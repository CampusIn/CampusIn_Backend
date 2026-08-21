import mongoose from "mongoose";

const luckyWheelSpinSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    eventId: {
      type: String,
      required: true,
      trim: true,
    },
    prizeId: {
      type: String,
      required: true,
      trim: true,
    },
    prizeLabel: {
      type: String,
      required: true,
      trim: true,
    },
    prizeType: {
      type: String,
      enum: ["none", "discount"],
      required: true,
    },
    coupon: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Coupon",
      default: null,
    },
    spunAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

luckyWheelSpinSchema.index(
  {
    user: 1,
    eventId: 1,
  },
  {
    unique: true,
  },
);

const luckyWheelSpinModel = mongoose.model("LuckyWheelSpin", luckyWheelSpinSchema);

export default luckyWheelSpinModel;
