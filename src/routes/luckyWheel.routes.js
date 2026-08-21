import { Router } from "express";
import luckyWheelController from "../controllers/luckyWheel.controllers.js";
import { authMiddleware } from "../middlewares/auth.middlewares.js";
import roleMiddleware from "../middlewares/role.middleware.js";
import { blockMiddleware } from "../middlewares/block.middlewares.js";
import { strictLimiter } from "../middlewares/rateLimiter.middlewares.js";

const luckyWheelRouter = Router();

luckyWheelRouter.get(
  "/status",
  authMiddleware,
  roleMiddleware("user"),
  luckyWheelController.getLuckyWheelStatus,
);

luckyWheelRouter.post(
  "/spin",
  strictLimiter,
  authMiddleware,
  roleMiddleware("user"),
  blockMiddleware,
  luckyWheelController.spinLuckyWheel,
);

export default luckyWheelRouter;
