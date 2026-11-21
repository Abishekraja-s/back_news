import nodemailer from 'nodemailer';
import Setting from '../models/Setting.js';

const MAIL_KEYS = [
  'mailProvider',
  'resendApiKey',
  'brevoApiKey',
  'smtpEnabled',
  'smtpHost',
  'smtpPort',
  'smtpSecure',
  'smtpUser',
  'smtpPassword',
  'smtpFromName',
  'smtpFromEmail',
];

/**
 * Port 465 = implicit TLS (secure: true).
 * Port 587/25 = plain then STARTTLS (secure: false + requireTLS).
 * Mis-setting secure:true on 587 causes OpenSSL "wrong version number".
 */
const resolveTlsMode = (port, secureFlag) => {
  const p = Number(port) || 587;
  if (p === 465) {
    return { port: 465, secure: true, requireTLS: false };
  }
  if (p === 587 || p === 2587 || p === 25 || p === 2525) {
    return { port: p, secure: false, requireTLS: p === 587 || p === 2587 };
  }
  return {
    port: p,
    secure: secureFlag === true || secureFlag === 'true',
    requireTLS: false,
  };
};

const truthy = (v) => v === true || v === 'true';

export const getMailSettings = async () => {
  const rows = await Setting.find({ key: { $in: MAIL_KEYS } }).lean();
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const port = Number(map.smtpPort) || 587;
  const tls = resolveTlsMode(port, map.smtpSecure);

  const envResend = String(process.env.RESEND_API_KEY || '').trim();
  const envBrevo = String(process.env.BREVO_API_KEY || '').trim();
  const envFromEmail = String(process.env.MAIL_FROM_EMAIL || '').trim();
  const envFromName = String(process.env.MAIL_FROM_NAME || '').trim();

  return {
    provider: String(map.mailProvider || process.env.MAIL_PROVIDER || 'auto').trim().toLowerCase(),
    resendApiKey: String(map.resendApiKey || envResend || '').trim(),
    brevoApiKey: String(map.brevoApiKey || envBrevo || '').trim(),
    smtp: {
      enabled: truthy(map.smtpEnabled),
      host: String(map.smtpHost || '').trim(),
      port: tls.port,
      secure: tls.secure,
      requireTLS: tls.requireTLS,
      user: String(map.smtpUser || '').trim(),
      // Gmail app passwords are often copied with spaces — strip them
      password: String(map.smtpPassword || '').replace(/\s+/g, ''),
      fromName: String(map.smtpFromName || envFromName || 'The Great India News').trim(),
      fromEmail: String(map.smtpFromEmail || envFromEmail || map.smtpUser || '').trim(),
    },
  };
};

/** @deprecated use getMailSettings — kept for any older imports */
export const getSmtpSettings = async () => {
  const { smtp } = await getMailSettings();
  return { ...smtp, enabled: smtp.enabled };
};

export const isSmtpConfigured = (smtp) =>
  Boolean(smtp?.enabled && smtp.host && smtp.port && smtp.fromEmail);

const isResendConfigured = (cfg) => Boolean(cfg.resendApiKey && cfg.smtp.fromEmail);
const isBrevoConfigured = (cfg) => Boolean(cfg.brevoApiKey && cfg.smtp.fromEmail);

/** Prefer HTTPS APIs on Render/cloud hosts (SMTP 587/465 often blocked). */
const resolveProviderOrder = (cfg) => {
  const p = cfg.provider || 'auto';
  if (p === 'resend') return isResendConfigured(cfg) ? ['resend'] : [];
  if (p === 'brevo') return isBrevoConfigured(cfg) ? ['brevo'] : [];
  if (p === 'smtp') return isSmtpConfigured(cfg.smtp) ? ['smtp'] : [];

  // auto: API first (works on Render), then SMTP
  const order = [];
  if (isResendConfigured(cfg)) order.push('resend');
  if (isBrevoConfigured(cfg)) order.push('brevo');
  if (isSmtpConfigured(cfg.smtp)) order.push('smtp');
  return order;
};

