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
  // Prefer STARTTLS on submission ports even if admin toggled "secure"
  if (p === 587 || p === 2587 || p === 25 || p === 2525) {
    return { port: p, secure: false, requireTLS: p === 587 || p === 2587 };
  }
  return {
    port: p,
    secure: secureFlag === true || secureFlag === 'true',
    requireTLS: false,
  };
};

export const getSmtpSettings = async () => {
  const rows = await Setting.find({ key: { $in: SMTP_KEYS } }).lean();
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const port = Number(map.smtpPort) || 587;
  const tls = resolveTlsMode(port, map.smtpSecure);
  return {
    enabled: map.smtpEnabled === true || map.smtpEnabled === 'true',
    host: String(map.smtpHost || '').trim(),
    port: tls.port,
    secure: tls.secure,
    requireTLS: tls.requireTLS,
    user: String(map.smtpUser || '').trim(),
    password: String(map.smtpPassword || ''),
    fromName: String(map.smtpFromName || 'The Great India News').trim(),
    fromEmail: String(map.smtpFromEmail || map.smtpUser || '').trim(),
  };
};

export const isSmtpConfigured = (smtp) =>
  Boolean(smtp?.enabled && smtp.host && smtp.port && smtp.fromEmail);

/** Turn raw OpenSSL / network errors into admin-friendly copy */
export const formatSmtpError = (err) => {
  const raw = String(err?.message || err || '');
  const code = err?.code || '';

  if (code === 'SMTP_NOT_CONFIGURED') {
    return 'Email is not set up yet. Ask the site admin to configure SMTP in Admin → Settings.';
  }
  if (/wrong version number|ssl3_get_record|EPROTO/i.test(raw) || code === 'ESOCKET') {
    return 'SMTP SSL mismatch. Use port 587 with Secure OFF (STARTTLS), or port 465 with Secure ON. Check Admin → Settings.';
  }
  if (code === 'ENETUNREACH' || code === 'EHOSTUNREACH' || /ENETUNREACH|EHOSTUNREACH/i.test(raw)) {
    return 'Cannot reach the mail server (network/IPv6). Check internet, firewall, or try another SMTP host in Admin → Settings.';
  }
  if (code === 'ETIMEDOUT' || code === 'ESOCKETTIMEDOUT' || /timeout/i.test(raw)) {
    return 'Mail server timed out. Check SMTP host/port and firewall (ports 587 or 465).';
  }
  if (code === 'EAUTH' || /Invalid login|authentication failed|Username and Password not accepted/i.test(raw)) {
    return 'SMTP login failed. Check email username and app password in Admin → Settings.';
  }
  if (code === 'EENVELOPE' || /sender|from/i.test(raw) && /not allowed|rejected/i.test(raw)) {
    return 'SMTP rejected the From address. Set From email to match your SMTP account.';
  }
  // Never leak long OpenSSL dumps to the toast UI
  if (raw.length > 160 || /openssl|ssl routines|c:\\ws\\deps/i.test(raw)) {
    return 'Could not send email. Check SMTP settings in Admin → Settings (host, port 587, app password).';
  }
  return raw || 'Could not send email. Check SMTP settings.';
};

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
    requireTLS: smtp.requireTLS,
    // Prefer IPv4 — Windows/local networks often fail on Google IPv6 (ENETUNREACH …::587)
    family: 4,
    connectionTimeout: 20000,
    greetingTimeout: 20000,
    socketTimeout: 30000,
    auth: smtp.user
      ? {
          user: smtp.user,
          pass: smtp.password,
        }
      : undefined,
    tls: {
      // Gmail / most providers need modern TLS; don't force outdated SSL
      minVersion: 'TLSv1.2',
      servername: smtp.host,
    },
  });

  const from = smtp.fromName
    ? `"${smtp.fromName.replace(/"/g, '')}" <${smtp.fromEmail}>`
    : smtp.fromEmail;

  try {
    await transporter.sendMail({
      from,
      to,
      subject,
      text: text || undefined,
      html: html || undefined,
    });
  } catch (err) {
    const friendly = new Error(formatSmtpError(err));
    friendly.code = err.code || 'SMTP_SEND_FAILED';
    friendly.cause = err;
    console.error('[SMTP]', err.code || '', err.message);
    throw friendly;
  }

  return true;
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
 * Fixes localhost vs production when CLIENT_URL lists multiple hosts.
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

  // Local/dev convenience when Origin was missing
  if (process.env.NODE_ENV !== 'production') {
    const local = allowed.find((o) => /localhost|127\.0\.0\.1/.test(o));
    if (local) return local;
  }

  return fallback;
};
