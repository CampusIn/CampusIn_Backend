import restaurantModel from "../models/restaurant.models.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/apiErrors.js";
import ApiResponse from "../utils/apiResponse.js";
import mongoose from "mongoose";
import {
  getRestaurantCached,
  setRestaurantCached,
  getRestaurantsCached,
  setRestaurantsCached,
  deleteRestaurantCached,
} from "../services/restaurantCached.services.js";

const createRestaurant = asyncHandler(async (req, res) => {
  const { restaurantName, phone, description, location, category } = req.body;
  const newRestaurant = await restaurantModel.create({
    owner: req.user.id,
    restaurantName,
    description,
    category,
    phone,
    location,
  });

  if (!newRestaurant) {
    throw new ApiError(500, "Failed to create restaurant");
  }

  await deleteRestaurantCached();

  return res
    .status(201)
    .json(
      new ApiResponse(201, "Restaurant created successfully", newRestaurant),
    );
});

const updateRestaurant = asyncHandler(async (req, res) => {

  const {id} = req.params
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid restaurant ID");
  }
  const restaurant = await restaurantModel.findById(id);
  if (!restaurant) {
    throw new ApiError(404, "Restaurant not found");
  }
  if (restaurant.owner.toString() !== req.user.id.toString()) {
    throw new ApiError(403, "Not allowed");
  }
  const allowedFields = [
    "restaurantName",
    "description",
    "category",
    "phone",
    "email",
    "logo",
    "banner",
    "location",
    "deliveryTime",
    "minimumOrder",
    "isOpen",
  ];

  const filteredBody = {};
  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      filteredBody[field] = req.body[field];
    }
  });
  const updatedRestaurant = await restaurantModel.findByIdAndUpdate(
    id,
    filteredBody,
    { returnDocument: "after" },
  );

  await deleteRestaurantCached(id)

  return res
    .status(200)
    .json(new ApiResponse(200, "Updated the restaurant", updatedRestaurant));
});

const getMyRestaurants = asyncHandler(async (req, res) => {
  const restaurant = await restaurantModel.find({ owner: req.user.id });

  return res
    .status(200)
    .json(new ApiResponse(200, "The fetched restaurants are", restaurant));
});
//debug this
const getRestaurantById = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    throw new ApiError(400, "Invalid restaurant ID");
  }
  const restaurant = await restaurantModel.findById(req.params.id);
  if (!restaurant) {
    throw new ApiError(404, "Restaurant Not Found");
  }

  if (restaurant.owner.toString() !== req.user.id.toString()) {
    throw new ApiError(403, "Not authorized");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, "Restaurant fetched successfully", restaurant));
});

const dltRestaurantById = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    throw new ApiError(400, "Invalid restaurant ID");
  }
  const restaurant = await restaurantModel.findById(req.params.id);

  if (!restaurant) {
    throw new ApiError(404, "Restaurant not found");
  }

  if (restaurant.owner.toString() !== req.user.id.toString()) {
    throw new ApiError(403, "Not authorized");
  }
  await restaurantModel.findByIdAndDelete(req.params.id);
  await deleteRestaurantCached(req.params.id)
  return res
    .status(200)
    .json(new ApiResponse(200, "Restaurant deleted successfully"));
});

const updateRestaurantStatus = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    throw new ApiError(400, "Invalid restaurant ID");
  }
  const restaurant = await restaurantModel.findById(req.params.id);
  if (!restaurant) {
    throw new ApiError(404, "Restaurant not found");
  }
  if (restaurant.owner.toString() !== req.user.id.toString()) {
    throw new ApiError(403, "Not authorized");
  }

  restaurant.isOpen = req.body.isOpen;
  await restaurant.save();
  await deleteRestaurantCached(req.params.id)
  return res.status(200).json(
    new ApiResponse(200, "Restaurant status updated successfully", restaurant),
  );
});

const getAllRestaurantsByUser = asyncHandler(async (req, res) => {
  const { search, page = 1, limit = 10, category } = req.query;
  const searchText = search ? String(search).trim() : "";
  const categoryText = category ? String(category).trim() : "";
  const pageNumber = parseInt(page) || 1;
  const limitNumber = parseInt(limit) || 10;
  if (pageNumber < 1 || limitNumber < 1) {
    throw new ApiError(400, "Invalid page number or limit number");
  }

  const cacheParams = {
    page: pageNumber,
    limit: limitNumber,
    search: searchText,
    category: categoryText,
  };
  const cachedData = await getRestaurantsCached(cacheParams);
  if (cachedData) {
    return res
      .status(200)
      .json(new ApiResponse(200, "Restaurants fetched successfully", cachedData));
  }

  const filter = {
    isOpen: true,
  };
  if (searchText) {
    filter.restaurantName = {
      $regex: searchText,
      $options: "i",
    };
  }
  if (categoryText) {
    filter.category = categoryText;
  }

  const skip = (pageNumber - 1) * limitNumber;
  const [restaurant, totalRestaurant] = await Promise.all([
    restaurantModel.find(filter).skip(skip).limit(limitNumber),
    restaurantModel.countDocuments(filter),
  ]);
  const totalPages = Math.ceil(totalRestaurant / limitNumber);
  const responseData = {
    restaurant,
    pagination: {
      page: pageNumber,
      limit: limitNumber,
      totalPages,
      totalRestaurant,
    },
  };

  await setRestaurantsCached(cacheParams, responseData);

  return res.status(200).json(
    new ApiResponse(200, "Restaurants fetched successfully", responseData),
  );
});

const getRestaurantByUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid restaurant ID");
  }

  const cachedData = await getRestaurantCached(id)
  if(cachedData){
    
    return res
    .status(200)
    .json(new ApiResponse(200, "Restaurant fetched successfully", cachedData));
  }


  
  const restaurant = await restaurantModel.findOne(
    {
      _id: id,
      isOpen: true,
    },
    "-owner -minimumOrder",
  );
  if (!restaurant) {
    throw new ApiError(404, "Restaurant not found");
  }

  await setRestaurantCached(id,restaurant)

  return res
    .status(200)
    .json(new ApiResponse(200, "Restaurant fetched successfully", restaurant));
});

export default {
  createRestaurant,
  updateRestaurant,
  getMyRestaurants,
  getRestaurantById,
  dltRestaurantById,
  updateRestaurantStatus,
  getAllRestaurantsByUser,
  getRestaurantByUser,
};
