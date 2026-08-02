import { jest } from "@jest/globals";
import bcrypt from "bcrypt";
import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import path from "path";

process.env.MONGO_URI ||= "mongodb://127.0.0.1:27017/repair-request-controller-test";
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

const uploadOnCloudinaryMock = jest.fn();
const getUserRepairRequestsCachedMock = jest.fn();
const setUserRepairRequestsCachedMock = jest.fn();
const deleteUserRepairRequestsCachedMock = jest.fn();
const getUserRepairRequestByIdCachedMock = jest.fn();
const setUserRepairRequestByIdCachedMock = jest.fn();
const deleteUserRepairRequestByIdCachedMock = jest.fn();

jest.unstable_mockModule("../src/services/cloudinary.services.js", () => ({
  uploadOnCloudinary: uploadOnCloudinaryMock,
}));

jest.unstable_mockModule("../src/services/repairRequestCached.services.js", () => ({
  getUserRepairRequestsCached: getUserRepairRequestsCachedMock,
  setUserRepairRequestsCached: setUserRepairRequestsCachedMock,
  deleteUserRepairRequestsCached: deleteUserRepairRequestsCachedMock,
  getUserRepairRequestByIdCached: getUserRepairRequestByIdCachedMock,
  setUserRepairRequestByIdCached: setUserRepairRequestByIdCachedMock,
  deleteUserRepairRequestByIdCached: deleteUserRepairRequestByIdCachedMock,
}));

let app;
let mongoServer;
let userModel;
let repairPartnerModel;
let repairRequestModel;
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

const createRepairPartner = async (overrides = {}) =>
  repairPartnerModel.create({
    name: "Repair Pro",
    phoneNumber: "9876543210",
    specialisations: ["MOBILE"],
    isActive: true,
    ...overrides,
  });

const createRepairRequest = async (user, overrides = {}) =>
  repairRequestModel.create({
    user: user._id,
    customerPhone: "9876543210",
    pickupLocation: "Hostel 1",
    serviceType: "MOBILE",
    description: "Screen issue",
    damageImages: ["https://cdn.example.com/image-1.jpg"],
    requestNumber: `REP-2026-07-${new mongoose.Types.ObjectId().toString().slice(-4)}`,
    requestStatus: "SUBMITTED",
    ...overrides,
  });

const attachRepairImages = (req, imageCount = 1) => {
  let chainedRequest = req;
  for (let index = 0; index < imageCount; index += 1) {
    chainedRequest = chainedRequest.attach(
      "images",
      Buffer.from(`image-${index + 1}`),
      `image-${index + 1}.jpg`,
    );
  }

  return chainedRequest;
};

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create({
    instance: {
      ip: "127.0.0.1",
    },
  });
  await mongoose.connect(mongoServer.getUri());

  const [
    { default: repairRouter },
    userModule,
    repairPartnerModule,
    repairRequestModule,
    errorModule,
  ] = await Promise.all([
    import("../src/routes/repairRequest.routes.js"),
    import("../src/models/user.models.js"),
    import("../src/models/repairPartner.models.js"),
    import("../src/models/repairRequest.models.js"),
    import("../src/utils/apiErrors.js"),
  ]);

  userModel = userModule.default;
  repairPartnerModel = repairPartnerModule.default;
  repairRequestModel = repairRequestModule.default;
  ApiError = errorModule.default;

  app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use("/api/repair-requests", repairRouter);
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

  uploadOnCloudinaryMock.mockImplementation(async (localFilePath) =>
    `https://cdn.example.com/${path.basename(localFilePath)}`,
  );
  getUserRepairRequestsCachedMock.mockResolvedValue(null);
  getUserRepairRequestByIdCachedMock.mockResolvedValue(null);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer?.stop();
});

