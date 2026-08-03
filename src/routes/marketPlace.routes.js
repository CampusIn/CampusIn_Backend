import { Router } from "express";
import marketPlaceController from "../controllers/marketPlace.contollers.js";
import marketCartController from "../controllers/marketCart.controllers.js";
import { authMiddleware } from "../middlewares/auth.middlewares.js";
import roleMiddleware from "../middlewares/role.middleware.js";
import {
  relaxedLimiter,
  searchAwareRelaxedLimiter,
} from "../middlewares/rateLimiter.middlewares.js";


const marketRouter = Router();

marketRouter.get(
  "/categories",
  relaxedLimiter,
  authMiddleware,
  roleMiddleware("user"),
  marketPlaceController.getAllCategoriesByUser,
);

marketRouter.get(
  "/settings",
  authMiddleware,
  roleMiddleware("user"),
  marketPlaceController.getCategoryPlatformSettings,
);

marketRouter.get(
  "/products",
  searchAwareRelaxedLimiter,
  authMiddleware,
  roleMiddleware("user"),
  marketPlaceController.getAllProductsByUser,
);

marketRouter.get(
  "/products/suggestions",
  authMiddleware,
  roleMiddleware("user"),
  marketPlaceController.getMarketPlaceProductSuggestions,
);

marketRouter.get(
  "/products/:productId",
  authMiddleware,
  roleMiddleware("user"),
  marketPlaceController.getProductsByIdUser,
);

export default marketRouter;
