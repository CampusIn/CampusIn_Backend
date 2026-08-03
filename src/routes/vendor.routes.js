import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middlewares.js";
import roleMiddleware from "../middlewares/role.middleware.js";
import vendorControllers from "../controllers/vendor.controllers.js";
import { blockMiddleware } from "../middlewares/block.middlewares.js";
import upload from "../middlewares/multer.middlewares.js";
import { uploadLimiter } from "../middlewares/rateLimiter.middlewares.js";

const vendorRouter = Router();

vendorRouter.get(
  "/dashboard/overview",
  authMiddleware,
  roleMiddleware("vendor"),
  vendorControllers.getVendorOverview,
);

vendorRouter.get(
  "/dashboard/top-items",
  authMiddleware,
  roleMiddleware("vendor"),
  vendorControllers.getTopItems,
);

vendorRouter.get(
  "/dashboard/order-status-breakdown",
  authMiddleware,
  roleMiddleware("vendor"),
  vendorControllers.orderStatusBreakdown,
);

vendorRouter.get(
  "/dashboard/daily-revenue",
  authMiddleware,
  roleMiddleware("vendor"),
  vendorControllers.revenueStatsPerWeek,
);

vendorRouter.get(
  "/dashboard/average-order-value",
  authMiddleware,
  roleMiddleware("vendor"),
  vendorControllers.averageOrderValue,
);

vendorRouter.patch(
  "/menu/:menuId/stock",
  authMiddleware,
  roleMiddleware("vendor"),
  blockMiddleware,
  vendorControllers.updateStock,
);

vendorRouter.get(
  "/inventory",
  authMiddleware,
  roleMiddleware("vendor"),
  vendorControllers.getAllMenu,
);

vendorRouter.get(
  "/inventory/low-stock",
  authMiddleware,
  roleMiddleware("vendor"),
  vendorControllers.lowStockItems,
);

vendorRouter.post(
  "/menu/bulk-upload",
  uploadLimiter,
  authMiddleware,
  roleMiddleware("vendor"),
  blockMiddleware,
  upload.array("images", 50),
  vendorControllers.bulkUpload,
);

vendorRouter.get(
  "/orders/:orderId/invoice",
  authMiddleware,
  roleMiddleware('vendor'),
  vendorControllers.generateInvoiceFood
)
export default vendorRouter;
