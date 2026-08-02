import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/apiErrors.js";
import ApiResponse from "../utils/apiResponse.js";
import userModel from "../models/user.models.js";
import restaurantModel from "../models/restaurant.models.js";
import orderModel from "../models/order.models.js";
import getRevenueStats from "../utils/revenueStats.utils.js";
import platformSettingsModel from "../models/platformSettings.models.js";
import couponModel from "../models/coupon.models.js";
import mongoose from "mongoose";
import announcementModel from "../models/anouncement.models.js";
import bannerModel from "../models/banners.models.js";
import cartModel from "../models/cart.models.js";
import marketPlaceCategoryModel from "../models/marketPlaceCategory.models.js";
import marketPlaceProductsModel from "../models/marketPlaceProducts.models.js";
import marketPlaceOrderModel from "../models/marketPlaceOrders.models.js";
import deliveryPartnerModel from "../models/deliveryPartner.models.js";
import { uploadOnCloudinary } from "../services/cloudinary.services.js";
import topRestaurantsPipeline from "../utils/topRestaurant.utils.js";
import generateInvoicePDF from "../services/invoice.services.js";
import generateMarketPlaceInvoicePDF from "../services/marketPlaceInvoice.services.js";
import emailServices from "../services/emailQueue.services.js";
import {
  generateReminderHTML,
  generateRepairRequestEstimateHTML,
  generateDeliveryAssignmentHTML,
} from "../utils/utils.js";
import config from "../config/config.js";
import {
  platformSettingsCached,
  setPlatformSettingsCached,
  deletePlatformSettingsCached,
} from "../services/platformSettingsCached.services.js";

import { deletedBannerCached } from "../services/bannersCached.services.js";
import { REDIS_KEYS } from "../constants/redis.constants.js";
import { deleteAnnouncementsCached } from "../services/announcementsCached.services.js";
import { deletedCategoriesCached } from "../services/categoriesCached.services.js";
import { deleteRestaurantCached } from "../services/restaurantCached.services.js";
import { deleteProductCached } from "../services/marketPlaceProductsCached.services.js";
import { deleteMarketplaceOrderHistoryCached } from "../services/marketPlaceOrderHistoryCached.services.js";
import { deleteCouponCached } from "../services/couponCached.services.js";
import {
  deleteUserRepairRequestByIdCached,
  deleteUserRepairRequestsCached,
} from "../services/repairRequestCached.services.js";
import {
  getMarketplaceOverviewPipeline,
  getMarketplaceOrderStatusPipeline,
  getMarketplaceRevenueChartPipeline,
  getTopMarketplaceProductsPipeline,
  getTopMarketplaceCategoriesPipeline,
  getMarketplaceInventoryPipeline,
} from "../utils/marketPlaceAnalytics.utils.js";
import repairPartnerModel from "../models/repairPartner.models.js";
import repairRequestModel from "../models/repairRequest.models.js";

const REPAIR_REQUEST_STATUSES = [
  "SUBMITTED",
  "PRICE_SENT",
  "ACCEPTED",
  "REJECTED",
  "FORWARDED",
  "COMPLETED",
];
const REPAIR_SERVICE_TYPES = ["MOBILE", "LAPTOP", "COOLERS", "OTHERS"];

const addRepairRequestSearchFilter = (filter, search) => {
  if (!search) {
    return;
  }

  filter.$or = [
    { requestNumber: { $regex: search, $options: "i" } },
    { customerPhone: { $regex: search, $options: "i" } },
  ];
};

const addRepairRequestStatusFilter = (filter, status) => {
  if (!status) {
    return;
  }

  if (!REPAIR_REQUEST_STATUSES.includes(status)) {
    throw new ApiError(400, "Invalid status");
  }

  filter.requestStatus = status;
};

const addRepairRequestServiceTypeFilter = (filter, serviceType) => {
  if (!serviceType) {
    return;
  }

  if (!REPAIR_SERVICE_TYPES.includes(serviceType)) {
    throw new ApiError(400, "Invalid service type");
  }

  filter.serviceType = serviceType;
};

const addRepairRequestPartnerFilter = (filter, repairPartner) => {
  if (!repairPartner) {
    return;
  }

  if (!mongoose.Types.ObjectId.isValid(repairPartner)) {
    throw new ApiError(400, "Invalid repair partner ID");
  }

  filter.repairPartner = repairPartner;
};

const addRepairRequestDateFilter = (filter, fromDate, toDate) => {
  if (!fromDate && !toDate) {
    return;
  }

  filter.createdAt = {};

  if (fromDate) {
    const parsedFromDate = new Date(fromDate);
    if (Number.isNaN(parsedFromDate.getTime())) {
      throw new ApiError(400, "Invalid fromDate");
    }
    filter.createdAt.$gte = parsedFromDate;
  }

  if (toDate) {
    const parsedToDate = new Date(toDate);
    if (Number.isNaN(parsedToDate.getTime())) {
      throw new ApiError(400, "Invalid toDate");
    }
    filter.createdAt.$lte = parsedToDate;
  }
};

const viewAdminDashboard = asyncHandler(async (req, res) => {
  const [userCount, vendorCount, restaurantCount, orderCount, revenue] =
    await Promise.all([
      userModel.countDocuments({ role: "user" }),
      userModel.countDocuments({ role: "vendor" }),
      restaurantModel.countDocuments(),
      orderModel.countDocuments(),
      getRevenueStats(),
    ]);

  return res.status(200).json(
    new ApiResponse(200, "Dashboard details fetched successfully", {
      userCount,
      vendorCount,
      restaurantCount,
      orderCount,
      revenue,
    }),
  );
});

const viewUsers = asyncHandler(async (req, res) => {
  const { search, page = 1, limit = 5 } = req.query;
  const pageNumber = parseInt(page) || 1;
  const limitNumber = parseInt(limit) || 5;
  if (pageNumber < 1 || limitNumber < 1) {
    throw new ApiError(400, "Invalid page number or limit number");
  }
  const skip = (pageNumber - 1) * limitNumber;
  let filter = {
    role: "user",
  };
  if (search) {
    filter.username = {
      $regex: search,
      $options: "i",
    };
  }
  const [matchedUsers, totalUsers] = await Promise.all([
    userModel.find(filter).skip(skip).limit(limitNumber).select("-password"),

    userModel.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(totalUsers / limitNumber);

  return res.status(200).json(
    new ApiResponse(200, "User details fetched successfuly", {
      users: matchedUsers,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        totalUsers,
        totalPages,
      },
    }),
  );
});

const viewVendors = asyncHandler(async (req, res) => {
  const { search, page = 1, limit = 5 } = req.query;
  const pageNumber = parseInt(page) || 1;
  const limitNumber = parseInt(limit) || 5;
  if (pageNumber < 1 || limitNumber < 1) {
    throw new ApiError(400, "Invalid page number or limit number");
  }
  const skip = (pageNumber - 1) * limitNumber;
  let filter = {
    role: "vendor",
  };
  if (search) {
    filter.username = {
      $regex: search,
      $options: "i",
    };
  }
  const [matchedVendors, totalVendor] = await Promise.all([
    userModel.find(filter).skip(skip).limit(limitNumber).select("-password"),

    userModel.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(totalVendor / limitNumber);

  return res.status(200).json(
    new ApiResponse(200, "Vendor details fetched successfuly", {
      venodors: matchedVendors,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        totalVendor,
        totalPages,
      },
    }),
  );
});

const viewRestaurants = asyncHandler(async (req, res) => {
  const { search, category, isOpen, page = 1, limit = 5 } = req.query;
  const pageNumber = parseInt(page) || 1;
  const limitNumber = parseInt(limit) || 5;
  if (pageNumber < 1 || limitNumber < 1) {
    throw new ApiError(400, "Invalid page number or limit number");
  }
  const skip = (pageNumber - 1) * limitNumber;
  let filter = {};
  if (search) {
    filter.restaurantName = {
      $regex: search,
      $options: "i",
    };
  }
  if (isOpen === "true") {
    filter.isOpen = true;
  } else if (isOpen === "false") {
    filter.isOpen = false;
  }
  if (category) {
    filter.category = category;
  }

  const [matchedRestaurants, totalRestaurants] = await Promise.all([
    restaurantModel.find(filter).skip(skip).limit(limitNumber),

    restaurantModel.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(totalRestaurants / limitNumber);

  return res.status(200).json(
    new ApiResponse(200, "Restaurant details fetched successfully", {
      restaurants: matchedRestaurants,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        totalRestaurants,
        totalPages,
      },
    }),
  );
});

const blockUser = asyncHandler(async (req, res) => {
  const userId = req.params.id;
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(404, "Invalid User ID");
  }

  const user = await userModel.findByIdAndUpdate(userId, {
    isBlocked: true,
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, "User blocked successfully"));
});

const unBlockUser = asyncHandler(async (req, res) => {
  const userId = req.params.id;
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(404, "Invalid User ID");
  }

  const user = await userModel.findByIdAndUpdate(userId, {
    isBlocked: false,
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, "User un-blocked successfully"));
});

const suspendRestaurant = asyncHandler(async (req, res) => {
  const restaurantId = req.params.id;
  if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
    throw new ApiError(404, "Inavlid restaurant ID");
  }

  const restaurant = await restaurantModel.findByIdAndUpdate(restaurantId, {
    isSuspended: true,
    isOpen: false,
  });

  if (!restaurant) {
    throw new ApiError(404, "Restaurant not found");
  }

  await deleteRestaurantCached(restaurantId);

  return res.status(200).json(200, "Restuarant suspended successfully");
});

