import { Worker } from "bullmq";
import {redis} from "../config/redis.js";
import { REDIS_KEYS } from "../constants/redis.constants.js";
import { sendEmail } from "../services/email.services.js";

const EMAIL_JOB_HANDLERS = {
  SEND_OTP: async ({ to, subject, text, otpHtml }) =>
    sendEmail(to, subject, text, otpHtml),
  WELCOME: async ({ to, subject, text, welcomeHtml }) =>
    sendEmail(to, subject, text, welcomeHtml),
  FORGOT_PASSWORD: async ({ to, subject, text, forgotHtml }) =>
    sendEmail(to, subject, text, forgotHtml),
  REPAIR_REQUEST_ESTIMATE: async ({ to, subject, text, estimateHtml }) =>
    sendEmail(to, subject, text, estimateHtml),
  REMINDER: async ({ to, subject, text, reminderHtml }) =>
    sendEmail(to, subject, text, reminderHtml),
  VENDOR_NEW_ORDER: async ({ to, subject, text, vendorOrderHtml }) =>
    sendEmail(to, subject, text, vendorOrderHtml),
  ADMIN_MARKETPLACE_NEW_ORDER: async ({ to, subject, text, adminMarketplaceOrderHtml }) =>
    sendEmail(to, subject, text, adminMarketplaceOrderHtml),
  DELIVERY_ASSIGNMENT: async ({ to, subject, text, deliveryAssignmentHtml }) =>
    sendEmail(to, subject, text, deliveryAssignmentHtml),
  ADMIN_REPAIR_REQUEST_SUBMITTED: async ({ to, subject, text, repairRequestSubmittedHtml }) =>
    sendEmail(to, subject, text, repairRequestSubmittedHtml),
  ADMIN_REPAIR_PRICE_DECISION: async ({ to, subject, text, repairPriceDecisionHtml }) =>
    sendEmail(to, subject, text, repairPriceDecisionHtml),
  PRINTING_ORDER_CREATED: async ({ to, subject, text, printingOrderCreatedHtml }) =>
    sendEmail(to, subject, text, printingOrderCreatedHtml),
  PRINTING_ORDER_STATUS_UPDATED: async ({ to, subject, text, printingOrderStatusHtml }) =>
    sendEmail(to, subject, text, printingOrderStatusHtml),
  ADMIN_PRINTING_ORDER_CREATED: async ({ to, subject, text, adminPrintingOrderCreatedHtml }) =>
    sendEmail(to, subject, text, adminPrintingOrderCreatedHtml),
};

const EMAIL_JOB_ALIASES = {
  [REDIS_KEYS.SEND_OTP]: "SEND_OTP",
  OTP: "SEND_OTP",
  [REDIS_KEYS.WELCOME]: "WELCOME",
  [REDIS_KEYS.FORGOT_PASSWORD]: "FORGOT_PASSWORD",
  FORGOT: "FORGOT_PASSWORD",
  [REDIS_KEYS.REPAIR_REQUEST_ESTIMATE]: "REPAIR_REQUEST_ESTIMATE",
  REPAIR_ESTIMATE: "REPAIR_REQUEST_ESTIMATE",
  [REDIS_KEYS.REMINDER]: "REMINDER",
  [REDIS_KEYS.VENDOR_NEW_ORDER]: "VENDOR_NEW_ORDER",
  VENDOR_ORDER: "VENDOR_NEW_ORDER",
  [REDIS_KEYS.ADMIN_MARKETPLACE_NEW_ORDER]: "ADMIN_MARKETPLACE_NEW_ORDER",
  ADMIN_MARKETPLACE_ORDER: "ADMIN_MARKETPLACE_NEW_ORDER",
  [REDIS_KEYS.DELIVERY_ASSIGNMENT]: "DELIVERY_ASSIGNMENT",
  DELIVERY_ASSIGN: "DELIVERY_ASSIGNMENT",
  DELIVERYASSIGNMENT: "DELIVERY_ASSIGNMENT",
  [REDIS_KEYS.ADMIN_REPAIR_REQUEST_SUBMITTED]: "ADMIN_REPAIR_REQUEST_SUBMITTED",
  ADMIN_REPAIR_SUBMITTED: "ADMIN_REPAIR_REQUEST_SUBMITTED",
  [REDIS_KEYS.ADMIN_REPAIR_PRICE_DECISION]: "ADMIN_REPAIR_PRICE_DECISION",
  ADMIN_REPAIR_DECISION: "ADMIN_REPAIR_PRICE_DECISION",
  [REDIS_KEYS.PRINTING_ORDER_CREATED]: "PRINTING_ORDER_CREATED",
  [REDIS_KEYS.PRINTING_ORDER_STATUS_UPDATED]: "PRINTING_ORDER_STATUS_UPDATED",
  [REDIS_KEYS.ADMIN_PRINTING_ORDER_CREATED]: "ADMIN_PRINTING_ORDER_CREATED",
};

const normalizeJobName = (jobName) => {
  if (typeof jobName !== "string") {
    return jobName;
  }

  return jobName
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^A-Z0-9_]/g, "");
};

const inferJobNameFromPayload = (data = {}) => {
  if (data.otpHtml) return "SEND_OTP";
  if (data.welcomeHtml) return "WELCOME";
  if (data.forgotHtml) return "FORGOT_PASSWORD";
  if (data.estimateHtml) return "REPAIR_REQUEST_ESTIMATE";
  if (data.reminderHtml) return "REMINDER";
  if (data.vendorOrderHtml) return "VENDOR_NEW_ORDER";
  if (data.adminMarketplaceOrderHtml) return "ADMIN_MARKETPLACE_NEW_ORDER";
  if (data.deliveryAssignmentHtml) return "DELIVERY_ASSIGNMENT";
  if (data.repairRequestSubmittedHtml) return "ADMIN_REPAIR_REQUEST_SUBMITTED";
  if (data.repairPriceDecisionHtml) return "ADMIN_REPAIR_PRICE_DECISION";
  if (data.printingOrderCreatedHtml) return "PRINTING_ORDER_CREATED";
  if (data.printingOrderStatusHtml) return "PRINTING_ORDER_STATUS_UPDATED";
  if (data.adminPrintingOrderCreatedHtml) return "ADMIN_PRINTING_ORDER_CREATED";

  return null;
};

const getEmailHtmlFromPayload = (data = {}) => {
  const htmlKey = Object.keys(data).find(
    (key) => key.toLowerCase().endsWith("html") && typeof data[key] === "string",
  );

  return htmlKey ? data[htmlKey] : null;
};

const emailWorker = new Worker(
  "email",
  async (job) => {
    const normalizedJobName = normalizeJobName(job.name);

    const canonicalJobName = EMAIL_JOB_ALIASES[normalizedJobName] || normalizedJobName;
    const inferredJobName = inferJobNameFromPayload(job.data);
    const resolvedJobName = EMAIL_JOB_HANDLERS[canonicalJobName]
      ? canonicalJobName
      : inferredJobName;
    const handler = EMAIL_JOB_HANDLERS[resolvedJobName];

    if (!handler) {
      const { to, subject, text } = job.data || {};
      const fallbackHtml = getEmailHtmlFromPayload(job.data);

      if (to && subject && text && fallbackHtml) {
        console.warn(
          `Unknown email job: ${job.name}. Processed with generic fallback handler.`,
        );
        await sendEmail(to, subject, text, fallbackHtml);
        return;
      }

      console.warn(`Skipping unknown email job: ${job.name}`);
      return;
    }

    await handler(job.data);
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
