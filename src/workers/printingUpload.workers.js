import { Worker } from "bullmq";
import { redis } from "../config/redis.js";
import printingUploadModel from "../models/printingUpload.models.js";
import { uploadPrintingBuffer } from "../services/printingStorage.services.js";
import {
  deleteStagedPrintingFile,
  getStagedPrintingFileBuffer,
} from "../services/printingStaging.services.js";
import {
  PRINTING_UPLOAD_QUEUE_NAME,
} from "../queue/printingUpload.queue.js";
import {
  getPageCountForFile,
  sha256FromBuffer,
  validateUploadMeta,
} from "../utils/printingFile.utils.js";
import { ensurePrintingConfig } from "../services/printingConfig.services.js";

const getUploadWorkerConcurrency = () => {
  const concurrency = Number(process.env.PRINTING_UPLOAD_WORKER_CONCURRENCY);
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    return 5;
  }
  return concurrency;
};

const printingUploadWorker = new Worker(
  PRINTING_UPLOAD_QUEUE_NAME,
  async (job) => {
    const { uploadId, userId } = job.data || {};
    if (!uploadId || !userId) {
      throw new Error("Invalid upload job payload");
    }

    const uploadRecord = await printingUploadModel.findOne({
      _id: uploadId,
      user: userId,
    });

    if (!uploadRecord) {
      throw new Error("Upload record not found");
    }

    if (uploadRecord.uploadStatus === "DELETED") {
      if (uploadRecord.stagingFileId) {
        await deleteStagedPrintingFile(uploadRecord.stagingFileId).catch(() => null);
      }
      return;
    }

    if (["UPLOADED", "ATTACHED"].includes(uploadRecord.uploadStatus)) {
      return;
    }

    uploadRecord.uploadStatus = "PROCESSING";
    uploadRecord.processingStartedAt = new Date();
    uploadRecord.queueJobId = job.id;
    uploadRecord.failureReason = null;
    await uploadRecord.save();

    const currentStagingFileId = uploadRecord.stagingFileId;
    const stagedBuffer = await getStagedPrintingFileBuffer(currentStagingFileId);

    const validated = validateUploadMeta({
      originalName: uploadRecord.originalName,
      mimeType: uploadRecord.mimeType,
      buffer: stagedBuffer,
    });

    const pageCount = getPageCountForFile({
      detectedMime: validated.detectedMime,
      buffer: stagedBuffer,
    });

    const checksumSha256 = sha256FromBuffer(stagedBuffer);
    const resourceType = validated.detectedMime === "application/pdf" ? "raw" : "image";
    const publicId = `u_${userId}_${Date.now()}_${Math.round(Math.random() * 1e8)}`;
    const storage = await uploadPrintingBuffer({
      buffer: stagedBuffer,
      mimeType: validated.detectedMime,
      resourceType,
      publicId,
    });

    const printingConfig = await ensurePrintingConfig();
    const expiresAt = new Date(
      Date.now() + printingConfig.limits.uploadTtlHours * 60 * 60 * 1000,
    );

    uploadRecord.mimeType = validated.detectedMime;
    uploadRecord.extension = validated.extension;
    uploadRecord.storageKey = storage.storageKey;
    uploadRecord.resourceType = storage.resourceType;
    uploadRecord.pageCount = pageCount;
    uploadRecord.checksumSha256 = checksumSha256;
    uploadRecord.uploadStatus = "UPLOADED";
    uploadRecord.expiresAt = expiresAt;
    uploadRecord.stagingFileId = null;
    uploadRecord.processedAt = new Date();
    await uploadRecord.save();

    await deleteStagedPrintingFile(currentStagingFileId).catch(() => null);
  },
  {
    connection: redis,
    concurrency: getUploadWorkerConcurrency(),
  },
);

printingUploadWorker.on("completed", (job) => {
  console.info(`Printing upload completed: ${job.id}`);
});

printingUploadWorker.on("failed", async (job, error) => {
  console.error("Printing upload failed:", job?.id, error.message);

  const uploadId = job?.data?.uploadId;
  if (!uploadId) {
    return;
  }

  const uploadRecord = await printingUploadModel.findById(uploadId);
  if (!uploadRecord) {
    return;
  }

  const attemptsMade = Number(job?.attemptsMade || 0);
  const attemptsConfigured = Number(job?.opts?.attempts || 1);
  if (attemptsMade < attemptsConfigured) {
    return;
  }

  uploadRecord.uploadStatus = "FAILED";
  uploadRecord.failureReason = error.message;
  uploadRecord.processedAt = new Date();
  await uploadRecord.save();

  if (uploadRecord.stagingFileId) {
    await deleteStagedPrintingFile(uploadRecord.stagingFileId).catch(() => null);
    uploadRecord.stagingFileId = null;
    await uploadRecord.save();
  }
});

printingUploadWorker.on("error", (error) => {
  console.error("Printing upload worker error:", error.message);
});

export default { printingUploadWorker };
