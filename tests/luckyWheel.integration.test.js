import { jest } from "@jest/globals";
import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import request from "supertest";

process.env.MONGO_URI ||= "mongodb://127.0.0.1:27017/lucky-wheel-test";
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
    ping: jest.fn().mockResolvedValue("PONG"),
  },
}));

let app;
let mongoServer;
let userModel;
let restaurantModel;
let menuModel;
let cartModel;
let couponModel;
let platformSettingsModel;
let luckyWheelSpinModel;
let luckyWheelConfig;

const buildToken = (user, expiresIn = "15m") =>
  jwt.sign(
    {
      id: user._id.toString(),
      role: user.role,
    },
    process.env.JWT_SECRET,
    { expiresIn },
  );

const authHeader = (user) => ({
  Authorization: `Bearer ${buildToken(user)}`,
});

const createUser = async ({
  username = `user-${new mongoose.Types.ObjectId().toString().slice(-6)}`,
  email = `${username}@example.com`,
  role = "user",
} = {}) => {
  return userModel.create({
    username,
    email,
    password: "password123",
    role,
    verified: true,
    authProvider: "local",
  });
};

const createRestaurant = async (owner) => {
  return restaurantModel.create({
    owner: owner._id,
    restaurantName: `Rest-${new mongoose.Types.ObjectId().toString().slice(-6)}`,
    phone: "9999999999",
    location: "Campus",
  });
};

const createMenuItem = async (restaurant, overrides = {}) => {
  return menuModel.create({
    restaurant: restaurant._id,
    name: `Item-${new mongoose.Types.ObjectId().toString().slice(-6)}`,
    description: "Test item",
    price: 120,
    mrp: 130,
    category: "Main Course",
    foodType: "veg",
    isAvailable: true,
    isDeleted: false,
    stockQty: 20,
    ...overrides,
  });
};

const createCart = async (user, restaurant, menuItem, quantity = 1) => {
  return cartModel.create({
    user: user._id,
    restaurant: restaurant._id,
    items: [{ menuItem: menuItem._id, quantity }],
    totalAmount: menuItem.price * quantity,
  });
};

