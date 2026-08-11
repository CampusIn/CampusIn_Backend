import connectDB from "../config/db.js";

await connectDB();
await import("./email.workers.js");

console.info("Email worker started");
