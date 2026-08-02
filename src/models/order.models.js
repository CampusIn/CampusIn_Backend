
import mongoose from "mongoose";

const cartSnapshotSchema = new mongoose.Schema(
  {
    menuItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Menu",
      required: true,
    },
    itemName: {
      type: String,
      required: [true, "Item name is required"],
    },
    priceAtPurchase: {
      type: Number,
      required: [true, "price at purchase is required"],
    },
    quantity: {
      type: Number,
      min: [1, "Atleast 1 item should be there to order"],
      required: [true, "Mention quantity"],
    },
    coupon: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Coupon",
    },

    couponCode: {
      type: String,
    },

    discountAmount: {
      type: Number,
      default: 0,
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

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User Id is required"],
    },
    restaurant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: [true, "Restaurant is required"],
    },
    restaurantName: {
      type: String,
      required: [true, "Restaurant name is required"],
    },
    items: [cartSnapshotSchema],
    totalAmount: {
      type: Number,
      min: [0, "minimum order amount should be 0"],
      required: [true, "Total amount is required"],
    },
    paymentMethod: {
      type: String,
      enum: ["COD", "PAY_ON_PICKUP"],
      required: [true, "Choose a payment method"],
    },
    paymentStatus: {
      type: String,
      enum: ["PENDING", "PAID"],
      default: "PENDING",
    },
    pricing: pricingSnapShotSchema,
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
        "REJECTED"
      ],
      default: "PENDING",
    },
    rejectionMsg:{
      type:String,
      default:null
    },
    orderNumber: {
      type: String,
      required: true,
      unique: true,
    },
    customerPhone: {
      type: String,
      trim: true,
    },
    deliveryAddress: {
      type: String,
      trim: true,
    },
    deliveryPartner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeliveryPartner",
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

const orderModel = mongoose.model("Order", orderSchema);

export default orderModel;
