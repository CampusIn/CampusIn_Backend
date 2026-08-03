import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/apiErrors.js";
import ApiResponse from "../utils/apiResponse.js";
import mongoose from "mongoose";
import marketPlaceProductsModel from "../models/marketPlaceProducts.models.js";
import marketCartModel from "../models/marketPlaceCart.models.js";
import marketCartTotal from "../utils/marketCartTotal.utils.js";

const emptyCartResponse = {
  category: null,
  items: [],
  totalAmount: 0,
};

const getActiveProduct = async (productId) => {
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    throw new ApiError(400, "Invalid product ID");
  }

  const product = await marketPlaceProductsModel.findOne({
    _id: productId,
    isActive: true,
  });

  if (!product) {
    throw new ApiError(404, "Product not found");
  }

  return product;
};

const calculateAndPopulateCart = async (cart) => {
  const finalCart = await marketCartTotal(cart);
  await finalCart.populate({
    path: "category",
    select: "name pricingSettings",
  });
  await finalCart.populate({
    path: "items.product",
    select: "name price images condition stock category",
  });

  return finalCart;
};

const findCartAfterAtomicWrite = async (userId) => {
  return marketCartModel.findOne({
    user: userId,
  });
};

const addToMarketCart = asyncHandler(async (req, res) => {
  const { productId, quantity } = req.body;
  const addQuantity = Number(quantity);

  if (!Number.isInteger(addQuantity) || addQuantity < 1) {
    throw new ApiError(400, "Invalid quantity");
  }

  const product = await getActiveProduct(productId);

  if (addQuantity > product.stock) {
    throw new ApiError(
      400,
      `Only ${product.stock} item(s) of ${product.name} are currently available`,
    );
  }

  let createdCart = false;
  let cart = await marketCartModel.findOne({
    user: req.user.id,
  });

  if (!cart) {
    try {
      cart = await marketCartModel.create({
        user: req.user.id,
        category: product.category,
        items: [
          {
            product: product._id,
            quantity: addQuantity,
          },
        ],
      });
      createdCart = true;
    } catch (error) {
      if (error.code !== 11000) {
        throw new ApiError(500,'Error adding items to the cart');
      }
    }
  }

  if (!cart) {
    cart = await findCartAfterAtomicWrite(req.user.id);
  }

  if (!cart) {
    throw new ApiError(409, "Cart was updated by another request");
  }

  if (cart.category.toString() !== product.category.toString()) {
    throw new ApiError(
      409,
      "Items are from different categories. Remove the items for proceeding",
    );
  }

  const existingItem = cart.items.find(
    (item) => item.product.toString() === product._id.toString(),
  );

  if (existingItem && !createdCart) {
    const maxCurrentQuantity = product.stock - addQuantity;
    const updatedCart = await marketCartModel.findOneAndUpdate(
      {
        user: req.user.id,
        category: product.category,
        items: {
          $elemMatch: {
            product: product._id,
            quantity: { $lte: maxCurrentQuantity },
          },
        },
      },
      {
        $inc: { "items.$.quantity": addQuantity },
      },
      { new: true },
    );

    if (!updatedCart) {
      throw new ApiError(
        400,
        `Only ${product.stock} item(s) of ${product.name} are currently available`,
      );
    }

    cart = updatedCart;
  } else if (!createdCart) {
    const updatedCart = await marketCartModel.findOneAndUpdate(
      {
        user: req.user.id,
        category: product.category,
        items: {
          $not: {
            $elemMatch: { product: product._id },
          },
        },
      },
      {
        $push: {
          items: {
            product: product._id,
            quantity: addQuantity,
          },
        },
      },
      { new: true },
    );

    if (!updatedCart) {
      const latestCart = await findCartAfterAtomicWrite(req.user.id);
      const latestItem = latestCart?.items.find(
        (item) => item.product.toString() === product._id.toString(),
      );

      if (latestItem && latestItem.quantity + addQuantity > product.stock) {
        throw new ApiError(
          400,
          `Only ${product.stock} item(s) of ${product.name} are currently available`,
        );
      }

      if (latestItem) {
        const maxCurrentQuantity = product.stock - addQuantity;
        const retriedCart = await marketCartModel.findOneAndUpdate(
          {
            user: req.user.id,
            category: product.category,
            items: {
              $elemMatch: {
                product: product._id,
                quantity: { $lte: maxCurrentQuantity },
              },
            },
          },
          {
            $inc: { "items.$.quantity": addQuantity },
          },
          { new: true },
        );

        if (!retriedCart) {
          throw new ApiError(
            400,
            `Only ${product.stock} item(s) of ${product.name} are currently available`,
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

  const finalCart = await calculateAndPopulateCart(cart);

  return res
    .status(201)
    .json(new ApiResponse(201, "Items added to cart", finalCart));
});

const getItemsFromMarketCart = asyncHandler(async (req, res) => {
  const cart = await marketCartModel
    .findOne({
      user: req.user.id,
    })
    .populate({
      path: "category",
      select: "name",
    });

  if (!cart) {
    return res
      .status(200)
      .json(new ApiResponse(200, "No items in the cart", emptyCartResponse));
  }

  await cart.populate({
    path: "items.product",
    select: "name price images condition stock category",
  });

  cart.items = cart.items.filter((item) => item.product);

  const productIds = cart.items.map((item) => item.product._id);
  const products = await marketPlaceProductsModel.find({
    _id: {
      $in: productIds,
    },
  });

  const calculatedAmount = cart.items.reduce((sum, item) => {
    const product = products.find(
      (product) => product._id.toString() === item.product._id.toString(),
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
  await cart.save();

  return res.status(200).json(
    new ApiResponse(200, "Cart fetched successfully", {
      category: cart.category,
      items: cart.items,
      totalAmount: cart.totalAmount,
    }),
  );
});

const updateMarketCartItemQuantity = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { quantity } = req.body;
  const newQuantity = Number(quantity);

  if (!Number.isInteger(newQuantity) || newQuantity < 1) {
    throw new ApiError(400, "Invalid quantity");
  }

  const product = await getActiveProduct(productId);

  if (newQuantity > product.stock) {
    throw new ApiError(
      400,
      `Only ${product.stock} item(s) of ${product.name} are currently available`,
    );
  }

  const updatedCart = await marketCartModel.findOneAndUpdate(
    {
      user: req.user.id,
      category: product.category,
      "items.product": product._id,
    },
    {
      $set: { "items.$.quantity": newQuantity },
    },
    { new: true },
  );

  if (!updatedCart) {
    const cart = await findCartAfterAtomicWrite(req.user.id);
    if (!cart) {
      throw new ApiError(404, "Cart not found");
    }
    throw new ApiError(404, "No such item in the cart");
  }

  const finalCart = await calculateAndPopulateCart(updatedCart);

  return res.status(200).json(
    new ApiResponse(200, "Quantity updated", {
      items: finalCart.items,
      totalAmount: finalCart.totalAmount,
    }),
  );
});

const deleteMarketCartItem = asyncHandler(async (req, res) => {
  const { productId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(productId)) {
    throw new ApiError(400, "Invalid product ID");
  }

  const updatedCart = await marketCartModel.findOneAndUpdate(
    {
      user: req.user.id,
      "items.product": productId,
    },
    {
      $pull: {
        items: { product: productId },
      },
    },
    { new: true },
  );

  if (!updatedCart) {
    const cart = await findCartAfterAtomicWrite(req.user.id);
    if (!cart) {
      throw new ApiError(404, "Cart not found");
    }
    throw new ApiError(404, "Item not found in cart");
  }

  if (updatedCart.items.length === 0) {
    await updatedCart.deleteOne({ user: req.user.id });
    return res
      .status(200)
      .json(
        new ApiResponse(200, "Item deleted successfully", emptyCartResponse),
      );
  }

  const finalCart = await calculateAndPopulateCart(updatedCart);

  return res
    .status(200)
    .json(new ApiResponse(200, "Item deleted successfully", finalCart));
});

const deleteMarketCart = asyncHandler(async (req, res) => {
  const cart = await marketCartModel.findOne({
    user: req.user.id,
  });

  if (!cart) {
    throw new ApiError(404, "Cart not found");
  }

  await cart.deleteOne({ user: req.user.id });
  return res
    .status(200)
    .json(new ApiResponse(200, "Cart deleted successfully"));
});

export default {
  addToMarketCart,
  getItemsFromMarketCart,
  updateMarketCartItemQuantity,
  deleteMarketCartItem,
  deleteMarketCart,
};
