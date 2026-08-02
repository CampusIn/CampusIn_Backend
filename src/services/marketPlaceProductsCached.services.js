import { REDIS_KEYS } from "../constants/redis.constants.js";
import redisServices from "./redis.services.js";
import { deleteMarketPlaceProductSuggestionsCached } from "./marketPlaceProductSuggestionsCached.services.js";

const normaliseCacheValue = (value) => {
    if (value === undefined || value === null || value === "") {
        return "all"
    }

    return encodeURIComponent(String(value).trim().toLowerCase()) || "all"
}

const getProductsListCacheKey = ({
    page,
    limit,
    search,
    category,
    condition,
    minPrice,
    maxPrice
}) => {
    return REDIS_KEYS.MARKETPLACE_PRODUCTS(
        page,
        limit,
        normaliseCacheValue(search),
        normaliseCacheValue(category),
        normaliseCacheValue(condition),
        normaliseCacheValue(minPrice),
        normaliseCacheValue(maxPrice)
    )
}

const getProductCached = async (id)=>{
    const cachedData = await redisServices.get(REDIS_KEYS.MARKETPLACE_PRODUCTS_ID(id))
    if(cachedData){
        return cachedData
    }

    return null
}

const setProductCached = async (id,products) =>{
    await redisServices.set(REDIS_KEYS.MARKETPLACE_PRODUCTS_ID(id),products,600)
}

const getProductsCached = async (params)=>{
    const cachedData = await redisServices.get(getProductsListCacheKey(params))
    if(cachedData){
        return cachedData
    }

    return null
}

const setProductsCached = async (params,products)=>{
    await redisServices.set(getProductsListCacheKey(params),products,600)
}

const deleteProductCached = async (id) =>{
    if(id){
        await redisServices.remove(REDIS_KEYS.MARKETPLACE_PRODUCTS_ID(id))
    }
    await Promise.all([
        redisServices.removeByPattern(REDIS_KEYS.MARKETPLACE_PRODUCTS_PATTERN),
        deleteMarketPlaceProductSuggestionsCached(),
    ])
}

export {
    getProductCached,
    setProductCached,
    getProductsCached,
    setProductsCached,
    deleteProductCached
}
