import nodemailer from 'nodemailer';
import Setting from '../models/Setting.js';

const SMTP_KEYS = [
  'smtpEnabled',
  'smtpHost',
  'smtpPort',
  'smtpSecure',
  'smtpUser',
  'smtpPassword',
  'smtpFromName',
  'smtpFromEmail',
];

export const getSmtpSettings = async () => {
  const rows = await Setting.find({ key: { $in: SMTP_KEYS } }).lean();
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const port = Number(map.smtpPort) || 587;
  return {
    enabled: map.smtpEnabled === true || map.smtpEnabled === 'true',
    host: String(map.smtpHost || '').trim(),
    port,
    secure: map.smtpSecure === true || map.smtpSecure === 'true' || port === 465,
    user: String(map.smtpUser || '').trim(),
    password: String(map.smtpPassword || ''),
    fromName: String(map.smtpFromName || 'The Great India News').trim(),
    fromEmail: String(map.smtpFromEmail || map.smtpUser || '').trim(),
  };
};

export const isSmtpConfigured = (smtp) =>
  Boolean(smtp?.enabled && smtp.host && smtp.port && smtp.fromEmail);

export const sendMail = async ({ to, subject, html, text }) => {
  const smtp = await getSmtpSettings();
  if (!isSmtpConfigured(smtp)) {
    const err = new Error('SMTP is not configured. Ask admin to set Email (SMTP) in Settings.');
    err.code = 'SMTP_NOT_CONFIGURED';
    throw err;
  }

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: smtp.user
      ? {
          user: smtp.user,
          pass: smtp.password,
        }
      : undefined,
  });

  const from = smtp.fromName
    ? `"${smtp.fromName.replace(/"/g, '')}" <${smtp.fromEmail}>`
    : smtp.fromEmail;

  await transporter.sendMail({
    from,
    to,
    subject,
    text: text || undefined,
    html: html || undefined,
  });

  return true;
};

export const getClientBaseUrl = () => {
  const raw = process.env.CLIENT_URL || 'http://localhost:5173';
  const first = String(raw).split(',')[0].trim();
  return first.replace(/\/$/, '') || 'http://localhost:5173';
};