const activateRestaurant = asyncHandler(async (req, res) => {
  const restaurantId = req.params.id;
  if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
    throw new ApiError(400, "Inavlid restaurant ID");
  }

  const restaurant = await restaurantModel.findByIdAndUpdate(restaurantId, {
    isSuspended: false,
    isOpen: true,
  });

  if (!restaurant) {
    throw new ApiError(404, "Restaurant not found");
  }

  await deleteRestaurantCached(restaurantId);

  return res
    .status(200)
    .json(new ApiResponse(200, "Restuarant activated successfully"));
});

const getAllOrders = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 5 } = req.query;
  const pageNumber = parseInt(page) || 1;
  const limitNumber = parseInt(limit) || 5;
  if (pageNumber < 1 || limitNumber < 1) {
    throw new ApiError(400, "Invalid Page number or Limit number");
  }
  const skip = (pageNumber - 1) * limitNumber;
  let filter = {};
  const validateStatus = [
    "PENDING",
    "ACCEPTED",
    "PREPARING",
    "READY",
    "DELIVERED",
    "CANCELLED",
  ];

  if (status && !validateStatus.includes(status)) {
    throw new ApiError(400, "Invalid status");
  } else if (status && validateStatus.includes(status)) {
    filter.orderStatus = status;
  }

  const [orders, totalOrders] = await Promise.all([
    orderModel
      .find(filter)
      .skip(skip)
      .limit(limitNumber)
      .populate({
        path: "user",
        select: "username",
      })
      .sort({ createdAt: -1 }),

    orderModel.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(totalOrders / limitNumber);

  return res.status(200).json(
    new ApiResponse(200, "Order details fetched successfully", {
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

const getOrderById = asyncHandler(async (req, res) => {
  const orderId = req.params.id;
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    throw new ApiError(400, "Invalid OrderID");
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

  return res
    .status(200)
    .json(new ApiResponse(200, "Order fetched successfully", { order }));
});

const configSettings = asyncHandler(async (req, res) => {
  let settings = await platformSettingsModel.findOne();
  if (!settings) {
    settings = await platformSettingsModel.create({});
  }

  return res
    .status(200)
    .json(new ApiResponse("Settings configured successfully", settings));
});

const editSettings = asyncHandler(async (req, res) => {
  const settings = await platformSettingsModel.findOne();
  if (!settings) {
    throw new ApiError(404, "Platform settings not found");
  }

  const updates = req.body;

  Object.entries(updates).forEach(([key, value]) => {
    if (value !== undefined) {
      settings[key] = value;
    }
  });

  if (settings.freeDeliveryAbove < settings.minimumOrderValue) {
    throw new ApiError(
      400,
      "Minimum order value cannot be above free delivery order value",
    );
  }

  settings.updatedBy = req.user.id;
  await settings.save();
  await deletePlatformSettingsCached();

  const refreshedSettings = await platformSettingsModel
    .findById(settings._id)
    .select("-updatedAt -createdAt -__v")
    .lean();

  if (refreshedSettings) {
    await setPlatformSettingsCached(refreshedSettings);
  }

  return res
    .status(200)
    .json(new ApiResponse(200, "Settings updated successfully", refreshedSettings || settings));
});

const getPlatformSettingsAdmin = asyncHandler(async (req, res) => {
  const cachedSettings = await platformSettingsCached();
  if (cachedSettings && cachedSettings.platformCharge !== undefined) {
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          "Platform settings fetched successfully",
          cachedSettings,
        ),
      );
  }
  const platformSettings = await platformSettingsModel
    .findOne()
    .select("-updatedAt -createdAt -__v");
  if (!platformSettings) {
    throw new ApiError(404, "Platform settings not found");
  }

  const plainSettings = platformSettings.toObject();
  await setPlatformSettingsCached(plainSettings);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        "Platform settings fetched successfully",
        plainSettings,
      ),
    );
});

const createCoupons = asyncHandler(async (req, res) => {
  let {
    code,
    discountType,
    discountValue,
    minimumOrderValue,
    maximumDiscount,
    expiryDate,
    usageLimit,
  } = req.body;

  const normalisedCode = code.trim().toUpperCase();
  const isExisting = await couponModel.findOne({ code: normalisedCode });
  if (isExisting) {
    throw new ApiError(409, "Coupon already exists");
  }

  const expiry = new Date(expiryDate);
  if (expiry <= new Date()) {
    throw new ApiError(400, "Coupon already expired");
  }

  if (discountType === "PERCENTAGE" && maximumDiscount <= 0) {
    throw new ApiError(
      400,
      "Maximum discount is required for percentage coupons",
    );
  }
  if (discountType === "PERCENTAGE") {
    if (discountValue > 100) {
      throw new ApiError(400, "Percentage cannot exceed 100%");
    }
  } else if (discountType === "FIXED") {
    maximumDiscount = 0;
  }

  const coupon = await couponModel.create({
    code: normalisedCode,
    discountType,
    discountValue,
    minimumOrderValue,
    maximumDiscount,
    expiryDate,
    usageLimit,
    createdBy: req.user.id,
  });

  await deleteCouponCached();

  return res
    .status(201)
    .json(new ApiResponse(201, "Coupon created successfully", coupon));
});

const getAllCoupons = asyncHandler(async (req, res) => {
  const { search, isActive, discountType, page = 1, limit = 5 } = req.query;

  const pageNumber = parseInt(page) || 1;
  const limitNumber = parseInt(limit) || 5;
  if (pageNumber < 1 || limitNumber < 1) {
    throw new ApiError(400, "Page or limit number cannot be less than 1");
  }

  const skip = (pageNumber - 1) * limitNumber;
  let filter = {};
  if (search) {
    filter.code = {
      $regex: search,
      $options: "i",
    };
  }

  if (isActive === "true") {
    filter.isActive = true;
  } else if (isActive === "false") {
    filter.isActive = false;
  }

  const allowedTypes = ["PERCENTAGE", "FIXED"];

  if (discountType) {
    if (!discountType.includes(allowedTypes)) {
      throw new ApiError(400, "Invalid discount type");
    }
    filter.discountType = discountType;
  }

  const [coupons, totalCoupons] = await Promise.all([
    couponModel
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNumber)
      .populate({
        path: "createdBy",
        select: "username",
      }),

    couponModel.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(totalCoupons / limitNumber);

  if (coupons.length === 0) {
    return res.status(200).json(
      new ApiResponse(200, "No coupons to fetch", {
        coupons,
        pagination: {
          page: pageNumber,
          limit: limitNumber,
          totalCoupons,
          totalPages,
        },
      }),
    );
  }

  return res.status(200).json(
    new ApiResponse(200, "Coupons fetched successfully", {
      coupons,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        totalCoupons,
        totalPages,
      },
    }),
  );
});

const getCouponById = asyncHandler(async (req, res) => {
  const { couponId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(couponId)) {
    throw new ApiError(400, "Invalid coupon ID");
  }

  const coupon = await couponModel.findById(couponId).populate({
    path: "createdBy",
    select: "username",
  });
  if (!coupon) {
    throw new ApiError(404, "Coupon not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, "Coupon fetched successfully", coupon));
});

const updateCoupon = asyncHandler(async (req, res) => {
  const { couponId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(couponId)) {
    throw new ApiError(400, "Invalid coupon ID`");
  }

  const coupon = await couponModel.findById(couponId);
  if (!coupon) {
    throw new ApiError(404, "Coupon not found");
  }

  const updates = req.body;

  if (updates.code) {
    const normalisedCode = updates.code.trim().toUpperCase();
    const isExisting = await couponModel.findOne({
      code: normalisedCode,
      _id: { $ne: couponId },
    });

    if (isExisting) {
      throw new ApiError(409, "Coupon already exists");
    }
  }

  Object.entries(updates).forEach(([key, value]) => {
    if (value !== undefined) {
      coupon[key] = value;
    }
  });

  const expiry = new Date(coupon.expiryDate);
  if (expiry <= new Date()) {
    throw new ApiError(400, "Coupon already expired");
  }

  if (coupon.discountType === "PERCENTAGE") {
    if (coupon.discountValue > 100) {
      throw new ApiError(400, "Discount value cannot be greater than 100");
    }

    if (coupon.maximumDiscount < 1) {
      throw new ApiError(
        400,
        "Maximum discount anount should be greater than 0",
      );
    }
  } else if (coupon.discountType === "FIXED") {
    coupon.maximumDiscount = 0;
  }

  await coupon.save();
  await deleteCouponCached();

  return res
    .status(200)
    .json(new ApiResponse(200, "Coupon updated successfully", coupon));
});

const updateCouponStatus = asyncHandler(async (req, res) => {
  const { couponId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(couponId)) {
    throw new ApiError(400, "Coupon ID is invalid");
  }
  const coupon = await couponModel.findById(couponId);
  if (!coupon) {
    throw new ApiError(404, "Coupon is not existing");
  }

  coupon.isActive = !coupon.isActive;
  await coupon.save();
  await deleteCouponCached();

  return res.status(200).json(
    new ApiResponse(200, "Coupon status updated successfully", {
      currentCouponState: coupon.isActive,
    }),
  );
});

const createAnnouncements = asyncHandler(async (req, res) => {
  const { title, description, priority, expiresAt } = req.body;

  const expiry = new Date(expiresAt);
  if (expiry <= new Date()) {
    throw new ApiError(400, "Expiry should be in the future");
  }
  if (priority < 1) {
    throw new ApiError(400, "Priority should be greater than or equal to 1");
  }

  const announcement = await announcementModel.create({
    title,
    description,
    priority,
    expiresAt,
    createdBy: req.user.id,
  });

  await deleteAnnouncementsCached();

  return res
    .status(201)
    .json(
      new ApiResponse(201, "Announcement created succesfully", announcement),
    );
});

const getAnnouncements = asyncHandler(async (req, res) => {
  const { search, page = 1, limit = 5, isActive } = req.query;
  const pageNumber = parseInt(page) || 1;
  const limitNumber = parseInt(limit) || 5;
  if (pageNumber < 1 || limitNumber < 1) {
    throw new ApiError(400, "Page number or limit number is invalid");
  }
  const skip = (pageNumber - 1) * limitNumber;

  let filter = {};
  if (search) {
    filter.title = {
      $regex: search,
      $options: "i",
    };
  }

  if (isActive === "true") {
    filter.isActive = true;
  } else if (isActive === "false") {
    filter.isActive = false;
  }
  const [announcements, totalAnnouncements] = await Promise.all([
    announcementModel
      .find(filter)
      .sort({
        priority: -1,
        createdAt: -1,
      })
      .skip(skip)
      .limit(limitNumber)
      .populate({
        path: "createdBy",
        select: "username",
      }),

    announcementModel.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(totalAnnouncements / limitNumber);

  if (announcements.length === 0) {
    return res.status(200).json(
      new ApiResponse(200, "No announcements fetched", {
        announcements,
        pagination: {
          page: pageNumber,
          limit: limitNumber,
          totalAnnouncements,
          totalPages,
        },
      }),
    );
  }

  return res.status(200).json(
    new ApiResponse(200, "Announcements fetched successfully", {
      announcements,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        totalAnnouncements,
        totalPages,
      },
    }),
  );
});

const getAnnouncementById = asyncHandler(async (req, res) => {
  const { announcementId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(announcementId)) {
    throw new ApiError(400, "Announcement ID is invalid");
  }

  const announcement = await announcementModel
    .findById(announcementId)
    .populate({
      path: "createdBy",
      select: "username",
    });
  if (!announcement) {
    throw new ApiError(404, "Announcement not found");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, "Announcement fetched successfully", announcement),
    );
});

const updateAnnouncement = asyncHandler(async (req, res) => {
  const { announcementId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(announcementId)) {
    throw new ApiError(400, "Invalid announcement ID");
  }

  const announcement = await announcementModel.findById(announcementId);
  if (!announcement) {
    throw new ApiError(404, "Announcement not found");
  }

  const updates = req.body;
  Object.entries(updates).forEach(([key, value]) => {
    if (value !== undefined) {
      announcement[key] = value;
    }
  });

  if (updates.expiresAt) {
    const expiry = new Date(updates.expiresAt);
    if (expiry <= new Date()) {
      throw new ApiError(400, "Expiry date must be in future");
    }
  }

  if (updates.priority !== undefined) {
    if (updates.priority < 1) {
      throw new ApiError(400, "Priority cannot be less than 1");
    }
  }

  await announcement.save();
  await deleteAnnouncementsCached();

  return res
    .status(200)
    .json(
      new ApiResponse(200, "Announcement updated successfully", announcement),
    );
});

const updateAnnouncementStatus = asyncHandler(async (req, res) => {
  const { announcementId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(announcementId)) {
    throw new ApiError(400, "Invalid announcement ID");
  }

  const announcement = await announcementModel.findById(announcementId);
  if (!announcement) {
    throw new ApiError(404, "Announcement not found");
  }

  announcement.isActive = !announcement.isActive;
  await announcement.save();
  await deleteAnnouncementsCached();

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        "Announcement status updated successfully",
        announcement.isActive,
      ),
    );
});

const createBanner = asyncHandler(async (req, res) => {
  const { title, priority, redirectType, redirectedId } = req.body;

  if (redirectType !== "NONE" && !redirectedId) {
    throw new ApiError(400, "Redirect ID is required");
  }

  const imageLocalPath = req.file?.path;
  if (!imageLocalPath) {
    throw new ApiError(400, "Menu image is required");
  }

  const imageUrl = await uploadOnCloudinary(imageLocalPath);

  const banner = await bannerModel.create({
    title,
    priority,
    redirectType,
    redirectedId,
    image: imageUrl,
    createdBy: req.user.id,
  });

  await deletedBannerCached();

  return res
    .status(201)
    .json(new ApiResponse(201, "Banner created successfully", banner));
});

const getAllBanners = asyncHandler(async (req, res) => {
  const { search, isActive, page = 1, limit = 5 } = req.query;

  const pageNumber = parseInt(page) || 1;
  const limitNumber = parseInt(limit) || 5;
  if (pageNumber < 1 || limitNumber < 1) {
    throw new ApiError(400, "Page or limit number cannot be less than 1");
  }

  const skip = (pageNumber - 1) * limitNumber;
  let filter = {};
  if (search) {
    filter.title = {
      $regex: search,
      $options: "i",
    };
  }

  if (isActive === "true") {
    filter.isActive = true;
  } else if (isActive === "false") {
    filter.isActive = false;
  }

  const [banners, totalBanners] = await Promise.all([
    bannerModel
      .find(filter)
      .sort({
        priority: -1,
        createdAt: -1,
      })
      .skip(skip)
      .limit(limitNumber)
      .populate({
        path: "createdBy",
        select: "username",
      }),

    bannerModel.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(totalBanners / limitNumber);
  if (banners.length === 0) {
    return res.status(200).json(
      new ApiResponse(200, "No banners to show", {
        banners,
        pagination: {
          page: pageNumber,
          limit: limitNumber,
          totalBanners,
          totalPages,
        },
      }),
    );
  }

  return res.status(200).json(
    new ApiResponse(200, "Banners fetched successfully", {
      banners,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        totalBanners,
        totalPages,
      },
    }),
  );
});

const getBannerById = asyncHandler(async (req, res) => {
  const { bannerId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(bannerId)) {
    throw new ApiError(400, "Banner ID is invalid");
  }

  const banner = await bannerModel.findById(bannerId).populate({
    path: "createdBy",
    select: "username",
  });
  if (!banner) {
    throw new ApiError(404, "Banner not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, "Banner fetched successfully", banner));
});

const updateBanner = asyncHandler(async (req, res) => {
  const { bannerId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(bannerId)) {
    throw new ApiError(400, "Banner ID is invalid");
  }

  const banner = await bannerModel.findById(bannerId);
  if (!banner) {
    throw new ApiError(404, "Banner not found");
  }

  const updates = req.body;
  Object.entries(updates).forEach(([key, value]) => {
    if (value !== undefined) {
      banner[key] = value;
    }
  });

  const imageLocalPath = req.file?.path;
  if (!imageLocalPath) {
    if (updates.redirectType !== "NONE" && !updates.redirectedId) {
      throw new ApiError(400, "Redirect ID is required");
    }
    await banner.save();
    await deletedBannerCached();
    return res
      .status(200)
      .json(new ApiResponse(200, "Banner updated successfully", banner));
  }

  if (updates.redirectType !== "NONE" && !updates.redirectedId) {
    throw new ApiError(400, "Redirect ID is required");
  }

  const imageUrl = await uploadOnCloudinary(imageLocalPath);
  banner.image = imageUrl;
  await banner.save();
  await deletedBannerCached();
  return res
    .status(200)
    .json(new ApiResponse(200, "Banner updated successfully", banner));
});

const updateBannerStatus = asyncHandler(async (req, res) => {
  const { bannerId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(bannerId)) {
    throw new ApiError(400, "Banner ID is invalid");
  }
  const banner = await bannerModel.findById(bannerId);
  if (!banner) {
    throw new ApiError(404, "Banner not found");
  }

  banner.isActive = !banner.isActive;
  await banner.save();
  await deletedBannerCached();

  return res
    .status(200)
    .json(
      new ApiError(200, "Banner status updated successfully", banner.isActive),
    );
});

const topRestaurants = asyncHandler(async (req, res) => {
  const topRestaurants = await topRestaurantsPipeline();
  if (topRestaurants.length === 0) {
    return res
      .status(200)
      .json(new ApiResponse(200, "No restaurants found", topRestaurants));
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        "Top restaurants fetched successfully",
        topRestaurants,
      ),
    );
});

const generateInvoiceFood = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    throw new ApiError(400, "Invalid Order ID");
  }

  const order = await orderModel.findById(orderId).populate([
    {
      path: "user",
      select: "username email",
    },
    {
      path: "restaurant",
      select: "restaurantName location phone",
    },
  ]);
  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  const pdfBuffer = await generateInvoicePDF(order);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=invoice-${order.orderNumber}.pdf`,
  );
  res.send(pdfBuffer);
});

const generateInvoiceMarketPlace = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    throw new ApiError(400, "Invalid Order ID");
  }

  const order = await marketPlaceOrderModel.findById(orderId).populate([
    {
      path: "user",
      select: "username email",
    },
  ]);

  if (!order) {
    throw new ApiError(404, "Marketplace order not found");
  }

  const pdfBuffer = await generateMarketPlaceInvoicePDF(order);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=marketplace-invoice-${order.orderNumber}.pdf`,
  );
  res.send(pdfBuffer);
});

