import { Queue } from "bullmq";
import { redis } from "../config/redis.js";

const printingQueue = new Queue("printing-maintenance", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    removeOnComplete: 100,
    removeOnFail: 500,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
  },
});

export { printingQueue };
