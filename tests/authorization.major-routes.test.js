import { jest } from "@jest/globals";
import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";

process.env.MONGO_URI ||= "mongodb://127.0.0.1:27017/major-authz-test";
process.env.JWT_SECRET ||= "test-jwt-secret";
process.env.CLIENT_ID ||= "test-client-id";
process.env.SMTP2GO_HOST ||= "mail.smtp2go.com";
process.env.SMTP2GO_PORT ||= "2525";
process.env.SMTP2GO_USER ||= "test-smtp2go-user";
process.env.SMTP2GO_PASS ||= "test-smtp2go-pass";
process.env.SMTP2GO_FROM_EMAIL ||= "order@example.com";
process.env.SMTP2GO_FROM_NAME ||= "Campus In";
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

const passThrough = (req, res, next) => next();
const okHandler = (req, res) => res.status(200).json({ ok: true });

jest.unstable_mockModule("../src/middlewares/block.middlewares.js", () => ({
  blockMiddleware: passThrough,
}));

jest.unstable_mockModule("../src/middlewares/restaurantSuspension.middlewares.js", () => ({
  restaurantSuspensionMiddleware: passThrough,
}));

jest.unstable_mockModule("../src/middlewares/rateLimiter.middlewares.js", () => ({
  strictLimiter: passThrough,
  cartLimiter: passThrough,
  reviewsLimiter: passThrough,
  relaxedLimiter: passThrough,
  searchAwareRelaxedLimiter: passThrough,
  uploadLimiter: passThrough,
  getClientIp: jest.fn(() => "127.0.0.1"),
  getLoginRateLimitKey: jest.fn(() => "mock-key"),
  getBlockDurationFromAttempts: jest.fn(() => null),
  getLoginAttemptsRedisKey: jest.fn(() => "attempts-key"),
  getLoginBlockRedisKey: jest.fn(() => "block-key"),
}));

jest.unstable_mockModule("../src/middlewares/multer.middlewares.js", () => ({
  default: {
    single: () => passThrough,
    array: () => passThrough,
  },
}));

jest.unstable_mockModule("../src/validators/restaurant.validators.js", () => ({
  restaurantValidationRules: passThrough,
  restaurantStatusValidationRule: passThrough,
}));

jest.unstable_mockModule("../src/validators/menu.validators.js", () => ({
  menuValidationRules: passThrough,
}));

jest.unstable_mockModule("../src/validators/menuUpdate.validators.js", () => ({
  menuUpdateValidationRules: passThrough,
}));

jest.unstable_mockModule("../src/validators/menuStatus.validators.js", () => ({
  menuStatusValidationRule: passThrough,
}));

jest.unstable_mockModule("../src/validators/review.validators.js", () => ({
  default: passThrough,
}));

jest.unstable_mockModule("../src/validators/marketCart.validators.js", () => ({
  default: passThrough,
}));

jest.unstable_mockModule("../src/validators/deliveryPartner.validators.js", () => ({
  default: {
    deliveryPartnerValidationRules: passThrough,
  },
}));

jest.unstable_mockModule("../src/validators/repairRequest.validators.js", () => ({
  createRepairRequestRules: passThrough,
  updateRepairRequestRules: passThrough,
}));

jest.unstable_mockModule("../src/controllers/auth.controllers.js", () => ({
  default: {},
}));

jest.unstable_mockModule("../src/controllers/restaurant.controllers.js", () => ({
  default: {
    createRestaurant: okHandler,
    updateRestaurant: okHandler,
    getMyRestaurants: okHandler,
    getRestaurantById: okHandler,
    dltRestaurantById: okHandler,
    updateRestaurantStatus: okHandler,
    getAllRestaurantsByUser: okHandler,
    getRestaurantByUser: okHandler,
  },
}));

jest.unstable_mockModule("../src/controllers/menu.controllers.js", () => ({
  default: {
    createMenuItem: okHandler,
    getRestaurantMenu: okHandler,
    getMenuSuggestions: okHandler,
    getMenuItemById: okHandler,
    updateMenuItem: okHandler,
    updateMenuStatus: okHandler,
    deleteMenuItem: okHandler,
  },
}));

jest.unstable_mockModule("../src/controllers/order.controllers.js", () => ({
  default: {
    createOrder: okHandler,
    getAllOrders: okHandler,
    getSingleOrder: okHandler,
    cancelOrder: okHandler,
    getVendorOrder: okHandler,
    getPlatformSettingsVendor: okHandler,
    getSingleVendorOrder: okHandler,
    changeOrderStatus: okHandler,
    getPlatformSettingsUser: okHandler,
    getAllCoupons: okHandler,
    applyCoupon: okHandler,
  },
}));