describe("repair request routes", () => {
  describe("authentication and authorization", () => {
    it("rejects requests without a bearer token", async () => {
      // Arrange
      const user = await createUser({ username: "missing-token-user" });
      await createRepairRequest(user);

      // Act
      const response = await request(app).get("/api/repair-requests");

      // Assert
      expect(response.status).toBe(401);
      expect(response.body.message).toBe("Unauthorized");
    });

    it("rejects invalid and expired bearer tokens", async () => {
      // Arrange
      const user = await createUser({ username: "token-user" });

      // Act
      const invalidTokenResponse = await request(app)
        .get("/api/repair-requests")
        .set("Authorization", "Bearer not-a-valid-token");
      const expiredTokenResponse = await request(app)
        .get("/api/repair-requests")
        .set(authHeader(user, {}, "-1s"));

      // Assert
      expect(invalidTokenResponse.status).toBe(401);
      expect(invalidTokenResponse.body.message).toBe("Invalid token");
      expect(expiredTokenResponse.status).toBe(401);
      expect(expiredTokenResponse.body.message).toBe("Token expired");
    });

    it("rejects non-user roles", async () => {
      // Arrange
      const vendor = await createUser({
        username: "vendor-account",
        role: "vendor",
      });

      // Act
      const response = await request(app)
        .get("/api/repair-requests")
        .set(authHeader(vendor));

      // Assert
      expect(response.status).toBe(403);
      expect(response.body.message).toBe("Forbidden");
    });
  });

  describe("POST /api/repair-requests", () => {
    it("creates a repair request with uploaded images", async () => {
      // Arrange
      const user = await createUser({ username: "requesting-user" });

      // Act
      const response = await attachRepairImages(
        request(app)
          .post("/api/repair-requests")
          .set(authHeader(user))
          .field("customerPhone", "9876543210")
          .field("pickupLocation", "Hostel 4")
          .field("serviceType", "MOBILE")
          .field("description", "Display is flickering"),
        2,
      );

      // Assert
      expect(response.status).toBe(201);
      expect(response.body.message).toBe("Repair request created successfully");
      expect(response.body.data).toMatchObject({
        user: user._id.toString(),
        customerPhone: "9876543210",
        pickupLocation: "Hostel 4",
        serviceType: "MOBILE",
        description: "Display is flickering",
        requestStatus: "SUBMITTED",
      });
      expect(response.body.data.requestNumber).toMatch(/^REP-\d{4}-\d{2}-\d{4}$/);
      expect(response.body.data.damageImages).toHaveLength(2);
      expect(response.body.data.damageImages[0]).toContain("https://cdn.example.com/");
      expect(uploadOnCloudinaryMock).toHaveBeenCalledTimes(2);

      const savedRequest = await repairRequestModel
        .findOne({ user: user._id })
        .lean();
      expect(savedRequest).toMatchObject({
        customerPhone: "9876543210",
        pickupLocation: "Hostel 4",
        serviceType: "MOBILE",
        description: "Display is flickering",
        requestStatus: "SUBMITTED",
      });
      expect(savedRequest.damageImages).toHaveLength(2);
      expect(deleteUserRepairRequestsCachedMock).toHaveBeenCalledWith(
        user._id.toString(),
      );
    });

    it("returns validation errors for malformed repair request payloads", async () => {
      // Arrange
      const user = await createUser({ username: "validation-user" });

      // Act
      const response = await attachRepairImages(
        request(app)
          .post("/api/repair-requests")
          .set(authHeader(user))
          .field("customerPhone", "12345")
          .field("pickupLocation", "")
          .field("serviceType", "PHONE")
          .field("description", ""),
        1,
      );

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Validation failed");
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: "customerPhone" }),
          expect.objectContaining({ field: "pickupLocation" }),
          expect.objectContaining({ field: "serviceType" }),
          expect.objectContaining({ field: "description" }),
        ]),
      );
      await expect(repairRequestModel.countDocuments()).resolves.toBe(0);
    });

    it("returns 400 when no images are attached", async () => {
      // Arrange
      const user = await createUser({ username: "no-image-user" });

      // Act
      const response = await request(app)
        .post("/api/repair-requests")
        .set(authHeader(user))
        .field("customerPhone", "9876543210")
        .field("pickupLocation", "Hostel 4")
        .field("serviceType", "MOBILE")
        .field("description", "Broken screen");

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.message).toBe("At least one image is required");
      await expect(repairRequestModel.countDocuments()).resolves.toBe(0);
    });

    it("returns 500 when cloudinary upload fails", async () => {
      // Arrange
      const user = await createUser({ username: "upload-failure-user" });
      uploadOnCloudinaryMock.mockRejectedValueOnce(new Error("cloudinary down"));

      // Act
      const response = await attachRepairImages(
        request(app)
          .post("/api/repair-requests")
          .set(authHeader(user))
          .field("customerPhone", "9876543210")
          .field("pickupLocation", "Hostel 2")
          .field("serviceType", "MOBILE")
          .field("description", "Charging port damaged"),
        1,
      );

      // Assert
      expect(response.status).toBe(500);
      expect(response.body.message).toBe("Failed to upload images");
      await expect(repairRequestModel.countDocuments()).resolves.toBe(0);
    });

    it("returns 500 when persisting the repair request fails", async () => {
      // Arrange
      const user = await createUser({ username: "db-failure-user" });
      jest.spyOn(repairRequestModel, "create").mockRejectedValueOnce(
        new Error("database write failed"),
      );

      // Act
      const response = await attachRepairImages(
        request(app)
          .post("/api/repair-requests")
          .set(authHeader(user))
          .field("customerPhone", "9876543210")
          .field("pickupLocation", "Hostel 9")
          .field("serviceType", "MOBILE")
          .field("description", "Speaker not working"),
        1,
      );

      // Assert
      expect(response.status).toBe(500);
      expect(response.body.message).toBe("database write failed");
    });
  });

  describe("GET /api/repair-requests", () => {
    it("returns paginated requests sorted by newest first", async () => {
      // Arrange
      const user = await createUser({ username: "list-user" });
      const olderRequest = await createRepairRequest(user, {
        requestNumber: "REP-2026-07-1001",
        requestStatus: "SUBMITTED",
      });
      await new Promise((resolve) => setTimeout(resolve, 5));
      const newerRequest = await createRepairRequest(user, {
        requestNumber: "REP-2026-07-2002",
        requestStatus: "PRICE_SENT",
      });

      // Act
      const response = await request(app)
        .get("/api/repair-requests")
        .set(authHeader(user))
        .query({ page: 1, limit: 1 });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Repair requests fetched successfully");
      expect(response.body.data.pagination).toMatchObject({
        page: 1,
        limit: 1,
        totalPages: 2,
        totalRequests: 2,
      });
      expect(response.body.data.repairRequests).toHaveLength(1);
      expect(response.body.data.repairRequests[0]._id).toBe(
        newerRequest._id.toString(),
      );
      expect(response.body.data.repairRequests[0].requestNumber).toBe(
        newerRequest.requestNumber,
      );
      expect(response.body.data.repairRequests[0]._id).not.toBe(
        olderRequest._id.toString(),
      );
      expect(getUserRepairRequestsCachedMock).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: user._id.toString(),
          page: 1,
          limit: 1,
        }),
      );
      expect(setUserRepairRequestsCachedMock).toHaveBeenCalledTimes(1);
    });

    it("returns cached paginated requests when cache exists", async () => {
      // Arrange
      const user = await createUser({ username: "list-cache-user" });
      getUserRepairRequestsCachedMock.mockResolvedValueOnce({
        repairRequests: [
          {
            _id: new mongoose.Types.ObjectId().toString(),
            requestNumber: "REP-2026-07-9999",
            serviceType: "MOBILE",
            estimatedPrice: 300,
            requestStatus: "PRICE_SENT",
            createdAt: new Date().toISOString(),
          },
        ],
        pagination: {
          page: 1,
          limit: 1,
          totalPages: 1,
          totalRequests: 1,
        },
      });

      // Act
      const response = await request(app)
        .get("/api/repair-requests")
        .set(authHeader(user))
        .query({ page: 1, limit: 1 });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Repair requests fetched successfully");
      expect(response.body.data.repairRequests).toHaveLength(1);
      expect(setUserRepairRequestsCachedMock).not.toHaveBeenCalled();
      await expect(repairRequestModel.countDocuments()).resolves.toBe(0);
    });

    it("filters requests by status and request number search", async () => {
      // Arrange
      const user = await createUser({ username: "search-user" });
      const matchingRequest = await createRepairRequest(user, {
        requestNumber: "REP-2026-07-7777",
        requestStatus: "PRICE_SENT",
      });
      await createRepairRequest(user, {
        requestNumber: "REP-2026-07-8888",
        requestStatus: "SUBMITTED",
      });

      // Act
      const response = await request(app)
        .get("/api/repair-requests")
        .set(authHeader(user))
        .query({ search: "7777", status: "PRICE_SENT" });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.data.repairRequests).toHaveLength(1);
      expect(response.body.data.repairRequests[0].requestNumber).toBe(
        matchingRequest.requestNumber,
      );
      expect(response.body.data.repairRequests[0].requestStatus).toBe(
        "PRICE_SENT",
      );
    });

    it("returns a no-data response when nothing matches", async () => {
      // Arrange
      const user = await createUser({ username: "empty-user" });
      await createRepairRequest(user, {
        requestNumber: "REP-2026-07-3003",
      });

      // Act
      const response = await request(app)
        .get("/api/repair-requests")
        .set(authHeader(user))
        .query({ search: "does-not-exist" });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.message).toBe("No repair requests to show");
      expect(response.body.data.repairRequests).toEqual([]);
    });

    it("rejects invalid pagination and status query parameters", async () => {
      // Arrange
      const user = await createUser({ username: "query-user" });

      // Act
      const invalidStatusResponse = await request(app)
        .get("/api/repair-requests")
        .set(authHeader(user))
        .query({ status: "BROKEN" });
      const invalidPaginationResponse = await request(app)
        .get("/api/repair-requests")
        .set(authHeader(user))
        .query({ page: -1, limit: 1 });

      // Assert
      expect(invalidStatusResponse.status).toBe(400);
      expect(invalidStatusResponse.body.message).toBe("Invalid status");
      expect(invalidPaginationResponse.status).toBe(400);
      expect(invalidPaginationResponse.body.message).toBe("Invalid page or limit");
    });

    it("returns 500 when counting repair requests fails", async () => {
      // Arrange
      const user = await createUser({ username: "count-failure-user" });
      jest
        .spyOn(repairRequestModel, "countDocuments")
        .mockRejectedValueOnce(new Error("count failed"));

      // Act
      const response = await request(app)
        .get("/api/repair-requests")
        .set(authHeader(user));

      // Assert
      expect(response.status).toBe(500);
      expect(response.body.message).toBe("count failed");
    });
  });

  describe("GET /api/repair-requests/:requestId", () => {
    it("returns a repair request with the repair partner details", async () => {
      // Arrange
      const user = await createUser({ username: "detail-user" });
      const repairPartner = await createRepairPartner({
        name: "FixIt Crew",
        phoneNumber: "9998887776",
      });
      const repairRequest = await createRepairRequest(user, {
        requestNumber: "REP-2026-07-9090",
        repairPartner: repairPartner._id,
        requestStatus: "FORWARDED",
        estimatedPrice: 450,
        adminRemarks: "Needs board replacement",
      });

      // Act
      const response = await request(app)
        .get(`/api/repair-requests/${repairRequest._id.toString()}`)
        .set(authHeader(user));

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Repair details fetched successfully");
      expect(response.body.data).toMatchObject({
        requestNumber: "REP-2026-07-9090",
        serviceType: "MOBILE",
        description: "Screen issue",
        pickupLocation: "Hostel 1",
        customerPhone: "9876543210",
        estimatedPrice: 450,
        adminRemarks: "Needs board replacement",
        requestStatus: "FORWARDED",
      });
      expect(response.body.data.repairPartner).toMatchObject({
        name: "FixIt Crew",
        phoneNumber: "9998887776",
      });
      expect(getUserRepairRequestByIdCachedMock).toHaveBeenCalledWith({
        userId: user._id.toString(),
        requestId: repairRequest._id.toString(),
      });
      expect(setUserRepairRequestByIdCachedMock).toHaveBeenCalledTimes(1);
    });

    it("returns cached repair request details when available", async () => {
      // Arrange
      const user = await createUser({ username: "detail-cache-user" });
      const requestId = new mongoose.Types.ObjectId().toString();
      getUserRepairRequestByIdCachedMock.mockResolvedValueOnce({
        requestNumber: "REP-2026-07-8080",
        serviceType: "MOBILE",
        description: "Cached detail",
        damageImages: ["https://cdn.example.com/cached.jpg"],
        pickupLocation: "Hostel 4",
        customerPhone: "9876543210",
        estimatedPrice: 800,
        adminRemarks: "Cached remarks",
        requestStatus: "PRICE_SENT",
        repairPartner: null,
      });

      // Act
      const response = await request(app)
        .get(`/api/repair-requests/${requestId}`)
        .set(authHeader(user));

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Repair details fetched successfully");
      expect(response.body.data.requestNumber).toBe("REP-2026-07-8080");
      expect(setUserRepairRequestByIdCachedMock).not.toHaveBeenCalled();
    });

    it("rejects invalid request ids and missing requests", async () => {
      // Arrange
      const user = await createUser({ username: "id-user" });

      // Act
      const invalidIdResponse = await request(app)
        .get("/api/repair-requests/not-an-object-id")
        .set(authHeader(user));
      const missingResponse = await request(app)
        .get(`/api/repair-requests/${new mongoose.Types.ObjectId().toString()}`)
        .set(authHeader(user));

      // Assert
      expect(invalidIdResponse.status).toBe(400);
      expect(invalidIdResponse.body.message).toBe("Invalid request ID");
      expect(missingResponse.status).toBe(404);
      expect(missingResponse.body.message).toBe("Repair request not found");
    });

    it("returns 500 when the lookup fails", async () => {
      // Arrange
      const user = await createUser({ username: "lookup-failure-user" });
      jest.spyOn(repairRequestModel, "findOne").mockReturnValueOnce({
        populate: () => ({
          select: () => Promise.reject(new Error("lookup failed")),
        }),
      });

      // Act
      const response = await request(app)
        .get(`/api/repair-requests/${new mongoose.Types.ObjectId().toString()}`)
        .set(authHeader(user));

      // Assert
      expect(response.status).toBe(500);
      expect(response.body.message).toBe("lookup failed");
    });
  });

  describe("PATCH /api/repair-requests/:requestId", () => {
    it("accepts a priced request and updates the customer decision", async () => {
      // Arrange
      const user = await createUser({ username: "decision-user" });
      const repairRequest = await createRepairRequest(user, {
        requestNumber: "REP-2026-07-5555",
        requestStatus: "PRICE_SENT",
      });

      // Act
      const response = await request(app)
        .patch(`/api/repair-requests/${repairRequest._id.toString()}`)
        .set(authHeader(user))
        .send({ requestStatus: "ACCEPTED" });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Request status updated successfully");
      expect(response.body.data).toBe("ACCEPTED");

      const updatedRequest = await repairRequestModel
        .findById(repairRequest._id)
        .lean();
      expect(updatedRequest.requestStatus).toBe("ACCEPTED");
      expect(updatedRequest.acceptedAt).toBeTruthy();
      expect(deleteUserRepairRequestsCachedMock).toHaveBeenCalledWith(
        user._id.toString(),
      );
      expect(deleteUserRepairRequestByIdCachedMock).toHaveBeenCalledWith({
        userId: user._id.toString(),
        requestId: repairRequest._id.toString(),
      });
    });

    it("rejects invalid decision payloads", async () => {
      // Arrange
      const user = await createUser({ username: "decision-validation-user" });
      const repairRequest = await createRepairRequest(user, {
        requestNumber: "REP-2026-07-6666",
        requestStatus: "PRICE_SENT",
      });

      // Act
      const response = await request(app)
        .patch(`/api/repair-requests/${repairRequest._id.toString()}`)
        .set(authHeader(user))
        .send({ requestStatus: "PENDING" });

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Validation failed");
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: "requestStatus" }),
        ]),
      );
    });

    it("returns 409 when the request is not in PRICE_SENT state", async () => {
      // Arrange
      const user = await createUser({ username: "decision-conflict-user" });
      const repairRequest = await createRepairRequest(user, {
        requestNumber: "REP-2026-07-7778",
        requestStatus: "SUBMITTED",
      });

      // Act
      const response = await request(app)
        .patch(`/api/repair-requests/${repairRequest._id.toString()}`)
        .set(authHeader(user))
        .send({ requestStatus: "REJECTED" });

      // Assert
      expect(response.status).toBe(409);
      expect(response.body.message).toBe(
        "Request status can only be updated if the PRICE has been sent by the admin",
      );
    });

    it("returns 404 for missing requests and 500 when saving fails", async () => {
      // Arrange
      const user = await createUser({ username: "decision-error-user" });
      const missingId = new mongoose.Types.ObjectId().toString();
      const notFoundResponse = await request(app)
        .patch(`/api/repair-requests/${missingId}`)
        .set(authHeader(user))
        .send({ requestStatus: "ACCEPTED" });

      const repairRequest = await createRepairRequest(user, {
        requestNumber: "REP-2026-07-8889",
        requestStatus: "PRICE_SENT",
      });
      jest
        .spyOn(repairRequestModel.prototype, "save")
        .mockRejectedValueOnce(new Error("save failed"));

      // Act
      const saveFailureResponse = await request(app)
        .patch(`/api/repair-requests/${repairRequest._id.toString()}`)
        .set(authHeader(user))
        .send({ requestStatus: "ACCEPTED" });

      // Assert
      expect(notFoundResponse.status).toBe(404);
      expect(notFoundResponse.body.message).toBe("Repair request not found");
      expect(saveFailureResponse.status).toBe(500);
      expect(saveFailureResponse.body.message).toBe("save failed");
    });
  });
});
