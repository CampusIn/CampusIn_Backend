import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middlewares.js";
import roleMiddleware from "../middlewares/role.middleware.js";
import { blockMiddleware } from "../middlewares/block.middlewares.js";
import marketCartValidationRules from "../validators/marketCart.validators.js";
import marketCartController from "../controllers/marketCart.controllers.js";
import { cartLimiter } from "../middlewares/rateLimiter.middlewares.js";

const marketCartRouter = Router()

marketCartRouter.post(
  "/cart",
  cartLimiter,
  authMiddleware,
  roleMiddleware("user"),
  blockMiddleware,
  marketCartValidationRules,
  marketCartController.addToMarketCart,
);

marketCartRouter.get(
  "/cart",
  authMiddleware,
  roleMiddleware("user"),
  marketCartController.getItemsFromMarketCart,
);

marketCartRouter.patch(
  "/cart/items/:productId",
  cartLimiter,
  authMiddleware,
  roleMiddleware("user"),
  blockMiddleware,
  marketCartController.updateMarketCartItemQuantity,
);

marketCartRouter.delete(
  "/cart/items/:productId",
  cartLimiter,
  authMiddleware,
  roleMiddleware("user"),
  blockMiddleware,
  marketCartController.deleteMarketCartItem,
);

marketCartRouter.delete(
  "/cart",
  cartLimiter,
  authMiddleware,
  roleMiddleware("user"),
  blockMiddleware,
  marketCartController.deleteMarketCart,
);

export default marketCartRouter
