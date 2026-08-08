import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/apiErrors.js";
import ApiResponse from "../utils/apiResponse.js";
import cartModel from "../models/cart.models.js";
import menuModel from "../models/menuItem.models.js";
import cartTotal from "../utils/cartTotal.js";
import mongoose from "mongoose";

const logCartDbFailure = (operation, error, userId) => {
  console.error(`[food-cart:${operation}]`, {
    userId,
    message: error?.message,
    name: error?.name,
  });
};

const persistCartTotal = async (cartId, userId, totalAmount) => {
  let persisted;
  try {
    persisted = await cartModel.updateOne(
      {
        _id: cartId,
        user: userId,
      },
      {
        $set: { totalAmount },
      },
    );
  } catch (error) {
    logCartDbFailure("persistCartTotal", error, userId);
    throw error;
  }

  return persisted.matchedCount > 0;
};

const addToCart = asyncHandler(async (req, res) => {
  const { menuItemId, quantity } = req.body;
  const addQuantity = Number(quantity);

  if (!mongoose.Types.ObjectId.isValid(menuItemId)) {
    throw new ApiError(400, "Invalid menu item ID");
  }
  if (!Number.isInteger(addQuantity) || addQuantity < 1) {
    throw new ApiError(400, "Invalid quantity");
  }

  const menu = await menuModel
    .findById(menuItemId)
    .select("restaurant name price stockQty isAvailable");
  if (!menu) {
    throw new ApiError(404, "Menu not found");
  }
  if (!menu.isAvailable) {
    throw new ApiError(400, "Item currently unavailable");
  }
  if (addQuantity > menu.stockQty) {
    throw new ApiError(
      400,
      `Only ${menu.stockQty} item(s) of ${menu.name} are currently available`,
    );
  }

  const addedAmount = menu.price * addQuantity;
  let createdCart = false;
  let cart = await cartModel.findOne({
    user: req.user.id,
  });

  if (!cart) {
    try {
      cart = await cartModel.create({
        user: req.user.id,
        restaurant: menu.restaurant,
        items: [
          {
            menuItem: menu._id,
            quantity: addQuantity,
          },
        ],
        totalAmount: addedAmount,
      });
      createdCart = true;
    } catch (error) {
      if (error.code !== 11000) {
        throw new ApiError(500, "Unable to update cart right now. Please try again.");
      }

      cart = await cartModel.findOne({
        user: req.user.id,
      });
    }
  }

  if (!cart) {
    throw new ApiError(409, "Cart was updated by another request");
  }

  if (cart.restaurant.toString() !== menu.restaurant.toString()) {
    throw new ApiError(
      409,
      "Items are from different restaurants.Remove the items for proceeding",
    );
  }

  if (!createdCart) {
    const existingItem = cart.items.find((item) => {
      return item.menuItem.toString() === menu._id.toString();
    });

    if (existingItem) {
      const maxCurrentQuantity = menu.stockQty - addQuantity;
      const updatedCart = await cartModel.findOneAndUpdate(
        {
          user: req.user.id,
          restaurant: menu.restaurant,
          items: {
            $elemMatch: {
              menuItem: menu._id,
              quantity: { $lte: maxCurrentQuantity },
            },
          },
        },
        {
          $inc: {
            "items.$.quantity": addQuantity,
            totalAmount: addedAmount,
          },
        },
        { returnDocument: 'after' },
      );

      if (!updatedCart) {
        throw new ApiError(
          400,
          `Only ${menu.stockQty} item(s) of ${menu.name} are currently available`,
        );
      }

      cart = updatedCart;
    } else {
      const updatedCart = await cartModel.findOneAndUpdate(
        {
          user: req.user.id,
          restaurant: menu.restaurant,
          items: {
            $not: {
              $elemMatch: { menuItem: menu._id },
            },
          },
        },
        {
          $push: {
            items: {
              menuItem: menu._id,
              quantity: addQuantity,
            },
          },
          $inc: {
            totalAmount: addedAmount,
          },
        },
        { returnDocument: 'after' },
      );

      if (!updatedCart) {
        const latestCart = await cartModel.findOne({
          user: req.user.id,
        });
        const latestItem = latestCart?.items.find(
          (item) => item.menuItem.toString() === menu._id.toString(),
        );

        if (latestItem && latestItem.quantity + addQuantity > menu.stockQty) {
          throw new ApiError(
            400,
            `Only ${menu.stockQty} item(s) of ${menu.name} are currently available`,
          );
        }

        if (latestItem) {
          const maxCurrentQuantity = menu.stockQty - addQuantity;
          const retriedCart = await cartModel.findOneAndUpdate(
            {
              user: req.user.id,
              restaurant: menu.restaurant,
              items: {
                $elemMatch: {
                  menuItem: menu._id,
                  quantity: { $lte: maxCurrentQuantity },
                },
              },
            },
            {
              $inc: {
                "items.$.quantity": addQuantity,
                totalAmount: addedAmount,
              },
            },
            { returnDocument: 'after' },
          );

          if (!retriedCart) {
            throw new ApiError(
              400,
              `Only ${menu.stockQty} item(s) of ${menu.name} are currently available`,
            );
          }

          cart = retriedCart;
        } else {
          throw new ApiError(409, "Cart was updated by another request");
        }
      } else {
        cart = updatedCart;
      }
    }
  }

  if (cart.totalAmount == null) {
    const finalCart = await cartTotal(cart);
    const persisted = await persistCartTotal(finalCart._id, req.user.id, finalCart.totalAmount);
    if (!persisted) {
      throw new ApiError(409, "Cart was updated by another request");
    }

    return res
      .status(201)
      .json(new ApiResponse(201, "Items added to cart", finalCart));
  }

  return res
    .status(201)
    .json(new ApiResponse(201, "Items added to cart", cart));
});

