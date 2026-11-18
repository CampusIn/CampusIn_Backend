import { Router } from "express";
import luckyDrawControllers from "../controllers/luckyDraw.controllers.js";
import { authMiddleware } from "../middlewares/auth.middlewares.js";
import roleMiddleware from "../middlewares/role.middleware.js";
import {
  enableLuckyDrawValidationRules,
  drawValidationRules,
  updateDeadlineValidationRules,
} from "../validators/luckyDraw.validators.js";

const adminLuckyDrawRouter = Router();

adminLuckyDrawRouter.post(
  "/enable",
  authMiddleware,
  roleMiddleware("admin"),
  enableLuckyDrawValidationRules,
  luckyDrawControllers.enableLuckyDraw,
);

adminLuckyDrawRouter.post(
  "/",
  authMiddleware,
  roleMiddleware("admin"),
  enableLuckyDrawValidationRules,
  luckyDrawControllers.enableLuckyDraw,
);

adminLuckyDrawRouter.patch(
  "/deadline",
  authMiddleware,
  roleMiddleware("admin"),
  updateDeadlineValidationRules,
  luckyDrawControllers.updateLuckyDrawDeadline,
);

adminLuckyDrawRouter.post(
  "/draw",
  authMiddleware,
  roleMiddleware("admin"),
  drawValidationRules,
  luckyDrawControllers.drawLuckyWinners,
);

adminLuckyDrawRouter.get(
  "/winners",
  authMiddleware,
  roleMiddleware("admin"),
  luckyDrawControllers.getAdminLuckyDrawWinners,
);

adminLuckyDrawRouter.get(
  "/participants",
  authMiddleware,
  roleMiddleware("admin"),
  luckyDrawControllers.getAdminLuckyDrawParticipants,
);

adminLuckyDrawRouter.get(
  "/",
  authMiddleware,
  roleMiddleware("admin"),
  luckyDrawControllers.getAdminLuckyDrawDetails,
);

adminLuckyDrawRouter.delete(
  "/:luckyDrawId",
  authMiddleware,
  roleMiddleware("admin"),
  luckyDrawControllers.deleteLuckyDraw,
);

adminLuckyDrawRouter.delete(
  "/",
  authMiddleware,
  roleMiddleware("admin"),
  luckyDrawControllers.deleteLuckyDraw,
);

export default adminLuckyDrawRouter;
