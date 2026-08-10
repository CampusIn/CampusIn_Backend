import { Router } from "express";
import printingController from "../controllers/printing.controllers.js";
import { authMiddleware } from "../middlewares/auth.middlewares.js";
import roleMiddleware from "../middlewares/role.middleware.js";
import { blockMiddleware } from "../middlewares/block.middlewares.js";
import printingUpload from "../middlewares/printingUpload.middlewares.js";
import {
  createPrintingOrderRules,
  printingFileAccessParamRules,
  printingListQueryRules,
  printingOrderIdParamRules,
  printingUploadIdParamRules,
} from "../validators/printing.validators.js";
import {
  strictLimiter,
  uploadLimiter,
} from "../middlewares/rateLimiter.middlewares.js";

const printingRouter = Router();

printingRouter.get(
  "/config",
  authMiddleware,
  roleMiddleware("user"),
  printingController.getPrintingConfigForUser,
);

printingRouter.post(
  "/uploads",
  uploadLimiter,
  authMiddleware,
  roleMiddleware("user"),
  blockMiddleware,
  printingUpload.array("files", 20),
  printingController.uploadPrintingFiles,
);

printingRouter.delete(
  "/uploads/:uploadId",
  authMiddleware,
  roleMiddleware("user"),
  blockMiddleware,
  printingUploadIdParamRules,
  printingController.deletePrintingUpload,
);

printingRouter.post(
  "/orders",
  strictLimiter,
  authMiddleware,
  roleMiddleware("user"),
  blockMiddleware,
  createPrintingOrderRules,
  printingController.createPrintingOrder,
);

printingRouter.get(
  "/orders/my",
  authMiddleware,
  roleMiddleware("user"),
  printingListQueryRules,
  printingController.getMyPrintingOrders,
);

printingRouter.get(
  "/orders/:orderId",
  authMiddleware,
  roleMiddleware("user"),
  printingOrderIdParamRules,
  printingController.getMyPrintingOrderById,
);

printingRouter.patch(
  "/orders/:orderId/cancel",
  authMiddleware,
  roleMiddleware("user"),
  printingOrderIdParamRules,
  printingController.cancelMyPrintingOrder,
);

printingRouter.get(
  "/orders/:orderId/files/:fileId/access",
  authMiddleware,
  roleMiddleware("user"),
  printingFileAccessParamRules,
  printingController.getPrintingFileAccess,
);

export default printingRouter;
