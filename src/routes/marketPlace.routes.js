import { Router } from "express";
import marketPlaceController from "../controllers/marketPlace.contollers.js";
import marketCartController from "../controllers/marketCart.controllers.js";
import { authMiddleware } from "../middlewares/auth.middlewares.js";
import roleMiddleware from "../middlewares/role.middleware.js";


const marketRouter = Router();

marketRouter.get(
  "/categories",
  authMiddleware,
  roleMiddleware("user"),
  marketPlaceController.getAllCategoriesByUser,
);

marketRouter.get(
  "/products",
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
