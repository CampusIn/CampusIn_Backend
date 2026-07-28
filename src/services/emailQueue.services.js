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
      removeOnComplete: true,
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
      removeOnComplete: true,
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
    removeOnComplete:true,
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
      removeOnComplete: true,
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
      removeOnComplete: true,
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
};
