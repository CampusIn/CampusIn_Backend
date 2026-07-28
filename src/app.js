import express from "express";
import morgan from "morgan";
import cookieParser from "cookie-parser";
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
import config from "./config/config.js";
import repairRouter from "./routes/repairRequest.routes.js";

const app = express();
const normalizeOrigin = (origin) => origin?.replace(/\/$/, "");
const allowedOrigins = [
  "http://localhost:5173",
  "https://campus-out-frontend.vercel.app",
  "http://localhost:3000",
  normalizeOrigin(config.CLIENT_URL),
].filter(Boolean);

app.use(express.json());
app.use(morgan("dev"));
app.use(cookieParser());
app.use(passport.initialize());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(normalizeOrigin(origin))) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true,
  }),
);

app.use("/admin/queues", serverAdapter.getRouter());

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

app.use((req, res) => {
  return res.status(404).json({
    statusCode: 404,
    data: null,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    success: false,
    errors: [],
  });
});

app.use((err, req, res,next) => {
  const statusCode = err instanceof ApiError ? err.statusCode : 500;

  return res.status(statusCode).json({
    statusCode,
    data: null,
    message: err.message || "Internal server error",
    success: false,
    errors: err.errors || [],
  });
});

export default app;
