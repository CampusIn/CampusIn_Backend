import Redis from "ioredis";
import config from "../config/config.js"

const isTestEnvironment = process.env.NODE_ENV === "test" || Boolean(process.env.JEST_WORKER_ID);

const redis = new Redis(config.REDIS_URL,{
    maxRetriesPerRequest: null,
    enableReadyCheck:true,
    lazyConnect: isTestEnvironment
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