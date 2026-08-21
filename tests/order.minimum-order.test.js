import { jest } from "@jest/globals";
import bcrypt from "bcrypt";
import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import request from "supertest";

process.env.MONGO_URI ||= "mongodb://127.0.0.1:27017/order-minimum-order-test";
process.env.JWT_SECRET ||= "test-jwt-secret";
process.env.CLIENT_ID ||= "test-client-id";
process.env.ZEPTOMAIL_HOST ||= "smtp.zeptomail.com";
process.env.ZEPTOMAIL_PORT ||= "2525";
process.env.ZEPTOMAIL_USER ||= "test-zeptomail-user";
process.env.ZEPTOMAIL_PASS ||= "test-zeptomail-pass";
process.env.ZEPTOMAIL_FROM_EMAIL ||= "order@example.com";
process.env.ZEPTOMAIL_FROM_NAME ||= "Campus In";
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

const mockedServices = {
  queueVendorNewOrderEmail: jest.fn(),
  queueAdminMarketplaceOrderEmail: jest.fn(),
  get: jest.fn(),
  set: jest.fn(),
  remove: jest.fn(),
  removeByPattern: jest.fn(),
  exists: jest.fn(),
  expire: jest.fn(),
  increment: jest.fn(),
  ttl: jest.fn(),
};

jest.unstable_mockModule("../src/services/emailQueue.services.js", () => ({
  default: mockedServices,
}));

jest.unstable_mockModule("../src/services/redis.services.js", () => ({
  default: mockedServices,
}));

jest.unstable_mockModule("../src/config/redis.js", () => ({
  redis: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    keys: jest.fn().mockResolvedValue([]),
    exists: jest.fn().mockResolvedValue(0),
    expire: jest.fn(),
    incr: jest.fn(),
    ttl: jest.fn().mockResolvedValue(0),
  },
}));

let app;
let mongoServer;
let userModel;
let restaurantModel;
let menuModel;
let cartModel;
let orderModel;
let couponModel;
let platformSettingsModel;

const buildToken = (user, overrides = {}, expiresIn = "15m") =>
  jwt.sign(
    {
      id: user._id.toString(),
      role: user.role,
      ...overrides,
    },
    process.env.JWT_SECRET,
    { expiresIn },
  );

const authHeader = (user, overrides = {}, expiresIn = "15m") => ({
  Authorization: `Bearer ${buildToken(user, overrides, expiresIn)}`,
});

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
    authProvider: "local",
  });

const createRestaurant = async (owner, overrides = {}) =>
  restaurantModel.create({
    owner: owner._id,
    restaurantName: `Rest-${new mongoose.Types.ObjectId().toString().slice(-6)}`,
    phone: "9999999999",
    location: "Campus",
    ...overrides,
  });

const createMenuItem = async (restaurant, overrides = {}) =>
  menuModel.create({
    restaurant: restaurant._id,
    name: `Item-${new mongoose.Types.ObjectId().toString().slice(-6)}`,
    description: "Test item",
    price: 58,
    mrp: 60,
    category: "Main Course",
    foodType: "veg",
    isAvailable: true,
    isDeleted: false,
    stockQty: 20,
    ...overrides,
  });

const createCart = async (user, restaurant, menuItem, quantity = 1) =>
  cartModel.create({
    user: user._id,
    restaurant: restaurant._id,
    items: [{ menuItem: menuItem._id, quantity }],
    totalAmount: menuItem.price * quantity,
  });

const createPlatformSettings = async (overrides = {}) =>
  platformSettingsModel.create({
    deliveryCharge: 10,
    freeDeliveryAbove: 200,
    minimumOrderValue: 69,
    gstPercentage: 0,
    packagingCharge: 0,
    platformCharge: 0,
    ...overrides,
  });