jest.unstable_mockModule("../src/controllers/marketPlace.contollers.js", () => ({
  default: {
    getAllCategoriesByUser: okHandler,
    getCategoryPlatformSettings: okHandler,
    getAllProductsByUser: okHandler,
    getMarketPlaceProductSuggestions: okHandler,
    getProductsByIdUser: okHandler,
  },
}));

jest.unstable_mockModule("../src/controllers/marketCart.controllers.js", () => ({
  default: {
    addToMarketCart: okHandler,
    getItemsFromMarketCart: okHandler,
    updateMarketCartItemQuantity: okHandler,
    deleteMarketCartItem: okHandler,
    deleteMarketCart: okHandler,
  },
}));

jest.unstable_mockModule("../src/controllers/marketPlaceOrders.contollers.js", () => ({
  default: {
    createMarketPlaceOrder: okHandler,
    getAllMarketPlaceOrders: okHandler,
    getSingleMarketPlaceOrder: okHandler,
    cancelMarketPlaceOrder: okHandler,
  },
}));

jest.unstable_mockModule("../src/controllers/reviews.controllers.js", () => ({
  default: {
    createReview: okHandler,
    getAllReview: okHandler,
    updateReview: okHandler,
    deleteReview: okHandler,
  },
}));

jest.unstable_mockModule("../src/controllers/deliveryPartner.controllers.js", () => ({
  default: {
    createProfile: okHandler,
    assignPartner: okHandler,
    viewAllOrders: okHandler,
    viewOneOrder: okHandler,
    pickUpOrder: okHandler,
    deliverOrder: okHandler,
    viewAllMarketPlaceOrders: okHandler,
    viewOrderById: okHandler,
    updateOrderStatus: okHandler,
    viewAllDeliveryPartners: okHandler,
  },
}));

jest.unstable_mockModule("../src/controllers/homePageCMS.controllers.js", () => ({
  default: {
    getActiveBanners: okHandler,
    getActiveAnnouncements: okHandler,
  },
}));

jest.unstable_mockModule("../src/controllers/vendor.controllers.js", () => ({
  default: {
    getVendorOverview: okHandler,
    getTopItems: okHandler,
    orderStatusBreakdown: okHandler,
    revenueStatsPerWeek: okHandler,
    averageOrderValue: okHandler,
    updateStock: okHandler,
    getAllMenu: okHandler,
    lowStockItems: okHandler,
    bulkUpload: okHandler,
    generateInvoiceFood: okHandler,
  },
}));

jest.unstable_mockModule("../src/controllers/repairRequest.controllers.js", () => ({
  default: {
    createRepairRequest: okHandler,
    getAllRepairRequests: okHandler,
    getRequestById: okHandler,
    customerDecision: okHandler,
  },
}));

let app;
let mongoServer;
let userModel;

const buildToken = (user, role = user.role, expiresIn = "15m") => {
  return jwt.sign(
    {
      id: user._id.toString(),
      role,
    },
    process.env.JWT_SECRET,
    { expiresIn },
  );
};

const authHeader = (user, role = user.role) => {
  return { Authorization: `Bearer ${buildToken(user, role)}` };
};

const createUser = async ({
  username,
  email,
  role,
}) => {
  return userModel.create({
    username,
    email,
    password: "password123",
    role,
    verified: true,
    authProvider: "local",
  });
};

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create({
    instance: { ip: "127.0.0.1" },
  });
  await mongoose.connect(mongoServer.getUri());

  const [
    { default: restaurantRoute },
    { default: menuRouter },
    { default: cartRouter },
    { default: orderRouter },
    { default: reviewRoute },
    { default: deliveryRouter },
    { default: homePageRouter },
    { default: marketRouter },
    { default: marketCartRouter },
    { default: marketPlaceOrdersRouter },
    { default: vendorRouter },
    { default: repairRouter },
    userModule,
    apiErrorModule,
  ] = await Promise.all([
    import("../src/routes/restaurant.routes.js"),
    import("../src/routes/menu.routes.js"),
    import("../src/routes/cart.routes.js"),
    import("../src/routes/order.routes.js"),
    import("../src/routes/review.routes.js"),
    import("../src/routes/deliveryPartner.routes.js"),
    import("../src/routes/homepageCMS.routes.js"),
    import("../src/routes/marketPlace.routes.js"),
    import("../src/routes/marketCart.routes.js"),
    import("../src/routes/marketPlace.Orders.routes.js"),
    import("../src/routes/vendor.routes.js"),
    import("../src/routes/repairRequest.routes.js"),
    import("../src/models/user.models.js"),
    import("../src/utils/apiErrors.js"),
  ]);

  userModel = userModule.default;

  app = express();
  app.use(express.json());
  app.use("/api", restaurantRoute);
  app.use("/api/restaurants", menuRouter);
  app.use("/api/user", cartRouter);
  app.use("/api/user", orderRouter);
  app.use("/api/user", reviewRoute);
  app.use("/api/delivery", deliveryRouter);
  app.use("/api/vendor", vendorRouter);
  app.use("/api/user/homepage", homePageRouter);
  app.use("/api/marketplace", marketRouter);
  app.use("/api/marketplace", marketCartRouter);
  app.use("/api/marketplace", marketPlaceOrdersRouter);
  app.use("/api/repair-requests", repairRouter);

  app.use((err, req, res, next) => {
    const statusCode = err instanceof apiErrorModule.default ? err.statusCode : 500;
    return res.status(statusCode).json({
      statusCode,
      message: err.message,
    });
  });
});

