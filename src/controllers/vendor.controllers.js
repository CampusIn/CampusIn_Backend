import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/apiErrors.js";
import ApiResponse from "../utils/apiResponse.js";
import restaurantModel from "../models/restaurant.models.js";
import orderModel from "../models/order.models.js";
import restaurantRevenueStats from "../utils/restaurantRevenueStats.utils.js";
import topSellerPipeline from "../utils/topSellerItems.utils.js";
import orderStatusPipeline from "../utils/orderStatus.utils.js";
import revenuePerDayPipeline from "../utils/revenuePerDay.utils.js";
import averageOrderPipeline from "../utils/averageOrder.utils.js";
import mongoose from "mongoose";
import menuModel from "../models/menuItem.models.js";
import { uploadOnCloudinary } from "../services/cloudinary.services.js";
import generateInvoicePDF from "../services/invoice.services.js";
import { deleteRestaurantMenuCached } from "../services/menuCahed.services.js";

const getVendorOverview = asyncHandler(async (req, res) => {
  const vendorId = req.user.id;
  const restaurant = await restaurantModel.findOne({
    owner: vendorId,
  });
  if (!restaurant) {
    throw new ApiError(404, "Restaurant not found");
  }

  const [totalOrders, deliveredOrders, cancelledOrders, revenue] =
    await Promise.all([
      orderModel.countDocuments({
        restaurant: restaurant._id,
      }),

      orderModel.countDocuments({
        restaurant: restaurant._id,
        orderStatus: "DELIVERED",
      }),

      orderModel.countDocuments({
        restaurant: restaurant._id,
        orderStatus: "CANCELLED",
      }),

      restaurantRevenueStats(restaurant._id),
    ]);

  return res.status(200).json(
    new ApiResponse(200, "Vendor dashboard fetched successfully", {
      restaurantName: restaurant.restaurantName,
      totalOrders,
      deliveredOrders,
      cancelledOrders,
      revenue,
    }),
  );
});

const getTopItems = asyncHandler(async (req, res) => {
  const vendorId = req.user.id;
  const restaurant = await restaurantModel.findOne({
    owner: vendorId,
  });
  if (!restaurant) {
    throw new ApiError(404, "Restaurant not found");
  }

  const topSellers = await topSellerPipeline(restaurant._id);

  return res
    .status(200)
    .json(new ApiResponse(200, "Top seller items are displayed", topSellers));
});

const orderStatusBreakdown = asyncHandler(async (req, res) => {
  const vendorId = req.user.id;
  const restaurant = await restaurantModel.findOne({
    owner: vendorId,
  });
  if (!restaurant) {
    throw new ApiError(404, "Restaurant not found");
  }

  const orderStatus = await orderStatusPipeline(restaurant._id);

  return res
    .status(200)
    .json(
      new ApiResponse(200, "Order Stats fetched successfully", orderStatus),
    );
});

const revenueStatsPerWeek = asyncHandler(async (req, res) => {
  const vendorId = req.user.id;
  const restaurant = await restaurantModel.findOne({
    owner: vendorId,
  });
  if (!restaurant) {
    throw new ApiError(404, "Restaurant not found");
  }

  const revenueStats = await revenuePerDayPipeline(restaurant._id);
  return res
    .status(200)
    .json(
      new ApiResponse(200, "Revenue Stats fetched successfully", revenueStats),
    );
});

const averageOrderValue = asyncHandler(async (req, res) => {
  const vendorId = req.user.id;
  const restaurant = await restaurantModel.findOne({
    owner: vendorId,
  });
  if (!restaurant) {
    throw new ApiError(404, "Restaurant not found");
  }
  const averageOrderValue = await averageOrderPipeline(restaurant._id);
  return res
    .status(200)
    .json(
      new ApiResponse(200, "Average order value fetched", averageOrderValue),
    );
});

const updateStock = asyncHandler(async (req, res) => {
  const { menuId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(menuId)) {
    throw new ApiError(400, "Invalid menu ID");
  }
  const vendorId = req.user.id;
  const restaurant = await restaurantModel.findOne({
    owner: vendorId,
  });

  if (!restaurant) {
    throw new ApiError(404, "Restaurant not found");
  }

  const menu = await menuModel.findById(menuId);
  if (!menu) {
    throw new ApiError(404, "Menu not found");
  }
  if (menu.restaurant.toString() !== restaurant._id.toString()) {
    throw new ApiError(403, "Forbidden");
  }

  const { stockQty } = req.body;
  if (stockQty === undefined || stockQty < 0) {
    throw new ApiError(400, "Invalid stock quantity");
  }

  menu.stockQty = stockQty;
  menu.isAvailable = stockQty > 0;
  await menu.save();
  await deleteRestaurantMenuCached(menu.restaurant);
  return res
    .status(200)
    .json(new ApiResponse(200, "Stock updated successfully"));
});

