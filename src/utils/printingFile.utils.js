import crypto from "crypto";
import path from "path";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "application/pdf",
]);

const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "pdf"]);

const getExtensionFromName = (filename = "") => {
  const extension = path.extname(filename).replace(".", "").toLowerCase();
  return extension;
};

const sha256FromBuffer = (buffer) => {
  return crypto.createHash("sha256").update(buffer).digest("hex");
};

const isPdfBuffer = (buffer) => {
  if (!buffer || buffer.length < 5) {
    return false;
  }
  return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
};

const isPngBuffer = (buffer) => {
  if (!buffer || buffer.length < 8) {
    return false;
  }
  const signature = buffer.subarray(0, 8);
  return signature.equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
};

const isJpegBuffer = (buffer) => {
  if (!buffer || buffer.length < 4) {
    return false;
  }
  return (
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[buffer.length - 2] === 0xff &&
    buffer[buffer.length - 1] === 0xd9
  );
};

const inferMimeFromBuffer = (buffer) => {
  if (isPdfBuffer(buffer)) {
    return "application/pdf";
  }
  if (isPngBuffer(buffer)) {
    return "image/png";
  }
  if (isJpegBuffer(buffer)) {
    return "image/jpeg";
  }
  return null;
};

const extractPdfPageCount = (buffer) => {
  if (!isPdfBuffer(buffer)) {
    throw new Error("Invalid PDF signature");
  }

  const text = buffer.toString("latin1");
  const matches = text.match(/\/Type\s*\/Page(?!s)/g);
  const count = matches ? matches.length : 0;

  if (count < 1) {
    throw new Error("Unable to read PDF pages");
  }

  return count;
};

const validateUploadMeta = ({ originalName, mimeType, buffer }) => {
  const extension = getExtensionFromName(originalName);
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    throw new Error("Unsupported file extension");
  }

  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error("Unsupported MIME type");
  }

  const detectedMime = inferMimeFromBuffer(buffer);
  if (!detectedMime) {
    throw new Error("Unable to detect file type");
  }

  const mimeGroup = mimeType === "image/jpg" ? "image/jpeg" : mimeType;
  if (detectedMime !== mimeGroup) {
    throw new Error("File content does not match MIME type");
  }

  if ((extension === "pdf" && detectedMime !== "application/pdf") ||
      (extension !== "pdf" && detectedMime === "application/pdf")) {
    throw new Error("File extension and content mismatch");
  }

  return {
    extension,
    detectedMime,
  };
};

const getPageCountForFile = ({ detectedMime, buffer }) => {
  if (detectedMime === "application/pdf") {
    return extractPdfPageCount(buffer);
  }
  return 1;
};

export {
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS,
  validateUploadMeta,
  getPageCountForFile,
  sha256FromBuffer,
};
