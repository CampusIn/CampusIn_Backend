import mongoose from "mongoose";

const winnerSchema = new mongoose.Schema(
  {
    entry: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LuckyDrawEntry",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    name: {
      type: String,
      required: [true, "Winner name is required"],
      trim: true,
    },
    mobileNumber: {
      type: String,
      required: [true, "Winner mobile number is required"],
      trim: true,
    },
    wonAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

const luckyDrawSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Lucky draw title is required"],
      trim: true,
      default: "Campus Lucky Draw",
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    submissionDeadline: {
      type: Date,
      required: [true, "Submission deadline is required"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "CLOSED", "COMPLETED"],
      default: "ACTIVE",
    },
    numberOfWinners: {
      type: Number,
      required: true,
      default: 1,
      min: [1, "Number of winners must be at least 1"],
    },
    isOver: {
      type: Boolean,
      default: false,
    },
    drawnAt: {
      type: Date,
      default: null,
    },
    drawnBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    winners: {
      type: [winnerSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

const luckyDrawModel = mongoose.model("LuckyDraw", luckyDrawSchema);

export default luckyDrawModel;
