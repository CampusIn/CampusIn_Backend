import { Router } from "express";
import luckyDrawControllers from "../controllers/luckyDraw.controllers.js";
import { authMiddleware } from "../middlewares/auth.middlewares.js";
import roleMiddleware from "../middlewares/role.middleware.js";
import { blockMiddleware } from "../middlewares/block.middlewares.js";
import { submitEntryValidationRules } from "../validators/luckyDraw.validators.js";
import { relaxedLimiter } from "../middlewares/rateLimiter.middlewares.js";

const luckyDrawRouter = Router();

luckyDrawRouter.post(
  "/submit",
  relaxedLimiter,
  authMiddleware,
  roleMiddleware("user"),
  blockMiddleware,
  submitEntryValidationRules,
  luckyDrawControllers.submitEntry,
);

luckyDrawRouter.post(
  "/",
  relaxedLimiter,
  authMiddleware,
  roleMiddleware("user"),
  blockMiddleware,
  submitEntryValidationRules,
  luckyDrawControllers.submitEntry,
);

luckyDrawRouter.get(
  "/winners",
  relaxedLimiter,
  authMiddleware,
  roleMiddleware("user"),
  luckyDrawControllers.getUserWinners,
);

luckyDrawRouter.get(
  "/status",
  relaxedLimiter,
  authMiddleware,
  roleMiddleware("user"),
  luckyDrawControllers.getUserLuckyDrawStatus,
);

luckyDrawRouter.get(
  "/",
  relaxedLimiter,
  authMiddleware,
  roleMiddleware("user"),
  luckyDrawControllers.getUserWinners,
);

export default luckyDrawRouter;
