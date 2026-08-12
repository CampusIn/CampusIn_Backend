import mongoose from "mongoose";

const printingOrderFileSchema = new mongoose.Schema(
  {
    uploadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PrintingUpload",
      required: true,
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
      trim: true,
      lowercase: true,
    },
    sizeBytes: {
      type: Number,
      required: true,
      min: 1,
    },
    storageProvider: {
      type: String,
      enum: ["cloudinary"],
      default: "cloudinary",
      required: true,
    },
    storageKey: {
      type: String,
      required: true,
    },
    resourceType: {
      type: String,
      enum: ["image", "raw"],
      required: true,
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
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    _id: true,
  },
);

const printingOptionsSchema = new mongoose.Schema(
  {
    copies: {
      type: Number,
      required: true,
      min: 1,
    },
    colorMode: {
      type: String,
      enum: ["BW", "COLOR"],
      required: true,
    },
    orientation: {
      type: String,
      enum: ["PORTRAIT", "LANDSCAPE"],
      required: true,
    },
    duplex: {
      type: String,
      enum: ["SINGLE", "DOUBLE"],
      default: "SINGLE",
    },
    paperSize: {
      type: String,
      enum: ["A4"],
      default: "A4",
    },
  },
  { _id: false },
);

const printingPricingSnapshotSchema = new mongoose.Schema(
  {
    currency: {
      type: String,
      default: "INR",
      required: true,
    },
    bwPerPage: {
      type: Number,
      required: true,
      min: 0,
    },
    colorPerPage: {
      type: Number,
      required: true,
      min: 0,
    },
    duplexMultiplier: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    finalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false },
);

const statusTimelineSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      required: true,
    },
    at: {
      type: Date,
      required: true,
      default: Date.now,
    },
    by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    note: {
      type: String,
      default: null,
    },
  },
  {
    _id: false,
  },
);

const printingOrderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    orderNumber: {
      type: String,
      required: true,
      unique: true,
    },
    contactMobile: {
      type: String,
      trim: true,
      required: [true, "Contact mobile number is required"],
    },
    deliveryAddress: {
      type: String,
      trim: true,
      required: [true, "Delivery address is required"],
    },
    files: {
      type: [printingOrderFileSchema],
      validate: {
        validator(value) {
          return Array.isArray(value) && value.length > 0;
        },
        message: "At least one file is required",
      },
    },
    printingOptions: {
      type: printingOptionsSchema,
      required: true,
    },
    pricingSnapshot: {
      type: printingPricingSnapshotSchema,
      required: true,
    },
    totals: {
      basePages: {
        type: Number,
        required: true,
        min: 1,
      },
      totalPagesToPrint: {
        type: Number,
        required: true,
        min: 1,
      },
    },
    paymentMethod: {
      type: String,
      enum: ["COD"],
      required: true,
      default: "COD",
    },
    paymentStatus: {
      type: String,
      enum: ["PENDING", "PAID"],
      default: "PENDING",
    },
    orderStatus: {
      type: String,
      enum: [
        "PENDING",
        "CONFIRMED",
        "PRINTING",
        "READY_FOR_PICKUP",
        "COMPLETED",
        "CANCELLED",
        "REJECTED",
      ],
      default: "PENDING",
      index: true,
    },
    adminNotes: {
      type: String,
      default: null,
      trim: true,
    },
    rejectionMsg: {
      type: String,
      default: null,
      trim: true,
    },
    statusTimeline: {
      type: [statusTimelineSchema],
      default: () => [{ status: "PENDING", at: new Date(), by: null, note: null }],
    },
    fileRetention: {
      deleteAfter: {
        type: Date,
        default: null,
      },
      deletedAt: {
        type: Date,
        default: null,
      },
    },
  },
  {
    timestamps: true,
  },
);

printingOrderSchema.index({ user: 1, createdAt: -1 });

const printingOrderModel = mongoose.model("PrintingOrder", printingOrderSchema);

export default printingOrderModel;