const abandonCart = asyncHandler(async (req, res) => {
  const { page = 1, limit = 5 } = req.query;
  const pageNumber = parseInt(page) || 1;
  const limitNumber = parseInt(limit) || 5;
  const skip = (pageNumber - 1) * limitNumber;
  let filter = {};

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  filter.updatedAt = {
    $lte: yesterday,
  };

  filter.$expr = {
    $gt: [{ $size: "$items" }, 0],
  };

  const [carts, totalCarts] = await Promise.all([
    cartModel
      .find(filter)
      .populate({
        path: "user",
        select: "username email",
      })
      .sort({ updatedAt: 1 })
      .select("items totalAmount updatedAt")
      .skip(skip)
      .limit(limitNumber),

    cartModel.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(totalCarts / limitNumber);

  if (carts.length === 0) {
    return res.status(200).json(
      new ApiResponse(200, "No Abandoned carts to fetch", {
        carts,
        pagination: {
          page: pageNumber,
          limit: limitNumber,
          totalCarts,
          totalPages,
        },
      }),
    );
  }

  return res.status(200).json(
    new ApiResponse(200, "Abandoned carts fetched successfully", {
      carts,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        totalCarts,
        totalPages,
      },
    }),
  );
});

const sendReminder = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(400, "User ID is invalid");
  }

  const user = await userModel.findById(userId);
  if (!user) {
    throw new ApiError(404, "User does not exists");
  }
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const cart = await cartModel.findOne({
    user: userId,
    $expr: { $gt: [{ $size: "$items" }, 0] },
    updatedAt: { $lte: yesterday },
  });
  if (!cart) {
    throw new ApiError(404, "Cart does not exists");
  }

  if (!user.email) {
    throw new ApiError(400, "User does not have a valid email ID");
  }

  try {
    await emailServices.queueReminderEmail({
      to: user.email,
      subject: "Hey Cutie you left something delicious behind!",
      text: `Hi Joel,

You left some delicious items in your CAMPUSIN cart.

Complete your order here:

${config.CLIENT_ID}/cart

Team CAMPUSIN`,
      reminderHtml: generateReminderHTML(),
    });
  } catch (error) {
    throw new ApiError(400, "Error in queuing email");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, "Email has been sent successfully"));
});

