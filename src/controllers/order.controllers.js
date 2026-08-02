import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/apiErrors.js";
import ApiResponse from "../utils/apiResponse.js";
import orderModel from "../models/order.models.js";
import cartModel from "../models/cart.models.js";
import userModel from "../models/user.models.js";
import restaurantModel from "../models/restaurant.models.js";
import generateOrderNumber from "../utils/orderNumber.utils.js";
import mongoose from "mongoose";
import couponModel from "../models/coupon.models.js";
import platformSettingsModel from "../models/platformSettings.models.js";
import couponUsageModel from "../models/couponUsage.models.js";
import menuModel from "../models/menuItem.models.js";
import emailServices from "../services/emailQueue.services.js";
import { generateVendorNewOrderHTML } from "../utils/utils.js";
import { platformSettingsCached,setPlatformSettingsCached,deletePlatformSettingsCached } from "../services/platformSettingsCached.services.js";
import { getCouponCached, setCouponCached, deleteCouponCached } from "../services/couponCached.services.js";


const validateCartItems = (cartItems) => {
  cartItems.forEach((item) => {
    if (!item.menuItem) {
      throw new ApiError(400, "One or more items no longer exists");
    }
    if (!item.menuItem.isAvailable) {
      throw new ApiError(400, "One or more items are not available");
    }
    if (item.quantity > item.menuItem.stockQty) {
      throw new ApiError(
        400,
        `Item ${item.menuItem.name} is out of stock. Available quantity: ${item.menuItem.stockQty}`,
      );
    }
  });
};

const reserveOrderStock = async (orderItems, session) => {
  for (const item of orderItems) {
    const updatedMenu = await menuModel.findOneAndUpdate(
      {
        _id: item.menuItem,
        isDeleted: false,
        isAvailable: true,
        stockQty: { $gte: item.quantity },
      },
      {
        $inc: {
          stockQty: -item.quantity,
        },
      },
      {
        returnDocument: 'after',
        session,
      },
    );

    if (!updatedMenu) {
      throw new ApiError(
        409,
        `Insufficient stock for ${item.itemName}. Please update your cart and try again.`,
      );
    }

    if (updatedMenu.stockQty === 0) {
      updatedMenu.isAvailable = false;
      await updatedMenu.save({ session });
    }
  }
};

const restoreOrderStock = async (orderItems, session) => {
  for (const item of orderItems) {
    await menuModel.updateOne(
      {
        _id: item.menuItem,
      },
      {
        $inc: {
          stockQty: item.quantity,
        },
        $set: {
          isAvailable: true,
        },
      },
      { session },
    );
  }
};