beforeEach(async () => {
  await Promise.all(
    Object.values(mongoose.connection.collections).map((collection) =>
      collection.deleteMany({}),
    ),
  );
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe("major route authorization", () => {
  it("returns 401 for protected routes with missing token", async () => {
    const endpoints = [
      ["post", "/api/restaurants"],
      ["post", "/api/restaurants/abc/menu"],
      ["post", "/api/user/order"],
      ["get", "/api/marketplace/categories"],
      ["post", "/api/marketplace/orders"],
      ["post", "/api/user/reviews/abc"],
      ["post", "/api/delivery/profile"],
      ["get", "/api/vendor/dashboard/overview"],
      ["get", "/api/user/homepage/banners"],
    ];

    for (const [method, url] of endpoints) {
      const response = await request(app)[method](url).send({});
      expect(response.status).toBe(401);
      expect(response.body.message).toBe("Unauthorized");
    }
  });

  it("returns 401 for invalid auth token", async () => {
    const response = await request(app)
      .get("/api/marketplace/categories")
      .set("Authorization", "Bearer invalid-token");

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Invalid token");
  });

  it("returns 403 when user role does not match endpoint role", async () => {
    const user = await createUser({
      username: "userone",
      email: "userone@example.com",
      role: "user",
    });
    const vendor = await createUser({
      username: "vendorone",
      email: "vendorone@example.com",
      role: "vendor",
    });
    const deliveryPartner = await createUser({
      username: "deliveryone",
      email: "deliveryone@example.com",
      role: "delivery_partner",
    });

    const wrongRoleCases = [
      {
        request: request(app).post("/api/restaurants").set(authHeader(user)).send({}),
      },
      {
        request: request(app)
          .post("/api/restaurants/abc/menu")
          .set(authHeader(user))
          .send({}),
      },
      {
        request: request(app)
          .post("/api/user/order")
          .set(authHeader(vendor))
          .send({}),
      },
      {
        request: request(app)
          .get("/api/marketplace/categories")
          .set(authHeader(vendor)),
      },
      {
        request: request(app)
          .post("/api/marketplace/orders")
          .set(authHeader(vendor))
          .send({}),
      },
      {
        request: request(app)
          .post("/api/user/reviews/abc")
          .set(authHeader(vendor))
          .send({}),
      },
      {
        request: request(app)
          .post("/api/delivery/profile")
          .set(authHeader(vendor))
          .send({}),
      },
      {
        request: request(app)
          .get("/api/vendor/dashboard/overview")
          .set(authHeader(user)),
      },
      {
        request: request(app)
          .get("/api/user/homepage/banners")
          .set(authHeader(deliveryPartner)),
      },
    ];

    for (const { request: requestCall } of wrongRoleCases) {
      const response = await requestCall;
      expect(response.status).toBe(403);
      expect(response.body.message).toBe("Forbidden");
    }
  });

  it("allows access when token is valid and role matches", async () => {
    const user = await createUser({
      username: "validuser",
      email: "validuser@example.com",
      role: "user",
    });
    const vendor = await createUser({
      username: "validvendor",
      email: "validvendor@example.com",
      role: "vendor",
    });
    const deliveryPartner = await createUser({
      username: "validdelivery",
      email: "validdelivery@example.com",
      role: "delivery_partner",
    });

    const responses = await Promise.all([
      request(app).post("/api/restaurants").set(authHeader(vendor)).send({}),
      request(app)
        .post("/api/restaurants/abc/menu")
        .set(authHeader(vendor))
        .send({}),
      request(app).post("/api/user/order").set(authHeader(user)).send({}),
      request(app).get("/api/marketplace/categories").set(authHeader(user)),
      request(app).post("/api/marketplace/orders").set(authHeader(user)).send({}),
      request(app).post("/api/user/reviews/abc").set(authHeader(user)).send({}),
      request(app)
        .post("/api/delivery/profile")
        .set(authHeader(deliveryPartner))
        .send({}),
      request(app)
        .get("/api/vendor/dashboard/overview")
        .set(authHeader(vendor)),
      request(app).get("/api/user/homepage/banners").set(authHeader(user)),
    ]);

    for (const response of responses) {
      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
    }
  });
});
