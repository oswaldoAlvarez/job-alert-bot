import nodemailer from "nodemailer";
import { config } from "../config.js";

type EmailPayload = {
  subject: string;
  text: string;
  html: string;
  to?: string;
};

const requiredSmtpFields = [
  ["SMTP_HOST", config.smtp.host],
  ["SMTP_USER", config.smtp.user],
  ["SMTP_PASSWORD", config.smtp.password],
  ["EMAIL_FROM", config.smtp.from],
  ["EMAIL_TO", config.smtp.to]
];

export const sendEmail = async (payload: EmailPayload): Promise<void> => {
  if (config.dryRun) {
    console.log(payload.text);
    return;
  }

  const missingFields = requiredSmtpFields
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missingFields.length > 0) {
    throw new Error(`Faltan variables SMTP: ${missingFields.join(", ")}`);
  }

  const transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.password
    }
  });

  await transporter.sendMail({
    from: config.smtp.from,
    to: payload.to ?? config.smtp.to,
    subject: payload.subject,
    text: payload.text,
    html: payload.html
  });
};
