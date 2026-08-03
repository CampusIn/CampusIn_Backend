import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middlewares.js";
import roleMiddleware from "../middlewares/role.middleware.js";
import cartControllers from "../controllers/cart.controllers.js";
import authControllers from "../controllers/auth.controllers.js";
import { blockMiddleware } from "../middlewares/block.middlewares.js";
import { cartLimiter } from "../middlewares/rateLimiter.middlewares.js";
const cartRouter = Router();

cartRouter.post(
  "/cart/items",
  cartLimiter,
  authMiddleware,
  roleMiddleware("user"),
  blockMiddleware,
  cartControllers.addToCart,
);
cartRouter.get(
  "/cart",
  authMiddleware,
  roleMiddleware("user"),
  cartControllers.getItemsFromCart,
);
cartRouter.patch(
  "/cart/items/:menuItemId",
  cartLimiter,
  authMiddleware,
  roleMiddleware("user"),
  blockMiddleware,
  cartControllers.updateCartItemQuantity,
);
cartRouter.delete(
  "/cart/items/:menuItemId",
  cartLimiter,
  authMiddleware,
  roleMiddleware("user"),
  blockMiddleware,
  cartControllers.deleteCartItem,
);
cartRouter.delete(
  "/cart",
  cartLimiter,
  authMiddleware,
  roleMiddleware("user"),
  blockMiddleware,
  cartControllers.deleteCart,
);
export default cartRouter;