//MarketPlace admin controlls starts here

const getMarketPlaceDashboard = asyncHandler(async (req, res) => {
  const [overviewCards, orderStatusChart, revenueChart] = await Promise.all([
    getMarketplaceOverviewPipeline(),
    getMarketplaceOrderStatusPipeline(),
    getMarketplaceRevenueChartPipeline(),
  ]);

  return res.status(200).json(
    new ApiResponse(200, "Marketplace dashboard fetched successfully", {
      overviewCards,
      orderStatusChart,
      revenueChart,
    }),
  );
});

const getTopMarketPlaceProducts = asyncHandler(async (req, res) => {
  const topProducts = await getTopMarketplaceProductsPipeline();

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        "Top marketplace products fetched successfully",
        topProducts,
      ),
    );
});

const getTopMarketPlaceCategories = asyncHandler(async (req, res) => {
  const topCategories = await getTopMarketplaceCategoriesPipeline();

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        "Top marketplace categories fetched successfully",
        topCategories,
      ),
    );
});

const getMarketPlaceInventory = asyncHandler(async (req, res) => {
  const inventory = await getMarketplaceInventoryPipeline();

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        "Marketplace inventory fetched successfully",
        inventory,
      ),
    );
});

const createCategory = asyncHandler(async (req, res) => {
  const { name, description, priority } = req.body;
  const imageLocalPath = req.file?.path;
  if (!imageLocalPath) {
    throw new ApiError(400, "Image file is not provided");
  }

  const normalisedName = name.trim().toUpperCase();
  const isExists = await marketPlaceCategoryModel.findOne({
    name: normalisedName,
  });

  if (isExists) {
    throw new ApiError(409, "Category already exists");
  }

  const imageUrl = await uploadOnCloudinary(imageLocalPath);

  const category = await marketPlaceCategoryModel.create({
    name: normalisedName,
    description,
    priority,
    image: imageUrl,
    createdBy: req.user.id,
  });

  await deletedCategoriesCached();

  return res
    .status(201)
    .json(new ApiResponse(201, "Category created successfully", category));
});

