import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middlewares.js";
import roleMiddleware from "../middlewares/role.middleware.js";
import {
  createRepairRequestRules,
  updateRepairRequestRules,
} from "../validators/repairRequest.validators.js";
import repairController from "../controllers/repairRequest.controllers.js";
import upload from "../middlewares/multer.middlewares.js";
import { strictLimiter } from "../middlewares/rateLimiter.middlewares.js";

const repairRouter = Router();

repairRouter.post(
  "/",
  strictLimiter,
  authMiddleware,
  roleMiddleware("user"),
  upload.array("images", 5),
  createRepairRequestRules,
  repairController.createRepairRequest,
);

repairRouter.get(
  "/",
  authMiddleware,
  roleMiddleware("user"),
  repairController.getAllRepairRequests,
);

repairRouter.get(
  "/:requestId",
  authMiddleware,
  roleMiddleware("user"),
  repairController.getRequestById,
);

repairRouter.patch(
  "/:requestId",
  authMiddleware,
  roleMiddleware("user"),
  updateRepairRequestRules,
  repairController.customerDecision,
);

export default repairRouter;
