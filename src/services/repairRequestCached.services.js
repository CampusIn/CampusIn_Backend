import { REDIS_KEYS } from "../constants/redis.constants.js";
import redisServices from "./redis.services.js";

const CACHE_TTL_SECONDS = 600;

const normaliseCacheValue = (value) => {
  if (value === undefined || value === null || value === "") {
    return "all";
  }

  return encodeURIComponent(String(value).trim().toLowerCase()) || "all";
};

const getUserRepairRequestsCacheKey = ({ userId, page, limit, search, status }) => {
  return REDIS_KEYS.USER_REPAIR_REQUESTS(
    userId,
    page,
    limit,
    normaliseCacheValue(search),
    normaliseCacheValue(status),
  );
};

const getUserRepairRequestByIdCacheKey = ({ userId, requestId }) => {
  return REDIS_KEYS.USER_REPAIR_REQUEST_DETAILS(userId, requestId);
};

const getUserRepairRequestsCached = async (params) => {
  const cachedData = await redisServices.get(getUserRepairRequestsCacheKey(params));

  if (cachedData) {
    return cachedData;
  }

  return null;
};

const setUserRepairRequestsCached = async (params, repairRequestsData) => {
  await redisServices.set(
    getUserRepairRequestsCacheKey(params),
    repairRequestsData,
    CACHE_TTL_SECONDS,
  );
};

const deleteUserRepairRequestsCached = async (userId) => {
  await redisServices.removeByPattern(REDIS_KEYS.USER_REPAIR_REQUESTS_PATTERN(userId));
};

const getUserRepairRequestByIdCached = async (params) => {
  const cachedData = await redisServices.get(
    getUserRepairRequestByIdCacheKey(params),
  );

  if (cachedData) {
    return cachedData;
  }

  return null;
};

const setUserRepairRequestByIdCached = async (params, repairRequestData) => {
  await redisServices.set(
    getUserRepairRequestByIdCacheKey(params),
    repairRequestData,
    CACHE_TTL_SECONDS,
  );
};

const deleteUserRepairRequestByIdCached = async (params) => {
  await redisServices.remove(getUserRepairRequestByIdCacheKey(params));
};

export {
  getUserRepairRequestsCached,
  setUserRepairRequestsCached,
  deleteUserRepairRequestsCached,
  getUserRepairRequestByIdCached,
  setUserRepairRequestByIdCached,
  deleteUserRepairRequestByIdCached,
};
