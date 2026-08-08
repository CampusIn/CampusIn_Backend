import { jest } from "@jest/globals";
import bcrypt from "bcrypt";
import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";

process.env.MONGO_URI ||= "mongodb://127.0.0.1:27017/market-cart-controller-test";
process.env.JWT_SECRET ||= "test-jwt-secret";
process.env.CLIENT_ID ||= "test-client-id";
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

const mockedExternalServices = {
  queueOTPEmail: jest.fn(),
  queueWelcomeEmail: jest.fn(),
  queueForgotEmail: jest.fn(),
  queueVendorNewOrderEmail: jest.fn(),
  queueAdminMarketplaceOrderEmail: jest.fn(),
  queueDeliveryAssignmentEmail: jest.fn(),
  storeOTP: jest.fn(),
  verifyOTP: jest.fn(),
  get: jest.fn(),
  set: jest.fn(),
  remove: jest.fn(),
  removeByPattern: jest.fn(),
  exists: jest.fn(),
  expire: jest.fn(),
  increment: jest.fn(),
  ttl: jest.fn(),
};

jest.unstable_mockModule("../src/controllers/auth.controllers.js", () => ({
  default: {},
}));

jest.unstable_mockModule("../src/services/emailQueue.services.js", () => ({
  default: mockedExternalServices,
}));

jest.unstable_mockModule("../src/services/otp.services.js", () => ({
  default: mockedExternalServices,
}));

jest.unstable_mockModule("../src/services/redis.services.js", () => ({
  default: mockedExternalServices,
}));

jest.unstable_mockModule("../src/config/redis.js", () => ({
  redis: {},
  default: {},
}));

jest.unstable_mockModule("../src/queue/email.queue.js", () => ({
  emailQueue: { add: jest.fn() },
}));

let app;
let mongoServer;
let userModel;
let marketPlaceCategoryModel;
let marketPlaceProductsModel;
let marketCartModel;

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

const createCategory = async (creator, overrides = {}) =>
  marketPlaceCategoryModel.create({
    name: `Electronics-${new mongoose.Types.ObjectId().toString().slice(-6)}`,
    description: "Used electronics",
    image: "https://example.com/category.jpg",
    createdBy: creator._id,
    pricingSettings: {
      deliveryCharge: 20,
      freeDeliveryAbove: 300,
      minimumOrderValue: 100,
      gstPercentage: 5,
      packagingCharge: 10,
      platformCharge: 5,
    },
    ...overrides,
  });

const createProduct = async (category, creator, overrides = {}) =>
  marketPlaceProductsModel.create({
    category: category._id,
    name: `Calculator-${new mongoose.Types.ObjectId().toString().slice(-6)}`,
    description: "Scientific calculator",
    price: 500,
    stock: 10,
    images: ["https://example.com/product.jpg"],
    condition: "GOOD",
    isActive: true,
    createdBy: creator._id,
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
    { default: marketCartRoute },
    userModule,
    categoryModule,
    productModule,
    cartModule,
    errorModule,
  ] = await Promise.all([
    import("../src/routes/marketCart.routes.js"),
    import("../src/models/user.models.js"),
    import("../src/models/marketPlaceCategory.models.js"),
    import("../src/models/marketPlaceProducts.models.js"),
    import("../src/models/marketPlaceCart.models.js"),
    import("../src/utils/apiErrors.js"),
  ]);

  app = express();
  app.use(express.json());
  app.use("/api/marketplace", marketCartRoute);
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
  marketPlaceCategoryModel = categoryModule.default;
  marketPlaceProductsModel = productModule.default;
  marketCartModel = cartModule.default;
});

beforeEach(async () => {
  await Promise.all(
    Object.values(mongoose.connection.collections).map((collection) =>
      collection.deleteMany({}),
    ),
  );

  jest.restoreAllMocks();
  jest.clearAllMocks();

  mockedExternalServices.queueOTPEmail.mockResolvedValue({ id: "otp-job" });
  mockedExternalServices.queueWelcomeEmail.mockResolvedValue({ id: "welcome-job" });
  mockedExternalServices.queueForgotEmail.mockResolvedValue({ id: "forgot-job" });
  mockedExternalServices.storeOTP.mockResolvedValue(undefined);
  mockedExternalServices.verifyOTP.mockResolvedValue(true);
  mockedExternalServices.get.mockResolvedValue(null);
  mockedExternalServices.set.mockResolvedValue(undefined);
  mockedExternalServices.remove.mockResolvedValue(undefined);
  mockedExternalServices.removeByPattern.mockResolvedValue(undefined);
  mockedExternalServices.exists.mockResolvedValue(false);
  mockedExternalServices.expire.mockResolvedValue(undefined);
  mockedExternalServices.increment.mockResolvedValue(1);
  mockedExternalServices.ttl.mockResolvedValue(0);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer?.stop();
});

