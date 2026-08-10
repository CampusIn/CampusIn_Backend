import printingConfigModel from "../models/printingConfig.models.js";

const getDefaultConfigPayload = () => ({
  key: "default",
  pricing: {
    bwPerPage: 2,
    colorPerPage: 5,
    duplexMultiplier: 1,
  },
  limits: {
    maxFilesPerOrder: 10,
    maxFileSizeBytes: 15 * 1024 * 1024,
    maxTotalSizeBytes: 60 * 1024 * 1024,
    maxPagesPerOrder: 300,
    maxCopies: 20,
    uploadTtlHours: 24,
    fileRetentionDays: 14,
  },
});

const ensurePrintingConfig = async () => {
  let config = await printingConfigModel.findOne({ key: "default" });
  if (!config) {
    config = await printingConfigModel.create(getDefaultConfigPayload());
  }
  return config;
};

export { ensurePrintingConfig };
