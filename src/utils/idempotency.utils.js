const IDEMPOTENCY_PENDING_VALUE = "PENDING";

const getUserIdempotencyCacheKey = ({ scope, userId, idempotencyKey }) => {
  return `${scope}:idempotency:${userId}:${idempotencyKey}`;
};

const acquireIdempotencySlot = async (redisClient, cacheKey) => {
  const response = await redisClient.set(
    cacheKey,
    IDEMPOTENCY_PENDING_VALUE,
    "EX",
    120,
    "NX",
  );
  return response === "OK";
};

const releaseIdempotencySlot = async (redisClient, cacheKey) => {
  await redisClient.del(cacheKey);
};

export {
  IDEMPOTENCY_PENDING_VALUE,
  getUserIdempotencyCacheKey,
  acquireIdempotencySlot,
  releaseIdempotencySlot,
};