describe("marketplace cart controller routes", () => {
  it("returns empty cart when no cart exists", async () => {
    const user = await createUser({ username: "market-empty" });

    const response = await request(app)
      .get("/api/marketplace/cart")
      .set(authHeader(user));

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("No items in the cart");
    expect(response.body.data).toEqual({
      category: null,
      items: [],
      totalAmount: 0,
    });
  });

  it("adds, updates, and deletes marketplace cart item safely", async () => {
    const user = await createUser({ username: "market-user" });
    const admin = await createUser({ username: "market-admin", role: "admin" });
    const category = await createCategory(admin);
    const product = await createProduct(category, admin, {
      stock: 6,
      price: 200,
    });

    const addResponse = await request(app)
      .post("/api/marketplace/cart")
      .set(authHeader(user))
      .send({ productId: product._id.toString(), quantity: 2 });

    expect(addResponse.status).toBe(201);
    expect(addResponse.body.message).toBe("Items added to cart");

    const updateResponse = await request(app)
      .patch(`/api/marketplace/cart/items/${product._id.toString()}`)
      .set(authHeader(user))
      .send({ quantity: 3 });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.message).toBe("Quantity updated");
    expect(updateResponse.body.data.items[0].quantity).toBe(3);

    const deleteResponse = await request(app)
      .delete(`/api/marketplace/cart/items/${product._id.toString()}`)
      .set(authHeader(user));

    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body.message).toBe("Item deleted successfully");
    expect(deleteResponse.body.data).toEqual({
      category: null,
      items: [],
      totalAmount: 0,
    });
  });

  it("returns 404 when updating item after cart deletion", async () => {
    const user = await createUser({ username: "market-404-update" });
    const admin = await createUser({ username: "market-admin-2", role: "admin" });
    const category = await createCategory(admin);
    const product = await createProduct(category, admin);

    await request(app)
      .post("/api/marketplace/cart")
      .set(authHeader(user))
      .send({ productId: product._id.toString(), quantity: 1 });

    await request(app)
      .delete(`/api/marketplace/cart/items/${product._id.toString()}`)
      .set(authHeader(user));

    const updateResponse = await request(app)
      .patch(`/api/marketplace/cart/items/${product._id.toString()}`)
      .set(authHeader(user))
      .send({ quantity: 2 });

    expect(updateResponse.status).toBe(404);
    expect(updateResponse.body.message).toBe("Cart not found");
  });

  it("returns 404 when deleting item already deleted", async () => {
    const user = await createUser({ username: "market-404-delete" });
    const admin = await createUser({ username: "market-admin-3", role: "admin" });
    const category = await createCategory(admin);
    const product = await createProduct(category, admin);

    await request(app)
      .post("/api/marketplace/cart")
      .set(authHeader(user))
      .send({ productId: product._id.toString(), quantity: 1 });

    await request(app)
      .delete(`/api/marketplace/cart/items/${product._id.toString()}`)
      .set(authHeader(user));

    const deleteAgainResponse = await request(app)
      .delete(`/api/marketplace/cart/items/${product._id.toString()}`)
      .set(authHeader(user));

    expect(deleteAgainResponse.status).toBe(404);
    expect(deleteAgainResponse.body.message).toBe("Cart not found");
  });

  it("keeps users isolated across cart mutations", async () => {
    const userOne = await createUser({ username: "market-user-one" });
    const userTwo = await createUser({ username: "market-user-two" });
    const admin = await createUser({ username: "market-admin-4", role: "admin" });
    const category = await createCategory(admin);
    const product = await createProduct(category, admin);

    await request(app)
      .post("/api/marketplace/cart")
      .set(authHeader(userOne))
      .send({ productId: product._id.toString(), quantity: 1 });

    const updateByUserTwo = await request(app)
      .patch(`/api/marketplace/cart/items/${product._id.toString()}`)
      .set(authHeader(userTwo))
      .send({ quantity: 2 });

    expect(updateByUserTwo.status).toBe(404);
    expect(updateByUserTwo.body.message).toBe("Cart not found");
  });

  it("does not throw 500 when cart disappears during GET total persistence", async () => {
    const user = await createUser({ username: "market-race-get" });
    const admin = await createUser({ username: "market-admin-5", role: "admin" });
    const category = await createCategory(admin);
    const product = await createProduct(category, admin, { price: 400, stock: 4 });

    await request(app)
      .post("/api/marketplace/cart")
      .set(authHeader(user))
      .send({ productId: product._id.toString(), quantity: 1 });

    jest.spyOn(marketCartModel, "updateOne").mockResolvedValueOnce({
      acknowledged: true,
      matchedCount: 0,
      modifiedCount: 0,
    });

    const response = await request(app)
      .get("/api/marketplace/cart")
      .set(authHeader(user));

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("No items in the cart");
    expect(response.body.data).toEqual({
      category: null,
      items: [],
      totalAmount: 0,
    });
  });
});