const getItemsFromCart = asyncHandler(async (req, res) => {
  let cart = await cartModel
    .findOne({
      user: req.user.id,
    })
    .populate({
      path: "restaurant",
      select: "restaurantName",
    });

  if (!cart) {
    return res.status(200).json(
      new ApiResponse(
        200,
        "No items in the cart",
        ({
          restaurant: null,
          items: [],
          totalAmount: 0,
        }),
      ),
    );
  }

  await cart.populate({
    path: "items.menuItem",
    select: "name price image stockQty",
  });

  cart.items = cart.items.filter((item) => item.menuItem);

  const menuIdOnly = cart.items.map((item) => item.menuItem._id);
  const menus = await menuModel.find({
    _id: {
      $in: menuIdOnly,
    },
  });

  const calculatedAmount = cart.items.reduce((sum, item) => {
    const menu = menus.find(
      (menu) => menu._id.toString() === item.menuItem._id.toString(),
    );
    if (!menu){
      throw new ApiError(
        400,
        "One or more items in your cart is not available",
      );
    }
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

  const persisted = await persistCartTotal(cart._id, req.user.id, calculatedAmount);
  if (!persisted) {
    return res.status(200).json(
      new ApiResponse(
        200,
        "No items in the cart",
        ({
          restaurant: null,
          items: [],
          totalAmount: 0,
        }),
      ),
    );
  }

  cart.totalAmount = calculatedAmount;

  return res.status(200).json(
    new ApiResponse(200, "Cart fetched successfully", {
      restaurant: cart.restaurant,
      items: cart.items,
      totalAmount: cart.totalAmount,
    }),
  );
});

const updateCartItemQuantity = asyncHandler(async (req, res) => {
  const { menuItemId } = req.params;
  const { quantity } = req.body;
  const updateQuantity = Number(quantity);

  if (!Number.isInteger(updateQuantity) || updateQuantity < 1) {
    throw new ApiError(400, "Invalid quantity");
  }
  if (!mongoose.Types.ObjectId.isValid(menuItemId)) {
    throw new ApiError(400, "Invalid menu item ID");
  }

  const menu = await menuModel
    .findById(menuItemId)
    .select("restaurant name price stockQty isAvailable");
  if (!menu || !menu.isAvailable) {
    throw new ApiError(400, "Item currently unavailable");
  }
  if (updateQuantity > menu.stockQty) {
    throw new ApiError(
      400,
      `Only ${menu.stockQty} item(s) of ${menu.name} are currently available`,
    );
  }

  const updatedCart = await cartModel.findOneAndUpdate(
    {
      user: req.user.id,
      restaurant: menu.restaurant,
      "items.menuItem": menu._id,
    },
    [
      {
        $set: {
          totalAmount: {
            $let: {
              vars: {
                currentItem: {
                  $first: {
                    $filter: {
                      input: "$items",
                      as: "item",
                      cond: { $eq: ["$$item.menuItem", menu._id] },
                    },
                  },
                },
              },
              in: {
                $add: [
                  "$totalAmount",
                  {
                    $multiply: [
                      {
                        $subtract: [updateQuantity, "$$currentItem.quantity"],
                      },
                      menu.price,
                    ],
                  },
                ],
              },
            },
          },
          items: {
            $map: {
              input: "$items",
              as: "item",
              in: {
                $cond: [
                  { $eq: ["$$item.menuItem", menu._id] },
                  { $mergeObjects: ["$$item", { quantity: updateQuantity }] },
                  "$$item",
                ],
              },
            },
          },
        },
      },
    ],
    {
      returnDocument: 'after',
      updatePipeline: true,
      projection: {
        items: 1,
        totalAmount: 1,
      },
    },
  );

  if (!updatedCart) {
    const cart = await cartModel
      .findOne({
        user: req.user.id,
      })
      .select("restaurant items.menuItem")
      .lean();

    if (!cart) {
      throw new ApiError(404, "Cart not found");
    }

    if (cart.restaurant.toString() !== menu.restaurant.toString()) {
      throw new ApiError(
        409,
        "Items are from different restaurants.Remove the items for proceeding",
      );
    }

    const item = cart.items.find(
      (item) => item.menuItem.toString() === menu._id.toString(),
    );

    if (!item) {
      throw new ApiError(404, "Item not found in cart");
    }

    throw new ApiError(409, "Cart was updated by another request");
  }

  if (updatedCart.totalAmount == null) {
    const finalCart = await cartTotal(updatedCart);
    const persisted = await persistCartTotal(finalCart._id, req.user.id, finalCart.totalAmount);
    if (!persisted) {
      throw new ApiError(409, "Cart was updated by another request");
    }

    return res.status(200).json(
      new ApiResponse(200, "Quantity updated", {
        items: finalCart.items,
        totalAmount: finalCart.totalAmount,
      }),
    );
  }

  return res.status(200).json(
    new ApiResponse(200, "Quantity updated", {
      items: updatedCart.items,
      totalAmount: updatedCart.totalAmount,
    }),
  );
});

const deleteCartItem = asyncHandler(async (req, res) => {
  const { menuItemId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(menuItemId)) {
    throw new ApiError(400, "Invalid Menu Item ID");
  }
  const updatedCart = await cartModel.findOneAndUpdate(
    {
      user: req.user.id,
      "items.menuItem": menuItemId,
    },
    {
      $pull: {
        items: {
          menuItem: menuItemId,
        },
      },
    },
    {
      returnDocument: "after",
    },
  );

  if (!updatedCart) {
    const cart = await cartModel.findOne({ user: req.user.id }).select("_id").lean();
    if (!cart) {
      throw new ApiError(404, "Cart not found");
    }

    throw new ApiError(404, "Item not found in cart");
  }

  if (updatedCart.items.length === 0) {
    await cartModel.deleteOne({ _id: updatedCart._id, user: req.user.id });
    return res.status(200).json(
      new ApiResponse(200, "Item deleted successfully", {
        restaurant: null,
        items: [],
        totalAmount: 0,
      }),
    );
  }

  const finalCart = await cartTotal(updatedCart);
  const persisted = await persistCartTotal(finalCart._id, req.user.id, finalCart.totalAmount);
  if (!persisted) {
    throw new ApiError(409, "Cart was updated by another request");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, "Item deleted successfully", finalCart));
});

const deleteCart = asyncHandler(async (req, res) => {
  const cart = await cartModel.findOne({
    user: req.user.id,
  });

  if (!cart) {
    throw new ApiError(404, "Cart not found");
  }

  await cart.deleteOne({ user: req.user.id });
  return res.status(200).json(new ApiResponse(200, "Cart deleted successfully"));
});

export default {
  addToCart,
  getItemsFromCart,
  updateCartItemQuantity,
  deleteCartItem,
  deleteCart,
};