const getAllMenu = asyncHandler(async (req, res) => {
  const vendorId = req.user.id;
  const restaurant = await restaurantModel.findOne({
    owner: vendorId,
  });
  if (!restaurant) {
    throw new ApiError(404, "Restaurant not found");
  }

  const menuItems = await menuModel
    .find({
      restaurant: restaurant._id,
      isDeleted: false,
    })
    .select("name stockQty lowStockThreshold isAvailable isDeleted");

  if (menuItems.length === 0) {
    return res
      .status(200)
      .json(new ApiResponse(200, "No menu items to show", menuItems));
  }

  return res
    .status(200)
    .json(new ApiResponse(200, "Menu Items fetched successfully", menuItems));
});

const lowStockItems = asyncHandler(async (req, res) => {
  const vendorId = req.user.id;
  const restaurant = await restaurantModel.findOne({
    owner: vendorId,
  });
  if (!restaurant) {
    throw new ApiError(404, "Restaurant not found");
  }

  const lowStockMenu = await menuModel
    .find({
      restaurant: restaurant._id,
      isDeleted: false,
      $expr: {
        $lte: ["$stockQty", "$lowStockThreshold"],
      },
    })
    .select("name stockQty lowStockThreshold isAvailable")
    .sort({ stockQty: 1 });

  if (lowStockMenu.length === 0) {
    return res
      .status(200)
      .json(new ApiResponse(200, "No items in low stock", lowStockMenu));
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        "Items in low stock fetched successfully",
        lowStockMenu,
      ),
    );
});

const bulkUpload = asyncHandler(async (req, res) => {
  const vendorId = req.user.id;

  const restaurant = await restaurantModel.findOne({
    owner: vendorId,
  });

  if (!restaurant) {
    throw new ApiError(404, "Restaurant not found");
  }

  const files = req.files;

  if (!files || files.length === 0) {
    throw new ApiError(400, "No images uploaded");
  }

  let items;

  try {
    items = JSON.parse(req.body.items);
  } catch (error) {
    throw new ApiError(400, "Invalid items format");
  }

  if (!Array.isArray(items)) {
    throw new ApiError(400, "Items must be an array");
  }

  if (files.length !== items.length) {
    throw new ApiError(400, "Image count and item count must match");
  }

  // Validate menu data before uploading images
  items.forEach((item) => {
    const hasMrp = !(item.mrp === undefined || item.mrp === null || item.mrp === "");
    const normalizedMrp = hasMrp ? Number(item.mrp) : Number(item.price);

    if (
      !item.name ||
      item.price === undefined ||
      !item.foodType
    ) {
      throw new ApiError(
        400,
        "Each item must contain name, price, foodType",
      );
    }

    if (!Number.isFinite(normalizedMrp)) {
      throw new ApiError(400, `Invalid MRP for ${item.name}`);
    }

    if (normalizedMrp < Number(item.price)) {
      throw new ApiError(400, `MRP cannot be less than price for ${item.name}`);
    }

    item.mrp = normalizedMrp;
  });

  const imageUrls = await Promise.all(
    files.map((file) => uploadOnCloudinary(file.path)),
  );

  const menuItems = items.map((item, index) => ({
    restaurant: restaurant._id,
    name: item.name,
    description: item.description ?? "",
    mrp: item.mrp,
    price: item.price,
    category: item.category || "Uncategorized",
    foodType: item.foodType,
    image: imageUrls[index],
  }));

  const createdMenus = await menuModel.insertMany(menuItems);

  return res.status(201).json(
    new ApiResponse(201, "Menu items uploaded successfully", {
      totalCreated: createdMenus.length,
      menuItems: createdMenus,
    }),
  );
});

const generateInvoiceFood = asyncHandler(async (req, res) => {
  const { orderId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    throw new ApiError(400, "Invalid order ID");
  }

  const order = await orderModel
    .findById(orderId)
    .populate([
      {
        path: "user",
        select: "username email",
      },
      {
        path: "restaurant",
        select: "restaurantName location phone owner",
      },
    ]);

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  if(order.restaurant.owner.toString() !== req.user.id) {
    throw new ApiError(403, "You are not authorized to generate invoice for this order");
  }

  const invoiceBuffer = await generateInvoicePDF(order);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=invoice_${orderId}.pdf`,
  );
  res.send(invoiceBuffer);
})

export default {
  getVendorOverview,
  getTopItems,
  orderStatusBreakdown,
  revenueStatsPerWeek,
  averageOrderValue,
  updateStock,
  getAllMenu,
  lowStockItems,
  bulkUpload,
  generateInvoiceFood
};