//User order section Start
const createOrder = asyncHandler(async (req, res) => {
  const { paymentMethod, couponId, customerPhone, deliveryAddress } = req.body;
  if (paymentMethod !== "COD" && paymentMethod !== "PAY_ON_PICKUP") {
    throw new ApiError(400, "Choose a payment method");
  }

  const cart = await cartModel
    .findOne({
      user: req.user.id,
    })
    .populate({
      path: "items.menuItem",
    });

  if (!cart || cart.items.length === 0) {
    throw new ApiError(400, "Cart is empty");
  }

  validateCartItems(cart.items);

  const restaurantId = cart.restaurant;
  const restaurant = await restaurantModel.findById(restaurantId);
  if (!restaurant) {
    throw new ApiError(404, "No such restaurant exists");
  }
  const restaurantName = restaurant.restaurantName;

  const orderItems = cart.items.map((item) => {
    const menuItem = item.menuItem._id;
    const itemName = item.menuItem.name;
    const priceAtPurchase = item.menuItem.price;
    const quantity = item.quantity;
    return { menuItem, itemName, priceAtPurchase, quantity };
  });
  const subTotal = orderItems.reduce((total, item) => {
    const itemPrice = item.priceAtPurchase * item.quantity;
    return total + itemPrice;
  }, 0);

  let coupon = null;
  let couponDiscount = 0;
  let applied = false;
  let couponCode = null;
  let pricingBase = subTotal;

  //If coupon is valid, then coupon discount is calculated
  if (couponId) {
    if (!mongoose.Types.ObjectId.isValid(couponId)) {
      throw new ApiError(400, "Invalid Coupon ID");
    }
    const todayDate = new Date();
    coupon = await couponModel.findOne({
      _id: couponId,
      isActive: true,
      expiryDate: { $gte: todayDate },
    });

    if (!coupon) {
      throw new ApiError(404, "Coupon not found");
    }

    const alreadyUsed = await couponUsageModel.findOne({
      coupon: coupon._id,
      user: req.user.id,
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

    let discount;

    if (coupon.discountType === "PERCENTAGE") {
      discount = Math.round((subTotal * coupon.discountValue) / 100);
      if (discount > coupon.maximumDiscount) {
        discount = coupon.maximumDiscount;
      }
    } else if (coupon.discountType === "FIXED") {
      discount = coupon.discountValue;
    }
    couponDiscount = Math.min(discount, subTotal);
    pricingBase = subTotal - couponDiscount;
    applied = true;
    couponCode = coupon.code;
  }

  const platformSettings = await platformSettingsModel.findOne();
  if (!platformSettings) {
    throw new ApiError(404, "Platform settings not found");
  }

  const gstPercentage = platformSettings.gstPercentage;
  const gstAmount = Math.round((pricingBase * gstPercentage) / 100);
  let deliveryCharge = platformSettings.deliveryCharge;
  const packagingCharge = platformSettings.packagingCharge;
  const platformCharge = platformSettings.platformCharge || 0;
  const freeDeliveryAbove = platformSettings.freeDeliveryAbove;

  if (freeDeliveryAbove <= pricingBase) {
    deliveryCharge = 0;
  }

  const finalAmount =
    pricingBase + gstAmount + deliveryCharge + packagingCharge + platformCharge;

  const session = await mongoose.startSession();
  let order;

  try {
    session.startTransaction();

    await reserveOrderStock(orderItems, session);

    [order] = await orderModel.create(
      [
        {
          user: req.user.id,
          restaurant: restaurantId,
          restaurantName,
          items: orderItems,
          totalAmount: finalAmount,
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
          orderNumber: generateOrderNumber(),
          paymentMethod,
          coupon: couponId || undefined,
          couponCode,
          discountAmount: couponDiscount,
          customerPhone,
          deliveryAddress,
        },
      ],
      { session },
    );

    if (coupon) {
      await Promise.all([
        couponModel.findByIdAndUpdate(
          coupon._id,
          {
            $inc: {
              usageCount: 1,
            },
          },
          { session },
        ),
        couponUsageModel.create(
          [
            {
              coupon: coupon._id,
              user: req.user.id,
              order: order._id,
            },
          ],
          { session },
        ),
      ]);
    }

    await cartModel.findOneAndDelete({ user: req.user.id }, { session });
    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }

  try {
    const vendorUser = await userModel
      .findById(restaurant.owner)
      .select("email username");

    if (vendorUser?.email) {
      await emailServices.queueVendorNewOrderEmail({
        to: vendorUser.email,
        subject: `New order for ${restaurant.restaurantName}`,
        text: `You have received a new order ${order.orderNumber} on CampusIn. Login to view order details.`,
        vendorOrderHtml: generateVendorNewOrderHTML({
          vendorName: vendorUser.username,
          restaurantName: restaurant.restaurantName,
          orderNumber: order.orderNumber,
          customerPhone: order.customerPhone,
          totalAmount: order.totalAmount,
        }),
      });
    }
  } catch (error) {
    console.error("Failed to queue vendor new-order email:", error.message);
  }

  return res.status(200).json(
    new ApiResponse(200, "Order created successful", {
      applied,
      order,
    }),
  );
});

const getAllOrders = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const pageNumber = parseInt(page) || 1;
  const limitNumber = parseInt(limit) || 10;
  if (pageNumber < 1 || limitNumber < 1) {
    throw new ApiError(404, "Invalid page number or limit number");
  }
  const skip = (pageNumber - 1) * limitNumber;
  const totalOrders = await orderModel.countDocuments({ user: req.user.id });
  if (totalOrders === 0) {
    return res.status(200).json(
      new ApiResponse(200, "No order found", {
        orders: [],
      }),
    );
  }
  const orders = await orderModel
    .find(
      { user: req.user.id },
      "orderNumber restaurantName totalAmount pricing orderStatus createdAt rejectionMsg",
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
    new ApiResponse(200, "Order history fetched successfuly", {
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

const getSingleOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    throw new ApiError(400, "Inavlid order Id");
  }

  const order = await orderModel
    .findById(orderId)
    .select(
      "user restaurant orderNumber restaurantName items paymentMethod paymentStatus orderStatus totalAmount pricing customerPhone deliveryAddress createdAt rejectionMsg")
    .populate({
      path: "items.menuItem",
      select: "image",
    });
  if (!order) {
    throw new ApiError(404, "Order not found");
  }
  if (order.user.toString() !== req.user.id) {
    throw new ApiError(403, "Forbidden");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, "Order details fetched successfuly", order));
});

const cancelOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    throw new ApiError(400, "Invalid Order");
  }
  const order = await orderModel.findById(orderId);
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

    await restoreOrderStock(order.items, session);
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

