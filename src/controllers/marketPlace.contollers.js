import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/apiErrors.js";
import ApiResponse from "../utils/apiResponse.js";
import marketPlaceCategoryModel from "../models/marketPlaceCategory.models.js";
import marketPlaceProductsModel from "../models/marketPlaceProducts.models.js";
import mongoose from "mongoose";
import {
  getCategoriesCached,
  setCategoriesCached,
} from "../services/categoriesCached.services.js";

import {
  getProductCached,
  setProductCached,
  getProductsCached,
  setProductsCached,
} from "../services/marketPlaceProductsCached.services.js";
import {
  getMarketPlaceProductSuggestionsCached,
  setMarketPlaceProductSuggestionsCached,
} from "../services/marketPlaceProductSuggestionsCached.services.js";

const getAllCategoriesByUser = asyncHandler(async (req, res) => {
  const { search, page = 1, limit = 5 } = req.query;
  const pageNumber = parseInt(page) || 1;
  const limitNumber = parseInt(limit) || 5;
  if (pageNumber < 1 || limitNumber < 1) {
    throw new ApiError(400, "Invalid page number or limit number");
  }

  const cacheParams = { page: pageNumber, limit: limitNumber, search };
  const cachedData = await getCategoriesCached(cacheParams);
  if (cachedData) {
    return res.status(200).json(
      new ApiResponse(200, "Categories fetched successfully", cachedData),
    );
  }

  const skip = (pageNumber - 1) * limitNumber;
  let filter = { isActive: true };
  if (search) {
    filter.name = {
      $regex: search,
      $options: "i",
    };
  }

  const [categories, totalCategories] = await Promise.all([
    marketPlaceCategoryModel
      .find(filter)
      .sort({
        priority: -1,
        createdAt: -1,
      })
      .select("name description image priority _id")
      .skip(skip)
      .limit(limitNumber),

    marketPlaceCategoryModel.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(totalCategories / limitNumber);
  const responseData = {
    categories,
    pagination: {
      page: pageNumber,
      limit: limitNumber,
      totalCategories,
      totalPages,
    },
  };

  await setCategoriesCached(cacheParams, responseData);

  if (categories.length === 0) {
    return res.status(200).json(
      new ApiResponse(200, "No categories to fetch", responseData),
    );
  }

  return res.status(200).json(
    new ApiResponse(200, "Categories fetched successfully", responseData),
  );
});

const getAllProductsByUser = asyncHandler(async (req, res) => {
  let filter = {
    isActive: true,
    stock: { $gt: 0 },
  };

  const {
    search,
    category,
    condition,
    maxPrice,
    minPrice,
    page = 1,
    limit = 5,
  } = req.query;
  const searchText = search ? String(search).trim() : "";
  const categoryText = category ? String(category).trim() : "";
  const conditionText = condition ? String(condition).trim() : "";
  const minPriceText = minPrice ? String(minPrice).trim() : "";
  const maxPriceText = maxPrice ? String(maxPrice).trim() : "";
  const pageNumber = parseInt(page) || 1;
  const limitNumber = parseInt(limit) || 5;
  if (pageNumber < 1 || limitNumber < 1) {
    throw new ApiError(400, "Page number or limit number is invalid");
  }

  const cacheParams = {
    page: pageNumber,
    limit: limitNumber,
    search: searchText,
    category: categoryText,
    condition: conditionText,
    minPrice: minPriceText,
    maxPrice: maxPriceText,
  };
  const cachedData = await getProductsCached(cacheParams);
  if (cachedData) {
    return res
      .status(200)
      .json(new ApiResponse(200, "Products fetched successfully", cachedData));
  }

  const skip = (pageNumber - 1) * limitNumber;
  if (searchText) {
    filter.name = {
      $regex: searchText,
      $options: "i",
    };
  }

  if (categoryText) {
    filter.category = categoryText
  }

  if (conditionText) {
    filter.condition = conditionText;
  }

  if(minPriceText || maxPriceText){
    filter.price = {}
    if (minPriceText) {
    filter.price.$gte = Number(minPriceText);
  }

  if (maxPriceText) {
    filter.price.$lte = Number(maxPriceText);
  }
  }
  const [products, totalProducts] = await Promise.all([
    marketPlaceProductsModel
      .find(filter)
      .sort({ createdAt: -1, price: -1 })
      .select("_id name price images condition category")
      .skip(skip)
      .limit(limitNumber),

    marketPlaceProductsModel.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(totalProducts / limitNumber);
  const responseData = {
    products,
    pagination: {
      page: pageNumber,
      limit: limitNumber,
      totalProducts,
      totalPages,
    },
  };

  await setProductsCached(cacheParams, responseData);

  if (products.length === 0) {
    return res.status(200).json(
      new ApiResponse(200, "No products to fetch", responseData),
    );
  }

  return res.status(200).json(
    new ApiResponse(200, "Products fetched successfully", responseData),
  );
});

const getProductsByIdUser = asyncHandler(async(req,res)=>{
  const{productId} = req.params
  if(!mongoose.Types.ObjectId.isValid(productId)){
    throw new ApiError(400,"Product ID is not valid")
  }

  const cachedData = await getProductCached(productId)
  if(cachedData){
    return res.status(200).json(new ApiResponse(200,"Product fetched successfully",cachedData))
  }

  const product = await marketPlaceProductsModel
    .findOne({
      _id:productId,
      isActive:true,
      stock:{$gt:0}
    })
    .populate(
      {
        path:'category',
        select:'name'
      })
      .select("-createdBy -createdAt -updatedAt")
  if(!product){
    throw new ApiError(404,"Product not found ")
  }

  await setProductCached(productId, product)

  return res.status(200).json(new ApiResponse(200,"Product fetched successfully",product))


});

const getMarketPlaceProductSuggestions = asyncHandler(async (req, res) => {
  const { q } = req.query;
  if (!q || !q.trim()) {
    return res.status(200).json(new ApiResponse(200, "No query provided", []));
  }

  const cachedSuggestions = await getMarketPlaceProductSuggestionsCached(q);
  if (cachedSuggestions) {
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          "Marketplace product suggestions fetched successfully",
          cachedSuggestions,
        ),
      );
  }

  const suggestions = await marketPlaceProductsModel
    .find({
      name: { $regex: q, $options: "i" },
      isActive: true,
      stock: { $gt: 0 },
    })
    .select("_id name images price condition category")
    .limit(5);

  if (suggestions.length === 0) {
    await setMarketPlaceProductSuggestionsCached(q, []);

    return res
      .status(200)
      .json(new ApiResponse(200, "No suggestions found", []));
  }

  await setMarketPlaceProductSuggestionsCached(q, suggestions);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        "Marketplace product suggestions fetched successfully",
        suggestions,
      ),
    );
});

export default {
  getAllCategoriesByUser,
  getAllProductsByUser,
  getProductsByIdUser,
  getMarketPlaceProductSuggestions,
};