const getAllCategories = asyncHandler(async (req, res) => {
  const { search, isActive, page = 1, limit = 5 } = req.query;
  const pageNumber = parseInt(page) || 1;
  const limitNumber = parseInt(limit) || 5;
  if (pageNumber < 1 || limitNumber < 1) {
    throw new ApiError(400, "Page number or Limit number is not valid");
  }
  const skip = (pageNumber - 1) * limitNumber;
  let filter = {};
  if (search) {
    filter.name = {
      $regex: search,
      $options: "i",
    };
  }

  if (isActive === "true") {
    filter.isActive = true;
  } else if (isActive === "false") {
    filter.isActive = false;
  }

  const [categories, totalCategories] = await Promise.all([
    marketPlaceCategoryModel
      .find(filter)
      .sort({
        priority: -1,
        createdAt: -1,
      })
      .populate({
        path: "createdBy",
        select: "username",
      })
      .select("name description image priority isActive createdBy createdAt")
      .skip(skip)
      .limit(limitNumber),

    marketPlaceCategoryModel.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(totalCategories / limitNumber);
  if (categories.length === 0) {
    return res.status(200).json(
      new ApiResponse(200, "No categories found", {
        categories,
        pagination: {
          page: pageNumber,
          limit: limitNumber,
          totalCategories,
          totalPages,
        },
      }),
    );
  }

  return res.status(200).json(
    new ApiResponse(200, "Categories fetched successfully", {
      categories,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        totalCategories,
        totalPages,
      },
    }),
  );
});

const getCategoryById = asyncHandler(async (req, res) => {
  const { categoryId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(categoryId)) {
    throw new ApiError(400, "Invalid category ID");
  }

  const category = await marketPlaceCategoryModel
    .findById(categoryId)
    .populate({
      path: "createdBy",
      select: "username",
    })
    .select(
      "name description image priority isActive createdBy createdAt updatedAt",
    );
  if (!category) {
    throw new ApiError(404, "Category not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, "Category fetched successfully", category));
});

const updateCategory = asyncHandler(async (req, res) => {
  const { categoryId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(categoryId)) {
    throw new ApiError(400, "Invalid category ID");
  }

  const category = await marketPlaceCategoryModel.findById(categoryId);
  if (!category) {
    throw new ApiError(404, "Category not found");
  }
  const { name } = req.body;
  if (name) {
    const normalisedName = name.trim().toUpperCase();
    const isNameExists = await marketPlaceCategoryModel.findOne({
      name: normalisedName,
      _id: { $ne: category._id },
    });

    if (isNameExists) {
      throw new ApiError(409, " Category name already exists");
    }

    category.name = normalisedName;
  }

  const allowedUpdates = ["priority", "description"];

  allowedUpdates.forEach((field) => {
    if (req.body[field] !== undefined) {
      category[field] = req.body[field];
    }
  });

  const imageLocalPath = req.file?.path;
  if (imageLocalPath) {
    const imageUrl = await uploadOnCloudinary(imageLocalPath);
    category.image = imageUrl;
  }

  await category.save();
  await deletedCategoriesCached();

  return res
    .status(200)
    .json(new ApiResponse(200, "Category updated successfully", category));
});

const updateCategoryStatus = asyncHandler(async (req, res) => {
  const { categoryId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(categoryId)) {
    throw new ApiError(400, "Invalid category ID");
  }

  const category = await marketPlaceCategoryModel.findById(categoryId);
  if (!category) {
    throw new ApiError(404, "Category does not exists");
  }

  category.isActive = !category.isActive;
  await category.save();
  await deletedCategoriesCached();

  return res.status(200).json(
    new ApiResponse(200, "Category status updates successfully", {
      status: category.isActive,
      categoryId: category._id,
    }),
  );
});

//Product related APIs of Marketplace

const createProducts = asyncHandler(async (req, res) => {
  const {
    category,
    name,
    description,
    price,
    stock,
    condition,
    sellerPhoneNumber,
  } = req.body;
  const imageLocalPath = req.files;
  if (!imageLocalPath || imageLocalPath.length === 0) {
    throw new ApiError(400, "Atlast one image is required");
  }

  if (!mongoose.Types.ObjectId.isValid(category)) {
    throw new ApiError(400, "Invalid category ID");
  }

  const IsCategoryExists = await marketPlaceCategoryModel.findById(category);
  if (!IsCategoryExists) {
    throw new ApiError(404, "Category does not exists");
  }

  if (!IsCategoryExists.isActive) {
    throw new ApiError(400, "Category is inactive");
  }

  const normalisedName = name.trim().toUpperCase();
  const isDuplicateProduct = await marketPlaceProductsModel.findOne({
    name: normalisedName,
    category,
  });

  if (isDuplicateProduct) {
    throw new ApiError(409, "Similar product exists");
  }

  let images;
  try {
    images = await Promise.all(
      imageLocalPath.map((file) => uploadOnCloudinary(file.path)),
    );
  } catch (error) {
    throw new ApiError(500, "Failed to upload images");
  }

  const product = await marketPlaceProductsModel.create({
    name: normalisedName,
    category,
    description,
    price,
    stock,
    condition,
    images,
    createdBy: req.user.id,
    sellerPhoneNumber,
  });

  await deleteProductCached(product._id);

  return res
    .status(201)
    .json(new ApiResponse(201, "Product created successfully", product));
});

const getAllProducts = asyncHandler(async (req, res) => {
  const {
    search,
    isActive,
    category,
    condition,
    page = 1,
    limit = 5,
  } = req.query;
  const pageNumber = parseInt(page) || 1;
  const limitNumber = parseInt(limit) || 5;
  if (pageNumber < 1 || limitNumber < 1) {
    throw new ApiError(400, "Page number or Limit number is invalid");
  }

  const skip = (pageNumber - 1) * limitNumber;
  let filter = {};
  if (search) {
    filter.name = {
      $regex: search,
      $options: "i",
    };
  }
  if (isActive === "true") {
    filter.isActive = true;
  } else if (isActive === "false") {
    filter.isActive = false;
  }

  const allowedTypes = ["NEW", "LIKE_NEW", "GOOD", "FAIR"];
  if (allowedTypes.includes(condition)) {
    filter.condition = condition;
  }

  if (category) {
    if (!mongoose.Types.ObjectId.isValid(category)) {
      throw new ApiError(400, "Category ID is not valid");
    }
    filter.category = category;
  }

  const [products, totalProducts] = await Promise.all([
    marketPlaceProductsModel
      .find(filter)
      .populate([
        {
          path: "category",
          select: "name",
        },
        {
          path: "createdBy",
          select: "username",
        },
      ])
      .select(
        "_id name price stock condition isActive category createdBy createdAt images",
      )
      .sort({
        createdAt: -1,
      })
      .skip(skip)
      .limit(limitNumber),

    marketPlaceProductsModel.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(totalProducts / limitNumber);
  if (products.length === 0) {
    return res.status(200).json(
      new ApiResponse(200, "No products to fetch", {
        products,
        pagination: {
          page: pageNumber,
          limit: limitNumber,
          totalProducts,
          totalPages,
        },
      }),
    );
  }

  return res.status(200).json(
    new ApiResponse(200, "Products fetched successfully", {
      products,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        totalProducts,
        totalPages,
      },
    }),
  );
});

const getProductById = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    throw new ApiError(400, "Product ID is invalid");
  }

  const product = await marketPlaceProductsModel
    .findById(productId)
    .populate([
      {
        path: "category",
        select: "name",
      },
      {
        path: "createdBy",
        select: "username",
      },
    ])
    .select(
      "name price stock condition isActive category createdBy description images sellerPhoneNumber createdAt updatedAt",
    );
  if (!product) {
    throw new ApiError(404, "Product not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, "Product fetchd successfully", product));
});

const updateProduct = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    throw new ApiError(400, "Product ID is invalid");
  }

  const product = await marketPlaceProductsModel.findById(productId);
  if (!product) {
    throw new ApiError(404, "Product not found");
  }

  const { categoryId } = req.body;
  const { name } = req.body;

  if (categoryId) {
    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      throw new ApiError(400, "Category ID is invalid");
    }
    const category = await marketPlaceCategoryModel.findOne({
      _id: categoryId,
      isActive: true,
    });
    if (!category) {
      throw new ApiError(404, "Category does not exists");
    }
    product.category = categoryId;
  }

  if (name) {
    const categoryToCheck = categoryId || product.category;
    const normalisedName = name.trim().toUpperCase();
    const isDuplicateProduct = await marketPlaceProductsModel.findOne({
      category: categoryToCheck,
      name: normalisedName,
      _id: { $ne: productId },
    });
    if (isDuplicateProduct) {
      throw new ApiError(409, "Similar product exists");
    }

    product.name = normalisedName;
  }

  const allowedTypes = [
    "description",
    "price",
    "stock",
    "condition",
    "sellerPhoneNumber",
  ];
  allowedTypes.forEach((field) => {
    if (req.body[field] !== undefined) {
      product[field] = req.body[field];
    }
  });

  if (req.files && req.files.length > 0) {
    try {
      const imageLocalPathArray = req.files;
      let images = await Promise.all(
        imageLocalPathArray.map((file) => {
          return uploadOnCloudinary(file.path);
        }),
      );

      product.images = images;
    } catch (error) {
      throw new ApiError(500, "Failed to upload image");
    }
  }

  await product.save();
  await deleteProductCached(productId);

  return res
    .status(200)
    .json(new ApiResponse(200, "Product updated successfully", product));
});

