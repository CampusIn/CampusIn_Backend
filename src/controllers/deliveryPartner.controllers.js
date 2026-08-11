import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/apiErrors.js";
import ApiResponse from "../utils/apiResponse.js";
import deliveryPartnerModel from "../models/deliveryPartner.models.js";
import orderModel from "../models/order.models.js";
import userModel from "../models/user.models.js";
import marketPlaceOrderModel from "../models/marketPlaceOrders.models.js";
import mongoose from "mongoose";
import emailServices from "../services/emailQueue.services.js";
import {
  generateDeliveryAssignmentHTML,
  generateDeliveryAssignmentText,
} from "../utils/utils.js";
import { deleteOrderHistoryCached } from "../services/orderHistoryCached.services.js";
import { deleteMarketplaceOrderHistoryCached } from "../services/marketPlaceOrderHistoryCached.services.js";

const isOrderAssignedToPartner = (assignedPartnerId, deliveryPartner) => {
  if (!assignedPartnerId || !deliveryPartner) {
    return false;
  }

  const assignedId = assignedPartnerId.toString();
  return (
    assignedId === deliveryPartner._id.toString() ||
    assignedId === deliveryPartner.user.toString()
  );
};

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getFinalAmountFromPricing = (pricing = {}) => {
  const subTotal = toNumber(pricing.subTotal);
  const couponDiscount = toNumber(pricing.couponDiscount);
  const gstAmount = toNumber(pricing.gstAmount);
  const deliveryCharge = toNumber(pricing.deliveryCharge);
  const packagingCharge = toNumber(pricing.packagingCharge);
  const platformCharge = toNumber(pricing.platformCharge);

  if (pricing.finalAmount !== undefined && pricing.finalAmount !== null) {
    return toNumber(pricing.finalAmount);
  }

  return (
    subTotal -
    couponDiscount +
    gstAmount +
    deliveryCharge +
    packagingCharge +
    platformCharge
  );
};

const normalizeOrderPricingForDeliveryPartner = (orderDocument) => {
  const order =
    typeof orderDocument?.toObject === "function"
      ? orderDocument.toObject()
      : { ...orderDocument };

  if (!order.pricing) {
    return order;
  }

  const finalAmount = getFinalAmountFromPricing(order.pricing);
  const platformCharge = toNumber(order.pricing.platformCharge);

  order.pricing = {
    ...order.pricing,
    platformCharge,
    finalAmount,
  };

  order.totalAmount = finalAmount;
  order.finalAmount = finalAmount;

  return order;
};

//Food orders//
const createProfile = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const isExisting = await deliveryPartnerModel.findOne({
    user: userId,
  });

  if (isExisting) {
    throw new ApiError(409, "Delivery partner profile already exists");
  }
  const { phoneNumber, vehicleNumber } = req.body;
  const deliveryPartner = await deliveryPartnerModel.create({
    user: userId,
    phoneNumber,
    vehicleNumber,
  });

  if (!deliveryPartner) {
    throw new ApiError(500, "Failed to create a new delivery partner");
  }

  return res
    .status(201)
    .json(
      new ApiResponse(
        201,
        "Delivery partner created successfully",
        deliveryPartner,
      ),
    );
});

const assignPartner = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { deliveryPartnerId } = req.body;
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    throw new ApiError(400, "Invalid Order Id");
  }

  if (!mongoose.Types.ObjectId.isValid(deliveryPartnerId)) {
    throw new ApiError(400, "Invalid Delivery Partner Id");
  }

  const order = await orderModel.findById(orderId).populate({
    path: "restaurant",
    select: "owner",
  });
  if (!order) {
    throw new ApiError(404, "Order does not exists");
  }
  if (order.restaurant.owner.toString() !== req.user.id) {
    throw new ApiError(403, "Forbidden, you are not the owner of restaurant");
  }

  const assignableStatuses = ["CONFIRMED", "PREPARING", "READY"];
  if (!assignableStatuses.includes(order.orderStatus)) {
    throw new ApiError(
      400,
      `Order must be CONFIRMED, PREPARING, or READY before assigning delivery. Current status: ${order.orderStatus}`,
    );
  }
  if (order.deliveryPartner) {
    throw new ApiError(400, "Delivery partner already assigned");
  }

  const deliveryPartner = await deliveryPartnerModel
    .findById(deliveryPartnerId)
    .populate({
      path: "user",
      select: "email username",
    });
  if (!deliveryPartner) {
    throw new ApiError(404, "Delivery partner does not exists");
  }

  if (!deliveryPartner.isAvailable) {
    throw new ApiError(400, "Partner unavailable");
  }

  order.deliveryPartner = deliveryPartner._id;
  await order.save();

  await order.populate({
    path: "deliveryPartner",
    select: "phoneNumber user",
    populate: {
      path: "user",
      select: "username",
    },
  });

  deliveryPartner.isAvailable = false;
  await deliveryPartner.save();

  try {
    if (deliveryPartner.user?.email) {
      await emailServices.queueDeliveryAssignmentEmail({
        to: deliveryPartner.user.email,
        subject: `New delivery assigned: ${order.orderNumber}`,
        text: generateDeliveryAssignmentText({
          orderNumber: order.orderNumber,
          pickupFrom: order.restaurantName,
          customerPhone: order.customerPhone,
          deliveryAddress: order.deliveryAddress,
        }),
        deliveryAssignmentHtml: generateDeliveryAssignmentHTML({
          deliveryPartnerName: deliveryPartner.user.username,
          orderNumber: order.orderNumber,
          pickupFrom: order.restaurantName,
          customerPhone: order.customerPhone,
          deliveryAddress: order.deliveryAddress,
        }),
      });
    }
  } catch (error) {
    console.error(
      "Failed to queue delivery assignment email for food order:",
      error.message,
    );
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, "Delivery partner assigned successfully", order),
    );
});

