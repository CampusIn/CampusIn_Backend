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
  printingUploadSessionIdParamRules,
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

printingRouter.get(
  "/uploads/:uploadId",
  authMiddleware,
  roleMiddleware("user"),
  printingUploadIdParamRules,
  printingController.getPrintingUploadById,
);

printingRouter.get(
  "/uploads/session/:uploadSessionId",
  authMiddleware,
  roleMiddleware("user"),
  printingUploadSessionIdParamRules,
  printingController.getPrintingUploadSessionStatus,
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
  "/orders/:orderId/files/:fileId/download",
  authMiddleware,
  roleMiddleware("user"),
  printingFileAccessParamRules,
  printingController.downloadPrintingFile,
);

export default printingRouter;