const updateProductStatus = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    throw new ApiError(400, "Product ID is invalid");
  }
  const product = await marketPlaceProductsModel.findById(productId);
  if (!product) {
    throw new ApiError(404, "Product not found");
  }
  product.isActive = !product.isActive;
  await product.save();
  await deleteProductCached(productId);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        "Product status updated successfully",
        product.isActive,
      ),
    );
});

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

const getAllMarketPlaceOrdersAdmin = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 5 } = req.query;
  const pageNumber = parseInt(page) || 1;
  const limitNumber = parseInt(limit) || 5;
  if (pageNumber < 1 || limitNumber < 1) {
    throw new ApiError(400, "Invalid Page number or Limit number");
  }

  const validStatus = [
    "PENDING",
    "CONFIRMED",
    "PREPARING",
    "READY",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
    "CANCELLED",
    "REJECTED",
  ];

  let filter = {};
  if (status) {
    if (!validStatus.includes(status)) {
      throw new ApiError(400, "Invalid status");
    }
    filter.orderStatus = status;
  }

  const skip = (pageNumber - 1) * limitNumber;
  const [orders, totalOrders] = await Promise.all([
    marketPlaceOrderModel
      .find(filter)
      .select(
        "user orderNumber categoryName pricing.finalAmount paymentMethod paymentStatus orderStatus customerPhone deliveryPartner createdAt rejectionMsg",
      )
      .skip(skip)
      .limit(limitNumber)
      .populate([
        {
          path: "user",
          select: "username email",
        },
        {
          path: "deliveryPartner",
          select: "phoneNumber vehicleNumber",
          populate: {
            path: "user",
            select: "username email",
          },
        },
      ])
      .sort({ createdAt: -1 }),

    marketPlaceOrderModel.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(totalOrders / limitNumber);

  return res.status(200).json(
    new ApiResponse(200, "Marketplace orders fetched successfully", {
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

const getMarketPlaceOrderByIdAdmin = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    throw new ApiError(400, "Invalid Order ID");
  }

  const order = await marketPlaceOrderModel.findById(orderId).populate([
    {
      path: "user",
      select: "username email phone",
    },
    {
      path: "category",
      select: "name description image",
    },
    {
      path: "items.product",
      select: "name description price images condition stock category",
    },
    {
      path: "deliveryPartner",
      select: "phoneNumber vehicleNumber isAvailable",
      populate: {
        path: "user",
        select: "username email",
      },
    },
  ]);

  if (!order) {
    throw new ApiError(404, "Marketplace order not found");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, "Marketplace order fetched successfully", { order }),
    );
});

const updateMarketPlaceOrderStatusAdmin = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { orderStatus, rejectionMsg } = req.body;
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    throw new ApiError(400, "Invalid Order ID");
  }

  const allowedStatus = [
    "PENDING",
    "CONFIRMED",
    "PREPARING",
    "READY",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
    "CANCELLED",
    "REJECTED",
  ];

  if (!allowedStatus.includes(orderStatus)) {
    throw new ApiError(400, "Invalid Order status");
  }

  const order = await marketPlaceOrderModel.findById(orderId);
  if (!order) {
    throw new ApiError(404, "Marketplace order not found");
  }

  if (["DELIVERED", "CANCELLED", "REJECTED"].includes(order.orderStatus)) {
    throw new ApiError(
      409,
      "Order is in a final state, no more changes can be made",
    );
  }

  if (
    orderStatus === "REJECTED" &&
    (!rejectionMsg || rejectionMsg.trim() === "")
  ) {
    throw new ApiError(400, "Rejection message is required");
  }

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const shouldRestoreStock = ["CANCELLED", "REJECTED"].includes(orderStatus);

    if (shouldRestoreStock) {
      await restoreMarketOrderStock(order.items, session);
    }

    if (orderStatus === "REJECTED") {
      order.rejectionMsg = rejectionMsg;
    } else {
      order.rejectionMsg = null;
    }

    order.orderStatus = orderStatus;
    await order.save({ session });

    if (
      ["DELIVERED", "CANCELLED", "REJECTED"].includes(orderStatus) &&
      order.deliveryPartner
    ) {
      await deliveryPartnerModel.findByIdAndUpdate(
        order.deliveryPartner,
        {
          isAvailable: true,
        },
        { session },
      );
    }

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }

  const cacheInvalidationTasks = [
    deleteMarketplaceOrderHistoryCached(order.user.toString()),
  ];

  if (["CANCELLED", "REJECTED"].includes(orderStatus)) {
    cacheInvalidationTasks.push(
      ...order.items.map((item) => deleteProductCached(item.product)),
    );
  }

  await Promise.all(cacheInvalidationTasks);

  return res.status(200).json(
    new ApiResponse(200, "Marketplace order status updated successfully", {
      orderNumber: order.orderNumber,
      orderStatus: order.orderStatus,
      rejectionMsg: order.rejectionMsg,
    }),
  );
});

