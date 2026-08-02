import { jest } from "@jest/globals";
import bcrypt from "bcrypt";
import cookieParser from "cookie-parser";
import crypto from "crypto";
import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";

process.env.MONGO_URI ||= "mongodb://127.0.0.1:27017/auth-controller-test";
process.env.JWT_SECRET ||= "test-jwt-secret";
process.env.CLIENT_ID ||= "test-client-id";
process.env.CLIENT_SECRET ||= "test-client-secret";
process.env.GOOGLE_REFRESH_TOKEN ||= "test-google-refresh-token";
process.env.GOOGLE_USER ||= "test-google-user@gmail.com";
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

const emailServicesMock = {
  queueOTPEmail: jest.fn(),
  queueWelcomeEmail: jest.fn(),
  queueForgotEmail: jest.fn(),
  queueVendorNewOrderEmail: jest.fn(),
  queueAdminMarketplaceOrderEmail: jest.fn(),
  queueDeliveryAssignmentEmail: jest.fn(),
};

const otpServicesMock = {
  storeOTP: jest.fn(),
  verifyOTP: jest.fn(),
};

const redisServicesMock = {
  get: jest.fn(),
  set: jest.fn(),
  remove: jest.fn(),
  removeByPattern: jest.fn(),
  exists: jest.fn(),
  expire: jest.fn(),
};

const passportMock = {
  initialize: jest.fn(() => (req, res, next) => next()),
  authenticate: jest.fn(() => (req, res) => res.status(200).json({ ok: true })),
  use: jest.fn(),
};

jest.unstable_mockModule("../src/services/emailQueue.services.js", () => ({
  default: emailServicesMock,
}));

jest.unstable_mockModule("../src/services/otp.services.js", () => ({
  default: otpServicesMock,
}));

jest.unstable_mockModule("../src/services/redis.services.js", () => ({
  default: redisServicesMock,
}));

jest.unstable_mockModule("../src/config/passport.js", () => ({
  default: passportMock,
}));

let app;
let mongoServer;
let userModel;
let sessionModel;
let authControllers;
let ApiError;

const hashRefreshToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

const buildAccessToken = (user, overrides = {}) =>
  jwt.sign(
    {
      id: user._id.toString(),
      role: user.role,
      ...overrides,
    },
    process.env.JWT_SECRET,
    { expiresIn: "15m" },
  );

const buildRefreshToken = (user, overrides = {}) =>
  jwt.sign(
    {
      id: user._id.toString(),
      role: user.role,
      ...overrides,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" },
  );

const createUser = async ({
  username = "testuser",
  email = "test@gmail.com",
  password = "password123",
  verified = true,
  role = "user",
  authProvider = "local",
  isBlocked = false,
  googleId = null,
} = {}) => {
  const hashedPassword =
    authProvider === "local" && password
      ? await bcrypt.hash(password, 10)
      : undefined;

  return userModel.create({
    username,
    email,
    password: hashedPassword,
    verified,
    role,
    authProvider,
    isBlocked,
    googleId,
  });
};

const createSession = async (user, refreshToken, overrides = {}) =>
  sessionModel.create({
    user: user._id,
    refreshTokenHash: hashRefreshToken(refreshToken),
    ip: "::ffff:127.0.0.1",
    userAgent: "jest-agent",
    ...overrides,
  });

const invokeController = async (
  handler,
  { body = {}, cookies = {}, authRole, user, ip = "::ffff:127.0.0.1" } = {},
) =>
  new Promise((resolve) => {
    const req = {
      body,
      cookies,
      authRole,
      user,
      ip,
      headers: { "user-agent": "jest-agent" },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      cookie: jest.fn().mockReturnThis(),
      clearCookie: jest.fn().mockReturnThis(),
      redirect: jest.fn().mockReturnThis(),
    };

    handler(req, res, (err) => resolve({ err, res }));
  });

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create({
    instance: {
      ip: "127.0.0.1",
    },
  });
  await mongoose.connect(mongoServer.getUri());

  const [{ default: authRouter }, userModule, sessionModule, controllerModule, errorModule] =
    await Promise.all([
      import("../src/routes/auth.routes.js"),
      import("../src/models/user.models.js"),
      import("../src/models/session.models.js"),
      import("../src/controllers/auth.controllers.js"),
      import("../src/utils/apiErrors.js"),
    ]);

  userModel = userModule.default;
  sessionModel = sessionModule.default;
  authControllers = controllerModule.default;
  ApiError = errorModule.default;

  app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/auth", authRouter);
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

  emailServicesMock.queueOTPEmail.mockResolvedValue({ id: "otp-job" });
  emailServicesMock.queueWelcomeEmail.mockResolvedValue({ id: "welcome-job" });
  emailServicesMock.queueForgotEmail.mockResolvedValue({ id: "forgot-job" });
  otpServicesMock.storeOTP.mockResolvedValue(undefined);
  otpServicesMock.verifyOTP.mockResolvedValue(true);
  redisServicesMock.get.mockResolvedValue(null);
  redisServicesMock.set.mockResolvedValue(undefined);
  redisServicesMock.remove.mockResolvedValue(undefined);
  redisServicesMock.removeByPattern.mockResolvedValue(undefined);
  redisServicesMock.exists.mockResolvedValue(false);
  redisServicesMock.expire.mockResolvedValue(undefined);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer?.stop();
});