//User order section Finished

//Vendor order section Start

const getVendorOrder = asyncHandler(async (req, res) => {
  const restaurant = await restaurantModel.findOne({ owner: req.user.id });
  if (!restaurant) {
    throw new ApiError(404, "No restaurant found");
  }

  const { page = 1, limit = 10 } = req.query;
  const pageNumber = parseInt(page) || 1;
  const limitNumber = parseInt(limit) || 10;
  if (pageNumber < 1 || limitNumber < 1) {
    throw new ApiError(400, "Invalid page number or limit number");
  }
  const skip = (pageNumber - 1) * limitNumber;

  const totalOrders = await orderModel.countDocuments({
    restaurant: restaurant._id,
  });
  const totalPages = Math.ceil(totalOrders / limitNumber);
  const orders = await orderModel
    .find({ restaurant: restaurant._id })
    .select(
      "user items totalAmount pricing orderNumber paymentMethod paymentStatus orderStatus createdAt customerPhone deliveryAddress couponCode rejectionMsg deliveryPartner",
    )
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limitNumber)
    .populate([
      {
        path: "user",
        select: "username",
      },
      {
        path: "deliveryPartner",
        select: "phoneNumber vehicleNumber user",
        populate: {
          path: "user",
          select: "username",
        },
      },
    ]);



  if (orders.length === 0) {
    return res.status(200).json(
      new ApiResponse(200, "No orders to show", {
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

  const ordersWithDeliveryPartnerDetails = orders.map((order) => {
    const normalizedOrder = order.toObject();
    const assignedPartner = normalizedOrder.deliveryPartner;

    return {
      ...normalizedOrder,
      deliveryPartnerDetails: assignedPartner
        ? {
            name: assignedPartner.user?.username || null,
            phoneNumber: assignedPartner.phoneNumber || null,
            vehicleNumber: assignedPartner.vehicleNumber || null,
          }
        : null,
    };
  });

  return res.status(200).json(
    new ApiResponse(200, "Orders fetched succesfuly", {
      orders: ordersWithDeliveryPartnerDetails,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        totalOrders,
        totalPages,
      },
    }),
  );
});

const getPlatformSettingsVendor = asyncHandler(async (req, res) => {
  const cachedSettings = await platformSettingsCached()
  if(cachedSettings){
    return res
    .status(200)
    .json(new ApiResponse(200, "Order details fetched successfuly", cachedSettings));
  }

  
  const platformSettings = await platformSettingsModel
    .findOne()
    .select('-updatedAt -createdAt -__v')
  if (!platformSettings) {
    throw new ApiError(404, 'Platform settings not found')
  }
  await setPlatformSettingsCached(platformSettings)

  return res.status(200).json(new ApiResponse(200, 'Platform settings fetched successfully', platformSettings))
});

const getSingleVendorOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    throw new ApiError(400, "Inavlid order Id");
  }


  const order = await orderModel
    .findById(orderId)
    .select(
      "user restaurant orderNumber restaurantName items paymentMethod paymentStatus orderStatus totalAmount pricing customerPhone deliveryAddress createdAt rejectionMsg deliveryPartner")
    .populate([
      {
      path: "items.menuItem",
      select: "image",},
    {
      path:'user',
      select:'username'
    },
    {
      path: "deliveryPartner",
      select: "phoneNumber vehicleNumber user",
      populate: {
        path: "user",
        select: "username",
      },
    },
  ]
    );
  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  const normalizedOrder = order.toObject();
  const assignedPartner = normalizedOrder.deliveryPartner;

  const orderWithDeliveryPartnerDetails = {
    ...normalizedOrder,
    deliveryPartnerDetails: assignedPartner
      ? {
          name: assignedPartner.user?.username || null,
          phoneNumber: assignedPartner.phoneNumber || null,
          vehicleNumber: assignedPartner.vehicleNumber || null,
        }
      : null,
  };


  return res
    .status(200)
    .json(new ApiResponse(200, "Order details fetched successfuly", orderWithDeliveryPartnerDetails));
});

