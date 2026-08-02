import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/apiErrors.js";
import ApiResponse from "../utils/apiResponse.js";
import mongoose from "mongoose";
import marketCartModel from "../models/marketPlaceCart.models.js";
import marketPlaceProductsModel from "../models/marketPlaceProducts.models.js";
import marketPlaceOrderModel from "../models/marketPlaceOrders.models.js";
import marketPlaceCategoryModel from "../models/marketPlaceCategory.models.js";
import platformSettingsModel from "../models/platformSettings.models.js";
import couponModel from "../models/coupon.models.js";
import couponUsageModel from "../models/couponUsage.models.js";
import generateOrderNumber from "../utils/orderNumber.utils.js";
import userModel from "../models/user.models.js";
import emailServices from "../services/emailQueue.services.js";
import { generateAdminMarketplaceOrderHTML } from "../utils/utils.js";

const allowedPaymentMethods = ["COD", "PAY_ON_PICKUP"];

const validateMarketCartItems = (cartItems) => {
  cartItems.forEach((item) => {
    if (!item.product) {
      throw new ApiError(400, "One or more items no longer exists");
    }

    if (!item.product.isActive) {
      throw new ApiError(400, `${item.product.name} is currently unavailable`);
    }

    if (item.quantity > item.product.stock) {
      throw new ApiError(
        400,
        `Only ${item.product.stock} item(s) of ${item.product.name} are currently available`,
      );
    }
  });
};

const reserveMarketOrderStock = async (orderItems, session) => {
  for (const item of orderItems) {
    const updatedProduct = await marketPlaceProductsModel.findOneAndUpdate(
      {
        _id: item.product,
        isActive: true,
        stock: { $gte: item.quantity },
      },
      {
        $inc: {
          stock: -item.quantity,
        },
      },
      {
        returnDocument: "after",
        session,
      },
    );

    if (!updatedProduct) {
      throw new ApiError(
        409,
        `Insufficient stock for ${item.productName}. Please update your cart and try again.`,
      );
    }
  }
};

const restoreMarketOrderStock = async (orderItems, session) => {
  for (const item of orderItems) {
    await marketPlaceProductsModel.updateOne(
      {
        _id: item.product,
      },
      {
        $inc: {
          stock: item.quantity,
        },
      },
      { session },
    );
  }
};

const calculateCouponDiscount = async (couponId, userId, subTotal) => {
  if (!couponId) {
    return {
      coupon: null,
      couponDiscount: 0,
    };
  }

  if (!mongoose.Types.ObjectId.isValid(couponId)) {
    throw new ApiError(400, "Invalid Coupon ID");
  }

  const todayDate = new Date();
  const coupon = await couponModel.findOne({
    _id: couponId,
    isActive: true,
    expiryDate: { $gte: todayDate },
  });

  if (!coupon) {
    throw new ApiError(400, "Invalid coupon");
  }

  const alreadyUsed = await couponUsageModel.findOne({
    coupon: coupon._id,
    user: userId,
  });

  if (alreadyUsed) {
    throw new ApiError(400, "You have already used this coupon");
  }

  if (coupon.usageLimit <= coupon.usageCount) {
    throw new ApiError(400, "Coupon usage limit is over");
  }

  if (subTotal < coupon.minimumOrderValue) {
    throw new ApiError(
      400,
      "Total cart amount is lower than minimum order value for the coupon",
    );
  }

  let discount = 0;

  if (coupon.discountType === "PERCENTAGE") {
    discount = Math.round((subTotal * coupon.discountValue) / 100);
    if (discount > coupon.maximumDiscount) {
      discount = coupon.maximumDiscount;
    }
  } else if (coupon.discountType === "FIXED") {
    discount = coupon.discountValue;
  }

  return {
    coupon,
    couponDiscount: Math.min(discount, subTotal),
  };
};