describe("auth controller routes", () => {
  describe("POST /api/auth/:role/register", () => {
    it("registers a user, stores an OTP, and queues a verification email", async () => {
      // Arrange
      const payload = {
        username: "  Alice  ",
        email: "  ALICE@gmail.COM  ",
        password: "password123",
      };

      // Act
      const response = await request(app)
        .post("/api/auth/user/register")
        .send(payload);

      // Assert
      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        statusCode: 201,
        success: true,
        message: "User registered successfully. Please verify your email",
        data: {
          username: "Alice",
          email: "alice@gmail.com",
          verified: false,
        },
      });

      const user = await userModel.findOne({ email: "alice@gmail.com" });
      expect(user).toBeTruthy();
      expect(user.role).toBe("user");
      expect(user.password).not.toBe(payload.password);
      await expect(bcrypt.compare(payload.password, user.password)).resolves.toBe(
        true,
      );
      expect(otpServicesMock.storeOTP).toHaveBeenCalledWith(
        "alice@gmail.com",
        expect.stringMatching(/^\d{6}$/),
      );
      expect(emailServicesMock.queueOTPEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "alice@gmail.com",
          subject: "Your OTP for CampusIn registration",
        }),
      );
    });

    it("registers vendor and delivery partner accounts with the expected role", async () => {
      // Arrange
      const vendorPayload = {
        username: "vendorone",
        email: "vendor@gmail.com",
        password: "password123",
      };
      const deliveryPayload = {
        username: "deliveryone",
        email: "delivery@gmail.com",
        password: "password123",
      };

      // Act
      const vendorResponse = await request(app)
        .post("/api/auth/vendor/register")
        .send(vendorPayload);
      const deliveryResponse = await request(app)
        .post("/api/auth/delivery-partner/register")
        .send(deliveryPayload);

      // Assert
      expect(vendorResponse.status).toBe(201);
      expect(deliveryResponse.status).toBe(201);
      await expect(
        userModel.findOne({ email: vendorPayload.email }).lean(),
      ).resolves.toMatchObject({ role: "vendor" });
      await expect(
        userModel.findOne({ email: deliveryPayload.email }).lean(),
      ).resolves.toMatchObject({ role: "delivery_partner" });
    });

    it("returns validation errors for malformed registration input", async () => {
      // Arrange
      const payload = {
        username: "ab",
        email: "not-an-email",
        password: "123",
      };

      // Act
      const response = await request(app)
        .post("/api/auth/user/register")
        .send(payload);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Validation failed");
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: "username" }),
          expect.objectContaining({ field: "email" }),
          expect.objectContaining({ field: "password" }),
        ]),
      );
      await expect(userModel.countDocuments()).resolves.toBe(0);
    });

    it("rejects registration from non-whitelisted email domains", async () => {
      // Arrange
      const payload = {
        username: "unknown",
        email: "unknown@yahoo.com",
        password: "password123",
      };

      // Act
      const response = await request(app)
        .post("/api/auth/user/register")
        .send(payload);

      // Assert
      expect(response.status).toBe(403);
      expect(response.body.message).toContain("@gmail.com");
      expect(response.body.message).toContain("@nitj.ac.in");
      await expect(userModel.countDocuments()).resolves.toBe(0);
      expect(emailServicesMock.queueOTPEmail).not.toHaveBeenCalled();
    });

    it("rejects duplicate email or username registration", async () => {
      // Arrange
      await createUser({
        username: "existing",
        email: "existing@gmail.com",
        verified: false,
      });

      // Act
      const response = await request(app).post("/api/auth/user/register").send({
        username: "newuser",
        email: "existing@gmail.com",
        password: "password123",
      });

      // Assert
      expect(response.status).toBe(409);
      expect(response.body.message).toBe("Username or email already exists");
      expect(emailServicesMock.queueOTPEmail).not.toHaveBeenCalled();
    });

    it("requires admin authentication and authorization for admin registration", async () => {
      // Arrange
      const adminPayload = {
        username: "adminnew",
        email: "adminnew@gmail.com",
        password: "password123",
      };
      const normalUser = await createUser({
        username: "normal",
        email: "normal@gmail.com",
        role: "user",
      });
      const userToken = buildAccessToken(normalUser);

      // Act
      const missingTokenResponse = await request(app)
        .post("/api/auth/admin/register")
        .send(adminPayload);
      const forbiddenResponse = await request(app)
        .post("/api/auth/admin/register")
        .set("Authorization", `Bearer ${userToken}`)
        .send(adminPayload);

      // Assert
      expect(missingTokenResponse.status).toBe(401);
      expect(missingTokenResponse.body.message).toBe("Unauthorized");
      expect(forbiddenResponse.status).toBe(403);
      expect(forbiddenResponse.body.message).toBe("Forbidden");
    });

    it("returns 500 when the registration database lookup fails", async () => {
      // Arrange
      jest
        .spyOn(userModel, "findOne")
        .mockRejectedValueOnce(new Error("database unavailable"));

      // Act
      const response = await request(app).post("/api/auth/user/register").send({
        username: "dbfail",
        email: "dbfail@gmail.com",
        password: "password123",
      });

      // Assert
      expect(response.status).toBe(500);
      expect(response.body.message).toBe("database unavailable");
    });
  });

  describe("POST /api/auth/:role/login", () => {
    it("logs in a verified local user, creates a session, and sets a refresh cookie", async () => {
      // Arrange
      const user = await createUser({
        username: "loginuser",
        email: "login@gmail.com",
        password: "password123",
      });

      // Act
      const response = await request(app)
        .post("/api/auth/user/login")
        .set("User-Agent", "jest-agent")
        .send({ email: " LOGIN@gmail.com ", password: "password123" });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Login successful");
      expect(response.body.data.accessToken).toEqual(expect.any(String));
      expect(response.headers["set-cookie"].join(";")).toContain(
        "refreshToken=",
      );
      const decoded = jwt.verify(
        response.body.data.accessToken,
        process.env.JWT_SECRET,
      );
      expect(decoded).toMatchObject({
        id: user._id.toString(),
        role: "user",
      });
      await expect(sessionModel.countDocuments({ user: user._id })).resolves.toBe(
        1,
      );
    });

    it("rejects missing fields before hitting the database", async () => {
      // Arrange
      const payload = { email: "login@gmail.com" };

      // Act
      const response = await request(app)
        .post("/api/auth/user/login")
        .send(payload);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Validation failed");
      await expect(sessionModel.countDocuments()).resolves.toBe(0);
    });

    it("rejects login from non-whitelisted email domains", async () => {
      // Act
      const response = await request(app)
        .post("/api/auth/vendor/login")
        .send({ email: "vendor@yahoo.com", password: "password123" });

      // Assert
      expect(response.status).toBe(403);
      expect(response.body.message).toContain("@gmail.com");
      expect(response.body.message).toContain("@nitj.ac.in");
      await expect(sessionModel.countDocuments()).resolves.toBe(0);
    });

    it("rejects invalid credentials, unverified users, and Google-only accounts", async () => {
      // Arrange
      await createUser({
        username: "verified",
        email: "verified@gmail.com",
        password: "password123",
      });
      await createUser({
        username: "unverified",
        email: "unverified@gmail.com",
        password: "password123",
        verified: false,
      });
      await createUser({
        username: "googleuser",
        email: "google@gmail.com",
        password: null,
        authProvider: "google",
        googleId: "google-id",
      });

      // Act
      const wrongPassword = await request(app)
        .post("/api/auth/user/login")
        .send({ email: "verified@gmail.com", password: "wrongpass" });
      const unverified = await request(app)
        .post("/api/auth/user/login")
        .send({ email: "unverified@gmail.com", password: "password123" });
      const googleOnly = await request(app)
        .post("/api/auth/user/login")
        .send({ email: "google@gmail.com", password: "password123" });

      // Assert
      expect(wrongPassword.status).toBe(400);
      expect(wrongPassword.body.message).toBe("Invalid credentials");
      expect(unverified.status).toBe(400);
      expect(unverified.body.message).toBe(
        "Please verify your email before logging in",
      );
      expect(googleOnly.status).toBe(400);
      expect(googleOnly.body.message).toBe("Please login with Google");
    });

    it("does not allow a user account to log in through a vendor endpoint", async () => {
      // Arrange
      await createUser({
        username: "notvendor",
        email: "notvendor@gmail.com",
        password: "password123",
        role: "user",
      });

      // Act
      const response = await request(app)
        .post("/api/auth/vendor/login")
        .send({ email: "notvendor@gmail.com", password: "password123" });

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Invalid credentials");
    });

    it("returns 500 when session creation fails after credentials are valid", async () => {
      // Arrange
      await createUser({
        username: "sessionfail",
        email: "sessionfail@gmail.com",
        password: "password123",
      });
      jest
        .spyOn(sessionModel, "create")
        .mockRejectedValueOnce(new Error("session write failed"));

      // Act
      const response = await request(app)
        .post("/api/auth/user/login")
        .send({ email: "sessionfail@gmail.com", password: "password123" });

      // Assert
      expect(response.status).toBe(500);
      expect(response.body.message).toBe("session write failed");
    });
  });

  describe("POST /api/auth/:role/verify-email", () => {
    it("verifies an email, creates a session, queues a welcome email, and returns an access token", async () => {
      // Arrange
      const user = await createUser({
        username: "verifyuser",
        email: "verify@gmail.com",
        verified: false,
      });

      // Act
      const response = await request(app)
        .post("/api/auth/user/verify-email")
        .set("User-Agent", "jest-agent")
        .send({ email: " verify@gmail.com ", otp: "123456" });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Email verified successfully");
      expect(response.body.data.user).toMatchObject({
        username: "verifyuser",
        email: "verify@gmail.com",
        verified: true,
      });
      expect(response.body.data.accessToken).toEqual(expect.any(String));
      expect(otpServicesMock.verifyOTP).toHaveBeenCalledWith(
        "verify@gmail.com",
        "123456",
      );
      expect(emailServicesMock.queueWelcomeEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: "verify@gmail.com" }),
      );
      await expect(userModel.findById(user._id).lean()).resolves.toMatchObject({
        verified: true,
      });
      await expect(sessionModel.countDocuments({ user: user._id })).resolves.toBe(
        1,
      );
    });

    it("rejects invalid OTPs and unknown role-scoped users", async () => {
      // Arrange
      await createUser({
        username: "vendorverify",
        email: "vendorverify@gmail.com",
        verified: false,
        role: "vendor",
      });
      otpServicesMock.verifyOTP.mockResolvedValueOnce(false);

      // Act
      const invalidOtp = await request(app)
        .post("/api/auth/vendor/verify-email")
        .send({ email: "vendorverify@gmail.com", otp: "000000" });
      const wrongRole = await request(app)
        .post("/api/auth/user/verify-email")
        .send({ email: "vendorverify@gmail.com", otp: "123456" });

      // Assert
      expect(invalidOtp.status).toBe(400);
      expect(invalidOtp.body.message).toBe("OTP verification failed");
      expect(wrongRole.status).toBe(404);
      expect(wrongRole.body.message).toBe("User not found");
    });

    it("returns validation errors for malformed verification requests", async () => {
      // Arrange
      const payload = { email: "bad-email", otp: "12ab" };

      // Act
      const response = await request(app)
        .post("/api/auth/user/verify-email")
        .send(payload);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Validation failed");
      expect(otpServicesMock.verifyOTP).not.toHaveBeenCalled();
    });
  });

  describe("POST /api/auth/:role/resend-otp", () => {
    it("resends an OTP to an unverified user outside the cooldown window", async () => {
      // Arrange
      await createUser({
        username: "resenduser",
        email: "resend@gmail.com",
        verified: false,
      });

      // Act
      const response = await request(app)
        .post("/api/auth/user/resend-otp")
        .send({ email: "resend@gmail.com" });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.message).toBe("OTP resent successfully");
      expect(redisServicesMock.exists).toHaveBeenCalledWith(
        "cooldown:resend@gmail.com",
      );
      expect(redisServicesMock.set).toHaveBeenCalledWith(
        "cooldown:resend@gmail.com",
        "1",
        60,
      );
      expect(otpServicesMock.storeOTP).toHaveBeenCalledWith(
        "resend@gmail.com",
        expect.stringMatching(/^\d{6}$/),
      );
      expect(emailServicesMock.queueOTPEmail).toHaveBeenCalled();
    });

    it("uses a generic response for unknown emails and rejects verified users", async () => {
      // Arrange
      await createUser({
        username: "alreadyverified",
        email: "already@gmail.com",
        verified: true,
      });

      // Act
      const unknown = await request(app)
        .post("/api/auth/user/resend-otp")
        .send({ email: "missing@gmail.com" });
      const verified = await request(app)
        .post("/api/auth/user/resend-otp")
        .send({ email: "already@gmail.com" });

      // Assert
      expect(unknown.status).toBe(200);
      expect(unknown.body.message).toBe(
        "If the email is registered, an OTP will be sent",
      );
      expect(verified.status).toBe(400);
      expect(verified.body.message).toBe("Email is already verified");
    });

    it("rate-limits OTP resend requests during cooldown", async () => {
      // Arrange
      await createUser({
        username: "cooldown",
        email: "cooldown@gmail.com",
        verified: false,
      });
      redisServicesMock.exists.mockResolvedValueOnce(true);

      // Act
      const response = await request(app)
        .post("/api/auth/user/resend-otp")
        .send({ email: "cooldown@gmail.com" });

      // Assert
      expect(response.status).toBe(429);
      expect(response.body.message).toBe(
        "Please wait 60 seconds before requesting a new OTP",
      );
      expect(otpServicesMock.storeOTP).not.toHaveBeenCalled();
    });
  });

  describe("POST /api/auth/:role/refresh-token", () => {
    it("rotates a valid refresh token and updates the stored session hash", async () => {
      // Arrange
      const user = await createUser({
        username: "refreshuser",
        email: "refresh@gmail.com",
      });
      const oldRefreshToken = buildRefreshToken(user, { nonce: "old-token" });
      const session = await createSession(user, oldRefreshToken);

      // Act
      const response = await request(app)
        .post("/api/auth/user/refresh-token")
        .set("Cookie", [`refreshToken=${oldRefreshToken}`]);

      // Assert
      expect(response.status).toBe(201);
      expect(response.body.message).toBe("New access token created");
      expect(response.body.data.accessToken).toEqual(expect.any(String));
      expect(response.headers["set-cookie"].join(";")).toContain(
        "refreshToken=",
      );
      const updatedSession = await sessionModel.findById(session._id);
      expect(updatedSession.refreshTokenHash).not.toBe(
        hashRefreshToken(oldRefreshToken),
      );
    });

    it("rejects missing, invalid, revoked, missing-user, and wrong-role refresh tokens", async () => {
      // Arrange
      const user = await createUser({
        username: "refreshcases",
        email: "refreshcases@gmail.com",
      });
      const vendor = await createUser({
        username: "refreshvendor",
        email: "refreshvendor@gmail.com",
        role: "vendor",
      });
      const validButNoSession = buildRefreshToken(user);
      const revokedToken = buildRefreshToken(user);
      const wrongRoleToken = buildRefreshToken(vendor);
      const deletedUser = await createUser({
        username: "deleted",
        email: "deleted@gmail.com",
      });
      const deletedUserToken = buildRefreshToken(deletedUser);
      await createSession(user, revokedToken, { revoked: true });
      await createSession(vendor, wrongRoleToken);
      await createSession(deletedUser, deletedUserToken);
      await userModel.findByIdAndDelete(deletedUser._id);

      // Act
      const missing = await request(app).post("/api/auth/user/refresh-token");
      const invalid = await request(app)
        .post("/api/auth/user/refresh-token")
        .set("Cookie", ["refreshToken=not-a-jwt"]);
      const noSession = await request(app)
        .post("/api/auth/user/refresh-token")
        .set("Cookie", [`refreshToken=${validButNoSession}`]);
      const revoked = await request(app)
        .post("/api/auth/user/refresh-token")
        .set("Cookie", [`refreshToken=${revokedToken}`]);
      const missingUser = await request(app)
        .post("/api/auth/user/refresh-token")
        .set("Cookie", [`refreshToken=${deletedUserToken}`]);
      const wrongRole = await request(app)
        .post("/api/auth/user/refresh-token")
        .set("Cookie", [`refreshToken=${wrongRoleToken}`]);

      // Assert
      expect(missing.status).toBe(401);
      expect(missing.body.message).toBe("Unauthorised, refresh token not found");
      expect(invalid.status).toBe(500);
      expect(noSession.status).toBe(400);
      expect(noSession.body.message).toBe("No session in progress");
      expect(revoked.status).toBe(400);
      expect(revoked.body.message).toBe("No session in progress");
      expect(missingUser.status).toBe(401);
      expect(missingUser.body.message).toBe("User not found");
      expect(wrongRole.status).toBe(403);
      expect(wrongRole.body.message).toBe(
        "This endpoint is only available for user accounts",
      );
    });
  });

  describe("POST /api/auth/:role/logout and logout-all", () => {
    it("revokes the current session and clears the refresh cookie on logout", async () => {
      // Arrange
      const user = await createUser({
        username: "logoutuser",
        email: "logout@gmail.com",
      });
      const refreshToken = buildRefreshToken(user);
      const session = await createSession(user, refreshToken);

      // Act
      const response = await request(app)
        .post("/api/auth/user/logout")
        .set("Cookie", [`refreshToken=${refreshToken}`]);

      // Assert
      expect(response.status).toBe(200);
      expect(response.headers["set-cookie"].join(";")).toContain(
        "refreshToken=;",
      );
      await expect(sessionModel.findById(session._id).lean()).resolves.toMatchObject(
        {
          revoked: true,
        },
      );
    });

    it("handles logout without a cookie as an idempotent success", async () => {
      // Arrange & Act
      const response = await request(app).post("/api/auth/user/logout");

      // Assert
      expect(response.status).toBe(200);
      expect(response.headers["set-cookie"].join(";")).toContain(
        "refreshToken=;",
      );
    });

    it("rejects logout when the token role does not match the endpoint", async () => {
      // Arrange
      const vendor = await createUser({
        username: "logoutvendor",
        email: "logoutvendor@gmail.com",
        role: "vendor",
      });
      const refreshToken = buildRefreshToken(vendor);

      // Act
      const response = await request(app)
        .post("/api/auth/user/logout")
        .set("Cookie", [`refreshToken=${refreshToken}`]);

      // Assert
      expect(response.status).toBe(403);
      expect(response.body.message).toBe(
        "This endpoint is only available for user accounts",
      );
    });

    it("revokes every active session for a user on logout-all", async () => {
      // Arrange
      const user = await createUser({
        username: "logoutall",
        email: "logoutall@gmail.com",
      });
      const firstToken = buildRefreshToken(user, { nonce: "one" });
      const secondToken = buildRefreshToken(user, { nonce: "two" });
      await createSession(user, firstToken);
      await createSession(user, secondToken);

      // Act
      const response = await request(app)
        .post("/api/auth/user/logout-all")
        .set("Cookie", [`refreshToken=${firstToken}`]);

      // Assert
      expect(response.status).toBe(200);
      await expect(
        sessionModel.countDocuments({ user: user._id, revoked: false }),
      ).resolves.toBe(0);
    });
  });

  describe("password reset flow", () => {
    it("queues a password reset OTP for a verified account", async () => {
      // Arrange
      await createUser({
        username: "forgotuser",
        email: "forgot@gmail.com",
      });

      // Act
      const response = await request(app)
        .post("/api/auth/user/forgot-password")
        .send({ email: "forgot@gmail.com" });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.message).toBe(
        "If an account exists with this email, an OTP has been sent.",
      );
      expect(otpServicesMock.storeOTP).toHaveBeenCalledWith(
        "forgot@gmail.com",
        expect.stringMatching(/^\d{6}$/),
      );
      expect(emailServicesMock.queueForgotEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: "forgot@gmail.com" }),
      );
    });

    it("returns a generic password reset response for unknown or unverified accounts", async () => {
      // Arrange
      await createUser({
        username: "forgotunverified",
        email: "forgotunverified@gmail.com",
        verified: false,
      });

      // Act
      const unknown = await request(app)
        .post("/api/auth/user/forgot-password")
        .send({ email: "unknown@gmail.com" });
      const unverified = await request(app)
        .post("/api/auth/user/forgot-password")
        .send({ email: "forgotunverified@gmail.com" });

      // Assert
      expect(unknown.status).toBe(200);
      expect(unverified.status).toBe(200);
      expect(emailServicesMock.queueForgotEmail).not.toHaveBeenCalled();
    });

    it("verifies a reset OTP and stores a short-lived reset token in Redis", async () => {
      // Arrange
      const user = await createUser({
        username: "resetotp",
        email: "resetotp@gmail.com",
      });

      // Act
      const response = await request(app)
        .post("/api/auth/user/verify-reset-otp")
        .send({ email: "resetotp@gmail.com", otp: "654321" });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Reset token set successfully");
      expect(response.body.data.resetToken).toEqual(expect.any(String));
      expect(redisServicesMock.set).toHaveBeenCalledWith(
        `reset:${response.body.data.resetToken}`,
        user._id.toString(),
        600,
      );
    });

    it("rejects invalid reset OTP submissions", async () => {
      // Arrange
      await createUser({
        username: "badresetotp",
        email: "badresetotp@gmail.com",
      });
      otpServicesMock.verifyOTP.mockResolvedValueOnce(false);

      // Act
      const invalidOtp = await request(app)
        .post("/api/auth/user/verify-reset-otp")
        .send({ email: "badresetotp@gmail.com", otp: "123456" });
      const unknownEmail = await request(app)
        .post("/api/auth/user/verify-reset-otp")
        .send({ email: "unknown@gmail.com", otp: "123456" });

      // Assert
      expect(invalidOtp.status).toBe(400);
      expect(invalidOtp.body.message).toBe("OTP verification failed");
      expect(unknownEmail.status).toBe(404);
      expect(unknownEmail.body.message).toBe("Invalid OTP or email");
    });

    it("resets a password, removes sessions, and requires the new password for login", async () => {
      // Arrange
      const user = await createUser({
        username: "resetuser",
        email: "reset@gmail.com",
        password: "oldpass123",
      });
      const refreshToken = buildRefreshToken(user);
      await createSession(user, refreshToken);
      redisServicesMock.get.mockResolvedValueOnce(user._id.toString());

      // Act
      const response = await request(app)
        .post("/api/auth/user/reset-password")
        .send({ resetToken: "valid-reset-token", password: "newpass123" });
      const oldPasswordLogin = await request(app)
        .post("/api/auth/user/login")
        .set("User-Agent", "jest-agent")
        .send({ email: "reset@gmail.com", password: "oldpass123" });
      const newPasswordLogin = await request(app)
        .post("/api/auth/user/login")
        .set("User-Agent", "jest-agent")
        .send({ email: "reset@gmail.com", password: "newpass123" });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.message).toBe(
        "Password reset is successfull. Log in again to continue",
      );
      expect(redisServicesMock.get).toHaveBeenCalledWith(
        "reset:valid-reset-token",
      );
      expect(redisServicesMock.remove).toHaveBeenCalledWith(
        "undefined:valid-reset-token",
      );
      await expect(sessionModel.countDocuments({ user: user._id })).resolves.toBe(
        1,
      );
      expect(oldPasswordLogin.status).toBe(400);
      expect(newPasswordLogin.status).toBe(200);
    });

    it("rejects reset-password requests with missing, unknown, or deleted users", async () => {
      // Arrange
      const deletedUser = await createUser({
        username: "deletedreset",
        email: "deletedreset@gmail.com",
      });
      const deletedUserId = deletedUser._id.toString();
      await userModel.findByIdAndDelete(deletedUser._id);
      redisServicesMock.get
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(deletedUserId);

      // Act
      const missingPassword = await request(app)
        .post("/api/auth/user/reset-password")
        .send({ resetToken: "token-only" });
      const missingRedisUser = await request(app)
        .post("/api/auth/user/reset-password")
        .send({ resetToken: "missing-user", password: "newpass123" });
      const deletedRedisUser = await request(app)
        .post("/api/auth/user/reset-password")
        .send({ resetToken: "deleted-user", password: "newpass123" });

      // Assert
      expect(missingPassword.status).toBe(400);
      expect(missingPassword.body.message).toBe("Validation failed");
      expect(missingRedisUser.status).toBe(400);
      expect(missingRedisUser.body.message).toBe("User ID not found");
      expect(deletedRedisUser.status).toBe(404);
      expect(deletedRedisUser.body.message).toBe("Invalid Request");
    });
  });

  describe("authenticated profile routes", () => {
    it("returns the current authenticated user's profile", async () => {
      // Arrange
      const user = await createUser({
        username: "profileuser",
        email: "profile@gmail.com",
        role: "vendor",
      });
      const token = buildAccessToken(user);

      // Act
      const response = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${token}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.message).toBe("User profile retrieved");
      expect(response.body.data).toMatchObject({
        id: user._id.toString(),
        username: "profileuser",
        email: "profile@gmail.com",
        role: "vendor",
      });
    });

    it("rejects unauthenticated, invalid, expired, and deleted-user profile requests", async () => {
      // Arrange
      const user = await createUser({
        username: "authcases",
        email: "authcases@gmail.com",
      });
      const expiredToken = jwt.sign(
        { id: user._id.toString(), role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: "-1s" },
      );
      const deletedUserToken = buildAccessToken(user);
      await userModel.findByIdAndDelete(user._id);

      // Act
      const missing = await request(app).get("/api/auth/me");
      const malformed = await request(app)
        .get("/api/auth/me")
        .set("Authorization", "Bearer bad-token");
      const expired = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${expiredToken}`);
      const deleted = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${deletedUserToken}`);

      // Assert
      expect(missing.status).toBe(401);
      expect(missing.body.message).toBe("Unauthorized");
      expect(malformed.status).toBe(401);
      expect(malformed.body.message).toBe("Invalid token");
      expect(expired.status).toBe(401);
      expect(expired.body.message).toBe("Token expired");
      expect(deleted.status).toBe(401);
      expect(deleted.body.message).toBe("Invalid token");
    });

    it("updates a profile username when it is unique", async () => {
      // Arrange
      const user = await createUser({
        username: "oldname",
        email: "oldname@gmail.com",
      });
      const token = buildAccessToken(user);

      // Act
      const response = await request(app)
        .patch("/api/auth/me")
        .set("Authorization", `Bearer ${token}`)
        .send({ username: "newname" });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Profile updated successfully");
      expect(response.body.data.username).toBe("newname");
      await expect(userModel.findById(user._id).lean()).resolves.toMatchObject({
        username: "newname",
      });
    });

    it("rejects duplicate usernames during profile updates", async () => {
      // Arrange
      await createUser({
        username: "taken",
        email: "taken@gmail.com",
      });
      const user = await createUser({
        username: "updater",
        email: "updater@gmail.com",
      });
      const token = buildAccessToken(user);

      // Act
      const response = await request(app)
        .patch("/api/auth/me")
        .set("Authorization", `Bearer ${token}`)
        .send({ username: "taken" });

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Username already exists");
    });

    it("surfaces database failures from profile updates", async () => {
      // Arrange
      const user = await createUser({
        username: "profiledbfail",
        email: "profiledbfail@gmail.com",
      });
      const token = buildAccessToken(user);
      jest
        .spyOn(userModel, "findByIdAndUpdate")
        .mockRejectedValueOnce(new Error("profile update failed"));

      // Act
      const response = await request(app)
        .patch("/api/auth/me")
        .set("Authorization", `Bearer ${token}`)
        .send({});

      // Assert
      expect(response.status).toBe(500);
      expect(response.body.message).toBe("profile update failed");
    });
  });

  describe("Google auth routes", () => {
    it("delegates the Google auth route to Passport with the expected options", async () => {
      // Arrange & Act
      const response = await request(app).get("/api/auth/google");

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ ok: true });
    });

    it("redirects a successful Google login with an access token", async () => {
      // Arrange
      const req = {
        user: await createUser({
          username: "googlelogin",
          email: "googlelogin@gmail.com",
        }),
        ip: "::ffff:127.0.0.1",
        headers: { "user-agent": "jest-agent" },
      };
      let resolveRedirect;
      const redirected = new Promise((resolve) => {
        resolveRedirect = resolve;
      });
      const res = {
        cookie: jest.fn().mockReturnThis(),
        redirect: jest.fn((url) => {
          resolveRedirect(url);
        }),
      };

      // Act
      authControllers.googleLogin(req, res, (err) => {
        throw err;
      });
      await redirected;

      // Assert
      expect(res.cookie).toHaveBeenCalledWith(
        "refreshToken",
        expect.any(String),
        expect.objectContaining({ httpOnly: true }),
      );
      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringMatching(
          /^http:\/\/localhost:5173\/auth\/success\?token=.+/,
        ),
      );
      await expect(sessionModel.countDocuments({ user: req.user._id })).resolves.toBe(
        1,
      );
    });
  });

  describe("controller-level guard rails", () => {
    it("keeps required-field checks inside controller methods", async () => {
      // Arrange & Act
      const registerResult = await invokeController(authControllers.register, {
        body: { email: "missing@gmail.com", password: "password123" },
      });
      const loginResult = await invokeController(authControllers.login, {
        body: { email: "missing@gmail.com" },
      });
      const verifyEmailResult = await invokeController(
        authControllers.verifyEmail,
        { body: { email: "missing@gmail.com" } },
      );
      const resendResult = await invokeController(authControllers.resendOTP);
      const forgotResult = await invokeController(authControllers.forgotPassword);
      const missingResetOtpResult = await invokeController(
        authControllers.verifyResetOtp,
        { body: { email: "missing@gmail.com" } },
      );
      const missingResetEmailResult = await invokeController(
        authControllers.verifyResetOtp,
        { body: { otp: "123456" } },
      );
      const resetPasswordResult = await invokeController(
        authControllers.resetPassword,
        { body: { resetToken: "token-only" } },
      );

      // Assert
      expect(registerResult.err).toMatchObject({
        statusCode: 400,
        message: "Username, email and password are required",
      });
      expect(loginResult.err).toMatchObject({
        statusCode: 400,
        message: "Email and password are required",
      });
      expect(verifyEmailResult.err).toMatchObject({
        statusCode: 400,
        message: "Email and OTP are required",
      });
      expect(resendResult.err).toMatchObject({
        statusCode: 400,
        message: "Email is required",
      });
      expect(forgotResult.err).toMatchObject({
        statusCode: 400,
        message: "User email is required",
      });
      expect(missingResetOtpResult.err).toMatchObject({
        statusCode: 400,
        message: "OTP is missing",
      });
      expect(missingResetEmailResult.err).toMatchObject({
        statusCode: 400,
        message: "User email is required",
      });
      expect(resetPasswordResult.err).toMatchObject({
        statusCode: 400,
        message: "New password is not enetered",
      });
    });

    it("handles profile controller edge cases after authentication has succeeded", async () => {
      // Arrange
      const missingUserId = new mongoose.Types.ObjectId().toString();

      // Act
      const invalidIdResult = await invokeController(authControllers.updateProfile, {
        user: { id: "not-a-valid-object-id" },
        body: { username: "ignored" },
      });
      const missingMeResult = await invokeController(authControllers.getMe, {
        user: { id: missingUserId },
      });
      const missingUpdateResult = await invokeController(
        authControllers.updateProfile,
        {
          user: { id: missingUserId },
          body: {},
        },
      );

      // Assert
      expect(invalidIdResult.err).toMatchObject({
        statusCode: 400,
        message: "Invalid user ID",
      });
      expect(missingMeResult.err).toMatchObject({
        statusCode: 404,
        message: "User not found",
      });
      expect(missingUpdateResult.err).toMatchObject({
        statusCode: 404,
        message: "User not found",
      });
    });
  });
});
