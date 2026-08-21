import { jest } from "@jest/globals";
import bcrypt from "bcrypt";
import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";

process.env.MONGO_URI ||= "mongodb://127.0.0.1:27017/cart-controller-test";
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
let restaurantModel;
let menuModel;
let cartModel;
let ApiError;

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
    stockQty: 10,
    isAvailable: true,
    ...overrides,
  });

const createCart = async (user, restaurant, items, totalAmount = 0) =>
  cartModel.create({
    user: user._id,
    restaurant: restaurant._id,
    items,
    totalAmount,
  });

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create({
    instance: {
      ip: "127.0.0.1",
    },
  });
  await mongoose.connect(mongoServer.getUri());

  const [
    { default: cartRoute },
    userModule,
    restaurantModule,
    menuModule,
    cartModule,
    errorModule,
  ] = await Promise.all([
    import("../src/routes/cart.routes.js"),
    import("../src/models/user.models.js"),
    import("../src/models/restaurant.models.js"),
    import("../src/models/menuItem.models.js"),
    import("../src/models/cart.models.js"),
    import("../src/utils/apiErrors.js"),
  ]);

  app = express();
  app.use(express.json());
  app.use("/api/user", cartRoute);
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
  ApiError = errorModule.default;
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

describe("cart controller routes", () => {
  describe("authentication and authorization", () => {
    it("rejects missing, invalid, expired, deleted, forbidden, and blocked requests", async () => {
      // Arrange
      const owner = await createUser({ role: "vendor", username: "vendor-owner" });
      const restaurant = await createRestaurant(owner);
      const menuItem = await createMenuItem(restaurant);

      const user = await createUser({ username: "student" });
      const blockedUser = await createUser({ username: "blocked", isBlocked: true });
      const vendor = await createUser({ username: "vendor", role: "vendor" });
      const deletedUser = await createUser({ username: "ghost" });
      const deletedToken = buildToken(deletedUser);
      await deletedUser.deleteOne();

      const payload = { menuItemId: menuItem._id.toString(), quantity: 1 };

      // Act
      const missingAuth = await request(app)
        .post("/api/user/cart/items")
        .send(payload);
      const invalidToken = await request(app)
        .post("/api/user/cart/items")
        .set("Authorization", "Bearer bad-token")
        .send(payload);
      const expired = await request(app)
        .post("/api/user/cart/items")
        .set("Authorization", `Bearer ${buildToken(user, {}, "-1s")}`)
        .send(payload);
      const deleted = await request(app)
        .post("/api/user/cart/items")
        .set("Authorization", `Bearer ${deletedToken}`)
        .send(payload);
      const forbidden = await request(app)
        .post("/api/user/cart/items")
        .set(authHeader(vendor))
        .send(payload);
      const blocked = await request(app)
        .post("/api/user/cart/items")
        .set(authHeader(blockedUser))
        .send(payload);

      // Assert
      expect(missingAuth.status).toBe(401);
      expect(missingAuth.body.message).toBe("Unauthorized");
      expect(invalidToken.status).toBe(401);
      expect(invalidToken.body.message).toBe("Invalid token");
      expect(expired.status).toBe(401);
      expect(expired.body.message).toBe("Token expired");
      expect(deleted.status).toBe(401);
      expect(deleted.body.message).toBe("Invalid token");
      expect(forbidden.status).toBe(403);
      expect(forbidden.body.message).toBe("Forbidden");
      expect(blocked.status).toBe(403);
      expect(blocked.body.message).toBe("Your account has been blocked");
    });
  });

  describe("POST /api/user/cart/items", () => {
    it("creates a cart for the first item", async () => {
      // Arrange
      const user = await createUser({ username: "alice" });
      const owner = await createUser({ role: "vendor", username: "owner" });
      const restaurant = await createRestaurant(owner);
      const menuItem = await createMenuItem(restaurant, {
        price: 75,
        stockQty: 8,
      });

      // Act
      const response = await request(app)
        .post("/api/user/cart/items")
        .set(authHeader(user))
        .send({ menuItemId: menuItem._id.toString(), quantity: 2 });

      // Assert
      expect(response.status).toBe(201);
      expect(response.body.message).toBe("Items added to cart");
      expect(response.body.data.totalAmount).toBe(150);
      expect(response.body.data.items).toHaveLength(1);
      expect(response.body.data.items[0]).toMatchObject({ quantity: 2 });
      await expect(cartModel.countDocuments({ user: user._id })).resolves.toBe(1);
    });

    it("increments an existing item when the restaurant matches", async () => {
      // Arrange
      const user = await createUser({ username: "bob" });
      const owner = await createUser({ role: "vendor", username: "owner" });
      const restaurant = await createRestaurant(owner);
      const menuItem = await createMenuItem(restaurant, {
        price: 100,
        stockQty: 6,
      });
      await createCart(
        user,
        restaurant,
        [{ menuItem: menuItem._id, quantity: 1 }],
        100,
      );

      // Act
      const response = await request(app)
        .post("/api/user/cart/items")
        .set(authHeader(user))
        .send({ menuItemId: menuItem._id.toString(), quantity: 2 });

      // Assert
      expect(response.status).toBe(201);
      expect(response.body.data.totalAmount).toBe(300);
      expect(response.body.data.items[0].quantity).toBe(3);
    });

    it("returns validation and business-rule errors", async () => {
      // Arrange
      const user = await createUser({ username: "charlie" });
      const owner = await createUser({ role: "vendor", username: "owner" });
      const firstRestaurant = await createRestaurant(owner, {
        restaurantName: "First Restaurant",
      });
      const secondOwner = await createUser({ role: "vendor", username: "owner-two" });
      const secondRestaurant = await createRestaurant(secondOwner, {
        restaurantName: "Second Restaurant",
        phone: "9999999999",
        location: "South Block",
      });
      const menuItem = await createMenuItem(firstRestaurant, {
        stockQty: 3,
      });
      await createCart(user, secondRestaurant, [
        { menuItem: menuItem._id, quantity: 1 },
      ], 80).catch(() => undefined);

      const unavailableItem = await createMenuItem(firstRestaurant, {
        name: "Cold coffee",
        isAvailable: false,
      });

      // Act
      const invalidId = await request(app)
        .post("/api/user/cart/items")
        .set(authHeader(user))
        .send({ menuItemId: "not-an-id", quantity: 1 });
      const invalidQuantity = await request(app)
        .post("/api/user/cart/items")
        .set(authHeader(user))
        .send({ menuItemId: menuItem._id.toString(), quantity: 0 });
      const notFound = await request(app)
        .post("/api/user/cart/items")
        .set(authHeader(user))
        .send({ menuItemId: new mongoose.Types.ObjectId().toString(), quantity: 1 });
      const unavailable = await request(app)
        .post("/api/user/cart/items")
        .set(authHeader(user))
        .send({ menuItemId: unavailableItem._id.toString(), quantity: 1 });
      const overStock = await request(app)
        .post("/api/user/cart/items")
        .set(authHeader(user))
        .send({ menuItemId: menuItem._id.toString(), quantity: 4 });

      // Assert
      expect(invalidId.status).toBe(400);
      expect(invalidId.body.message).toBe("Invalid menu item ID");
      expect(invalidQuantity.status).toBe(400);
      expect(invalidQuantity.body.message).toBe("Invalid quantity");
      expect(notFound.status).toBe(404);
      expect(notFound.body.message).toBe("Menu not found");
      expect(unavailable.status).toBe(400);
      expect(unavailable.body.message).toBe("Item currently unavailable");
      expect(overStock.status).toBe(400);
      expect(overStock.body.message).toBe(
        `Only ${menuItem.stockQty} item(s) of ${menuItem.name} are currently available`,
      );
    });

    it("returns 500 when the database read fails", async () => {
      // Arrange
      const user = await createUser({ username: "db-user" });
      jest.spyOn(menuModel, "findById").mockReturnValueOnce({
        select: () => Promise.reject(new Error("database unavailable")),
      });

      // Act
      const response = await request(app)
        .post("/api/user/cart/items")
        .set(authHeader(user))
        .send({ menuItemId: new mongoose.Types.ObjectId().toString(), quantity: 1 });

      // Assert
      expect(response.status).toBe(500);
      expect(response.body.message).toBe("database unavailable");
    });
  });

  describe("GET /api/user/cart", () => {
    it("returns an empty cart when no cart exists", async () => {
      // Arrange
      const user = await createUser({ username: "empty-cart" });

      // Act
      const response = await request(app)
        .get("/api/user/cart")
        .set(authHeader(user));

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.message).toBe("No items in the cart");
      expect(response.body.data).toEqual({
        restaurant: null,
        items: [],
        totalAmount: 0,
      });
    });

    it("recalculates and persists the cart total", async () => {
      // Arrange
      const user = await createUser({ username: "viewer" });
      const owner = await createUser({ role: "vendor", username: "restaurant-owner" });
      const restaurant = await createRestaurant(owner);
      const firstMenuItem = await createMenuItem(restaurant, {
        name: "Veg sandwich",
        price: 60,
        stockQty: 10,
      });
      const secondMenuItem = await createMenuItem(restaurant, {
        name: "Fresh juice",
        price: 40,
        stockQty: 10,
      });
      await createCart(
        user,
        restaurant,
        [
          { menuItem: firstMenuItem._id, quantity: 2 },
          { menuItem: secondMenuItem._id, quantity: 1 },
        ],
        0,
      );

      // Act
      const response = await request(app)
        .get("/api/user/cart")
        .set(authHeader(user));

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Cart fetched successfully");
      expect(response.body.data.totalAmount).toBe(160);
      await expect(
        cartModel.findOne({ user: user._id }).lean(),
      ).resolves.toMatchObject({ totalAmount: 160 });
    });

    it("returns a validation error when a cart item refers to an unavailable menu item", async () => {
      // Arrange
      const user = await createUser({ username: "stale-cart" });
      const owner = await createUser({ role: "vendor", username: "owner" });
      const restaurant = await createRestaurant(owner);
      const menuItem = await createMenuItem(restaurant, {
        name: "Milkshake",
        isAvailable: false,
      });
      await createCart(user, restaurant, [{ menuItem: menuItem._id, quantity: 1 }], 40);

      // Act
      const response = await request(app)
        .get("/api/user/cart")
        .set(authHeader(user));

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.message).toBe(`${menuItem.name} is currently unavailable`);
    });

    it("returns an empty cart response when the cart is deleted during total persistence", async () => {
      // Arrange
      const user = await createUser({ username: "racy-reader" });
      const owner = await createUser({ role: "vendor", username: "owner-racy" });
      const restaurant = await createRestaurant(owner);
      const menuItem = await createMenuItem(restaurant, {
        name: "Poha",
        price: 50,
        stockQty: 10,
      });
      await createCart(user, restaurant, [{ menuItem: menuItem._id, quantity: 1 }], 50);

      jest.spyOn(cartModel, "updateOne").mockResolvedValueOnce({
        acknowledged: true,
        matchedCount: 0,
        modifiedCount: 0,
      });

      // Act
      const response = await request(app)
        .get("/api/user/cart")
        .set(authHeader(user));

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.message).toBe("No items in the cart");
      expect(response.body.data).toEqual({
        restaurant: null,
        items: [],
        totalAmount: 0,
      });
    });
  });

  describe("PATCH /api/user/cart/items/:menuItemId", () => {
    it("updates the quantity of an existing cart item", async () => {
      // Arrange
      const user = await createUser({ username: "updater" });
      const owner = await createUser({ role: "vendor", username: "owner" });
      const restaurant = await createRestaurant(owner);
      const menuItem = await createMenuItem(restaurant, {
        price: 90,
        stockQty: 10,
      });
      await createCart(user, restaurant, [{ menuItem: menuItem._id, quantity: 1 }], 90);

      // Act
      const response = await request(app)
        .patch(`/api/user/cart/items/${menuItem._id.toString()}`)
        .set(authHeader(user))
        .send({ quantity: 3 });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Quantity updated");
      expect(response.body.data.totalAmount).toBe(270);
      expect(response.body.data.items[0].quantity).toBe(3);
    });

    it("returns validation and not-found failures", async () => {
      // Arrange
      const user = await createUser({ username: "patch-user" });
      const owner = await createUser({ role: "vendor", username: "owner" });
      const restaurant = await createRestaurant(owner);
      const menuItem = await createMenuItem(restaurant, {
        stockQty: 4,
      });
      const otherMenuItem = await createMenuItem(restaurant, {
        name: "Paneer wrap",
        stockQty: 4,
      });
      await createCart(user, restaurant, [{ menuItem: menuItem._id, quantity: 1 }], 80);

      // Act
      const invalidQuantity = await request(app)
        .patch(`/api/user/cart/items/${menuItem._id.toString()}`)
        .set(authHeader(user))
        .send({ quantity: 0 });
      const invalidId = await request(app)
        .patch("/api/user/cart/items/not-an-id")
        .set(authHeader(user))
        .send({ quantity: 2 });
      const noCartUser = await createUser({ username: "no-cart-user" });
      const missingCart = await request(app)
        .patch(`/api/user/cart/items/${menuItem._id.toString()}`)
        .set(authHeader(noCartUser))
        .send({ quantity: 2 });
      const noSuchItem = await request(app)
        .patch(`/api/user/cart/items/${otherMenuItem._id.toString()}`)
        .set(authHeader(user))
        .send({ quantity: 2 });

      // Assert
      expect(invalidQuantity.status).toBe(400);
      expect(invalidQuantity.body.message).toBe("Invalid quantity");
      expect(invalidId.status).toBe(400);
      expect(invalidId.body.message).toBe("Invalid menu item ID");
      expect(missingCart.status).toBe(404);
      expect(missingCart.body.message).toBe("Cart not found");
      expect(noSuchItem.status).toBe(404);
      expect(noSuchItem.body.message).toBe("Item not found in cart");
    });

    it("returns business-rule errors and conflict handling", async () => {
      // Arrange
      const user = await createUser({ username: "race-user" });
      const owner = await createUser({ role: "vendor", username: "owner" });
      const restaurant = await createRestaurant(owner);
      const menuItem = await createMenuItem(restaurant, { stockQty: 4 });
      const cart = await createCart(user, restaurant, [{ menuItem: menuItem._id, quantity: 1 }], 80);

      const overStock = await request(app)
        .patch(`/api/user/cart/items/${menuItem._id.toString()}`)
        .set(authHeader(user))
        .send({ quantity: 6 });

      jest.spyOn(cartModel, "findOneAndUpdate").mockResolvedValueOnce(null);
      jest.spyOn(cartModel, "findOne").mockReturnValueOnce({
        select: () => ({
          lean: async () => ({
            restaurant: cart.restaurant,
            items: cart.items.map((item) => ({
              menuItem: item.menuItem,
            })),
          }),
        }),
      });

      const conflict = await request(app)
        .patch(`/api/user/cart/items/${menuItem._id.toString()}`)
        .set(authHeader(user))
        .send({ quantity: 2 });

      // Assert
      expect(overStock.status).toBe(400);
      expect(overStock.body.message).toBe(
        `Only ${menuItem.stockQty} item(s) of ${menuItem.name} are currently available`,
      );
      expect(conflict.status).toBe(409);
      expect(conflict.body.message).toBe("Cart was updated by another request");
    });
  });

  describe("DELETE /api/user/cart/items/:menuItemId", () => {
    it("removes the last item and deletes the cart", async () => {
      // Arrange
      const user = await createUser({ username: "deleter" });
      const owner = await createUser({ role: "vendor", username: "owner" });
      const restaurant = await createRestaurant(owner);
      const menuItem = await createMenuItem(restaurant, { price: 55 });
      await createCart(user, restaurant, [{ menuItem: menuItem._id, quantity: 1 }], 55);

      // Act
      const response = await request(app)
        .delete(`/api/user/cart/items/${menuItem._id.toString()}`)
        .set(authHeader(user));

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Item deleted successfully");
      expect(response.body.data).toEqual({
        restaurant: null,
        items: [],
        totalAmount: 0,
      });
      await expect(cartModel.countDocuments({ user: user._id })).resolves.toBe(0);
    });

    it("recalculates the total when other items remain", async () => {
      // Arrange
      const user = await createUser({ username: "multi-delete" });
      const owner = await createUser({ role: "vendor", username: "owner" });
      const restaurant = await createRestaurant(owner);
      const firstMenuItem = await createMenuItem(restaurant, {
        name: "Burger",
        price: 100,
      });
      const secondMenuItem = await createMenuItem(restaurant, {
        name: "Fries",
        price: 40,
      });
      await createCart(
        user,
        restaurant,
        [
          { menuItem: firstMenuItem._id, quantity: 1 },
          { menuItem: secondMenuItem._id, quantity: 2 },
        ],
        180,
      );

      // Act
      const response = await request(app)
        .delete(`/api/user/cart/items/${firstMenuItem._id.toString()}`)
        .set(authHeader(user));

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.data.totalAmount).toBe(80);
      expect(response.body.data.items).toHaveLength(1);
      expect(response.body.data.items[0].quantity).toBe(2);
    });

    it("returns validation and lookup errors", async () => {
      // Arrange
      const user = await createUser({ username: "lookup-user" });
      const owner = await createUser({ role: "vendor", username: "owner" });
      const restaurant = await createRestaurant(owner);
      const menuItem = await createMenuItem(restaurant);
      await createCart(user, restaurant, [{ menuItem: menuItem._id, quantity: 1 }], 80);

      // Act
      const invalidId = await request(app)
        .delete("/api/user/cart/items/not-an-id")
        .set(authHeader(user));
      const missingItem = await request(app)
        .delete(`/api/user/cart/items/${new mongoose.Types.ObjectId().toString()}`)
        .set(authHeader(user));

      // Assert
      expect(invalidId.status).toBe(400);
      expect(invalidId.body.message).toBe("Invalid Menu Item ID");
      expect(missingItem.status).toBe(404);
      expect(missingItem.body.message).toBe("Item not found in cart");
    });
  });

  describe("DELETE /api/user/cart", () => {
    it("deletes the cart for the current user", async () => {
      // Arrange
      const user = await createUser({ username: "cart-delete" });
      const owner = await createUser({ role: "vendor", username: "owner" });
      const restaurant = await createRestaurant(owner);
      const menuItem = await createMenuItem(restaurant);
      await createCart(user, restaurant, [{ menuItem: menuItem._id, quantity: 1 }], 80);

      // Act
      const response = await request(app)
        .delete("/api/user/cart")
        .set(authHeader(user));

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Cart deleted successfully");
      await expect(cartModel.countDocuments({ user: user._id })).resolves.toBe(0);
    });

    it("returns a not-found error when the cart is missing", async () => {
      // Arrange
      const user = await createUser({ username: "missing-cart" });

      // Act
      const response = await request(app)
        .delete("/api/user/cart")
        .set(authHeader(user));

      // Assert
      expect(response.status).toBe(404);
      expect(response.body.message).toBe("Cart not found");
    });
  });
});
