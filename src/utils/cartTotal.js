import menuModel from "../models/menuItem.models.js";
import ApiError from "./apiErrors.js";

const cartTotal = async (cart) => {
  const menuIdOnly = cart.items.map((item) => item.menuItem);
  const menus = await menuModel.find({
    _id: {
      $in: menuIdOnly,
    },
  });

  const calculatedAmount = cart.items.reduce((sum, item) => {
    const menu = menus.find(
      (menu) => menu._id.toString() === item.menuItem.toString(),
    );
    if (!menu){
      throw new ApiError(
        400,
        "One or more items in your cart is not available",
      );}
    if (!menu.isAvailable) {
      throw new ApiError(400, `${menu.name} is currently unavailable`);
    }
    if (item.quantity > menu.stockQty) {
      throw new ApiError(
        400,
        `Only ${menu.stockQty} item(s) of ${menu.name} are currently available`,
      );
    }
    const finalPrice = item.quantity * menu.price;
    return sum + finalPrice;
  }, 0);

  cart.totalAmount = calculatedAmount;
  return cart;
};

export default cartTotal;