/** Turn raw OpenSSL / network errors into admin-friendly copy */
export const formatSmtpError = (err) => {
  const raw = String(err?.message || err || '');
  const code = err?.code || '';

  if (code === 'SMTP_NOT_CONFIGURED' || code === 'MAIL_NOT_CONFIGURED') {
    return 'Email is not set up yet. On live (Render), use Resend or Brevo API in Admin → Settings — SMTP ports are often blocked.';
  }
  if (/wrong version number|ssl3_get_record|EPROTO/i.test(raw) || code === 'ESOCKET') {
    return 'SMTP SSL mismatch. Use port 587 with Secure OFF (STARTTLS), or port 465 with Secure ON. Prefer Resend/Brevo on live hosting.';
  }
  if (code === 'ENETUNREACH' || code === 'EHOSTUNREACH' || /ENETUNREACH|EHOSTUNREACH/i.test(raw)) {
    return 'Cannot reach the mail server. On Render, SMTP is often blocked — set Resend or Brevo API key in Admin → Settings.';
  }
  if (code === 'ETIMEDOUT' || code === 'ESOCKETTIMEDOUT' || /timeout/i.test(raw)) {
    return 'Mail server timed out. Live hosts (Render) block SMTP 587/465 — switch to Resend or Brevo API in Admin → Settings.';
  }
  if (code === 'GMAIL_APP_PASSWORD_REQUIRED') {
    return raw;
  }
  if (code === 'EAUTH' || /Invalid login|authentication failed|Username and Password not accepted/i.test(raw)) {
    return 'Gmail login rejected. In Admin → Settings use a 16-character Google App Password (Google Account → Security → App passwords), not your normal Gmail password. Or switch Mail provider to Resend.';
  }
  if (code === 'EENVELOPE' || (/sender|from/i.test(raw) && /not allowed|rejected/i.test(raw))) {
    return 'From address rejected. Use a verified sender domain (Resend/Brevo) or match your SMTP account.';
  }
  if (code === 'RESEND_FAILED' || code === 'BREVO_FAILED') {
    return raw.length > 200 ? raw.slice(0, 200) : raw;
  }
  if (raw.length > 160 || /openssl|ssl routines|c:\\ws\\deps/i.test(raw)) {
    return 'Could not send email. On live hosting prefer Resend/Brevo API; SMTP often times out behind firewalls.';
  }
  return raw || 'Could not send email. Check mail settings in Admin → Settings.';
};

const formatFrom = (smtp) =>
  smtp.fromName
    ? `"${smtp.fromName.replace(/"/g, '')}" <${smtp.fromEmail}>`
    : smtp.fromEmail;

const sendViaResend = async ({ to, subject, html, text }, cfg) => {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: formatFrom(cfg.smtp),
      to: [to],
      subject,
      html: html || undefined,
      text: text || undefined,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.message || body?.error || `Resend HTTP ${res.status}`;
    const err = new Error(String(msg));
    err.code = 'RESEND_FAILED';
    throw err;
  }
  return true;
};

const sendViaBrevo = async ({ to, subject, html, text }, cfg) => {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': cfg.brevoApiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: {
        name: cfg.smtp.fromName || 'The Great India News',
        email: cfg.smtp.fromEmail,
      },
      to: [{ email: to }],
      subject,
      htmlContent: html || undefined,
      textContent: text || undefined,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.message || body?.error?.message || `Brevo HTTP ${res.status}`;
    const err = new Error(String(msg));
    err.code = 'BREVO_FAILED';
    throw err;
  }
  return true;
};

const isGmailHost = (host = '') => /gmail\.com$/i.test(String(host).trim());

