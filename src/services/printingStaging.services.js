import mongoose from "mongoose";

const STAGING_BUCKET_NAME = "printing_upload_staging";

const getBucket = () => {
  const db = mongoose.connection?.db;
  if (!db) {
    throw new Error("Database connection is not ready");
  }

  return new mongoose.mongo.GridFSBucket(db, {
    bucketName: STAGING_BUCKET_NAME,
  });
};

const stagePrintingFileBuffer = async ({ buffer, filename, metadata = {} }) => {
  const bucket = getBucket();

  return new Promise((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(filename, {
      contentType: metadata.mimeType,
      metadata,
    });

    uploadStream.on("error", reject);
    uploadStream.on("finish", () => {
      resolve(String(uploadStream.id));
    });

    uploadStream.end(buffer);
  });
};

const getStagedPrintingFileBuffer = async (stagingFileId) => {
  const bucket = getBucket();
  const objectId = new mongoose.Types.ObjectId(stagingFileId);

  return new Promise((resolve, reject) => {
    const chunks = [];
    const stream = bucket.openDownloadStream(objectId);

    stream.on("data", (chunk) => {
      chunks.push(chunk);
    });

    stream.on("error", reject);
    stream.on("end", () => {
      resolve(Buffer.concat(chunks));
    });
  });
};

const deleteStagedPrintingFile = async (stagingFileId) => {
  if (!stagingFileId) {
    return;
  }

  const bucket = getBucket();
  const objectId = new mongoose.Types.ObjectId(stagingFileId);

  try {
    await bucket.delete(objectId);
  } catch (error) {
    const isNotFoundError =
      error?.message?.includes("FileNotFound") || error?.code === "ENOENT";
    if (!isNotFoundError) {
      throw error;
    }
  }
};

export { stagePrintingFileBuffer, getStagedPrintingFileBuffer, deleteStagedPrintingFile };
