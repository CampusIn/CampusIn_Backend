import { Worker } from "bullmq";
import { redis } from "../config/redis.js";
import { printingQueue } from "../queue/printing.queue.js";
import printingUploadModel from "../models/printingUpload.models.js";
import printingOrderModel from "../models/printingOrder.models.js";
import { deletePrintingFile } from "../services/printingStorage.services.js";

const CLEANUP_JOB_NAME = "cleanup-printing-files";

const cleanupExpiredUploads = async () => {
  const now = new Date();
  const expiredUploads = await printingUploadModel.find({
    uploadStatus: "UPLOADED",
    expiresAt: { $lte: now },
  });

  for (const upload of expiredUploads) {
    try {
      await deletePrintingFile({
        storageKey: upload.storageKey,
        resourceType: upload.resourceType,
      });
      upload.uploadStatus = "DELETED";
      upload.deletedAt = new Date();
      await upload.save();
    } catch (error) {
      console.error("Failed cleaning expired printing upload:", error.message);
    }
  }
};

const cleanupRetainedOrderFiles = async () => {
  const now = new Date();
  const orders = await printingOrderModel.find({
    "fileRetention.deleteAfter": { $lte: now },
    "fileRetention.deletedAt": null,
  });

  for (const order of orders) {
    try {
      for (const file of order.files) {
        if (file.deletedAt) {
          continue;
        }
        await deletePrintingFile({
          storageKey: file.storageKey,
          resourceType: file.resourceType,
        });
        file.deletedAt = new Date();
      }

      order.fileRetention.deletedAt = new Date();
      await order.save();

      await printingUploadModel.updateMany(
        { printingOrder: order._id },
        {
          $set: {
            uploadStatus: "DELETED",
            deletedAt: new Date(),
          },
        },
      );
    } catch (error) {
      console.error("Failed cleaning retained printing order files:", error.message);
    }
  }
};

const printingWorker = new Worker(
  "printing-maintenance",
  async (job) => {
    if (job.name !== CLEANUP_JOB_NAME) {
      return;
    }

    await cleanupExpiredUploads();
    await cleanupRetainedOrderFiles();
  },
  { connection: redis },
);

printingWorker.on("completed", (job) => {
  console.info(`Printing maintenance completed: ${job.id}`);
});

printingWorker.on("failed", (job, error) => {
  console.error("Printing maintenance failed:", job?.id, error.message);
});

printingWorker.on("error", (error) => {
  console.error("Printing maintenance worker error:", error.message);
});

const schedulePrintingCleanupJob = async () => {
  try {
    await printingQueue.add(
      CLEANUP_JOB_NAME,
      {},
      {
        jobId: CLEANUP_JOB_NAME,
        repeat: {
          every: 30 * 60 * 1000,
        },
      },
    );
  } catch (error) {
    if (!String(error.message).includes("Job already exists")) {
      console.error("Failed to schedule printing cleanup job:", error.message);
    }
  }
};

await schedulePrintingCleanupJob();

export default { printingWorker };
