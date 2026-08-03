import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/apiErrors.js";
import ApiResponse from "../utils/apiResponse.js";
import menuModel from "../models/menuItem.models.js";
import restaurantModel from "../models/restaurant.models.js";
import { verifyMenuOwnership } from "../utils/menuOwnership.utils.js";
import { uploadOnCloudinary } from "../services/cloudinary.services.js";
import { setRestaurantMenuCached,getRestaurantMenuCached,deleteRestaurantMenuCached } from "../services/menuCahed.services.js";
import mongoose from "mongoose";

const createMenuItem = asyncHandler(async (req, res) => {
  const { restaurantId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
    throw new ApiError(400, "Invalid restaurant ID");
  }
  const restaurant = await restaurantModel.findById(restaurantId);
  if (!restaurant) {
    throw new ApiError(404, "Restaurant not found");
  }

  if (restaurant.owner.toString() !== req.user.id.toString()) {
    throw new ApiError(403, "Forbidden");
  }
  const { name, description, price, category, mrp, foodType } = req.body;
  if (mrp < price) {
    throw new ApiError(400, "MRP cannot be less than price");
  }
  const imageLocalPath = req.file?.path;
  if (!imageLocalPath) {
    throw new ApiError(400, "Menu image is required");
  }
  const imageUrl = await uploadOnCloudinary(imageLocalPath);

  const menuCreated = await menuModel.create({
    restaurant: restaurantId,
    name,
    description,
    price,
    category,
    mrp,
    foodType,
    image: imageUrl,
  });

  await deleteRestaurantMenuCached(restaurantId)
  return res
    .status(201)
    .json(new ApiResponse(201, "Menu item created successfully", menuCreated));
});

const getRestaurantMenu = asyncHandler(async (req, res) => {
  const { restaurantId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
    throw new ApiError(400, "Invalid restaurant ID");
  }
  
  const cachedData = await getRestaurantMenuCached(restaurantId)
  if(cachedData){
    
    return res
    .status(200)
    .json(new ApiResponse(200, "Menu fetched successfully", cachedData));
  }

  
  
  const restaurant = await restaurantModel.findById(restaurantId);
  if (!restaurant) {
    throw new ApiError(404, "Restaurant not found");
  }

  const menuItems = await menuModel.find({
    restaurant: restaurantId,
    isDeleted: false,
  });

  await setRestaurantMenuCached(restaurantId,menuItems)

  return res
    .status(200)
    .json(new ApiResponse(200, "Menu fetched successfully", menuItems));
});

const getMenuItemById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid menu item ID");
  }
  const menuItem = await menuModel.findOne({
    _id: id,
    isDeleted: false,
  });
  if (!menuItem) {
    throw new ApiError(404, "Menu item not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, "Menu item fetched successfully", menuItem));
});

const updateMenuItem = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid menu item ID");
  }
  const menuItem = await verifyMenuOwnership(id, req.user.id);
  const allowedFields = ["name", "description", "price", "category", "image", "foodType"];

  const filteredBody = {};
  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      filteredBody[field] = req.body[field];
    }
  });
  const updatedMenu = await menuModel.findByIdAndUpdate(id, filteredBody, {
    returnDocument: "after",
  });

  await deleteRestaurantMenuCached(updatedMenu.restaurant)

  

  return res
    .status(200)
    .json(new ApiResponse(200, "Menu updated successfully", updatedMenu));
});

const updateMenuStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isAvailable } = req.body;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid menu item ID");
  }

  const menuItem = await verifyMenuOwnership(id, req.user.id);

  menuItem.isAvailable = isAvailable;
  await menuItem.save();

  await deleteRestaurantMenuCached(menuItem.restaurant._id)

  return res
    .status(200)
    .json(new ApiResponse(200, "Availability updated successfully", menuItem));
});

const deleteMenuItem = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid menu item ID");
  }
  const menuItem = await verifyMenuOwnership(id, req.user.id);

  menuItem.isDeleted = true;
  await menuItem.save();
  await deleteRestaurantMenuCached(menuItem.restaurant._id)
  return res.status(200).json(new ApiResponse(200, "Menu deleted successfully"));
});

const getMenuSuggestions = asyncHandler(async (req, res) => {
  const { q } = req.query;
  if (!q.trim()) {
    return res.status(200).json(new ApiResponse(200, "No query provided", []));
  }

  const suggestions = await menuModel
    .find({
      name: { $regex: q, $options: "i" },
      isDeleted: false,
      isAvailable: true,
    })
    .select("_id name image price category restaurant")
    .limit(5);

  if (suggestions.length === 0) {
    return res
      .status(200)
      .json(new ApiResponse(200, "No suggestions found", []));
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        "Menu suggestions fetched successfully",
        suggestions,
      ),
    );
});

export default {
  createMenuItem,
  getRestaurantMenu,
  getMenuItemById,
  updateMenuItem,
  updateMenuStatus,
  deleteMenuItem,
  getMenuSuggestions,
};
