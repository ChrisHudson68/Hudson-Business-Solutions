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
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    dnsTimeout: 10000,
  });

  return cachedTransporter;
}

function toErrorMessage(error: unknown): string {
  const err = error as { code?: string; response?: string; message?: string };
  const code = String(err?.code || '').trim().toUpperCase();
  const response = String(err?.response || '').trim();
  const message = String(err?.message || '').trim();

  if (code === 'EAUTH') {
    return 'SMTP authentication failed. Check the SMTP username and password on the server.';
  }

  if (code === 'ECONNECTION' || code === 'ESOCKET' || code === 'ETIMEDOUT') {
    return 'SMTP connection timed out. The server could not reach the mail provider in time.';
  }

  if (code === 'ECONNREFUSED') {
    return 'SMTP connection was refused. Check the SMTP host, port, and any server firewall or outbound mail restrictions.';
  }

  if (response) {
    return `SMTP rejected the message: ${response}`;
  }

  if (message) {
    return message;
  }

  return 'Unable to send email.';
}

export async function sendMail(input: SendMailInput): Promise<SendMailResult> {
  const env = getEnv();
  const transporter = getTransporter();

  try {
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
  } catch (error) {
    cachedTransporter = null;
    throw new Error(toErrorMessage(error));
  }
}

export default {
  sendMail,
};
