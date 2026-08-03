import { jest } from "@jest/globals";
import bcrypt from "bcrypt";
import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";

process.env.MONGO_URI ||= "mongodb://127.0.0.1:27017/admin-controller-test";
process.env.JWT_SECRET ||= "test-jwt-secret";
process.env.CLIENT_ID ||= "http://localhost:5173";
process.env.CLIENT_SECRET ||= "test-client-secret";
process.env.GOOGLE_REFRESH_TOKEN ||= "test-google-refresh-token";
process.env.GOOGLE_USER ||= "test-google-user@example.com";
process.env.CLOUDINARY_API_KEY ||= "test-cloudinary-api-key";
process.env.CLOUDINARY_API_SECRET ||= "test-cloudinary-api-secret";
process.env.CLOUDINARY_NAME ||= "test-cloudinary-name";
process.env.GOOGLE_CLIENT_ID ||= "test-google-client-id";
process.env.GOOGLE_CLIENT_SECRET ||= "test-google-client-secret";
process.env.GOOGLE_CALLBACK_URL ||= "http://localhost/api/auth/google/callback";
process.env.CLIENT_URL ||= "http://localhost:5173";
process.env.REDIS_HOST ||= "localhost";
process.env.REDIS_PORT ||= "6379";
process.env.REDIS_PASSWORD ||= "test-redis-password";
process.env.REDIS_URL ||= "redis://localhost:6379";

const revenueStatsMock = jest.fn();
const uploadOnCloudinaryMock = jest.fn();
const generateInvoicePDFMock = jest.fn();
const generateMarketPlaceInvoicePDFMock = jest.fn();
const sendEmailMock = jest.fn();
const emailQueueMock = {
  queueReminderEmail: jest.fn(async ({ to, subject, text, reminderHtml }) =>
    sendEmailMock(to, subject, text, reminderHtml),
  ),
  queueRepairRequestEstimateEmail: jest.fn(),
  queueOTPEmail: jest.fn(),
  queueWelcomeEmail: jest.fn(),
  queueForgotEmail: jest.fn(),
  queueVendorNewOrderEmail: jest.fn(),
  queueAdminMarketplaceOrderEmail: jest.fn(),
  queueDeliveryAssignmentEmail: jest.fn(),
};
const platformSettingsCachedMock = jest.fn();
const setPlatformSettingsCachedMock = jest.fn();
const deletePlatformSettingsCachedMock = jest.fn();
const deletedBannerCachedMock = jest.fn();
const deleteAnnouncementsCachedMock = jest.fn();
const deletedCategoriesCachedMock = jest.fn();
const deleteRestaurantCachedMock = jest.fn();
const deleteProductCachedMock = jest.fn();
const deleteCouponCachedMock = jest.fn();
const topRestaurantsPipelineMock = jest.fn();
const marketplaceOverviewMock = jest.fn();
const marketplaceOrderStatusMock = jest.fn();
const marketplaceRevenueChartMock = jest.fn();
const topMarketplaceProductsMock = jest.fn();
const topMarketplaceCategoriesMock = jest.fn();
const marketplaceInventoryMock = jest.fn();

jest.unstable_mockModule("../src/utils/revenueStats.utils.js", () => ({
  default: revenueStatsMock,
}));

jest.unstable_mockModule("../src/services/cloudinary.services.js", () => ({
  uploadOnCloudinary: uploadOnCloudinaryMock,
}));

jest.unstable_mockModule("../src/services/invoice.services.js", () => ({
  default: generateInvoicePDFMock,
}));

jest.unstable_mockModule("../src/services/marketPlaceInvoice.services.js", () => ({
  default: generateMarketPlaceInvoicePDFMock,
}));

jest.unstable_mockModule("../src/services/email.services.js", () => ({
  sendEmail: sendEmailMock,
}));

jest.unstable_mockModule("../src/services/emailQueue.services.js", () => ({
  default: emailQueueMock,
}));

jest.unstable_mockModule(
  "../src/services/platformSettingsCached.services.js",
  () => ({
    platformSettingsCached: platformSettingsCachedMock,
    setPlatformSettingsCached: setPlatformSettingsCachedMock,
    deletePlatformSettingsCached: deletePlatformSettingsCachedMock,
  }),
);

jest.unstable_mockModule("../src/services/bannersCached.services.js", () => ({
  deletedBannerCached: deletedBannerCachedMock,
}));

jest.unstable_mockModule(
  "../src/services/announcementsCached.services.js",
  () => ({
    deleteAnnouncementsCached: deleteAnnouncementsCachedMock,
  }),
);

jest.unstable_mockModule("../src/services/categoriesCached.services.js", () => ({
  deletedCategoriesCached: deletedCategoriesCachedMock,
}));

jest.unstable_mockModule("../src/services/restaurantCached.services.js", () => ({
  deleteRestaurantCached: deleteRestaurantCachedMock,
}));

jest.unstable_mockModule(
  "../src/services/marketPlaceProductsCached.services.js",
  () => ({
    deleteProductCached: deleteProductCachedMock,
  }),
);

jest.unstable_mockModule("../src/services/couponCached.services.js", () => ({
  deleteCouponCached: deleteCouponCachedMock,
}));

jest.unstable_mockModule("../src/utils/topRestaurant.utils.js", () => ({
  default: topRestaurantsPipelineMock,
}));

jest.unstable_mockModule("../src/utils/marketPlaceAnalytics.utils.js", () => ({
  getMarketplaceOverviewPipeline: marketplaceOverviewMock,
  getMarketplaceOrderStatusPipeline: marketplaceOrderStatusMock,
  getMarketplaceRevenueChartPipeline: marketplaceRevenueChartMock,
  getTopMarketplaceProductsPipeline: topMarketplaceProductsMock,
  getTopMarketplaceCategoriesPipeline: topMarketplaceCategoriesMock,
  getMarketplaceInventoryPipeline: marketplaceInventoryMock,
}));

jest.unstable_mockModule("../src/middlewares/multer.middlewares.js", () => ({
  default: {
    single: jest.fn(() => (req, res, next) => next()),
    array: jest.fn(() => (req, res, next) => next()),
  },
}));

let app;
let mongoServer;
let userModel;
let restaurantModel;
let orderModel;
let platformSettingsModel;
let couponModel;
let announcementModel;
let bannerModel;
let categoryModel;
let productModel;
let repairPartnerModel;
let menuModel;
let marketPlaceOrderModel;
let deliveryPartnerModel;
let cartModel;
let ApiError;

const futureDate = (days = 7) =>
  new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

const buildToken = (user, overrides = {}) =>
  jwt.sign(
    {
      id: user._id.toString(),
      role: user.role,
      ...overrides,
    },
    process.env.JWT_SECRET,
    { expiresIn: "15m" },
  );

const authHeader = (user) => ({ Authorization: `Bearer ${buildToken(user)}` });

const createUser = async ({
  username = `user-${new mongoose.Types.ObjectId().toString().slice(-6)}`,
  email = `${username}@example.com`,
  password = "password123",
  role = "user",
  verified = true,
  isBlocked = false,
} = {}) =>
  userModel.create({
    username,
    email,
    password: await bcrypt.hash(password, 10),
    role,
    verified,
    isBlocked,
  });

