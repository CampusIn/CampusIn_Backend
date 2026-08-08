import marketPlaceProductsModel from "../models/marketPlaceProducts.models.js";
import ApiError from "./apiErrors.js";

const marketCartTotal = async (cart) => {
  const productIds = cart.items.map((item) => item.product);
  const products = await marketPlaceProductsModel.find({
    _id: {
      $in: productIds,
    },
  });

  const calculatedAmount = cart.items.reduce((sum, item) => {
    const product = products.find(
      (product) => product._id.toString() === item.product.toString(),
    );
    if (!product) {
      throw new ApiError(
        400,
        "One or more items in your cart is not available",
      );
    }
    if (!product.isActive) {
      throw new ApiError(400, `${product.name} is currently unavailable`);
    }
    if (item.quantity > product.stock) {
      throw new ApiError(
        400,
        `Only ${product.stock} item(s) of ${product.name} are currently available`,
      );
    }

    return sum + item.quantity * product.price;
  }, 0);

  cart.totalAmount = calculatedAmount;
  return cart;
};

export default marketCartTotal;
