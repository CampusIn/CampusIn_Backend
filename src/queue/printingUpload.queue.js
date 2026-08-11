import { Queue } from "bullmq";
import { redis } from "../config/redis.js";

const PRINTING_UPLOAD_QUEUE_NAME = "printing-upload";

const printingUploadQueue = new Queue(PRINTING_UPLOAD_QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    removeOnComplete: 200,
    removeOnFail: 500,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
  },
});

export { PRINTING_UPLOAD_QUEUE_NAME, printingUploadQueue };