const assignMarketPlaceDeliveryPartnerAdmin = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { deliveryPartnerId } = req.body;
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    throw new ApiError(400, "Invalid Order ID");
  }

  if (!mongoose.Types.ObjectId.isValid(deliveryPartnerId)) {
    throw new ApiError(400, "Invalid Delivery Partner ID");
  }

  const order = await marketPlaceOrderModel.findById(orderId);
  if (!order) {
    throw new ApiError(404, "Marketplace order not found");
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
    throw new ApiError(404, "Delivery partner does not exist");
  }

  if (!deliveryPartner.isAvailable) {
    throw new ApiError(400, "Partner unavailable");
  }

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    order.deliveryPartner = deliveryPartner._id;
    await order.save({ session });

    deliveryPartner.isAvailable = false;
    await deliveryPartner.save({ session });

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }

  try {
    if (deliveryPartner.user?.email) {
      await emailServices.queueDeliveryAssignmentEmail({
        to: deliveryPartner.user.email,
        subject: `New delivery assigned: ${order.orderNumber}`,
        text: `You have been assigned a new delivery ${order.orderNumber} on CampusIn. Login to view delivery details.`,
        deliveryAssignmentHtml: generateDeliveryAssignmentHTML({
          deliveryPartnerName: deliveryPartner.user.username,
          orderNumber: order.orderNumber,
          pickupFrom: `Marketplace - ${order.categoryName}`,
          customerPhone: order.customerPhone,
          deliveryAddress: order.deliveryAddressSnapShot,
        }),
      });
    }
  } catch (error) {
    console.error(
      "Failed to queue delivery assignment email for marketplace order:",
      error.message,
    );
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, "Delivery partner assigned successfully", order),
    );
});

// Repair Request Module

const getAllRepairRequestsAdmin = asyncHandler(async (req, res) => {
  const {
    search,
    status,
    serviceType,
    repairPartner,
    fromDate,
    toDate,
    page = 1,
    limit = 5,
  } = req.query;

  const pageNumber = parseInt(page) || 1;
  const limitNumber = parseInt(limit) || 5;
  if (pageNumber < 1 || limitNumber < 1) {
    throw new ApiError(400, "Invalid page or limit");
  }

  const filter = {};

  addRepairRequestSearchFilter(filter, search);
  addRepairRequestStatusFilter(filter, status);
  addRepairRequestServiceTypeFilter(filter, serviceType);
  addRepairRequestPartnerFilter(filter, repairPartner);
  addRepairRequestDateFilter(filter, fromDate, toDate);

  const skip = (pageNumber - 1) * limitNumber;

  const [repairRequests, totalRequests] = await Promise.all([
    repairRequestModel
      .find(filter)
      .sort({ createdAt: -1 })
      .select(
        "_id requestNumber user serviceType customerPhone pickupLocation estimatedPrice requestStatus repairPartner createdAt updatedAt",
      )
      .populate({
        path: "user",
        select: "username email",
      })
      .populate({
        path: "repairPartner",
        select: "name phoneNumber specialisations",
      })
      .skip(skip)
      .limit(limitNumber)
      .lean(),

    repairRequestModel.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(totalRequests / limitNumber);

  if (repairRequests.length === 0 || !repairRequests) {
    return res.status(200).json(
      new ApiResponse(200, "No requests to display", {
        repairRequests,
        pagination: {
          page: pageNumber,
          limit: limitNumber,
          totalRequests,
          totalPages,
        },
      }),
    );
  }
  return res.status(200).json(
    new ApiResponse(200, "Repair requests fetched successfully", {
      repairRequests,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        totalRequests,
        totalPages,
      },
    }),
  );
});

const getRepairRequestByIdAdmin = asyncHandler(async (req, res) => {
  const { requestId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(requestId)) {
    throw new ApiError(400, "Invalid request ID");
  }

  const repairRequest = await repairRequestModel
    .findById(requestId)
    .populate({
      path: "user",
      select: "username email",
    })
    .populate({
      path: "repairPartner",
      select: "name phoneNumber specialisations isActive",
    })
    .select(
      "requestNumber user serviceType description damageImages pickupLocation customerPhone estimatedPrice adminRemarks estimatedAt requestStatus acceptedAt repairPartner forwardedAt completedAt createdAt updatedAt",
    )
    .lean();

  if (!repairRequest) {
    throw new ApiError(404, "Repair request not found");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        "Repair request fetched successfully",
        repairRequest,
      ),
    );
});

const sendRepairRequestEstimateAdmin = asyncHandler(async (req, res) => {
  const { requestId } = req.params;
  const { estimatedPrice, adminRemarks } = req.body;

  if (!mongoose.Types.ObjectId.isValid(requestId)) {
    throw new ApiError(400, "Invalid request ID");
  }

  const repairRequest = await repairRequestModel.findById(requestId).populate({
    path: "user",
    select: "username email",
  });

  if (!repairRequest) {
    throw new ApiError(404, "Repair request not found");
  }

  if (
    !["SUBMITTED", "FORWARDED", "PRICE_SENT"].includes(
      repairRequest.requestStatus,
    )
  ) {
    throw new ApiError(
      409,
      `Estimate cannot be sent when request status is ${repairRequest.requestStatus}`,
    );
  }

  if (!repairRequest.user?.email) {
    throw new ApiError(400, "User does not have a valid email ID");
  }

  repairRequest.estimatedPrice = estimatedPrice;
  repairRequest.adminRemarks = adminRemarks || null;
  repairRequest.estimatedAt = new Date();
  repairRequest.requestStatus = "PRICE_SENT";
  await repairRequest.save();

  const requestOwnerId = repairRequest.user._id.toString();
  await Promise.all([
    deleteUserRepairRequestsCached(requestOwnerId),
    deleteUserRepairRequestByIdCached({
      userId: requestOwnerId,
      requestId: repairRequest._id.toString(),
    }),
  ]);

  try {
    await emailServices.queueRepairRequestEstimateEmail({
      to: repairRequest.user.email,
      subject: `Repair estimate for ${repairRequest.requestNumber}`,
      text: "This email is regarding your repair request submitted in CampusIn. If you are not able to view this email, kindly login to the CampusIn portal",
      estimateHtml: generateRepairRequestEstimateHTML(
        repairRequest,
        estimatedPrice,
        adminRemarks,
      ),
    });
  } catch (error) {
    throw new ApiError(400, "Estimate saved but email could not be queued");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, "Estimate sent successfully", repairRequest));
});

