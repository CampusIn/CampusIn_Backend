import { Router } from "express";
import reviewsController from "../controllers/reviews.controllers.js";
import { authMiddleware } from "../middlewares/auth.middlewares.js";
import roleMiddleware from "../middlewares/role.middleware.js";
import reviewValidationRules from "../validators/review.validators.js";
import { blockMiddleware } from "../middlewares/block.middlewares.js";
import { reviewsLimiter } from "../middlewares/rateLimiter.middlewares.js";

const reviewRoute = Router();

reviewRoute.post(
  "/reviews/:restaurantId",
  reviewsLimiter,
  authMiddleware,
  roleMiddleware("user"),
  blockMiddleware,
  reviewValidationRules,
  reviewsController.createReview,
);

reviewRoute.get(
  "/restaurants/:restaurantId/reviews",
  reviewsController.getAllReview,
);

reviewRoute.patch(
  "/reviews/:reviewId",
  reviewsLimiter,
  authMiddleware,
  roleMiddleware("user"),
  blockMiddleware,
  reviewsController.updateReview,
);

reviewRoute.delete(
  "/reviews/:reviewId",
  authMiddleware,
  roleMiddleware("user"),
  blockMiddleware,
  reviewsController.deleteReview,
);

export default reviewRoute;