const changeOrderStatus = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { orderStatus } = req.body;
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    throw new ApiError(400, "Inavlid Order Id");
  }
  const allowedStatus = ["CONFIRMED", "PREPARING", "READY", "DELIVERED", "REJECTED"];

  const isValidStatus = allowedStatus.includes(orderStatus);
  if (!isValidStatus) {
    throw new ApiError(400, "Invalid Order status");
  }

  const order = await orderModel.findById(orderId).populate({
    path: "restaurant",
    select: "owner",
  });
  if (!order) {
    throw new ApiError(404, "Order not found");
  }
  if (order.restaurant.owner.toString() !== req.user.id) {
    throw new ApiError(403, "Forbidden, you are not the owner of restaurant");
  }

  if (["DELIVERED", "CANCELLED", "REJECTED"].includes(order.orderStatus)) {
    throw new ApiError(409, "Order is in a final state, no more changes can be made");
  }

  if(orderStatus === "REJECTED"){
    const { rejectionMsg } = req.body;
    if (!rejectionMsg || rejectionMsg.trim() === "") {
      throw new ApiError(400, "Rejection message is required");
    }
    order.rejectionMsg = rejectionMsg;
  }

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    if (orderStatus === "REJECTED") {
      await restoreOrderStock(order.items, session);
    }

    order.orderStatus = orderStatus;
    await order.save({ session });

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }

  return res.status(200).json(
    new ApiResponse(200, "Order status updated successfuly", {
      orderNumber: order.orderNumber,
      orderStatus: order.orderStatus,
    }),
  );
});
//Vendor order section Finished


//Coupon selection Module starts

const getAllCoupons = asyncHandler(async (req, res) => {

  const cachedData = await getCouponCached()
  if(cachedData){
    return res
    .status(200)
    .json(new ApiResponse(200, "Coupons fetched successfully", cachedData));
  }
  const todayDate = new Date();
  const coupons = await couponModel
    .find({
      isActive: true,
      expiryDate: { $gte: todayDate },
    })
    .sort({
      maximumDiscount: -1,
      expiryDate: -1,
    })
    .select(
      "_id code discountType discountValue minimumOrderValue maximumDiscount expiryDate",
    );

  if (coupons.length === 0) {
    return res
      .status(200)
      .json(new ApiResponse(200, "No coupons to show", coupons));
  }

  await setCouponCached(coupons)

  return res
    .status(200)
    .json(new ApiResponse(200, "Coupons fetched successfully", coupons));
});

