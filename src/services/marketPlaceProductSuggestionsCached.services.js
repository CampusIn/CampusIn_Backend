import { REDIS_KEYS } from "../constants/redis.constants.js";
import redisServices from "./redis.services.js";

const normaliseSuggestionQuery = (query) => {
  if (!query || !query.trim()) {
    return "all";
  }

  return encodeURIComponent(query.trim().toLowerCase());
};

const getSuggestionsCacheKey = (query) => {
  return REDIS_KEYS.MARKETPLACE_PRODUCTS_SUGGESTIONS(
    normaliseSuggestionQuery(query),
  );
};

const getMarketPlaceProductSuggestionsCached = async (query) => {
  const cachedData = await redisServices.get(getSuggestionsCacheKey(query));
  if (cachedData) {
    return cachedData;
  }

  return null;
};

const setMarketPlaceProductSuggestionsCached = async (query, suggestions) => {
  await redisServices.set(getSuggestionsCacheKey(query), suggestions, 300);
};

const deleteMarketPlaceProductSuggestionsCached = async () => {
  await redisServices.removeByPattern(
    REDIS_KEYS.MARKETPLACE_PRODUCTS_SUGGESTIONS_PATTERN,
  );
};

export {
  getMarketPlaceProductSuggestionsCached,
  setMarketPlaceProductSuggestionsCached,
  deleteMarketPlaceProductSuggestionsCached,
};
