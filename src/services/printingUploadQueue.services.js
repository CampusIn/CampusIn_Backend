let printingUploadQueuePromise;

const getPrintingUploadQueue = async () => {
  if (!printingUploadQueuePromise) {
    printingUploadQueuePromise = import("../queue/printingUpload.queue.js").then(
      ({ printingUploadQueue }) => printingUploadQueue,
    );
  }

  return printingUploadQueuePromise;
};

const queuePrintingUploadJob = async ({ uploadId, userId }) => {
  const printingUploadQueue = await getPrintingUploadQueue();
  return printingUploadQueue.add(
    "process-printing-upload",
    {
      uploadId: String(uploadId),
      userId: String(userId),
    },
    {
      jobId: `printing-upload-${uploadId}`,
      delay: 0,
    },
  );
};

const removePrintingUploadJobIfPending = async (jobId) => {
  if (!jobId) {
    return false;
  }

  const printingUploadQueue = await getPrintingUploadQueue();
  const job = await printingUploadQueue.getJob(jobId);
  if (!job) {
    return false;
  }

  const state = await job.getState();
  if (["active", "completed"].includes(state)) {
    return false;
  }

  await job.remove();
  return true;
};

export { queuePrintingUploadJob, removePrintingUploadJobIfPending };
