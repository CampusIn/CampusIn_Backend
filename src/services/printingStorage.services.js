import { v2 as cloudinary } from "cloudinary";
import config from "../config/config.js";

cloudinary.config({
  cloud_name: config.CLOUDINARY_NAME,
  api_key: config.CLOUDINARY_API_KEY,
  api_secret: config.CLOUDINARY_API_SECRET,
});

const uploadPrintingBuffer = async ({ buffer, mimeType, resourceType, publicId }) => {
  const dataUri = `data:${mimeType};base64,${buffer.toString("base64")}`;

  const response = await cloudinary.uploader.upload(dataUri, {
    resource_type: resourceType,
    folder: "campusin/printing",
    public_id: publicId,
    type: "private",
    overwrite: false,
    use_filename: false,
  });

  return {
    storageKey: response.public_id,
    resourceType: response.resource_type,
  };
};

const deletePrintingFile = async ({ storageKey, resourceType }) => {
  await cloudinary.uploader.destroy(storageKey, {
    resource_type: resourceType,
    type: "private",
    invalidate: true,
  });
};

const getSignedPrintingFileUrl = ({
  storageKey,
  resourceType,
  extension,
  expiresInSeconds = 300,
}) => {
  const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const format = extension || (resourceType === "raw" ? "pdf" : undefined);

  const signedUrl = cloudinary.utils.private_download_url(
    storageKey,
    format,
    {
      resource_type: resourceType,
      type: "private",
      expires_at: expiresAt,
      attachment: false,
    },
  );

  return {
    signedUrl,
    expiresAt,
  };
};

const downloadPrivatePrintingFile = async ({
  storageKey,
  resourceType,
  extension,
  expiresInSeconds = 60,
}) => {
  const { signedUrl } = getSignedPrintingFileUrl({
    storageKey,
    resourceType,
    extension,
    expiresInSeconds,
  });

  const response = await fetch(signedUrl);
  if (!response.ok) {
    throw new Error("Failed to download private printing file");
  }

  const arrayBuffer = await response.arrayBuffer();

  return {
    buffer: Buffer.from(arrayBuffer),
    contentType: response.headers.get("content-type"),
  };
};

export {
  uploadPrintingBuffer,
  deletePrintingFile,
  getSignedPrintingFileUrl,
  downloadPrivatePrintingFile,
};
