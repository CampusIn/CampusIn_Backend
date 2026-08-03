import { RateLimiterMemory, RateLimiterRedis } from "rate-limiter-flexible";
import { redis } from "../config/redis.js";

const isTestEnvironment =
  process.env.NODE_ENV === "test" || Boolean(process.env.JEST_WORKER_ID);

const getClientIp = (req) => {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim();
  }

  return req.ip || req.socket?.remoteAddress || "unknown";
};

const createLimiter = ({ keyPrefix, points, duration }) => {
  if (isTestEnvironment) {
    return new RateLimiterMemory({
      keyPrefix,
      points,
      duration,
    });
  }

  return new RateLimiterRedis({
    storeClient: redis,
    keyPrefix,
    points,
    duration,
  });
};

const buildErrorPayload = (retryAfterSeconds, message) => ({
  statusCode: 429,
  data: null,
  message,
  success: false,
  errors: [],
  retryAfter: retryAfterSeconds,
});

const consumeLimiter = ({ limiter, message }) => {
  return async (req, res, next) => {
    if (isTestEnvironment) {
      return next();
    }

    const key = getClientIp(req);

    try {
      await limiter.consume(key);
      return next();
    } catch (error) {
      if (error && typeof error.msBeforeNext === "number") {
        const retryAfterSeconds = Math.max(
          1,
          Math.ceil(error.msBeforeNext / 1000),
        );

        res.set("Retry-After", String(retryAfterSeconds));

        return res
          .status(429)
          .json(buildErrorPayload(retryAfterSeconds, message));
      }

      return next();
    }
  };
};

const strictLimiter = consumeLimiter({
  limiter: createLimiter({
    keyPrefix: "rate-limit:strict",
    points: 5,
    duration: 60,
  }),
  message: "Too many requests. Please try again in a minute.",
});

const cartLimiter = consumeLimiter({
  limiter: createLimiter({
    keyPrefix: "rate-limit:cart",
    points: 100,
    duration: 60,
  }),
  message: "Cart request limit exceeded. Please try again soon.",
});

const reviewsLimiter = consumeLimiter({
  limiter: createLimiter({
    keyPrefix: "rate-limit:reviews",
    points: 10,
    duration: 60,
  }),
  message: "Review request limit exceeded. Please try again soon.",
});

const relaxedLimiter = consumeLimiter({
  limiter: createLimiter({
    keyPrefix: "rate-limit:relaxed",
    points: 300,
    duration: 60,
  }),
  message: "Too many requests. Please slow down and retry.",
});

const searchLimiter = consumeLimiter({
  limiter: createLimiter({
    keyPrefix: "rate-limit:search",
    points: 60,
    duration: 60,
  }),
  message: "Search request limit exceeded. Please try again soon.",
});

const uploadLimiter = consumeLimiter({
  limiter: createLimiter({
    keyPrefix: "rate-limit:uploads",
    points: 10,
    duration: 60,
  }),
  message: "Upload limit exceeded. Please try again soon.",
});

const searchAwareRelaxedLimiter = async (req, res, next) => {
  if (req.query?.search && String(req.query.search).trim()) {
    return searchLimiter(req, res, next);
  }

  return relaxedLimiter(req, res, next);
};

const LOGIN_ATTEMPTS_KEY_PREFIX = "auth:login:attempts";
const LOGIN_BLOCK_KEY_PREFIX = "auth:login:block";

const getLoginRateLimitKey = ({ role = "all", email = "unknown", ip }) => {
  const normalizedRole = String(role).trim().toLowerCase() || "all";
  const normalizedEmail = String(email).trim().toLowerCase() || "unknown";
  const normalizedIp = String(ip || "unknown");
  return `${normalizedRole}:${normalizedEmail}:${normalizedIp}`;
};

const LOGIN_FAILURE_RULES = [
  { attempts: 20, blockForSeconds: 24 * 60 * 60 },
  { attempts: 10, blockForSeconds: 60 * 60 },
  { attempts: 5, blockForSeconds: 15 * 60 },
];

const getBlockDurationFromAttempts = (attempts) => {
  return (
    LOGIN_FAILURE_RULES.find((rule) => attempts >= rule.attempts)?.blockForSeconds ||
    null
  );
};

const getLoginAttemptsRedisKey = (key) => `${LOGIN_ATTEMPTS_KEY_PREFIX}:${key}`;
const getLoginBlockRedisKey = (key) => `${LOGIN_BLOCK_KEY_PREFIX}:${key}`;

export {
  strictLimiter,
  cartLimiter,
  reviewsLimiter,
  relaxedLimiter,
  searchLimiter,
  uploadLimiter,
  searchAwareRelaxedLimiter,
  getClientIp,
  getLoginRateLimitKey,
  getBlockDurationFromAttempts,
  getLoginAttemptsRedisKey,
  getLoginBlockRedisKey,
};
