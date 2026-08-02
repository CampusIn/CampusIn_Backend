import { REDIS_KEYS } from "../constants/redis.constants.js";
import redisServices from "./redis.services.js";

const getUserOrderHistoryCacheKey = ({ userId, page, limit }) => {
  return REDIS_KEYS.USER_FOOD_ORDER_HISTORY(userId, page, limit);
};

const getOrderHistoryCached = async ({ userId, page, limit }) => {
  const cachedData = await redisServices.get(
    getUserOrderHistoryCacheKey({ userId, page, limit }),
  );

  if (cachedData) {
    return cachedData;
  }

  return null;
};

const setOrderHistoryCached = async ({ userId, page, limit }, ordersData) => {
  await redisServices.set(
    getUserOrderHistoryCacheKey({ userId, page, limit }),
    ordersData,
    600,
  );
};

const deleteOrderHistoryCached = async (userId) => {
  await redisServices.removeByPattern(
    REDIS_KEYS.USER_FOOD_ORDER_HISTORY_PATTERN(userId),
  );
};

export { getOrderHistoryCached, setOrderHistoryCached, deleteOrderHistoryCached };
