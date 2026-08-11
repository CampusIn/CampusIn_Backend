import connectDB from "../config/db.js";

await connectDB();
await import("./printingUpload.workers.js");

console.info("Printing upload worker started");
