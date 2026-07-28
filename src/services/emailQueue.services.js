import { emailQueue } from "../queue/email.queue.js";
import { REDIS_KEYS } from "../constants/redis.constants.js";

const queueOTPEmail = async ({ to, subject, text, otpHtml }) => {
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