const applyCoupon = asyncHandler(async (req, res) => {
  const { couponId } = req.body;
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

  const cart = await cartModel.findOne({
    user: req.user.id,
  });

  if (!cart) {
    throw new ApiError(404, "Cart not found");
  }
  if (cart.items.length === 0) {
    throw new ApiError(400, "Cart is empty");
  }

  const [alreadyUsed, platformSettings] = await Promise.all([
    couponUsageModel.findOne({
      coupon: coupon._id,
      user: req.user.id,
    }),

    platformSettingsModel.findOne(),
  ]);

  if (alreadyUsed) {
    throw new ApiError(400, "You have already used this coupon");
  }

  if (coupon.usageLimit <= coupon.usageCount) {
    throw new ApiError(400, "Coupon usage limit is over");
  }

  if (coupon.minimumOrderValue > cart.totalAmount) {
    throw new ApiError(
      400,
      "Total should be above minimum order value to apply the coupon",
    );
  }

  let discount;

  if (coupon.discountType === "PERCENTAGE") {
    discount = Math.round((cart.totalAmount * coupon.discountValue) / 100);
    if (discount > coupon.maximumDiscount) {
      discount = coupon.maximumDiscount;
    }
  } else if (coupon.discountType === "FIXED") {
    discount = coupon.discountValue;
  }

  if (!platformSettings) {
    throw new ApiError(404, "Platform settings not found");
  }

  const subTotal = cart.totalAmount;
  const couponDiscount = Math.min(discount, subTotal);
  const subTotalAfterDiscount = subTotal - couponDiscount;
  const gstPercentage = platformSettings.gstPercentage;
  const gstAmount = Math.round((subTotalAfterDiscount * gstPercentage) / 100);
  let deliveryCharge = platformSettings.deliveryCharge;
  const packagingCharge = platformSettings.packagingCharge;
  const platformCharge = platformSettings.platformCharge || 0;
  const freeDeliveryAbove = platformSettings.freeDeliveryAbove;

  if (freeDeliveryAbove <= subTotalAfterDiscount) {
    deliveryCharge = 0
  }

  const finalAmount =
    subTotalAfterDiscount + gstAmount + deliveryCharge + packagingCharge + platformCharge;

  return res.status(200).json(
    new ApiResponse(200, "Coupon applied successfully", {
      applied: true,
      coupon: {
        code: coupon.code,
        couponId,
        couponDiscount,
        isUsed: false,
      },
      pricing: {
        subTotal,
        couponDiscount,
        subTotalAfterDiscount,
        gstAmount,
        packagingCharge,
        deliveryCharge,
        platformCharge,
        finalAmount,
      },
    }),
  );
});

const getPlatformSettingsUser = asyncHandler(async (req, res) => {
  const cachedSettings = await platformSettingsCached()
  if(cachedSettings){
    return res.status(200).json(new ApiResponse(200, 'Platform settings fetched successfully', cachedSettings))
  }
  const platformSettings = await platformSettingsModel
    .findOne()
    .select('-updatedAt -createdAt -__v')
  if (!platformSettings) {
    throw new ApiError(404, 'Platform settings not found')
  }

  await setPlatformSettingsCached(platformSettings)

  return res.status(200).json(new ApiResponse(200, 'Platform settings fetched successfully', platformSettings))
})

export default {
  createOrder,
  getAllOrders,
  getSingleOrder,
  cancelOrder,
  getVendorOrder,
  getSingleVendorOrder,
  changeOrderStatus,
  applyCoupon,
  getAllCoupons,
  getPlatformSettingsUser,
  getPlatformSettingsVendor
};