const sendViaSmtp = async ({ to, subject, html, text }, smtp) => {
  const pass = String(smtp.password || '').replace(/\s+/g, '');

  // Gmail rejects normal passwords — App Passwords are exactly 16 chars
  if (isGmailHost(smtp.host) && pass && pass.length !== 16) {
    const err = new Error(
      'Gmail needs a 16-character App Password (not your Gmail login). Google Account → Security → 2-Step Verification → App passwords. Paste it in Admin → Settings → SMTP Password. Or use Resend API instead.'
    );
    err.code = 'GMAIL_APP_PASSWORD_REQUIRED';
    throw err;
  }

  const auth = smtp.user
    ? {
        user: smtp.user,
        pass,
      }
    : undefined;

  // Prefer Nodemailer well-known Gmail profile (correct TLS for 587)
  const transporter = isGmailHost(smtp.host)
    ? nodemailer.createTransport({
        service: 'gmail',
        auth,
        family: 4,
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 20000,
      })
    : nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        requireTLS: smtp.requireTLS,
        family: 4,
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 20000,
        auth,
        tls: {
          minVersion: 'TLSv1.2',
          servername: smtp.host,
        },
      });

  await transporter.sendMail({
    from: formatFrom(smtp),
    to,
    subject,
    text: text || undefined,
    html: html || undefined,
  });
  return true;
};

export const sendMail = async ({ to, subject, html, text }) => {
  const cfg = await getMailSettings();
  const order = resolveProviderOrder(cfg);

  if (!order.length) {
    const err = new Error(
      'Email is not configured. Set Resend/Brevo API (recommended on Render) or SMTP in Admin → Settings.'
    );
    err.code = 'SMTP_NOT_CONFIGURED';
    throw err;
  }

  let lastErr;
  for (const provider of order) {
    try {
      if (provider === 'resend') {
        await sendViaResend({ to, subject, html, text }, cfg);
        return true;
      }
      if (provider === 'brevo') {
        await sendViaBrevo({ to, subject, html, text }, cfg);
        return true;
      }
      if (provider === 'smtp') {
        await sendViaSmtp({ to, subject, html, text }, cfg.smtp);
        return true;
      }
    } catch (err) {
      lastErr = err;
      console.error(`[mail:${provider}]`, err.code || '', err.message);
      // Try next provider (e.g. SMTP timeout → Resend already tried first in auto)
    }
  }

  const friendly = new Error(formatSmtpError(lastErr));
  friendly.code = lastErr?.code || 'SMTP_SEND_FAILED';
  friendly.cause = lastErr;
  throw friendly;
};

/** Allowed front-end origins from CLIENT_URL (comma-separated). */
export const getAllowedClientOrigins = () => {
  const raw = process.env.CLIENT_URL || 'http://localhost:5173';
  return String(raw)
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);
};

/**
 * Pick the correct site URL for emails (reset links, etc.).
 * Prefer the caller's origin when it is in CLIENT_URL — otherwise first entry.
 */
export const getClientBaseUrl = (reqOrOrigin) => {
  const allowed = getAllowedClientOrigins();
  const fallback = allowed[0] || 'http://localhost:5173';

  let candidate = '';
  if (typeof reqOrOrigin === 'string') {
    candidate = reqOrOrigin;
  } else if (reqOrOrigin && typeof reqOrOrigin === 'object') {
    const bodyOrigin = reqOrOrigin.body?.clientOrigin || reqOrOrigin.body?.origin;
    const headerOrigin = reqOrOrigin.get?.('origin') || reqOrOrigin.headers?.origin;
    const referer = reqOrOrigin.get?.('referer') || reqOrOrigin.headers?.referer;
    candidate = bodyOrigin || headerOrigin || '';
    if (!candidate && referer) {
      try {
        candidate = new URL(referer).origin;
      } catch {
        candidate = '';
      }
    }
  }

  const normalized = String(candidate || '')
    .trim()
    .replace(/\/$/, '');
  if (normalized && allowed.some((o) => o.toLowerCase() === normalized.toLowerCase())) {
    return normalized;
  }

  if (process.env.NODE_ENV !== 'production') {
    const local = allowed.find((o) => /localhost|127\.0\.0\.1/.test(o));
    if (local) return local;
  }

  return fallback;
};