const createRestaurant = async (owner, overrides = {}) =>
  restaurantModel.create({
    owner: owner._id,
    restaurantName: "Campus Cafe",
    description: "Coffee and snacks",
    category: "Cafe",
    phone: "9876543210",
    email: "cafe@example.com",
    location: "North Block",
    isOpen: true,
    ...overrides,
  });

const createMenuItem = async (restaurant, overrides = {}) =>
  menuModel.create({
    restaurant: restaurant._id,
    name: "Masala dosa",
    description: "Crispy dosa",
    price: 80,
    mrp: 90,
    category: "Breakfast",
    foodType: "veg",
    image: "https://cdn.example.com/dosa.jpg",
    ...overrides,
  });

const createOrder = async (user, restaurant, overrides = {}) => {
  const menuItem = await createMenuItem(restaurant, {
    name: `Masala dosa ${new mongoose.Types.ObjectId().toString().slice(-6)}`,
  });

  return orderModel.create({
    user: user._id,
    restaurant: restaurant._id,
    restaurantName: restaurant.restaurantName,
    items: [
      {
        menuItem: menuItem._id,
        itemName: "Masala dosa",
        priceAtPurchase: 80,
        quantity: 1,
      },
    ],
    totalAmount: 99,
    paymentMethod: "COD",
    pricing: {
      subTotal: 80,
      gstPercentage: 5,
      gstAmount: 4,
      deliveryCharge: 10,
      packagingCharge: 5,
      platformCharge: 0,
      couponDiscount: 0,
      finalAmount: 99,
    },
    orderNumber: `ORD-${new mongoose.Types.ObjectId().toString().slice(-8)}`,
    customerPhone: "9876543210",
    deliveryAddress: "Hostel 1",
    ...overrides,
  });
};

const createCoupon = async (admin, overrides = {}) =>
  couponModel.create({
    code: "SAVE10",
    discountType: "PERCENTAGE",
    discountValue: 10,
    minimumOrderValue: 100,
    maximumDiscount: 50,
    expiryDate: futureDate(),
    usageLimit: 20,
    createdBy: admin._id,
    ...overrides,
  });

const createCategoryRecord = async (admin, overrides = {}) =>
  {
    const basePricingSettings = {
      deliveryCharge: 10,
      freeDeliveryAbove: 500,
      minimumOrderValue: 50,
      gstPercentage: 5,
      packagingCharge: 2,
      platformCharge: 3,
    };

    const { pricingSettings, ...restOverrides } = overrides;

    return categoryModel.create({
      name: "BOOKS",
      description: "Study material",
      image: "https://cdn.example.com/books.jpg",
      priority: 1,
      createdBy: admin._id,
      pricingSettings: {
        ...basePricingSettings,
        ...(pricingSettings || {}),
      },
      ...restOverrides,
    });
  };

const createProduct = async (admin, category, overrides = {}) =>
  productModel.create({
    category: category._id,
    name: `NOTEBOOK-${new mongoose.Types.ObjectId().toString().slice(-6)}`,
    description: "Ruled notebook",
    price: 120,
    stock: 10,
    images: ["https://cdn.example.com/notebook.jpg"],
    condition: "NEW",
    createdBy: admin._id,
    sellerPhoneNumber: "9876543210",
    ...overrides,
  });

const createMarketplaceOrder = async (user, category, product, overrides = {}) =>
  marketPlaceOrderModel.create({
    user: user._id,
    category: category._id,
    categoryName: category.name,
    items: [
      {
        product: product._id,
        productName: product.name,
        productImage: product.images[0],
        priceAtPurchase: product.price,
        quantity: 1,
      },
    ],
    pricing: {
      subTotal: 120,
      gstPercentage: 5,
      gstAmount: 6,
      deliveryCharge: 10,
      packagingCharge: 0,
      platformCharge: 0,
      couponDiscount: 0,
      finalAmount: 136,
    },
    pricingSettingsSnapshot: {
      deliveryCharge: category.pricingSettings?.deliveryCharge ?? 10,
      freeDeliveryAbove: category.pricingSettings?.freeDeliveryAbove ?? 500,
      minimumOrderValue: category.pricingSettings?.minimumOrderValue ?? 50,
      gstPercentage: category.pricingSettings?.gstPercentage ?? 5,
      packagingCharge: category.pricingSettings?.packagingCharge ?? 2,
      platformCharge: category.pricingSettings?.platformCharge ?? 3,
    },
    deliveryAddressSnapShot: "Hostel 2",
    customerPhone: "9876543210",
    paymentMethod: "COD",
    orderNumber: `MKT-${new mongoose.Types.ObjectId().toString().slice(-8)}`,
    ...overrides,
  });

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create({
    instance: {
      ip: "127.0.0.1",
    },
  });
  await mongoose.connect(mongoServer.getUri());

  const [
    { default: adminRouter },
    userModule,
    restaurantModule,
    orderModule,
    settingsModule,
    couponModule,
    announcementModule,
    bannerModule,
    categoryModule,
    productModule,
    repairPartnerModule,
    menuModule,
    marketplaceOrderModule,
    deliveryPartnerModule,
    cartModule,
    errorModule,
  ] = await Promise.all([
    import("../src/routes/admin.routes.js"),
    import("../src/models/user.models.js"),
    import("../src/models/restaurant.models.js"),
    import("../src/models/order.models.js"),
    import("../src/models/platformSettings.models.js"),
    import("../src/models/coupon.models.js"),
    import("../src/models/anouncement.models.js"),
    import("../src/models/banners.models.js"),
    import("../src/models/marketPlaceCategory.models.js"),
    import("../src/models/marketPlaceProducts.models.js"),
    import("../src/models/repairPartner.models.js"),
    import("../src/models/menuItem.models.js"),
    import("../src/models/marketPlaceOrders.models.js"),
    import("../src/models/deliveryPartner.models.js"),
    import("../src/models/cart.models.js"),
    import("../src/utils/apiErrors.js"),
  ]);

  userModel = userModule.default;
  restaurantModel = restaurantModule.default;
  orderModel = orderModule.default;
  platformSettingsModel = settingsModule.default;
  couponModel = couponModule.default;
  announcementModel = announcementModule.default;
  bannerModel = bannerModule.default;
  categoryModel = categoryModule.default;
  productModel = productModule.default;
  repairPartnerModel = repairPartnerModule.default;
  menuModel = menuModule.default;
  marketPlaceOrderModel = marketplaceOrderModule.default;
  deliveryPartnerModel = deliveryPartnerModule.default;
  cartModel = cartModule.default;
  ApiError = errorModule.default;

  app = express();
  app.use(express.json());
  app.use("/api/admin", adminRouter);
  app.use((req, res) => {
    res.status(404).json({
      statusCode: 404,
      data: null,
      message: `Route not found: ${req.method} ${req.originalUrl}`,
      success: false,
      errors: [],
    });
  });
  app.use((err, req, res, next) => {
    const statusCode = err instanceof ApiError ? err.statusCode : 500;
    res.status(statusCode).json({
      statusCode,
      data: null,
      message: err.message || "Internal server error",
      success: false,
      errors: err.errors || [],
    });
  });
});

