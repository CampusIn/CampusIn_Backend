import express from "express";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
import authRouter from "./routes/auth.routes.js";
import restaurantRoute from "./routes/restaurant.routes.js";
import menuRouter from "./routes/menu.routes.js";
import cartRouter from "./routes/cart.routes.js";
import orderRouter from "./routes/order.routes.js";
import reviewRoute from "./routes/review.routes.js";
import vendorRouter from "./routes/vendor.routes.js";
import adminRouter from "./routes/admin.routes.js";
import deliveryRouter from "./routes/deliveryPartner.routes.js";
import homePageRouter from "./routes/homepageCMS.routes.js";
import marketRouter from "./routes/marketPlace.routes.js";
import marketCartRouter from "./routes/marketCart.routes.js";
import marketPlaceOrdersRouter from "./routes/marketPlace.Orders.routes.js";
import { serverAdapter } from "./dashboard/bullBoard.js";
import ApiError from "./utils/apiErrors.js";
import passport from "./config/passport.js";
import cors from "cors";
import helmet from "helmet";
import config from "./config/config.js";
import repairRouter from "./routes/repairRequest.routes.js";
import printingRouter from "./routes/printing.routes.js";
import adminPrintingRouter from "./routes/adminPrinting.routes.js";
import { authMiddleware } from "./middlewares/auth.middlewares.js";
import roleMiddleware from "./middlewares/role.middleware.js";
import { redis } from "./config/redis.js";
import requestIdMiddleware from "./middlewares/requestId.middleware.js";

const app = express();
const readinessTimeoutMs = Number(process.env.READINESS_TIMEOUT_MS || 1000);

const withTimeout = async (promise, timeoutMs) => {
  let timeoutId;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error("Operation timed out"));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId);
  }
};

const parseTrustProxy = (value) => {
  if (value === undefined) {
    return 1;
  }

  const normalizedValue = String(value).trim().toLowerCase();
  if (["true", "1", "yes"].includes(normalizedValue)) {
    return true;
  }
  if (["false", "0", "no"].includes(normalizedValue)) {
    return false;
  }

  const numericValue = Number(value);
  if (!Number.isNaN(numericValue)) {
    return numericValue;
  }

  return value;
};

app.set("trust proxy", parseTrustProxy(process.env.TRUST_PROXY));
morgan.token("request-id", (req) => req.requestId || "-");

const normalizeOrigin = (origin) => origin?.replace(/\/$/, "");
const allowedOrigins = [
  "http://localhost:5173",
  "https://campus-out-frontend.vercel.app",
  "http://localhost:3000",
  "https://campusin.store",
  normalizeOrigin(config.CLIENT_URL),
].filter(Boolean);

app.use(express.json({ limit: "200kb" }));
app.use(express.urlencoded({ extended: true, limit: "200kb" }));
app.use(requestIdMiddleware);
app.use(
  helmet({
    crossOriginResourcePolicy: false,
  }),
);
app.use(morgan(":method :url :status :response-time ms requestId=:request-id"));
app.use(cookieParser());
app.use(passport.initialize());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(normalizeOrigin(origin))) {
        return callback(null, true);
      }

      return callback(new Error("Request origin is not allowed"));
    },
    credentials: true,
  }),
);

app.use(
  "/admin/queues",
  authMiddleware,
  roleMiddleware("admin"),
  serverAdapter.getRouter(),
);

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Campus Out API is running",
  });
});

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "ok",
  });
});

app.get("/ready", async (req, res) => {
  const mongoReady = mongoose.connection.readyState === 1;

  let redisReady = false;
  try {
    await withTimeout(redis.ping(), readinessTimeoutMs);
    redisReady = true;
  } catch {
    redisReady = false;
  }

  const isReady = mongoReady && redisReady;
  return res.status(isReady ? 200 : 503).json({
    success: isReady,
    status: isReady ? "ready" : "not_ready",
    checks: {
      mongo: mongoReady ? "ok" : "not_ready",
      redis: redisReady ? "ok" : "not_ready",
    },
  });
});

app.use("/api/auth", authRouter);
app.use("/api", restaurantRoute);
app.use("/api/restaurants", menuRouter);
app.use("/api/user", cartRouter);
app.use("/api/user", orderRouter);
app.use("/api/user", reviewRoute);
app.use("/api/admin", adminRouter);
app.use("/admin", adminRouter);
app.use("/api/delivery", deliveryRouter);
app.use("/api/vendor", vendorRouter);
app.use("/api/user/homepage", homePageRouter);
app.use("/api/marketplace", marketRouter);
app.use("/api/marketplace", marketCartRouter);
app.use("/api/marketplace", marketPlaceOrdersRouter);
app.use("/api/repair-requests", repairRouter);
app.use("/api/printing", printingRouter);
app.use("/api/admin/printing", adminPrintingRouter);


app.use((req, res) => {
  return res.status(404).json({
    statusCode: 404,
    data: null,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    success: false,
    requestId: req.requestId,
    errors: [],
  });
});

app.use((err, req, res, next) => {
  if (err?.name === "MulterError") {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "Image size limit should be below 200kb"
        : err.message;

    return res.status(400).json({
      statusCode: 400,
      data: null,
      message,
      success: false,
      requestId: req.requestId,
      errors: [],
    });
  }

  const statusCode = err instanceof ApiError ? err.statusCode : 500;
  const isOperationalError = err instanceof ApiError;

  if (!isOperationalError) {
    console.error("Unhandled error:", err);
  }

  const responseErrors =
    isOperationalError && Array.isArray(err.errors)
      ? err.errors.filter((item) => typeof item === "string")
      : [];

  return res.status(statusCode).json({
    statusCode,
    data: null,
    message: isOperationalError
      ? err.message
      : "Something went wrong. Please try again later.",
    success: false,
    requestId: req.requestId,
    errors: responseErrors,
  });
});



export default app;
