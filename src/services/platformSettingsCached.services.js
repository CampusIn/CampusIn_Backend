import { REDIS_KEYS } from "../constants/redis.constants.js";
import redisServices from "./redis.services.js";

const PLATFORM_SETTINGS_CACHE_TTL_SECONDS = 10 * 60;

const platformSettingsCached = async () => {
  const cachedSettings = await redisServices.get(REDIS_KEYS.PLATFORM_SETTINGS);
  if (cachedSettings) {
    return cachedSettings;
  }

  const legacyCachedSettings = await redisServices.get(
    REDIS_KEYS.PLATFORM_SETTINGS_LEGACY,
  );
  if (legacyCachedSettings) {
    await redisServices.set(
      REDIS_KEYS.PLATFORM_SETTINGS,
      legacyCachedSettings,
      PLATFORM_SETTINGS_CACHE_TTL_SECONDS,
    );
    await redisServices.remove(REDIS_KEYS.PLATFORM_SETTINGS_LEGACY);
    return legacyCachedSettings;
  }

  return null;
};

const setPlatformSettingsCached = async (platformSettings) => {
  await redisServices.set(
    REDIS_KEYS.PLATFORM_SETTINGS,
    platformSettings,
    PLATFORM_SETTINGS_CACHE_TTL_SECONDS,
  );
};

const deletePlatformSettingsCached = async () => {
  await Promise.all([
    redisServices.remove(REDIS_KEYS.PLATFORM_SETTINGS),
    redisServices.remove(REDIS_KEYS.PLATFORM_SETTINGS_LEGACY),
  ]);
};

export { platformSettingsCached, setPlatformSettingsCached, deletePlatformSettingsCached };