const createPlatformSettings = async (overrides = {}) => {
  return platformSettingsModel.create({
    deliveryCharge: 10,
    freeDeliveryAbove: 500,
    minimumOrderValue: 50,
    gstPercentage: 0,
    packagingCharge: 0,
    platformCharge: 0,
    ...overrides,
  });
};

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
    { default: luckyWheelRouter },
    userModule,
    restaurantModule,
    menuModule,
    cartModule,
    couponModule,
    settingsModule,
    luckySpinModule,
    luckyConfigModule,
    apiErrorModule,
  ] = await Promise.all([
    import("../src/routes/order.routes.js"),
    import("../src/routes/luckyWheel.routes.js"),
    import("../src/models/user.models.js"),
    import("../src/models/restaurant.models.js"),
    import("../src/models/menuItem.models.js"),
    import("../src/models/cart.models.js"),
    import("../src/models/coupon.models.js"),
    import("../src/models/platformSettings.models.js"),
    import("../src/models/luckyWheelSpin.models.js"),
    import("../src/config/luckyWheel.config.js"),
    import("../src/utils/apiErrors.js"),
  ]);

  userModel = userModule.default;
  restaurantModel = restaurantModule.default;
  menuModel = menuModule.default;
  cartModel = cartModule.default;
  couponModel = couponModule.default;
  platformSettingsModel = settingsModule.default;
  luckyWheelSpinModel = luckySpinModule.default;
  luckyWheelConfig = luckyConfigModule.default;

  app = express();
  app.use(express.json());
  app.use("/api/user", orderRouter);
  app.use("/api/lucky-wheel", luckyWheelRouter);
  app.use((err, req, res, _next) => {
    const statusCode = err instanceof apiErrorModule.default ? err.statusCode : 500;
    return res.status(statusCode).json({
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
  jest.clearAllMocks();

  mockedServices.queueVendorNewOrderEmail.mockResolvedValue({ id: "job-1" });
  mockedServices.get.mockResolvedValue(null);
  mockedServices.set.mockResolvedValue(undefined);
  mockedServices.remove.mockResolvedValue(undefined);
  mockedServices.removeByPattern.mockResolvedValue(undefined);
  mockedServices.exists.mockResolvedValue(false);
  mockedServices.expire.mockResolvedValue(undefined);
  mockedServices.increment.mockResolvedValue(1);
  mockedServices.ttl.mockResolvedValue(0);

  luckyWheelConfig.eventId = "freshers-2026";
  luckyWheelConfig.startsAt = new Date(Date.now() - 60 * 1000);
  luckyWheelConfig.endsAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  luckyWheelConfig.couponExpiryDays = 7;
  luckyWheelConfig.prizes = [
    {
      id: "20-off",
      label: "20 OFF",
      type: "discount",
      discountType: "FIXED",
      discountValue: 20,
      probability: 100,
    },
  ];
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer?.stop();
});

describe("lucky wheel and personal coupon security", () => {
  it("returns canSpin=true for a new authenticated user and rejects unauthenticated spin", async () => {
    const user = await createUser({ username: "lucky-new-user" });

    const statusResponse = await request(app)
      .get("/api/lucky-wheel/status")
      .set(authHeader(user));
    const unauthorizedSpin = await request(app).post("/api/lucky-wheel/spin");

    expect(statusResponse.status).toBe(200);
    expect(statusResponse.body.data).toMatchObject({
      canSpin: true,
      result: null,
    });
    expect(unauthorizedSpin.status).toBe(401);
    expect(unauthorizedSpin.body.message).toBe("Unauthorized");
  });

  it("allows one successful spin, creates personal coupon, and prevents second spin", async () => {
    const user = await createUser({ username: "spin-user" });

    const spinResponse = await request(app)
      .post("/api/lucky-wheel/spin")
      .set(authHeader(user));
    const secondSpin = await request(app)
      .post("/api/lucky-wheel/spin")
      .set(authHeader(user));
    const statusResponse = await request(app)
      .get("/api/lucky-wheel/status")
      .set(authHeader(user));

    expect(spinResponse.status).toBe(201);
    expect(spinResponse.body.data.result.prizeId).toBe("20-off");
    expect(spinResponse.body.data.result.coupon).toBeTruthy();

    const createdCoupon = await couponModel.findOne({
      code: spinResponse.body.data.result.coupon.code,
    });
    expect(createdCoupon.type).toBe("personal");
    expect(createdCoupon.source).toBe("lucky_wheel");
    expect(createdCoupon.assignedTo.toString()).toBe(user._id.toString());

    expect(secondSpin.status).toBe(409);
    expect(secondSpin.body.message).toBe("You have already spun the wheel.");
    expect(statusResponse.status).toBe(200);
    expect(statusResponse.body.data.canSpin).toBe(false);
    expect(statusResponse.body.data.result.prizeId).toBe("20-off");
  });

  it("enforces coupon ownership for visibility, apply, and order redemption", async () => {
    const admin = await createUser({ username: "admin-user", role: "admin" });
    const userA = await createUser({ username: "winner-user" });
    const userB = await createUser({ username: "other-user" });
    const vendor = await createUser({ username: "food-vendor", role: "vendor" });

    const restaurant = await createRestaurant(vendor);
    const menuItem = await createMenuItem(restaurant);
    await createPlatformSettings();

    await createCart(userA, restaurant, menuItem, 1);
    await createCart(userB, restaurant, menuItem, 1);

    const publicCoupon = await couponModel.create({
      code: "PUBLIC20",
      discountType: "FIXED",
      discountValue: 20,
      minimumOrderValue: 0,
      maximumDiscount: 0,
      expiryDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      usageLimit: 50,
      createdBy: admin._id,
    });

    const spinResponse = await request(app)
      .post("/api/lucky-wheel/spin")
      .set(authHeader(userA));

    const personalCode = spinResponse.body.data.result.coupon.code;
    const personalCoupon = await couponModel.findOne({ code: personalCode });

    const listA = await request(app)
      .get("/api/user/coupons/view")
      .set(authHeader(userA));
    const listB = await request(app)
      .get("/api/user/coupons/view")
      .set(authHeader(userB));

    const userACodes = listA.body.data.map((coupon) => coupon.code);
    const userBCodes = listB.body.data.map((coupon) => coupon.code);
    expect(userACodes).toContain(personalCode);
    expect(userACodes).toContain(publicCoupon.code);
    expect(userBCodes).toContain(publicCoupon.code);
    expect(userBCodes).not.toContain(personalCode);

    const applyAsOwner = await request(app)
      .post("/api/user/coupons/apply")
      .set(authHeader(userA))
      .send({ couponId: personalCoupon._id.toString() });
    expect(applyAsOwner.status).toBe(200);
    expect(applyAsOwner.body.data.coupon.code).toBe(personalCode);

    const applyAsOther = await request(app)
      .post("/api/user/coupons/apply")
      .set(authHeader(userB))
      .send({ couponId: personalCoupon._id.toString() });
    expect(applyAsOther.status).toBe(403);
    expect(applyAsOther.body.message).toBe(
      "This coupon is not assigned to your account.",
    );

    const redeemAsOther = await request(app)
      .post("/api/user/order")
      .set(authHeader(userB))
      .send({
        paymentMethod: "COD",
        customerPhone: "9999999999",
        deliveryAddress: "Hostel B",
        couponId: personalCoupon._id.toString(),
      });
    expect(redeemAsOther.status).toBe(403);
    expect(redeemAsOther.body.message).toBe(
      "This coupon is not assigned to your account.",
    );

    const redeemAsOwner = await request(app)
      .post("/api/user/order")
      .set(authHeader(userA))
      .send({
        paymentMethod: "COD",
        customerPhone: "9999999999",
        deliveryAddress: "Hostel A",
        couponId: personalCoupon._id.toString(),
      });
    expect(redeemAsOwner.status).toBe(200);
    expect(redeemAsOwner.body.data.applied).toBe(true);

    const applyPublicAsOther = await request(app)
      .post("/api/user/coupons/apply")
      .set(authHeader(userB))
      .send({ couponId: publicCoupon._id.toString() });
    expect(applyPublicAsOther.status).toBe(200);
  });

  it("handles duplicate concurrent spin requests and creates only one coupon", async () => {
    const user = await createUser({ username: "race-user" });

    const [responseOne, responseTwo] = await Promise.all([
      request(app).post("/api/lucky-wheel/spin").set(authHeader(user)),
      request(app).post("/api/lucky-wheel/spin").set(authHeader(user)),
    ]);

    const statuses = [responseOne.status, responseTwo.status].sort((a, b) => a - b);
    expect(statuses).toEqual([201, 409]);

    const spinCount = await luckyWheelSpinModel.countDocuments({
      user: user._id,
      eventId: luckyWheelConfig.eventId,
    });
    const couponCount = await couponModel.countDocuments({
      assignedTo: user._id,
      source: "lucky_wheel",
      type: "personal",
    });

    expect(spinCount).toBe(1);
    expect(couponCount).toBe(1);
  });

  it("rejects spin outside event window", async () => {
    const user = await createUser({ username: "window-user" });

    luckyWheelConfig.startsAt = new Date(Date.now() + 60 * 60 * 1000);
    luckyWheelConfig.endsAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const beforeStart = await request(app)
      .post("/api/lucky-wheel/spin")
      .set(authHeader(user));

    expect(beforeStart.status).toBe(400);
    expect(beforeStart.body.message).toBe(
      "The Freshers Lucky Wheel has not started yet.",
    );

    luckyWheelConfig.startsAt = new Date(Date.now() - 2 * 60 * 60 * 1000);
    luckyWheelConfig.endsAt = new Date(Date.now() - 60 * 60 * 1000);
    const afterEnd = await request(app)
      .post("/api/lucky-wheel/spin")
      .set(authHeader(user));

    expect(afterEnd.status).toBe(400);
    expect(afterEnd.body.message).toBe("The Freshers Lucky Wheel has ended.");
  });

  it("prevents client-side payload manipulation from changing coupon ownership", async () => {
    const userA = await createUser({ username: "manip-winner" });
    const userB = await createUser({ username: "manip-other" });

    const spinResponse = await request(app)
      .post("/api/lucky-wheel/spin")
      .set(authHeader(userA));
    const personalCoupon = await couponModel.findOne({
      code: spinResponse.body.data.result.coupon.code,
    });

    const manipulationAttempt = await request(app)
      .post("/api/user/coupons/apply")
      .set(authHeader(userB))
      .send({
        couponId: personalCoupon._id.toString(),
        userId: userA._id.toString(),
        assignedTo: userB._id.toString(),
      });

    expect(manipulationAttempt.status).toBe(403);
    expect(manipulationAttempt.body.message).toBe(
      "This coupon is not assigned to your account.",
    );
  });

});