beforeEach(async () => {
  await Promise.all(
    Object.values(mongoose.connection.collections).map((collection) =>
      collection.deleteMany({}),
    ),
  );

  jest.restoreAllMocks();
  jest.clearAllMocks();

  revenueStatsMock.mockResolvedValue({ totalRevenue: 2500 });
  uploadOnCloudinaryMock.mockResolvedValue("https://cdn.example.com/image.jpg");
  generateInvoicePDFMock.mockResolvedValue(Buffer.from("food-pdf"));
  generateMarketPlaceInvoicePDFMock.mockResolvedValue(
    Buffer.from("marketplace-pdf"),
  );
  sendEmailMock.mockResolvedValue(undefined);
  platformSettingsCachedMock.mockResolvedValue(null);
  setPlatformSettingsCachedMock.mockResolvedValue(undefined);
  deletePlatformSettingsCachedMock.mockResolvedValue(undefined);
  deletedBannerCachedMock.mockResolvedValue(undefined);
  deleteAnnouncementsCachedMock.mockResolvedValue(undefined);
  deletedCategoriesCachedMock.mockResolvedValue(undefined);
  deleteRestaurantCachedMock.mockResolvedValue(undefined);
  deleteProductCachedMock.mockResolvedValue(undefined);
  deleteCouponCachedMock.mockResolvedValue(undefined);
  topRestaurantsPipelineMock.mockResolvedValue([]);
  marketplaceOverviewMock.mockResolvedValue({ orders: 3 });
  marketplaceOrderStatusMock.mockResolvedValue([{ status: "PENDING", count: 1 }]);
  marketplaceRevenueChartMock.mockResolvedValue([{ day: "Mon", revenue: 100 }]);
  topMarketplaceProductsMock.mockResolvedValue([{ name: "Notebook", sold: 5 }]);
  topMarketplaceCategoriesMock.mockResolvedValue([{ name: "BOOKS", sold: 5 }]);
  marketplaceInventoryMock.mockResolvedValue([{ name: "Notebook", stock: 12 }]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer?.stop();
});

describe("admin controller routes", () => {
  describe("admin authentication and authorization", () => {
    it("rejects missing, malformed, expired, and non-admin credentials", async () => {
      // Arrange
      const user = await createUser({ role: "user", username: "notadmin" });
      const expired = jwt.sign(
        { id: user._id.toString(), role: "admin" },
        process.env.JWT_SECRET,
        { expiresIn: "-1s" },
      );

      // Act
      const missing = await request(app).get("/api/admin/dashboard");
      const malformed = await request(app)
        .get("/api/admin/dashboard")
        .set("Authorization", "Bearer bad-token");
      const expiredResponse = await request(app)
        .get("/api/admin/dashboard")
        .set("Authorization", `Bearer ${expired}`);
      const forbidden = await request(app)
        .get("/api/admin/dashboard")
        .set(authHeader(user));

      // Assert
      expect(missing.status).toBe(401);
      expect(missing.body.message).toBe("Unauthorized");
      expect(malformed.status).toBe(401);
      expect(malformed.body.message).toBe("Invalid token");
      expect(expiredResponse.status).toBe(401);
      expect(expiredResponse.body.message).toBe("Token expired");
      expect(forbidden.status).toBe(403);
      expect(forbidden.body.message).toBe("Forbidden");
    });
  });

  describe("dashboard and account listings", () => {
    it("returns aggregate dashboard counts for admins", async () => {
      // Arrange
      const admin = await createUser({ role: "admin", username: "admin" });
      const user = await createUser({ role: "user", username: "student" });
      const vendor = await createUser({ role: "vendor", username: "vendor" });
      const restaurant = await createRestaurant(vendor);
      await createOrder(user, restaurant);

      // Act
      const response = await request(app)
        .get("/api/admin/dashboard")
        .set(authHeader(admin));

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Dashboard details fetched successfully");
      expect(response.body.data).toMatchObject({
        userCount: 1,
        vendorCount: 1,
        restaurantCount: 1,
        orderCount: 1,
        revenue: { totalRevenue: 2500 },
      });
      expect(revenueStatsMock).toHaveBeenCalledTimes(1);
    });

    it("lists users with search and pagination while excluding passwords", async () => {
      // Arrange
      const admin = await createUser({ role: "admin", username: "admin" });
      await createUser({ role: "user", username: "alice" });
      await createUser({ role: "user", username: "bob" });
      await createUser({ role: "vendor", username: "alicevendor" });

      // Act
      const response = await request(app)
        .get("/api/admin/dashboard/users?search=ali&page=1&limit=10")
        .set(authHeader(admin));

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.data.users).toHaveLength(1);
      expect(response.body.data.users[0]).toMatchObject({
        username: "alice",
        role: "user",
      });
      expect(response.body.data.users[0].password).toBeUndefined();
      expect(response.body.data.pagination).toMatchObject({
        page: 1,
        limit: 10,
        totalUsers: 1,
        totalPages: 1,
      });
    });

    it("rejects invalid pagination for user and vendor listing endpoints", async () => {
      // Arrange
      const admin = await createUser({ role: "admin", username: "admin" });

      // Act
      const usersResponse = await request(app)
        .get("/api/admin/dashboard/users?limit=-1")
        .set(authHeader(admin));
      const vendorsResponse = await request(app)
        .get("/api/admin/dashboard/vendors?limit=-1")
        .set(authHeader(admin));

      // Assert
      expect(usersResponse.status).toBe(400);
      expect(usersResponse.body.message).toBe(
        "Invalid page number or limit number",
      );
      expect(vendorsResponse.status).toBe(400);
      expect(vendorsResponse.body.message).toBe(
        "Invalid page number or limit number",
      );
    });

    it("lists vendors and restaurants with filters", async () => {
      // Arrange
      const admin = await createUser({ role: "admin", username: "admin" });
      const vendor = await createUser({ role: "vendor", username: "pizzaowner" });
      await createUser({ role: "vendor", username: "cafeowner" });
      await createRestaurant(vendor, {
        restaurantName: "Pizza Square",
        category: "Fast Food",
        isOpen: false,
      });

      // Act
      const vendorsResponse = await request(app)
        .get("/api/admin/dashboard/vendors?search=pizza")
        .set(authHeader(admin));
      const restaurantsResponse = await request(app)
        .get(
          "/api/admin/dashboard/restaurants?search=pizza&category=Fast%20Food&isOpen=false",
        )
        .set(authHeader(admin));

      // Assert
      expect(vendorsResponse.status).toBe(200);
      expect(vendorsResponse.body.data.venodors).toHaveLength(1);
      expect(restaurantsResponse.status).toBe(200);
      expect(restaurantsResponse.body.data.restaurants).toHaveLength(1);
      expect(restaurantsResponse.body.data.restaurants[0]).toMatchObject({
        restaurantName: "Pizza Square",
        isOpen: false,
      });
    });

    it("surfaces database failures from dashboard listings", async () => {
      // Arrange
      const admin = await createUser({ role: "admin", username: "admin" });
      jest
        .spyOn(userModel, "countDocuments")
        .mockRejectedValueOnce(new Error("count failed"));

      // Act
      const response = await request(app)
        .get("/api/admin/dashboard")
        .set(authHeader(admin));

      // Assert
      expect(response.status).toBe(500);
      expect(response.body.message).toBe("count failed");
    });
  });

  describe("user and restaurant moderation", () => {
    it("blocks and unblocks users", async () => {
      // Arrange
      const admin = await createUser({ role: "admin", username: "admin" });
      const user = await createUser({ role: "user", username: "blockme" });

      // Act
      const blockResponse = await request(app)
        .patch(`/api/admin/users/${user._id}/block`)
        .set(authHeader(admin));
      const blockedUser = await userModel.findById(user._id);
      const unblockResponse = await request(app)
        .patch(`/api/admin/users/${user._id}/unblock`)
        .set(authHeader(admin));
      const unblockedUser = await userModel.findById(user._id);

      // Assert
      expect(blockResponse.status).toBe(200);
      expect(blockResponse.body.message).toBe("User blocked successfully");
      expect(blockedUser.isBlocked).toBe(true);
      expect(unblockResponse.status).toBe(200);
      expect(unblockResponse.body.message).toBe("User un-blocked successfully");
      expect(unblockedUser.isBlocked).toBe(false);
    });

    it("returns clear errors for invalid or missing users during moderation", async () => {
      // Arrange
      const admin = await createUser({ role: "admin", username: "admin" });
      const missingId = new mongoose.Types.ObjectId();

      // Act
      const invalid = await request(app)
        .patch("/api/admin/users/not-an-id/block")
        .set(authHeader(admin));
      const missing = await request(app)
        .patch(`/api/admin/users/${missingId}/block`)
        .set(authHeader(admin));

      // Assert
      expect(invalid.status).toBe(404);
      expect(invalid.body.message).toBe("Invalid User ID");
      expect(missing.status).toBe(404);
      expect(missing.body.message).toBe("User not found");
    });

    it("suspends and activates restaurants while clearing restaurant cache", async () => {
      // Arrange
      const admin = await createUser({ role: "admin", username: "admin" });
      const vendor = await createUser({ role: "vendor", username: "vendor" });
      const restaurant = await createRestaurant(vendor);

      // Act
      const suspendResponse = await request(app)
        .patch(`/api/admin/restaurants/${restaurant._id}/suspend`)
        .set(authHeader(admin));
      const suspended = await restaurantModel.findById(restaurant._id);
      const activateResponse = await request(app)
        .patch(`/api/admin/restaurants/${restaurant._id}/activate`)
        .set(authHeader(admin));
      const activated = await restaurantModel.findById(restaurant._id);

      // Assert
      expect(suspendResponse.status).toBe(200);
      expect(suspended).toMatchObject({ isSuspended: true, isOpen: false });
      expect(activateResponse.status).toBe(200);
      expect(activateResponse.body.message).toBe(
        "Restaurant activated successfully",
      );
      expect(activated).toMatchObject({ isSuspended: false, isOpen: true });
      expect(deleteRestaurantCachedMock).toHaveBeenCalledWith(
        restaurant._id.toString(),
      );
    });
  });

  describe("orders", () => {
    it("lists orders by status and fetches an order by id", async () => {
      // Arrange
      const admin = await createUser({ role: "admin", username: "admin" });
      const user = await createUser({ role: "user", username: "orderuser" });
      const vendor = await createUser({ role: "vendor", username: "vendor" });
      const restaurant = await createRestaurant(vendor);
      const order = await createOrder(user, restaurant, { orderStatus: "PENDING" });
      await createOrder(user, restaurant, { orderStatus: "DELIVERED" });

      // Act
      const listResponse = await request(app)
        .get("/api/admin/orders?status=PENDING&page=1&limit=5")
        .set(authHeader(admin));
      const detailResponse = await request(app)
        .get(`/api/admin/orders/${order._id}`)
        .set(authHeader(admin));

      // Assert
      expect(listResponse.status).toBe(200);
      expect(listResponse.body.data.orders).toHaveLength(1);
      expect(listResponse.body.data.orders[0].orderStatus).toBe("PENDING");
      expect(detailResponse.status).toBe(200);
      expect(detailResponse.body.message).toBe("Order fetched successfully");
      expect(detailResponse.body.data.order._id).toBe(order._id.toString());
    });

    it("rejects invalid order filters and ids", async () => {
      // Arrange
      const admin = await createUser({ role: "admin", username: "admin" });

      // Act
      const badStatus = await request(app)
        .get("/api/admin/orders?status=OUT_FOR_DELIVERY")
        .set(authHeader(admin));
      const badId = await request(app)
        .get("/api/admin/orders/not-an-id")
        .set(authHeader(admin));

      // Assert
      expect(badStatus.status).toBe(400);
      expect(badStatus.body.message).toBe("Invalid status");
      expect(badId.status).toBe(400);
      expect(badId.body.message).toBe("Invalid OrderID");
    });
  });

  describe("platform settings", () => {
    it("creates default settings when none exist and returns cached settings when available", async () => {
      // Arrange
      const admin = await createUser({ role: "admin", username: "admin" });
      platformSettingsCachedMock.mockResolvedValueOnce({
        deliveryCharge: 10,
        minimumOrderValue: 50,
        platformCharge: 5,
      });

      // Act
      const configureResponse = await request(app)
        .get("/api/admin/settings")
        .set(authHeader(admin));
      const cachedResponse = await request(app)
        .get("/api/admin/view/settings")
        .set(authHeader(admin));

      // Assert
      expect(configureResponse.status).toBe(200);
      expect(configureResponse.body.success).toBe(false);
      await expect(platformSettingsModel.countDocuments()).resolves.toBe(1);
      expect(cachedResponse.status).toBe(200);
      expect(cachedResponse.body.data).toMatchObject({
        deliveryCharge: 10,
        minimumOrderValue: 50,
        platformCharge: 5,
      });
    });

    it("updates settings and invalidates cache", async () => {
      // Arrange
      const admin = await createUser({ role: "admin", username: "admin" });
      await platformSettingsModel.create({});

      // Act
      const response = await request(app)
        .patch("/api/admin/settings")
        .set(authHeader(admin))
        .send({
          deliveryCharge: 20,
          minimumOrderValue: 100,
          freeDeliveryAbove: 500,
          platformCharge: 7,
        });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Settings updated successfully");
      expect(response.body.data).toMatchObject({
        deliveryCharge: 20,
        minimumOrderValue: 100,
        freeDeliveryAbove: 500,
        platformCharge: 7,
      });
      expect(deletePlatformSettingsCachedMock).toHaveBeenCalledTimes(1);
    });

    it("rejects invalid setting validation and inconsistent delivery thresholds", async () => {
      // Arrange
      const admin = await createUser({ role: "admin", username: "admin" });
      await platformSettingsModel.create({});

      // Act
      const invalidValidation = await request(app)
        .patch("/api/admin/settings")
        .set(authHeader(admin))
        .send({ deliveryCharge: -1 });
      const inconsistent = await request(app)
        .patch("/api/admin/settings")
        .set(authHeader(admin))
        .send({ minimumOrderValue: 500, freeDeliveryAbove: 100 });

      // Assert
      expect(invalidValidation.status).toBe(400);
      expect(invalidValidation.body.message).toBe("Validation failed");
      expect(inconsistent.status).toBe(400);
      expect(inconsistent.body.message).toBe(
        "Minimum order value cannot be above free delivery order value",
      );
    });
  });

  describe("coupons", () => {
    it("creates fixed and percentage coupons with normalization and cache invalidation", async () => {
      // Arrange
      const admin = await createUser({ role: "admin", username: "admin" });

      // Act
      const fixedResponse = await request(app)
        .post("/api/admin/coupons")
        .set(authHeader(admin))
        .send({
          code: " flat50 ",
          discountType: "FIXED",
          discountValue: 50,
          minimumOrderValue: 200,
          maximumDiscount: 999,
          expiryDate: futureDate(),
          usageLimit: 10,
        });
      const percentageResponse = await request(app)
        .post("/api/admin/coupons")
        .set(authHeader(admin))
        .send({
          code: "save15",
          discountType: "PERCENTAGE",
          discountValue: 15,
          minimumOrderValue: 100,
          maximumDiscount: 30,
          expiryDate: futureDate(),
          usageLimit: 5,
        });

      // Assert
      expect(fixedResponse.status).toBe(201);
      expect(fixedResponse.body.data).toMatchObject({
        code: "FLAT50",
        discountType: "FIXED",
        maximumDiscount: 0,
      });
      expect(percentageResponse.status).toBe(201);
      expect(percentageResponse.body.data.code).toBe("SAVE15");
      expect(deleteCouponCachedMock).toHaveBeenCalledTimes(2);
    });

    it("rejects invalid coupon payloads, duplicates, expired coupons, and bad percentage rules", async () => {
      // Arrange
      const admin = await createUser({ role: "admin", username: "admin" });
      await createCoupon(admin, { code: "DUPLICATE" });

      // Act
      const validation = await request(app)
        .post("/api/admin/coupons")
        .set(authHeader(admin))
        .send({ code: "", discountType: "BOGUS" });
      const duplicate = await request(app)
        .post("/api/admin/coupons")
        .set(authHeader(admin))
        .send({
          code: "duplicate",
          discountType: "FIXED",
          discountValue: 10,
          minimumOrderValue: 0,
          maximumDiscount: 0,
          expiryDate: futureDate(),
          usageLimit: 1,
        });
      const expired = await request(app)
        .post("/api/admin/coupons")
        .set(authHeader(admin))
        .send({
          code: "EXPIRED",
          discountType: "FIXED",
          discountValue: 10,
          minimumOrderValue: 0,
          maximumDiscount: 0,
          expiryDate: new Date(Date.now() - 1000).toISOString(),
          usageLimit: 1,
        });
      const badPercentage = await request(app)
        .post("/api/admin/coupons")
        .set(authHeader(admin))
        .send({
          code: "BADPERCENT",
          discountType: "PERCENTAGE",
          discountValue: 101,
          minimumOrderValue: 0,
          maximumDiscount: 10,
          expiryDate: futureDate(),
          usageLimit: 1,
        });

      // Assert
      expect(validation.status).toBe(400);
      expect(validation.body.message).toBe("Validation failed");
      expect(duplicate.status).toBe(409);
      expect(duplicate.body.message).toBe("Coupon already exists");
      expect(expired.status).toBe(400);
      expect(expired.body.message).toBe("Coupon already expired");
      expect(badPercentage.status).toBe(400);
      expect(badPercentage.body.message).toBe("Percentage cannot exceed 100%");
    });

    it("lists coupons, handles empty results, fetches by id, updates, and toggles status", async () => {
      // Arrange
      const admin = await createUser({ role: "admin", username: "admin" });
      const coupon = await createCoupon(admin, { code: "SAVE10" });

      // Act
      const listResponse = await request(app)
        .get("/api/admin/coupons?search=SAVE&isActive=true&discountType=FIXED")
        .set(authHeader(admin));
      const emptyResponse = await request(app)
        .get("/api/admin/coupons?search=NOPE")
        .set(authHeader(admin));
      const detailResponse = await request(app)
        .get(`/api/admin/coupons/${coupon._id}`)
        .set(authHeader(admin));
      const updateResponse = await request(app)
        .patch(`/api/admin/coupons/${coupon._id}`)
        .set(authHeader(admin))
        .send({ code: "newsave", discountType: "FIXED", discountValue: 20 });
      const statusResponse = await request(app)
        .patch(`/api/admin/coupons/${coupon._id}/status`)
        .set(authHeader(admin));

      // Assert
      expect(listResponse.status).toBe(400);
      expect(listResponse.body.message).toBe("Invalid discount type");
      expect(emptyResponse.status).toBe(200);
      expect(emptyResponse.body.message).toBe("No coupons to fetch");
      expect(detailResponse.status).toBe(200);
      expect(detailResponse.body.data._id).toBe(coupon._id.toString());
      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.data).toMatchObject({
        code: "NEWSAVE",
        discountType: "FIXED",
        maximumDiscount: 0,
      });
      expect(statusResponse.status).toBe(200);
      expect(statusResponse.body.data.currentCouponState).toBe(false);
    });

    it("returns clear errors for invalid coupon ids, missing coupons, and invalid updates", async () => {
      // Arrange
      const admin = await createUser({ role: "admin", username: "admin" });
      const missingId = new mongoose.Types.ObjectId();
      const coupon = await createCoupon(admin, { code: "PERCENT" });

      // Act
      const invalidDetail = await request(app)
        .get("/api/admin/coupons/not-an-id")
        .set(authHeader(admin));
      const missingDetail = await request(app)
        .get(`/api/admin/coupons/${missingId}`)
        .set(authHeader(admin));
      const invalidUpdate = await request(app)
        .patch("/api/admin/coupons/not-an-id")
        .set(authHeader(admin))
        .send({ code: "ANY" });
      const invalidStatus = await request(app)
        .patch("/api/admin/coupons/not-an-id/status")
        .set(authHeader(admin));
      const badPercentage = await request(app)
        .patch(`/api/admin/coupons/${coupon._id}`)
        .set(authHeader(admin))
        .send({ discountValue: 101 });

      // Assert
      expect(invalidDetail.status).toBe(400);
      expect(invalidDetail.body.message).toBe("Invalid coupon ID");
      expect(missingDetail.status).toBe(404);
      expect(missingDetail.body.message).toBe("Coupon not found");
      expect(invalidUpdate.status).toBe(400);
      expect(invalidUpdate.body.message).toBe("Invalid coupon ID`");
      expect(invalidStatus.status).toBe(400);
      expect(invalidStatus.body.message).toBe("Coupon ID is invalid");
      expect(badPercentage.status).toBe(400);
      expect(badPercentage.body.message).toBe(
        "Discount value cannot be greater than 100",
      );
    });

    it("surfaces database failures from coupon creation", async () => {
      // Arrange
      const admin = await createUser({ role: "admin", username: "admin" });
      jest
        .spyOn(couponModel, "findOne")
        .mockRejectedValueOnce(new Error("coupon lookup failed"));

      // Act
      const response = await request(app)
        .post("/api/admin/coupons")
        .set(authHeader(admin))
        .send({
          code: "DBFAIL",
          discountType: "FIXED",
          discountValue: 10,
          minimumOrderValue: 0,
          maximumDiscount: 0,
          expiryDate: futureDate(),
          usageLimit: 1,
        });

      // Assert
      expect(response.status).toBe(500);
      expect(response.body.message).toBe("coupon lookup failed");
    });
  });

  describe("announcements, banners, marketplace categories, and repair partners", () => {
    it("creates, lists, updates, and toggles announcements", async () => {
      // Arrange
      const admin = await createUser({ role: "admin", username: "admin" });

      // Act
      const createResponse = await request(app)
        .post("/api/admin/announcements")
        .set(authHeader(admin))
        .send({
          title: "Holiday",
          description: "Campus closed tomorrow",
          priority: 2,
          expiresAt: futureDate(),
        });
      const announcementId = createResponse.body.data._id;
      const listResponse = await request(app)
        .get("/api/admin/announcements?search=holiday")
        .set(authHeader(admin));
      const updateResponse = await request(app)
        .patch(`/api/admin/announcements/${announcementId}`)
        .set(authHeader(admin))
        .send({ priority: 3 });
      const statusResponse = await request(app)
        .patch(`/api/admin/announcements/${announcementId}/status`)
        .set(authHeader(admin));

      // Assert
      expect(createResponse.status).toBe(201);
      expect(listResponse.status).toBe(200);
      expect(listResponse.body.data.announcements).toHaveLength(1);
      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.data.priority).toBe(3);
      expect(statusResponse.status).toBe(200);
      expect(statusResponse.body.data).toBe(false);
      expect(deleteAnnouncementsCachedMock).toHaveBeenCalledTimes(3);
    });

    it("rejects announcement edge cases", async () => {
      // Arrange
      const admin = await createUser({ role: "admin", username: "admin" });

      // Act
      const validation = await request(app)
        .post("/api/admin/announcements")
        .set(authHeader(admin))
        .send({ title: "", description: "" });
      const expired = await request(app)
        .post("/api/admin/announcements")
        .set(authHeader(admin))
        .send({
          title: "Old enough",
          description: "Expired announcement",
          priority: 1,
          expiresAt: new Date(Date.now() - 1000).toISOString(),
        });
      const invalidId = await request(app)
        .get("/api/admin/announcements/not-an-id")
        .set(authHeader(admin));

      // Assert
      expect(validation.status).toBe(400);
      expect(validation.body.message).toBe("Validation failed");
      expect(expired.status).toBe(400);
      expect(expired.body.message).toBe("Expiry should be in the future");
      expect(invalidId.status).toBe(400);
      expect(invalidId.body.message).toBe("Announcement ID is invalid");
    });

    it("lists, fetches, and toggles banners without touching Cloudinary", async () => {
      // Arrange
      const admin = await createUser({ role: "admin", username: "admin" });
      const banner = await bannerModel.create({
        title: "Lunch",
        image: "https://cdn.example.com/banner.jpg",
        redirectType: "NONE",
        priority: 1,
        createdBy: admin._id,
      });

      // Act
      const listResponse = await request(app)
        .get("/api/admin/banners?search=lunch")
        .set(authHeader(admin));
      const detailResponse = await request(app)
        .get(`/api/admin/banners/${banner._id}`)
        .set(authHeader(admin));
      const statusResponse = await request(app)
        .patch(`/api/admin/banners/${banner._id}/status`)
        .set(authHeader(admin));

      // Assert
      expect(listResponse.status).toBe(200);
      expect(listResponse.body.data.banners).toHaveLength(1);
      expect(detailResponse.status).toBe(200);
      expect(detailResponse.body.data._id).toBe(banner._id.toString());
      expect(statusResponse.status).toBe(200);
      expect(statusResponse.body.statusCode).toBe(200);
      expect(statusResponse.body.success).toBe(true);
      expect(statusResponse.body.data.isActive).toBe(false);
      expect(deletedBannerCachedMock).toHaveBeenCalledTimes(1);
    });

    it("creates and updates marketplace categories through mocked uploads", async () => {
      // Arrange
      const admin = await createUser({ role: "admin", username: "admin" });
      const category = await categoryModel.create({
        name: "BOOKS",
        description: "Study material",
        image: "https://cdn.example.com/books.jpg",
        priority: 1,
        createdBy: admin._id,
        pricingSettings: {
          deliveryCharge: 10,
          freeDeliveryAbove: 500,
          minimumOrderValue: 50,
          gstPercentage: 5,
          packagingCharge: 2,
          platformCharge: 3,
        },
      });

      // Act
      const listResponse = await request(app)
        .get("/api/admin/marketplace/categories?search=BOOKS")
        .set(authHeader(admin));
      const detailResponse = await request(app)
        .get(`/api/admin/marketplace/categories/${category._id}`)
        .set(authHeader(admin));
      const updateResponse = await request(app)
        .patch(`/api/admin/marketplace/categories/${category._id}`)
        .set(authHeader(admin))
        .send({
          name: "Stationery",
          priority: 4,
          deliveryCharge: 25,
          minimumOrderValue: 120,
          freeDeliveryAbove: 700,
        });
      const statusResponse = await request(app)
        .patch(`/api/admin/marketPlace/categories/${category._id}/status`)
        .set(authHeader(admin));

      // Assert
      expect(listResponse.status).toBe(200);
      expect(listResponse.body.data.categories).toHaveLength(1);
      expect(detailResponse.status).toBe(200);
      expect(detailResponse.body.data.name).toBe("BOOKS");
      expect(detailResponse.body.data.pricingSettings).toMatchObject({
        deliveryCharge: 10,
        minimumOrderValue: 50,
      });
      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.data).toMatchObject({
        name: "STATIONERY",
        priority: 4,
      });
      expect(updateResponse.body.data.pricingSettings).toMatchObject({
        deliveryCharge: 25,
        minimumOrderValue: 120,
        freeDeliveryAbove: 700,
      });
      expect(statusResponse.status).toBe(200);
      expect(statusResponse.body.data.status).toBe(false);
      expect(deletedCategoriesCachedMock).toHaveBeenCalledTimes(2);
    });

    it("returns category errors for invalid ids, missing categories, and duplicate names", async () => {
      // Arrange
      const admin = await createUser({ role: "admin", username: "admin" });
      const category = await createCategoryRecord(admin, { name: "BOOKS" });
      await createCategoryRecord(admin, { name: "GAMES" });
      const missingId = new mongoose.Types.ObjectId();

      // Act
      const invalidList = await request(app)
        .get("/api/admin/marketplace/categories?limit=-1")
        .set(authHeader(admin));
      const invalidDetail = await request(app)
        .get("/api/admin/marketplace/categories/not-an-id")
        .set(authHeader(admin));
      const missingDetail = await request(app)
        .get(`/api/admin/marketplace/categories/${missingId}`)
        .set(authHeader(admin));
      const duplicateUpdate = await request(app)
        .patch(`/api/admin/marketplace/categories/${category._id}`)
        .set(authHeader(admin))
        .send({ name: "games" });
      const inconsistentPricing = await request(app)
        .patch(`/api/admin/marketplace/categories/${category._id}`)
        .set(authHeader(admin))
        .send({ minimumOrderValue: 800, freeDeliveryAbove: 200 });

      // Assert
      expect(invalidList.status).toBe(400);
      expect(invalidList.body.message).toBe(
        "Invalid page number or limit number",
      );
      expect(invalidDetail.status).toBe(400);
      expect(invalidDetail.body.message).toBe("Invalid category ID");
      expect(missingDetail.status).toBe(404);
      expect(missingDetail.body.message).toBe("Category not found");
      expect(duplicateUpdate.status).toBe(409);
      expect(duplicateUpdate.body.message).toBe(" Category name already exists");
      expect(inconsistentPricing.status).toBe(400);
      expect(inconsistentPricing.body.message).toBe(
        "Minimum order value cannot be above free delivery order value",
      );
    });

    it("creates, lists, updates, and toggles repair partners", async () => {
      // Arrange
      const admin = await createUser({ role: "admin", username: "admin" });

      // Act
      const createResponse = await request(app)
        .post("/api/admin/repair-partners")
        .set(authHeader(admin))
        .send({
          name: "FixIt",
          phoneNumber: "9876543210",
          specialisations: ["MOBILE", "LAPTOP"],
        });
      const listResponse = await request(app)
        .get("/api/admin/repair-partners")
        .set(authHeader(admin));
      const partnerId = listResponse.body.data[0]._id;
      const updateResponse = await request(app)
        .patch(`/api/admin/repair-partners/${partnerId}`)
        .set(authHeader(admin))
        .send({ name: "FixIt Pro" });
      const statusResponse = await request(app)
        .patch(`/api/admin/repair-partners/${partnerId}/status`)
        .set(authHeader(admin));

      // Assert
      expect(createResponse.status).toBe(201);
      expect(createResponse.body.message).toBe(
        "New repair partner created successfully",
      );
      expect(listResponse.status).toBe(200);
      expect(listResponse.body.data).toHaveLength(1);
      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.data.name).toBe("FixIt Pro");
      expect(statusResponse.status).toBe(200);
      expect(statusResponse.body.data).toBe(false);
    });
  });

  describe("marketplace admin dashboards", () => {
    it("returns marketplace dashboard analytics from mocked pipeline utilities", async () => {
      // Arrange
      const admin = await createUser({ role: "admin", username: "admin" });

      // Act
      const dashboard = await request(app)
        .get("/api/admin/marketplace/dashboard")
        .set(authHeader(admin));
      const products = await request(app)
        .get("/api/admin/marketplace/dashboard/top-products")
        .set(authHeader(admin));
      const categories = await request(app)
        .get("/api/admin/marketplace/dashboard/top-categories")
        .set(authHeader(admin));
      const inventory = await request(app)
        .get("/api/admin/marketplace/dashboard/inventory")
        .set(authHeader(admin));

      // Assert
      expect(dashboard.status).toBe(200);
      expect(dashboard.body.data).toMatchObject({
        overviewCards: { orders: 3 },
      });
      expect(products.status).toBe(200);
      expect(products.body.data[0].name).toBe("Notebook");
      expect(categories.status).toBe(200);
      expect(categories.body.data[0].name).toBe("BOOKS");
      expect(inventory.status).toBe(200);
      expect(inventory.body.data[0].stock).toBe(12);
    });
  });

  describe("marketplace products and orders", () => {
    it("lists, fetches, updates, and toggles marketplace products", async () => {
      // Arrange
      const admin = await createUser({ role: "admin", username: "admin" });
      const category = await createCategoryRecord(admin, { name: "BOOKS" });
      const product = await createProduct(admin, category, { name: "NOTEBOOK" });

      // Act
      const listResponse = await request(app)
        .get(
          `/api/admin/marketplace/products?search=note&category=${category._id}&condition=NEW&isActive=true`,
        )
        .set(authHeader(admin));
      const detailResponse = await request(app)
        .get(`/api/admin/marketplace/products/${product._id}`)
        .set(authHeader(admin));
      const updateResponse = await request(app)
        .patch(`/api/admin/marketplace/products/${product._id}`)
        .set(authHeader(admin))
        .send({ name: "premium notebook", price: 150 });
      const statusResponse = await request(app)
        .patch(`/api/admin/marketplace/products/${product._id}/status`)
        .set(authHeader(admin));

      // Assert
      expect(listResponse.status).toBe(200);
      expect(listResponse.body.data.products).toHaveLength(1);
      expect(detailResponse.status).toBe(200);
      expect(detailResponse.body.data.name).toBe("NOTEBOOK");
      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.data).toMatchObject({
        name: "PREMIUM NOTEBOOK",
        price: 150,
      });
      expect(statusResponse.status).toBe(200);
      expect(statusResponse.body.data).toBe(false);
      expect(deleteProductCachedMock).toHaveBeenCalledWith(product._id.toString());
    });

    it("returns product validation, lookup, and duplicate errors", async () => {
      // Arrange
      const admin = await createUser({ role: "admin", username: "admin" });
      const category = await createCategoryRecord(admin, { name: "BOOKS" });
      const product = await createProduct(admin, category, { name: "PEN" });
      await createProduct(admin, category, { name: "PENCIL" });
      const missingId = new mongoose.Types.ObjectId();

      // Act
      const invalidCategory = await request(app)
        .get("/api/admin/marketplace/products?category=bad-id")
        .set(authHeader(admin));
      const invalidDetail = await request(app)
        .get("/api/admin/marketplace/products/not-an-id")
        .set(authHeader(admin));
      const missingDetail = await request(app)
        .get(`/api/admin/marketplace/products/${missingId}`)
        .set(authHeader(admin));
      const duplicateUpdate = await request(app)
        .patch(`/api/admin/marketplace/products/${product._id}`)
        .set(authHeader(admin))
        .send({ name: "pencil" });
      const invalidStatus = await request(app)
        .patch("/api/admin/marketplace/products/not-an-id/status")
        .set(authHeader(admin));

      // Assert
      expect(invalidCategory.status).toBe(400);
      expect(invalidCategory.body.message).toBe("Invalid category ID");
      expect(invalidDetail.status).toBe(400);
      expect(invalidDetail.body.message).toBe("Product ID is invalid");
      expect(missingDetail.status).toBe(404);
      expect(missingDetail.body.message).toBe("Product not found");
      expect(duplicateUpdate.status).toBe(409);
      expect(duplicateUpdate.body.message).toBe("Similar product exists");
      expect(invalidStatus.status).toBe(400);
      expect(invalidStatus.body.message).toBe("Product ID is invalid");
    });

    it("lists and fetches marketplace orders", async () => {
      // Arrange
      const admin = await createUser({ role: "admin", username: "admin" });
      const buyer = await createUser({ role: "user", username: "buyer" });
      const category = await createCategoryRecord(admin, { name: "BOOKS" });
      const product = await createProduct(admin, category, { name: "TEXTBOOK" });
      const order = await createMarketplaceOrder(buyer, category, product, {
        orderStatus: "CONFIRMED",
      });

      // Act
      const listResponse = await request(app)
        .get("/api/admin/marketplace/orders?status=CONFIRMED")
        .set(authHeader(admin));
      const detailResponse = await request(app)
        .get(`/api/admin/marketplace/orders/${order._id}`)
        .set(authHeader(admin));

      // Assert
      expect(listResponse.status).toBe(200);
      expect(listResponse.body.data.orders).toHaveLength(1);
      expect(detailResponse.status).toBe(200);
      expect(detailResponse.body.data.order._id).toBe(order._id.toString());
    });

    it("rejects invalid marketplace order requests before transaction work", async () => {
      // Arrange
      const admin = await createUser({ role: "admin", username: "admin" });
      const buyer = await createUser({ role: "user", username: "buyer" });
      const category = await createCategoryRecord(admin, { name: "BOOKS" });
      const product = await createProduct(admin, category, { name: "TEXTBOOK" });
      const finalOrder = await createMarketplaceOrder(buyer, category, product, {
        orderStatus: "DELIVERED",
      });

      // Act
      const badStatusFilter = await request(app)
        .get("/api/admin/marketplace/orders?status=BAD")
        .set(authHeader(admin));
      const invalidDetail = await request(app)
        .get("/api/admin/marketplace/orders/not-an-id")
        .set(authHeader(admin));
      const invalidUpdate = await request(app)
        .patch(`/api/admin/marketplace/orders/${finalOrder._id}/status`)
        .set(authHeader(admin))
        .send({ orderStatus: "BAD" });
      const finalStateUpdate = await request(app)
        .patch(`/api/admin/marketplace/orders/${finalOrder._id}/status`)
        .set(authHeader(admin))
        .send({ orderStatus: "READY" });
      const invalidAssign = await request(app)
        .patch(`/api/admin/marketplace/orders/${finalOrder._id}/assign-delivery`)
        .set(authHeader(admin))
        .send({ deliveryPartnerId: "not-an-id" });

      // Assert
      expect(badStatusFilter.status).toBe(400);
      expect(badStatusFilter.body.message).toBe("Invalid status");
      expect(invalidDetail.status).toBe(400);
      expect(invalidDetail.body.message).toBe("Invalid Order ID");
      expect(invalidUpdate.status).toBe(400);
      expect(invalidUpdate.body.message).toBe("Invalid Order status");
      expect(finalStateUpdate.status).toBe(409);
      expect(finalStateUpdate.body.message).toBe(
        "Order is in a final state, no more changes can be made",
      );
      expect(invalidAssign.status).toBe(400);
      expect(invalidAssign.body.message).toBe("Invalid Delivery Partner ID");
    });
  });

  describe("invoices and abandoned carts", () => {
    it("generates a food order invoice with PDF headers", async () => {
      // Arrange
      const admin = await createUser({ role: "admin", username: "admin" });
      const user = await createUser({ role: "user", username: "invoiceuser" });
      const vendor = await createUser({ role: "vendor", username: "vendor" });
      const restaurant = await createRestaurant(vendor);
      const order = await createOrder(user, restaurant);

      // Act
      const response = await request(app)
        .get(`/api/admin/orders/${order._id}/invoice`)
        .set(authHeader(admin));

      // Assert
      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toBe("application/pdf");
      expect(response.headers["content-disposition"]).toContain(
        `invoice-${order.orderNumber}.pdf`,
      );
      expect(generateInvoicePDFMock).toHaveBeenCalledTimes(1);
    });

    it("generates a marketplace order invoice with PDF headers", async () => {
      // Arrange
      const admin = await createUser({ role: "admin", username: "admin" });
      const buyer = await createUser({ role: "user", username: "buyer" });
      const category = await createCategoryRecord(admin, { name: "BOOKS" });
      const product = await createProduct(admin, category, { name: "TEXTBOOK" });
      const order = await createMarketplaceOrder(buyer, category, product);

      // Act
      const response = await request(app)
        .get(`/api/admin/marketplace/orders/${order._id}/invoice`)
        .set(authHeader(admin));

      // Assert
      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toBe("application/pdf");
      expect(response.headers["content-disposition"]).toContain(
        `marketplace-invoice-${order.orderNumber}.pdf`,
      );
      expect(generateMarketPlaceInvoicePDFMock).toHaveBeenCalledTimes(1);
    });

    it("lists abandoned carts and sends reminder emails", async () => {
      // Arrange
      const admin = await createUser({ role: "admin", username: "admin" });
      const user = await createUser({ role: "user", username: "cartuser" });
      const vendor = await createUser({ role: "vendor", username: "vendor" });
      const restaurant = await createRestaurant(vendor);
      const menuItem = await createMenuItem(restaurant);
      const cart = await cartModel.create({
        user: user._id,
        restaurant: restaurant._id,
        items: [{ menuItem: menuItem._id, quantity: 2 }],
        totalAmount: 160,
      });
      await cartModel.updateOne(
        { _id: cart._id },
        { updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
        { timestamps: false },
      );

      // Act
      const listResponse = await request(app)
        .get("/api/admin/abandoned-carts")
        .set(authHeader(admin));
      const reminderResponse = await request(app)
        .post(`/api/admin/abandoned-carts/${user._id}/remind`)
        .set(authHeader(admin));

      // Assert
      expect(listResponse.status).toBe(200);
      expect(listResponse.body.data.carts).toHaveLength(1);
      expect(reminderResponse.status).toBe(200);
      expect(reminderResponse.body.message).toBe(
        "Email has been sent successfully",
      );
      expect(sendEmailMock).toHaveBeenCalledWith(
        user.email,
        expect.any(String),
        expect.stringContaining("/cart"),
        expect.any(String),
      );
    });

    it("returns abandoned-cart reminder edge-case errors", async () => {
      // Arrange
      const admin = await createUser({ role: "admin", username: "admin" });
      const user = await createUser({ role: "user", username: "emptycart" });

      // Act
      const invalidUser = await request(app)
        .post("/api/admin/abandoned-carts/not-an-id/remind")
        .set(authHeader(admin));
      const noCart = await request(app)
        .post(`/api/admin/abandoned-carts/${user._id}/remind`)
        .set(authHeader(admin));

      // Assert
      expect(invalidUser.status).toBe(400);
      expect(invalidUser.body.message).toBe("User ID is invalid");
      expect(noCart.status).toBe(404);
      expect(noCart.body.message).toBe("Cart does not exists");
    });
  });
});
