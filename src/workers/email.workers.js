import { Worker } from "bullmq";
import {redis} from "../config/redis.js";
import { REDIS_KEYS } from "../constants/redis.constants.js";
import { sendEmail } from "../services/email.services.js";

const emailWorker = new Worker(
  "email",
  async (job) => {
    switch (job.name) {
      case REDIS_KEYS.SEND_OTP: {
        const { to, subject, text, otpHtml } = job.data;
        await sendEmail(to, subject, text, otpHtml);
        break;
      }
      case REDIS_KEYS.WELCOME: {
        const { to, subject, text, welcomeHtml } = job.data;
        await sendEmail(to, subject, text, welcomeHtml);
        break;
      }

      case REDIS_KEYS.FORGOT_PASSWORD: {
        const {to,subject,text,forgotHtml} = job.data
        await sendEmail(to,subject,text,forgotHtml)
        break;
      }
      case REDIS_KEYS.REPAIR_REQUEST_ESTIMATE: {
        const { to, subject, text, estimateHtml } = job.data;
        await sendEmail(to, subject, text, estimateHtml);
        break;
      }
      case REDIS_KEYS.REMINDER: {
        const { to, subject, text, reminderHtml } = job.data;
        await sendEmail(to, subject, text, reminderHtml);
        break;
      }
      default:
        throw new Error(`Unknown email job: ${job.name}`);
    }
  },
  { connection: redis },
);

emailWorker.on("completed",(job)=>{
    console.log(`Email sent: ${job.id}`)
})

emailWorker.on("failed",(job,error)=>{
    console.error(job?.id, error.message)
})

emailWorker.on("ready",()=>{
    console.log("Worker started successfully")
})

emailWorker.on("error",(error)=>{
    console.log("Email worker error:", error.message);
    
})

export default {emailWorker}
