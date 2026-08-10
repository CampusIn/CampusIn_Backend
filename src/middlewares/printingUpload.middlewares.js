import multer from "multer";

const printingUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024,
    files: 20,
  },
});

export default printingUpload;
