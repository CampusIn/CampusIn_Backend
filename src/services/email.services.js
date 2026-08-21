import config from "../config/config.js";
import nodemailer from "nodemailer";

const zeptoMailPort = Number(config.ZEPTOMAIL_PORT);

const transporter = nodemailer.createTransport({
  host: config.ZEPTOMAIL_HOST,
  port: zeptoMailPort,
  secure: zeptoMailPort === 465,
  auth: {
    user: config.ZEPTOMAIL_USER,
    pass: config.ZEPTOMAIL_PASS,
  },
});

const sendEmail = async (to, subject, text, html) => {
  const info = await transporter.sendMail({
    from: `${config.ZEPTOMAIL_FROM_NAME} <${config.ZEPTOMAIL_FROM_EMAIL}>`,
    to,
    subject,
    text,
    html,
  });

  return info;
};

export { sendEmail };