const viewAllOrders = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const deliveryPartner = await deliveryPartnerModel.findOne({
    user: userId,
  });

  if (!deliveryPartner) {
    throw new ApiError(404, "Delivery partner not found");
  }

  const orders = await orderModel
    .find({
      $or: [
        { deliveryPartner: deliveryPartner._id },
        { deliveryPartner: deliveryPartner.user },
      ],
    })
    .populate({
      path: "user",
      select: "username",
    })
    .sort({ createdAt: -1 });

  if (orders.length === 0) {
    return res
      .status(200)
      .json(new ApiResponse(200, "No orders to show", orders));
  }

  const normalizedOrders = orders.map(normalizeOrderPricingForDeliveryPartner);

  return res
    .status(200)
    .json(new ApiResponse(200, "Orders fetched successfully", normalizedOrders));
});

const viewOneOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    throw new ApiError(400, "Invalid order ID");
  }

  const deliveryPartner = await deliveryPartnerModel.findOne({
    user: req.user.id,
  });

  if (!deliveryPartner) {
    throw new ApiError(404, "Delivery partner not found");
  }

  const order = await orderModel.findById(orderId).populate([
    {
      path: "user",
      select: "username",
    },
    {
      path: "items.menuItem",
      select: "name price image",
    },
  ]);

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  if (!isOrderAssignedToPartner(order.deliveryPartner, deliveryPartner)) {
    throw new ApiError(403, "No access to this order");
  }

  const normalizedOrder = normalizeOrderPricingForDeliveryPartner(order);

  return res
    .status(200)
    .json(new ApiResponse(200, "Order fetched successfully", normalizedOrder));
});

const pickUpOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    throw new ApiError(400, "Invalid Order ID");
  }

  const deliveryPartner = await deliveryPartnerModel.findOne({
    user: req.user.id,
  });

  if (!deliveryPartner) {
    throw new ApiError(404, "Delivery partner not found");
  }

  const order = await orderModel.findById(orderId);

  if (!order) {
    throw new ApiError(404, "Order does not exists");
  }

  if (!isOrderAssignedToPartner(order.deliveryPartner, deliveryPartner)) {
    throw new ApiError(403, "Forbidden");
  }

  if (order.orderStatus !== "READY") {
    throw new ApiError(400, "Order must be READY before pickup");
  }

  order.orderStatus = "OUT_FOR_DELIVERY";
  await order.save();
  await deleteOrderHistoryCached(order.user.toString());

  const normalizedOrder = normalizeOrderPricingForDeliveryPartner(order);

  return res
    .status(200)
    .json(new ApiResponse(200, "Order Picked up successfully", normalizedOrder));
});

const deliverOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    throw new ApiError(400, "Invalid Order ID");
  }

  const deliveryPartner = await deliveryPartnerModel.findOne({
    user: req.user.id,
  });

  if (!deliveryPartner) {
    throw new ApiError(404, "Delivery partner not found");
  }

  const order = await orderModel.findById(orderId);

  if (!order) {
    throw new ApiError(404, "Order does not exists");
  }

  if (!isOrderAssignedToPartner(order.deliveryPartner, deliveryPartner)) {
    throw new ApiError(403, "Forbidden");
  }

  if (order.orderStatus !== "OUT_FOR_DELIVERY") {
    throw new ApiError(400, "Order must be OUT_FOR_DELIVERY before delivery");
  }
  order.orderStatus = "DELIVERED";
  deliveryPartner.isAvailable = true;

  await Promise.all([order.save(), deliveryPartner.save()]);
  await deleteOrderHistoryCached(order.user.toString());

  const normalizedOrder = normalizeOrderPricingForDeliveryPartner(order);

  return res
    .status(200)
    .json(new ApiResponse(200, "delivered successfully", normalizedOrder));
});

