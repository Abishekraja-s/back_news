import crypto from 'crypto';

const ALGO = 'aes-256-gcm';
const PREFIX = 'enc:v1:';

const deriveKey = () => {
  const secret = process.env.JWT_SECRET || process.env.ASTROLOGY_CRYPTO_SECRET || 'dev-astrology-secret';
  return crypto.createHash('sha256').update(String(secret)).digest();
};

/** Encrypt sensitive string for DB storage. Empty input → empty string. */
export const encryptSecret = (plain = '') => {
  const text = String(plain || '');
  if (!text) return '';
  if (text.startsWith(PREFIX)) return text;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, deriveKey(), iv);
  const enc = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
};

/** Decrypt value; supports legacy plaintext (no prefix). */
export const decryptSecret = (stored = '') => {
  const text = String(stored || '');
  if (!text) return '';
  if (!text.startsWith(PREFIX)) return text;
  try {
    const payload = text.slice(PREFIX.length);
    const [ivB64, tagB64, dataB64] = payload.split(':');
    const decipher = crypto.createDecipheriv(ALGO, deriveKey(), Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    return '';
  }
};

export const isMaskedSecret = (val) =>
  !val || String(val).includes('•') || String(val) === '__UNCHANGED__' || String(val).includes('*');