const assignRepairPartnerAdmin = asyncHandler(async (req, res) => {
  const { requestId } = req.params;
  const { repairPartner } = req.body;

  if (!mongoose.Types.ObjectId.isValid(requestId)) {
    throw new ApiError(400, "Invalid request ID");
  }

  const repairRequest = await repairRequestModel.findById(requestId);
  if (!repairRequest) {
    throw new ApiError(404, "Repair request not found");
  }

  if (repairRequest.requestStatus !== "SUBMITTED") {
    throw new ApiError(
      409,
      "Repair partner can be assigned only after the request is submitted",
    );
  }

  const partner = await repairPartnerModel.findById(repairPartner);
  if (!partner) {
    throw new ApiError(404, "Repair partner not found");
  }

  if (!partner.isActive) {
    throw new ApiError(400, "Repair partner is inactive");
  }

  if (!partner.specialisations.includes(repairRequest.serviceType)) {
    throw new ApiError(
      400,
      "Repair partner does not support this service type",
    );
  }

  repairRequest.repairPartner = partner._id;
  repairRequest.forwardedAt = new Date();
  repairRequest.requestStatus = "FORWARDED";
  await repairRequest.save();

  const requestOwnerId = repairRequest.user.toString();
  await Promise.all([
    deleteUserRepairRequestsCached(requestOwnerId),
    deleteUserRepairRequestByIdCached({
      userId: requestOwnerId,
      requestId: repairRequest._id.toString(),
    }),
  ]);

  await repairRequest.populate({
    path: "repairPartner",
    select: "name phoneNumber specialisations isActive",
  });

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        "Repair partner assigned successfully",
        repairRequest,
      ),
    );
});

const completeRepairRequestAdmin = asyncHandler(async (req, res) => {
  const { requestId } = req.params;
  const { adminRemarks } = req.body;

  if (!mongoose.Types.ObjectId.isValid(requestId)) {
    throw new ApiError(400, "Invalid request ID");
  }

  const repairRequest = await repairRequestModel.findById(requestId);
  if (!repairRequest) {
    throw new ApiError(404, "Repair request not found");
  }

  if (repairRequest.requestStatus === "COMPLETED") {
    throw new ApiError(409, "Repair request is already completed");
  }

  if (repairRequest.requestStatus !== "ACCEPTED") {
    throw new ApiError(
      409,
      "Repair request can be completed only after the customer accepts the estimate",
    );
  }

  repairRequest.requestStatus = "COMPLETED";
  repairRequest.completedAt = new Date();
  if (adminRemarks !== undefined) {
    repairRequest.adminRemarks = adminRemarks;
  }
  await repairRequest.save();

  const requestOwnerId = repairRequest.user.toString();
  await Promise.all([
    deleteUserRepairRequestsCached(requestOwnerId),
    deleteUserRepairRequestByIdCached({
      userId: requestOwnerId,
      requestId: repairRequest._id.toString(),
    }),
  ]);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        "Repair request completed successfully",
        repairRequest,
      ),
    );
});

//Repair Partner Module

const createRepairPartner = asyncHandler(async (req, res) => {
  const { name, phoneNumber, specialisations } = req.body;

  const isExisting = await repairPartnerModel.findOne({
    phoneNumber,
  });

  if (isExisting) {
    throw new ApiError(409, "Similar user exists with the same mobile number");
  }

  const normalisedName = name.trim();
  const repairPartner = await repairPartnerModel.create({
    name: normalisedName,
    phoneNumber,
    specialisations,
  });

  return res.status(201).json(
    new ApiResponse(201, "New repair partner created successfully", {
      name: repairPartner.name,
      phoneNumber: repairPartner.phoneNumber,
      specialisations: repairPartner.specialisations,
      isActive: repairPartner.isActive,
    }),
  );
});

const getAllRepairPartner = asyncHandler(async (req, res) => {
  const repairPartners = await repairPartnerModel
    .find({
      isActive: true,
    })
    .select("name phoneNumber specialisations isActive");
  if (!repairPartners) {
    throw new ApiError(404, "Repair Partners not found");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        "Repair partners fetched successfully",
        repairPartners,
      ),
    );
});

const getOneRepairPartner = asyncHandler(async (req, res) => {
  const { partnerId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(partnerId)) {
    throw new ApiError(400, "Invalid Partner Id");
  }

  const repairPartner = await repairPartnerModel
    .findById(partnerId)
    .select("name phoneNumber specialisations isActive");
  if (!repairPartner) {
    throw new ApiError(404, "Repair partner not found ");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        "Reapir Partner fethced successfully",
        repairPartner,
      ),
    );
});

const updateRepairPartner = asyncHandler(async (req, res) => {
  const { partnerId } = req.params;
  if (!partnerId) {
    throw new ApiError(400, "Partner Id not found");
  }

  const repairPartner = await repairPartnerModel.findById(partnerId);
  if (!repairPartner) {
    throw new ApiError(404, "Repair partner not found");
  }
  const allowedFields = ["name", "phoneNumber", "specialisations"];

  allowedFields.forEach((value) => {
    if (req.body[value] !== undefined) {
      repairPartner[value] = req.body[value];
    }
  });

  await repairPartner.save();

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        "Repair Partner updated successfully",
        repairPartner,
      ),
    );
});

const updateRepairPartnerStatus = asyncHandler(async (req, res) => {
  const { partnerId } = req.params;
  const repairPartner = await repairPartnerModel.findById(partnerId);
  if (!repairPartner) {
    throw new ApiError(404, "Repair partner not found");
  }

  repairPartner.isActive = !repairPartner.isActive;
  await repairPartner.save();

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        "Repair Partner status upadted successfully",
        repairPartner.isActive,
      ),
    );
});

export default {
  viewAdminDashboard,
  viewUsers,
  viewVendors,
  viewRestaurants,
  blockUser,
  unBlockUser,
  suspendRestaurant,
  activateRestaurant,
  getAllOrders,
  getOrderById,
  configSettings,
  editSettings,
  createCoupons,
  getAllCoupons,
  getCouponById,
  updateCoupon,
  updateCouponStatus,
  createAnnouncements,
  getAnnouncements,
  getAnnouncementById,
  updateAnnouncement,
  updateAnnouncementStatus,
  createBanner,
  getAllBanners,
  getBannerById,
  updateBanner,
  updateBannerStatus,
  topRestaurants,
  getPlatformSettingsAdmin,
  generateInvoiceFood,
  generateInvoiceMarketPlace,
  abandonCart,
  sendReminder,
  getMarketPlaceDashboard,
  getTopMarketPlaceProducts,
  getTopMarketPlaceCategories,
  getMarketPlaceInventory,
  createCategory,
  getAllCategories,
  getCategoryById,
  updateCategory,
  updateCategoryStatus,
  createProducts,
  getProductById,
  getAllProducts,
  updateProduct,
  updateProductStatus,
  getAllMarketPlaceOrdersAdmin,
  getMarketPlaceOrderByIdAdmin,
  updateMarketPlaceOrderStatusAdmin,
  assignMarketPlaceDeliveryPartnerAdmin,
  getAllRepairRequestsAdmin,
  getRepairRequestByIdAdmin,
  sendRepairRequestEstimateAdmin,
  assignRepairPartnerAdmin,
  completeRepairRequestAdmin,
  createRepairPartner,
  getAllRepairPartner,
  getOneRepairPartner,
  updateRepairPartner,
  updateRepairPartnerStatus,
};