//MarketPlace orders//

const viewAllMarketPlaceOrders = asyncHandler(async (req, res) => {
  const partnerId = req.user.id;
  const deliveryPartner = await deliveryPartnerModel.findOne({
    user: partnerId,
  });
  if (!deliveryPartner) {
    throw new ApiError(404, "Delivery partner not found");
  }

  const orders = await marketPlaceOrderModel
    .find({
      $or: [
        { deliveryPartner: deliveryPartner._id },
        { deliveryPartner: deliveryPartner.user },
      ],
    })
    .populate({
      path: "user",
      select: "username",
    })
    .sort({ createdAt: -1 });

  if (!orders || orders.length === 0) {
    return res
      .status(200)
      .json(new ApiResponse(200, "No orders to fetch ", orders));
  }

  const normalizedOrders = orders.map(normalizeOrderPricingForDeliveryPartner);

  return res
    .status(200)
    .json(new ApiResponse(200, "Orders fetched successfully", normalizedOrders));
});

const viewOrderById = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    throw new ApiError(400, "Invalid Order ID");
  }

  const deliveryPartner = await deliveryPartnerModel.findOne({
    user: req.user.id,
  });

  if (!deliveryPartner) {
    throw new ApiError(404, "Delivery partner not found");
  }

  const order = await marketPlaceOrderModel.findById(orderId).populate([
    {
      path: "user",
      select: "username",
    },
    {
      path:"items.product",
      select:"images"
    }
  ]);

  if(!order){
    throw new ApiError(404,"Order not found")
  }

  if (!isOrderAssignedToPartner(order.deliveryPartner, deliveryPartner)) {
    throw new ApiError(403,"You don't have access to this order")
  }

  const normalizedOrder = normalizeOrderPricingForDeliveryPartner(order);

  return res.status(200).json(new ApiResponse(200,"Order fetched successfully",normalizedOrder))
});

const updateOrderStatus = asyncHandler(async(req,res)=>{
  const{orderId} = req.params
  if(!mongoose.Types.ObjectId.isValid(orderId)){
    throw new ApiError(400,"Invalid Order ID")
  }

  const deliveryPartner = await deliveryPartnerModel.findOne({
    user:req.user.id
  })

  if(!deliveryPartner){
    throw new ApiError(400,"Delivery partner not found")
  }
  const order = await marketPlaceOrderModel.findOne({
    _id:orderId,
    $or: [
      { deliveryPartner: deliveryPartner._id },
      { deliveryPartner: deliveryPartner.user },
    ],
  })

  if(!order){
    throw new ApiError(404,"Order not found")
  }

  if(order.orderStatus!=="OUT_FOR_DELIVERY"){
    throw new ApiError(400,"Order must be OUT_FOR_DELIVERY before delivery")
  }

  order.orderStatus = "DELIVERED"
  deliveryPartner.isAvailable = true
  await Promise.all([order.save(), deliveryPartner.save()])
  await deleteMarketplaceOrderHistoryCached(order.user.toString())

  return res.status(200).json(new ApiResponse(200,"Order status updated successfully"))
})

const viewAllDeliveryPartners = asyncHandler(async(req,res)=>{

  const {role} = req.user
  console.log(role)
  const userId = req.user.id
  const normalisedRole = role.trim().toLowerCase()

  const user = await userModel.findById(userId)

  if(!user){
    throw new ApiError(400,"User not found")
  }
  if (!['admin', 'vendor'].includes(user.role)) {
  throw new ApiError(403, "Unauthorized")
}
  const deliveryPartners = await deliveryPartnerModel.find({
    isAvailable:true
  }).populate({
    path:"user",
    select:"username"
  })

  if(!deliveryPartners || deliveryPartners.length === 0){
    return res.status(200).json(new ApiResponse(200,"No delivery partners found"))
  }

  return res.status(200).json(new ApiResponse(200,"Delivery partners fetched successfully",deliveryPartners))
})

export default {
  createProfile,
  assignPartner,
  viewAllOrders,
  viewOneOrder,
  pickUpOrder,
  deliverOrder,
  viewAllMarketPlaceOrders,
  viewOrderById,
  updateOrderStatus,
  viewAllDeliveryPartners
};
