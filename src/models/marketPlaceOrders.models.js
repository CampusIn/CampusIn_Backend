import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MarketPlaceProduct",
      required: true,
    },
    productName: {
      type: String,
      required: true,
    },
    productImage: {
      type: String,
      required: true,
    },
    priceAtPurchase: {
      type: Number,
      required: true,
    },
    quantity: {
      type: Number,
      min: [1, "Atleast one item should be there to place an order"],
      required: true,
    },
  },
  {
    _id: false,
  },
);

const pricingSnapShotSchema = new mongoose.Schema(
  {
    subTotal: {
      type: Number,
      required: true,
      min: 0,
    },
    gstPercentage: {
      type: Number,
      required: true,
      min: 0,
    },
    gstAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    deliveryCharge: {
      type: Number,
      required: true,
      min: 0,
    },
    packagingCharge: {
      type: Number,
      required: true,
      min: 0,
    },
    platformCharge: {
      type: Number,
      required: true,
      min: 0,
    },
    couponDiscount: {
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
  {
    _id: false,
  },
);

const pricingSettingsSnapshotSchema = new mongoose.Schema(
  {
    deliveryCharge: {
      type: Number,
      required: true,
      min: 0,
    },
    freeDeliveryAbove: {
      type: Number,
      required: true,
      min: 0,
    },
    minimumOrderValue: {
      type: Number,
      required: true,
      min: 0,
    },
    gstPercentage: {
      type: Number,
      required: true,
      min: 0,
    },
    packagingCharge: {
      type: Number,
      required: true,
      min: 0,
    },
    platformCharge: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    _id: false,
  },
);

const marketPlacOrderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MarketPlaceCategory",
      required: true,
    },
    categoryName: {
      type: String,
      required: true,
    },
    items: [orderItemSchema],

    pricing: pricingSnapShotSchema,
    pricingSettingsSnapshot: pricingSettingsSnapshotSchema,

    deliveryAddressSnapShot: {
      type: String,
      required: true,
      trim: true,
    },
    customerPhone: {
      type: String,
      trim: true,
      required: true,
    },

    paymentMethod: {
      type: String,
      enum: ["COD", "PAY_ON_PICKUP"],
      required: true,
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
        "PREPARING",
        "READY",
        "OUT_FOR_DELIVERY",
        "DELIVERED",
        "CANCELLED",
        "REJECTED",
      ],
      default: "PENDING",
    },

    rejectionMsg: {
      type: String,
      default: null,
      trim: true,
    },
    deliveryPartner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeliveryPartner",
      default: null,
    },
    orderNumber: {
      type: String,
      required: true,
      unique: true,
    },
  },
  {
    timestamps: true,
  },
);
marketPlacOrderSchema.index({
  user: 1,
  createdAt: -1,
});
marketPlacOrderSchema.index({
  orderStatus: 1,
});
marketPlacOrderSchema.index({
  deliveryPartner: 1,
  orderStatus: 1,
});
const marketPlaceOrderModel = mongoose.model(
  "MarketPlaceOrder",
  marketPlacOrderSchema,
);

export default marketPlaceOrderModel;
