import Redis from "ioredis";
import config from "../config/config.js"

const isTestEnvironment = process.env.NODE_ENV === "test" || Boolean(process.env.JEST_WORKER_ID);

const commonRedisOptions = {
    maxRetriesPerRequest: null,
    enableReadyCheck:true,
    lazyConnect: isTestEnvironment,
    retryStrategy: (times) => Math.min(times * 200, 2000),
}

const redis = new Redis({
    host: config.REDIS_HOST,
    port: Number(config.REDIS_PORT),
    password: config.REDIS_PASSWORD,
    ...commonRedisOptions,
})

redis.on("connect",()=>{
    if (!isTestEnvironment) {
        console.log("Redis connected successfully");
    }
})

redis.on("ready",()=>{
    if (!isTestEnvironment) {
        console.log("Redis is ready to use");
    }
})

redis.on("error",(err)=>{
    if (!isTestEnvironment) {
        console.log("Redis connection error:", err.message);
    }
})

redis.on("close",()=>{
    if (!isTestEnvironment) {
        console.log("Redis connection closed");
    }
})

export {redis};