const createCoupon = async (creator, overrides = {}) =>
  couponModel.create({
    code: `SAVE${new mongoose.Types.ObjectId().toString().slice(-5)}`,
    discountType: "FIXED",
    discountValue: 10,
    minimumOrderValue: 0,
    maximumDiscount: 0,
    expiryDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    usageLimit: 10,
    createdBy: creator._id,
    ...overrides,
  });

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({
    replSet: {
      count: 1,
      storageEngine: "wiredTiger",
    },
  });
  await mongoose.connect(mongoServer.getUri());

  const [
    { default: orderRouter },
    userModule,
    restaurantModule,
    menuModule,
    cartModule,
    orderModule,
    couponModule,
    settingsModule,
    errorModule,
  ] = await Promise.all([
    import("../src/routes/order.routes.js"),
    import("../src/models/user.models.js"),
    import("../src/models/restaurant.models.js"),
    import("../src/models/menuItem.models.js"),
    import("../src/models/cart.models.js"),
    import("../src/models/order.models.js"),
    import("../src/models/coupon.models.js"),
    import("../src/models/platformSettings.models.js"),
    import("../src/utils/apiErrors.js"),
  ]);

  app = express();
  app.use(express.json());
  app.use("/api/user", orderRouter);
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
    const statusCode = err instanceof errorModule.default ? err.statusCode : 500;
    res.status(statusCode).json({
      statusCode,
      data: null,
      message: err.message || "Internal server error",
      success: false,
      errors: err.errors || [],
    });
  });

  userModel = userModule.default;
  restaurantModel = restaurantModule.default;
  menuModel = menuModule.default;
  cartModel = cartModule.default;
  orderModel = orderModule.default;
  couponModel = couponModule.default;
  platformSettingsModel = settingsModule.default;
});

beforeEach(async () => {
  await Promise.all(
    Object.values(mongoose.connection.collections).map((collection) =>
      collection.deleteMany({}),
    ),
  );
  jest.clearAllMocks();

  mockedServices.queueVendorNewOrderEmail.mockResolvedValue({ id: "job-1" });
  mockedServices.queueAdminMarketplaceOrderEmail.mockResolvedValue({ id: "job-2" });
  mockedServices.get.mockResolvedValue(null);
  mockedServices.set.mockResolvedValue(undefined);
  mockedServices.remove.mockResolvedValue(undefined);
  mockedServices.removeByPattern.mockResolvedValue(undefined);
  mockedServices.exists.mockResolvedValue(false);
  mockedServices.expire.mockResolvedValue(undefined);
  mockedServices.increment.mockResolvedValue(1);
  mockedServices.ttl.mockResolvedValue(0);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer?.stop();
});

describe("food order minimum order value enforcement", () => {
  it("rejects create order when subtotal is below configured minimum", async () => {
    const user = await createUser({ username: "min-order-user" });
    const vendor = await createUser({ username: "min-order-vendor", role: "vendor" });
    const restaurant = await createRestaurant(vendor);
    const menuItem = await createMenuItem(restaurant, { price: 58, mrp: 60 });

    await createPlatformSettings({ minimumOrderValue: 69 });
    await createCart(user, restaurant, menuItem, 1);

    const response = await request(app)
      .post("/api/user/order")
      .set(authHeader(user))
      .send({
        paymentMethod: "COD",
        customerPhone: "9999999999",
        deliveryAddress: "Block A",
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Minimum order value is 69");

    const totalOrders = await orderModel.countDocuments();
    expect(totalOrders).toBe(0);
  });

  it("creates order when subtotal meets configured minimum", async () => {
    const user = await createUser({ username: "min-order-ok-user" });
    const vendor = await createUser({ username: "min-order-ok-vendor", role: "vendor" });
    const restaurant = await createRestaurant(vendor);
    const menuItem = await createMenuItem(restaurant, { price: 69, mrp: 75 });

    await createPlatformSettings({ minimumOrderValue: 69 });
    await createCart(user, restaurant, menuItem, 1);

    const response = await request(app)
      .post("/api/user/order")
      .set(authHeader(user))
      .send({
        paymentMethod: "COD",
        customerPhone: "9999999999",
        deliveryAddress: "Block B",
      });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Order created successful");
    expect(response.body.data.order.pricing.subTotal).toBe(69);

    const totalOrders = await orderModel.countDocuments();
    expect(totalOrders).toBe(1);
  });

  it("rejects coupon apply when cart subtotal is below configured minimum", async () => {
    const user = await createUser({ username: "min-order-coupon-user" });
    const admin = await createUser({ username: "min-order-admin", role: "admin" });
    const vendor = await createUser({ username: "min-order-coupon-vendor", role: "vendor" });
    const restaurant = await createRestaurant(vendor);
    const menuItem = await createMenuItem(restaurant, { price: 58, mrp: 60 });

    await createPlatformSettings({ minimumOrderValue: 69 });
    await createCart(user, restaurant, menuItem, 1);

    const coupon = await createCoupon(admin, {
      discountType: "FIXED",
      discountValue: 5,
      minimumOrderValue: 0,
      maximumDiscount: 0,
    });

    const response = await request(app)
      .post("/api/user/coupons/apply")
      .set(authHeader(user))
      .send({ couponId: coupon._id.toString() });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Minimum order value is 69");
  });
});
