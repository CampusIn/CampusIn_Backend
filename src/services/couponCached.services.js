import { REDIS_KEYS } from "../constants/redis.constants.js";
import redisServices from "./redis.services.js";

const getCouponCacheKey = (scope = "all") => {
    const normalizedScope = String(scope || "all").toLowerCase();
    return `${REDIS_KEYS.COUPON}:${normalizedScope}`;
}

const getCouponCached = async(scope = "all")=>{
    const cachedData = await redisServices.get(getCouponCacheKey(scope))
    if(cachedData){
        return cachedData
    }

    return null
}

const setCouponCached = async(scope = "all", coupon = [])=>{
    await redisServices.set(getCouponCacheKey(scope),coupon,300)
}

const deleteCouponCached = async()=>{
    await redisServices.remove(REDIS_KEYS.COUPON)
    await redisServices.removeByPattern(`${REDIS_KEYS.COUPON}:*`)
}

export {
    getCouponCached,
    setCouponCached,
    deleteCouponCached
}
