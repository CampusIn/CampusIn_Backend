import mongoose from "mongoose";
import config from "./config.js";

const toPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
};

const ensurePrintingUploadStorageKeyIndex = async () => {
  const collection = mongoose.connection.db.collection("printinguploads");
  const indexes = await collection.indexes();
  const storageKeyIndex = indexes.find((index) => index.name === "storageKey_1");

  if (
    storageKeyIndex &&
    !storageKeyIndex.partialFilterExpression?.storageKey &&
    storageKeyIndex.unique
  ) {
    await collection.dropIndex("storageKey_1");
    console.log("Dropped legacy storageKey_1 index on printinguploads");
  }

  await collection.createIndex(
    { storageKey: 1 },
    {
      name: "storageKey_1",
      unique: true,
      partialFilterExpression: {
        storageKey: { $type: "string" },
      },
    },
  );
};

const connectDB = async () => {
  try {
    await mongoose.connect(config.MONGO_URI, {
      maxPoolSize: toPositiveInt(process.env.MONGO_MAX_POOL_SIZE, 20),
      minPoolSize: toPositiveInt(process.env.MONGO_MIN_POOL_SIZE, 1),
      serverSelectionTimeoutMS: toPositiveInt(
        process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS,
        5000,
      ),
      socketTimeoutMS: toPositiveInt(process.env.MONGO_SOCKET_TIMEOUT_MS, 45000),
      connectTimeoutMS: toPositiveInt(process.env.MONGO_CONNECT_TIMEOUT_MS, 10000),
      maxIdleTimeMS: toPositiveInt(process.env.MONGO_MAX_IDLE_TIME_MS, 30000),
      autoIndex: process.env.NODE_ENV !== "production",
    });

    await ensurePrintingUploadStorageKeyIndex();
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.log("Error connecting to MongoDB:", error);
  }
};

export default connectDB;
