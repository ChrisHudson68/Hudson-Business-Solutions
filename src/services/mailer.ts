import nodemailer from 'nodemailer';
import { getEnv } from '../config/env.js';

export interface SendMailInput {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
}

export interface SendMailResult {
  messageId: string;
}

let cachedTransporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (cachedTransporter) return cachedTransporter;

  const env = getEnv();

  if (!env.smtpEnabled) {
    throw new Error('SMTP is not enabled.');
  }

  cachedTransporter = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure,
    auth: {
      user: env.smtpUser,
      pass: env.smtpPass,
    },
  });

  return cachedTransporter;
}

export async function sendMail(input: SendMailInput): Promise<SendMailResult> {
  const env = getEnv();
  const transporter = getTransporter();

  const info = await transporter.sendMail({
    from: `"${env.smtpFromName}" <${env.smtpFromEmail}>`,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
    replyTo: input.replyTo || undefined,
  });

  return {
    messageId: String(info.messageId || ''),
  };
}

export default {
  sendMail,
};