import { REDIS_KEYS } from "../constants/redis.constants.js";

let emailQueuePromise;

const getEmailQueue = async () => {
  if (!emailQueuePromise) {
    emailQueuePromise = import("../queue/email.queue.js").then(
      ({ emailQueue }) => emailQueue,
    );
  }

  return emailQueuePromise;
};

const queueOTPEmail = async ({ to, subject, text, otpHtml }) => {
  const emailQueue = await getEmailQueue();
  return emailQueue.add(
    REDIS_KEYS.SEND_OTP,
    {
      to,
      subject,
      text,
      otpHtml,
    },
    {
      jobId: `otp-${to}-${Date.now()}`,
      delay: 0,
    },
  );
};

const queueWelcomeEmail = async ({ to, subject, text, welcomeHtml }) => {
  const emailQueue = await getEmailQueue();
  return emailQueue.add(
    REDIS_KEYS.WELCOME,
    {
      to,
      subject,
      text,
      welcomeHtml,
    },
    {
      jobId: `wel-${to}-${Date.now()}`,
      delay: 0,
    },
  );
};

const queueForgotEmail = async({to,subject,text,forgotHtml})=>{
  const emailQueue = await getEmailQueue();
  return emailQueue.add(REDIS_KEYS.FORGOT_PASSWORD,{
    to,
    subject,
    text,
    forgotHtml
  },{
    jobId: `for-${to}-${Date.now()}`,
    delay:0
  })
}

const queueRepairRequestEstimateEmail = async ({
  to,
  subject,
  text,
  estimateHtml,
}) => {
  const emailQueue = await getEmailQueue();
  return emailQueue.add(
    REDIS_KEYS.REPAIR_REQUEST_ESTIMATE,
    {
      to,
      subject,
      text,
      estimateHtml,
    },
    {
      jobId: `estimate-${to}-${Date.now()}`,
      delay: 0,
    },
  );
};

const queueReminderEmail = async ({ to, subject, text, reminderHtml }) => {
  const emailQueue = await getEmailQueue();
  return emailQueue.add(
    REDIS_KEYS.REMINDER,
    {
      to,
      subject,
      text,
      reminderHtml,
    },
    {
      jobId: `rem-${to}-${Date.now()}`,
      delay: 0,
    },
  );
};

const queueVendorNewOrderEmail = async ({ to, subject, text, vendorOrderHtml }) => {
  const emailQueue = await getEmailQueue();
  return emailQueue.add(
    REDIS_KEYS.VENDOR_NEW_ORDER,
    {
      to,
      subject,
      text,
      vendorOrderHtml,
    },
    {
      jobId: `vendor-order-${to}-${Date.now()}`,
      delay: 0,
    },
  );
};

const queueAdminMarketplaceOrderEmail = async ({
  to,
  subject,
  text,
  adminMarketplaceOrderHtml,
}) => {
  const emailQueue = await getEmailQueue();
  return emailQueue.add(
    REDIS_KEYS.ADMIN_MARKETPLACE_NEW_ORDER,
    {
      to,
      subject,
      text,
      adminMarketplaceOrderHtml,
    },
    {
      jobId: `admin-marketplace-order-${to}-${Date.now()}`,
      delay: 0,
    },
  );
};

const queueDeliveryAssignmentEmail = async ({
  to,
  subject,
  text,
  deliveryAssignmentHtml,
}) => {
  const emailQueue = await getEmailQueue();
  return emailQueue.add(
    REDIS_KEYS.DELIVERY_ASSIGNMENT,
    {
      to,
      subject,
      text,
      deliveryAssignmentHtml,
    },
    {
      jobId: `delivery-assignment-${to}-${Date.now()}`,
      delay: 0,
    },
  );
};

const queueAdminRepairRequestSubmittedEmail = async ({
  to,
  subject,
  text,
  repairRequestSubmittedHtml,
}) => {
  const emailQueue = await getEmailQueue();
  return emailQueue.add(
    REDIS_KEYS.ADMIN_REPAIR_REQUEST_SUBMITTED,
    {
      to,
      subject,
      text,
      repairRequestSubmittedHtml,
    },
    {
      jobId: `admin-repair-submitted-${to}-${Date.now()}`,
      delay: 0,
    },
  );
};

const queueAdminRepairPriceDecisionEmail = async ({
  to,
  subject,
  text,
  repairPriceDecisionHtml,
}) => {
  const emailQueue = await getEmailQueue();
  return emailQueue.add(
    REDIS_KEYS.ADMIN_REPAIR_PRICE_DECISION,
    {
      to,
      subject,
      text,
      repairPriceDecisionHtml,
    },
    {
      jobId: `admin-repair-decision-${to}-${Date.now()}`,
      delay: 0,
    },
  );
};

const queuePrintingOrderCreatedEmail = async ({
  to,
  subject,
  text,
  printingOrderCreatedHtml,
}) => {
  const emailQueue = await getEmailQueue();
  return emailQueue.add(
    REDIS_KEYS.PRINTING_ORDER_CREATED,
    {
      to,
      subject,
      text,
      printingOrderCreatedHtml,
    },
    {
      jobId: `printing-created-${to}-${Date.now()}`,
      delay: 0,
    },
  );
};

const queuePrintingOrderStatusUpdatedEmail = async ({
  to,
  subject,
  text,
  printingOrderStatusHtml,
}) => {
  const emailQueue = await getEmailQueue();
  return emailQueue.add(
    REDIS_KEYS.PRINTING_ORDER_STATUS_UPDATED,
    {
      to,
      subject,
      text,
      printingOrderStatusHtml,
    },
    {
      jobId: `printing-status-${to}-${Date.now()}`,
      delay: 0,
    },
  );
};

const queueAdminPrintingOrderCreatedEmail = async ({
  to,
  subject,
  text,
  adminPrintingOrderCreatedHtml,
}) => {
  const emailQueue = await getEmailQueue();
  return emailQueue.add(
    REDIS_KEYS.ADMIN_PRINTING_ORDER_CREATED,
    {
      to,
      subject,
      text,
      adminPrintingOrderCreatedHtml,
    },
    {
      jobId: `admin-printing-created-${to}-${Date.now()}`,
      delay: 0,
    },
  );
};

export default {
  queueOTPEmail,
  queueWelcomeEmail,
  queueForgotEmail,
  queueRepairRequestEstimateEmail,
  queueReminderEmail,
  queueVendorNewOrderEmail,
  queueAdminMarketplaceOrderEmail,
  queueDeliveryAssignmentEmail,
  queueAdminRepairRequestSubmittedEmail,
  queueAdminRepairPriceDecisionEmail,
  queuePrintingOrderCreatedEmail,
  queuePrintingOrderStatusUpdatedEmail,
  queueAdminPrintingOrderCreatedEmail,
};