const redeemCouponForMarketOrder = async (coupon, userId, orderId, session) => {
  if (!coupon) {
    return
  }

  try {
    await couponUsageModel.create(
      [
        {
          coupon: coupon._id,
          user: userId,
          order: orderId,
        },
      ],
      { session },
    );
  } catch (error) {
    if (error.code === 11000) {
      throw new ApiError(400, "You have already used this coupon");
    }

    throw error;
  }

  const updatedCoupon = await couponModel.findOneAndUpdate(
    {
      _id: coupon._id,
      usageCount: { $lt: coupon.usageLimit },
    },
    {
      $inc: {
        usageCount: 1,
      },
    },
    {
      session,
      new: true,
    },
  );

  if (!updatedCoupon) {
    throw new ApiError(400, "Coupon usage limit is over");
  }
};

const createMarketPlaceOrder = asyncHandler(async (req, res) => {
  const { paymentMethod, customerPhone, deliveryAddress, couponId } = req.body;

  if (!allowedPaymentMethods.includes(paymentMethod)) {
    throw new ApiError(400, "Choose a payment method");
  }

  if (!customerPhone?.trim()) {
    throw new ApiError(400, "Customer phone is required");
  }

  if (!deliveryAddress?.trim()) {
    throw new ApiError(400, "Delivery address is required");
  }

  const cart = await marketCartModel
    .findOne({
      user: req.user.id,
    })
    .populate({
      path: "items.product",
      select: "name price images stock isActive category",
    });

  if (!cart || cart.items.length === 0) {
    throw new ApiError(400, "Cart is empty");
  }

  validateMarketCartItems(cart.items);

  const category = await marketPlaceCategoryModel.findOne({
    _id: cart.category,
    isActive: true,
  });

  if (!category) {
    throw new ApiError(404, "Category not found");
  }

  const orderItems = cart.items.map((item) => ({
    product: item.product._id,
    productName: item.product.name,
    productImage: item.product.images?.[0],
    priceAtPurchase: item.product.price,
    quantity: item.quantity,
  }));

  if (orderItems.some((item) => !item.productImage)) {
    throw new ApiError(400, "One or more products does not have an image");
  }

  const subTotal = orderItems.reduce((total, item) => {
    return total + item.priceAtPurchase * item.quantity;
  }, 0);

  const platformSettings = await platformSettingsModel.findOne();
  if (!platformSettings) {
    throw new ApiError(404, "Platform settings not found");
  }

  if (subTotal < platformSettings.minimumOrderValue) {
    throw new ApiError(
      400,
      `Minimum order value is ${platformSettings.minimumOrderValue}`,
    );
  }

  const { coupon, couponDiscount } = await calculateCouponDiscount(
    couponId,
    req.user.id,
    subTotal,
  );
  const pricingBase = subTotal - couponDiscount;
  const gstPercentage = platformSettings.gstPercentage;
  const gstAmount = Math.round((pricingBase * gstPercentage) / 100);
  const deliveryCharge =
    pricingBase >= platformSettings.freeDeliveryAbove
      ? 0
      : platformSettings.deliveryCharge;
  const packagingCharge = platformSettings.packagingCharge;
  const platformCharge = platformSettings.platformCharge || 0;
  const finalAmount =
    pricingBase + gstAmount + deliveryCharge + packagingCharge + platformCharge;

  const session = await mongoose.startSession();
  let order;

  try {
    session.startTransaction();

    await reserveMarketOrderStock(orderItems, session);

    [order] = await marketPlaceOrderModel.create(
      [
        {
          user: req.user.id,
          category: category._id,
          categoryName: category.name,
          items: orderItems,
          pricing: {
            subTotal,
            gstPercentage,
            gstAmount,
            deliveryCharge,
            packagingCharge,
            platformCharge,
            couponDiscount,
            finalAmount,
          },
          deliveryAddressSnapShot: deliveryAddress,
          customerPhone,
          paymentMethod,
          orderNumber: generateOrderNumber(),
        },
      ],
      { session },
    );

    await redeemCouponForMarketOrder(coupon, req.user.id, order._id, session);

    await marketCartModel.findOneAndDelete({ user: req.user.id }, { session });
    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }

  try {
    const admins = await userModel.find({ role: "admin" }).select("email username");

    const adminEmailJobs = admins
      .filter((admin) => admin.email)
      .map((admin) =>
        emailServices.queueAdminMarketplaceOrderEmail({
          to: admin.email,
          subject: `New marketplace order ${order.orderNumber}`,
          text: `A new marketplace order ${order.orderNumber} has been placed on CampusIn. Login to view details.`,
          adminMarketplaceOrderHtml: generateAdminMarketplaceOrderHTML({
            adminName: admin.username,
            orderNumber: order.orderNumber,
            categoryName: order.categoryName,
            customerPhone: order.customerPhone,
            finalAmount: order.pricing.finalAmount,
          }),
        }),
      );

    await Promise.all(adminEmailJobs);
  } catch (error) {
    console.error(
      "Failed to queue marketplace new-order admin emails:",
      error.message,
    );
  }

  return res.status(201).json(
    new ApiResponse(201, "Marketplace order created successfully", {
      applied: Boolean(coupon),
      order,
    }),
  );
});

