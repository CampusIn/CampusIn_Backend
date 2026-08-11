import connectDB from "../config/db.js";

await connectDB();
await import("./printing.workers.js");

console.info("Printing maintenance worker started");
