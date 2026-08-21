import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middlewares.js";
import roleMiddleware from "../middlewares/role.middleware.js";
import { blockMiddleware } from "../middlewares/block.middlewares.js";
import marketPlaceOrdersController from "../controllers/marketPlaceOrders.contollers.js";

const marketPlaceOrdersRouter = Router();

marketPlaceOrdersRouter.post(
  "/orders",
  authMiddleware,
  roleMiddleware("user"),
  blockMiddleware,
  marketPlaceOrdersController.createMarketPlaceOrder,
);

marketPlaceOrdersRouter.get(
  "/orders/my",
  authMiddleware,
  roleMiddleware("user"),
  marketPlaceOrdersController.getAllMarketPlaceOrders,
);

marketPlaceOrdersRouter.get(
  "/orders/:orderId",
  authMiddleware,
  roleMiddleware("user"),
  marketPlaceOrdersController.getSingleMarketPlaceOrder,
);

marketPlaceOrdersRouter.patch(
  "/orders/:orderId/cancel",
  authMiddleware,
  roleMiddleware("user"),
  marketPlaceOrdersController.cancelMarketPlaceOrder,
);

marketPlaceOrdersRouter.get(
  "/coupons/view",
  authMiddleware,
  roleMiddleware("user"),
  marketPlaceOrdersController.getAllMarketplaceCoupons,
);

marketPlaceOrdersRouter.post(
  "/coupons/apply",
  authMiddleware,
  roleMiddleware("user"),
  marketPlaceOrdersController.applyMarketplaceCoupon,
);

export default marketPlaceOrdersRouter;
