import config from "../config/config.js";
import nodemailer from "nodemailer";

const smtp2goPort = Number(config.SMTP2GO_PORT);

const transporter = nodemailer.createTransport({
  host: config.SMTP2GO_HOST,
  port: smtp2goPort,
  secure: smtp2goPort === 465,
  auth: {
    user: config.SMTP2GO_USER,
    pass: config.SMTP2GO_PASS,
  },
});

const sendEmail = async (to, subject, text, html) => {
  const info = await transporter.sendMail({
    from: `${config.SMTP2GO_FROM_NAME} <${config.SMTP2GO_FROM_EMAIL}>`,
    to,
    subject,
    text,
    html,
  });

  return info;
};

export { sendEmail };
