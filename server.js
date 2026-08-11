import app from "./src/app.js";
import connectDB from "./src/config/db.js";
import config from "./src/config/config.js";
import {redis} from "./src/config/redis.js";




const port = config.PORT || 3000;
//Connect to Database
connectDB();

if (process.env.RUN_INLINE_WORKERS !== "false") {
  await import("./src/workers/email.workers.js");
  await import("./src/workers/printing.workers.js");
  await import("./src/workers/printingUpload.workers.js");
}

try {
  await redis.set("health:boot", "ok", "EX", 30);
  const value = await redis.get("health:boot");
  console.log("Redis boot check:", value);
} catch (error) {
  console.warn("Redis boot check failed. Continuing startup:", error.message);
}

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
