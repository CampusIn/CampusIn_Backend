import mongoose from "mongoose";

const luckyDrawEntrySchema = new mongoose.Schema(
  {
    luckyDraw: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LuckyDraw",
      required: [true, "Lucky draw reference is required"],
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    mobileNumber: {
      type: String,
      required: [true, "Mobile number is required"],
      trim: true,
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

luckyDrawEntrySchema.index(
  { luckyDraw: 1, mobileNumber: 1 },
  { unique: true },
);

luckyDrawEntrySchema.index(
  { luckyDraw: 1, user: 1 },
  { unique: true, partialFilterExpression: { user: { $type: "objectId" } } },
);

const luckyDrawEntryModel = mongoose.model(
  "LuckyDrawEntry",
  luckyDrawEntrySchema,
);

export default luckyDrawEntryModel;
