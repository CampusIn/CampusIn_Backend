import { Router } from "express";
import adminPrintingController from "../controllers/adminPrinting.controllers.js";
import { authMiddleware } from "../middlewares/auth.middlewares.js";
import roleMiddleware from "../middlewares/role.middleware.js";
import {
  printingFileAccessParamRules,
  printingListQueryRules,
  printingOrderIdParamRules,
  updatePrintingConfigRules,
  updatePrintingOrderNotesRules,
  updatePrintingPaymentStatusRules,
  updatePrintingOrderStatusRules,
} from "../validators/printing.validators.js";

const adminPrintingRouter = Router();

adminPrintingRouter.get(
  "/config",
  authMiddleware,
  roleMiddleware("admin"),
  adminPrintingController.getPrintingConfigAdmin,
);

adminPrintingRouter.patch(
  "/config",
  authMiddleware,
  roleMiddleware("admin"),
  updatePrintingConfigRules,
  adminPrintingController.updatePrintingConfigAdmin,
);

adminPrintingRouter.get(
  "/orders",
  authMiddleware,
  roleMiddleware("admin"),
  printingListQueryRules,
  adminPrintingController.getAllPrintingOrdersAdmin,
);

adminPrintingRouter.get(
  "/orders/:orderId",
  authMiddleware,
  roleMiddleware("admin"),
  printingOrderIdParamRules,
  adminPrintingController.getPrintingOrderByIdAdmin,
);

adminPrintingRouter.patch(
  "/orders/:orderId/status",
  authMiddleware,
  roleMiddleware("admin"),
  printingOrderIdParamRules,
  updatePrintingOrderStatusRules,
  adminPrintingController.updatePrintingOrderStatusAdmin,
);

adminPrintingRouter.patch(
  "/orders/:orderId/notes",
  authMiddleware,
  roleMiddleware("admin"),
  printingOrderIdParamRules,
  updatePrintingOrderNotesRules,
  adminPrintingController.updatePrintingOrderNotesAdmin,
);

adminPrintingRouter.patch(
  "/orders/:orderId/payment-status",
  authMiddleware,
  roleMiddleware("admin"),
  printingOrderIdParamRules,
  updatePrintingPaymentStatusRules,
  adminPrintingController.updatePrintingPaymentStatusAdmin,
);

adminPrintingRouter.get(
  "/orders/:orderId/files/:fileId/download",
  authMiddleware,
  roleMiddleware("admin"),
  printingFileAccessParamRules,
  adminPrintingController.downloadPrintingFileAdmin,
);

export default adminPrintingRouter;