const getAllMarketPlaceOrders = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const pageNumber = parseInt(page) || 1;
  const limitNumber = parseInt(limit) || 10;
  if (pageNumber < 1 || limitNumber < 1) {
    throw new ApiError(404, "Invalid page number or limit number");
  }

  const skip = (pageNumber - 1) * limitNumber;
  const totalOrders = await marketPlaceOrderModel.countDocuments({
    user: req.user.id,
  });

  if (totalOrders === 0) {
    return res.status(200).json(
      new ApiResponse(200, "No order found", {
        orders: [],
      }),
    );
  }

  const orders = await marketPlaceOrderModel
    .find(
      { user: req.user.id },
      "orderNumber categoryName pricing.finalAmount orderStatus createdAt rejectionMsg",
    )
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limitNumber);

  const totalPages = Math.ceil(totalOrders / limitNumber);
  if (orders.length === 0) {
    return res.status(200).json(
      new ApiResponse(200, "No order found", {
        orders: [],
        pagination: {
          page: pageNumber,
          limit: limitNumber,
          totalOrders,
          totalPages,
        },
      }),
    );
  }

  return res.status(200).json(
    new ApiResponse(200, "Marketplace order history fetched successfuly", {
      orders,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        totalOrders,
        totalPages,
      },
    }),
  );
});

const getSingleMarketPlaceOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    throw new ApiError(400, "Inavlid order Id");
  }

  const order = await marketPlaceOrderModel
    .findById(orderId)
    .select(
      "user orderNumber category categoryName items pricing deliveryAddressSnapShot customerPhone paymentMethod paymentStatus orderStatus createdAt rejectionMsg",
    )
    .populate([
      {
        path: "items.product",
        select: "name description price images condition stock category",
      },
      {
        path: "category",
        select: "name description image",
      },
    ]);

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  if (order.user.toString() !== req.user.id) {
    throw new ApiError(403, "Forbidden");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        "Marketplace order details fetched successfuly",
        order,
      ),
    );
});

const cancelMarketPlaceOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    throw new ApiError(400, "Invalid Order");
  }

  const order = await marketPlaceOrderModel.findById(orderId);
  if (!order) {
    throw new ApiError(404, "Order does not exist");
  }

  if (order.user.toString() !== req.user.id) {
    throw new ApiError(403, " Forbidden");
  }

  if (order.orderStatus !== "PENDING") {
    throw new ApiError(409, "Only pending orders can be cancelled");
  }

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    await restoreMarketOrderStock(order.items, session);
    order.orderStatus = "CANCELLED";
    await order.save({ session });

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }

  return res
    .status(200)
    .json(new ApiResponse(200, "Order has been cancelled", order));
});

export default {
  createMarketPlaceOrder,
  getAllMarketPlaceOrders,
  getSingleMarketPlaceOrder,
  cancelMarketPlaceOrder,
};
