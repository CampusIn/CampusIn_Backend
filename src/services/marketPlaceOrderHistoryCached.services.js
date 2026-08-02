import { REDIS_KEYS } from "../constants/redis.constants.js";
import redisServices from "./redis.services.js";

const getUserMarketplaceOrderHistoryCacheKey = ({ userId, page, limit }) => {
  return REDIS_KEYS.USER_MARKETPLACE_ORDER_HISTORY(userId, page, limit);
};

const getMarketplaceOrderHistoryCached = async ({ userId, page, limit }) => {
  const cachedData = await redisServices.get(
    getUserMarketplaceOrderHistoryCacheKey({ userId, page, limit }),
  );

  if (cachedData) {
    return cachedData;
  }

  return null;
};

const setMarketplaceOrderHistoryCached = async (
  { userId, page, limit },
  ordersData,
) => {
  await redisServices.set(
    getUserMarketplaceOrderHistoryCacheKey({ userId, page, limit }),
    ordersData,
    600,
  );
};

const deleteMarketplaceOrderHistoryCached = async (userId) => {
  await redisServices.removeByPattern(
    REDIS_KEYS.USER_MARKETPLACE_ORDER_HISTORY_PATTERN(userId),
  );
};

export {
  getMarketplaceOrderHistoryCached,
  setMarketplaceOrderHistoryCached,
  deleteMarketplaceOrderHistoryCached,
};
