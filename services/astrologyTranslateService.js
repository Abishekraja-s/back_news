/**
 * Translate astrology horoscope fields English → Tamil.
 * Prefers Gemini when configured; falls back to MyMemory free API.
 */

import { resolveGeminiApiKey, parseGeminiJson } from './geminiService.js';

const MODEL = process.env.GEMINI_TRANSLATE_MODEL || 'gemini-3.6-flash';
const hasTamil = (s = '') => /[\u0B80-\u0BFF]/.test(String(s));

const TEXT_FIELDS = [
  'prediction',
  'career',
  'business',
  'finance',
  'love',
  'family',
  'health',
  'education',
  'advice',
  'compatibility',
  'luckyColor',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const translateWithMyMemory = async (text) => {
  const q = String(text || '').trim();
  if (!q) return '';
  if (hasTamil(q)) return q;
  // MyMemory soft limit ~500 chars per request
  const chunk = q.slice(0, 450);
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=en|ta`;
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  const data = await res.json().catch(() => ({}));
  const out = String(data?.responseData?.translatedText || '').trim();
  if (!out || /MYMEMORY WARNING/i.test(out)) return '';
  return out;
};

const translateBatchWithGemini = async (fields) => {
  const { key } = await resolveGeminiApiKey();
  if (!key) return null;

  const payload = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v) payload[k] = v;
  }
  if (!Object.keys(payload).length) return {};

  const prompt = `You are a professional Tamil astrology writer for a Tamil Nadu news website.
Translate the following English daily horoscope fields into natural, clear Tamil (தமிழ்).

Rules:
- Keep meaning accurate; do not invent new predictions.
- Use warm, readable Tamil suitable for ராசி பலன்.
- Keep lucky colour names in common Tamil form when natural.
- Return ONLY valid JSON with the SAME keys as the input.

INPUT JSON:
${JSON.stringify(payload, null, 2)}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(90000),
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.25,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
      },
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.warn('[AstrologyTranslate] Gemini:', data?.error?.message || res.status);
    return null;
  }

  const text =
    data?.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join('\n') || '';
  if (!text.trim()) return null;

  try {
    return parseGeminiJson(text) || JSON.parse(text);
  } catch {
    try {
      return JSON.parse(text);
    } catch {
      console.warn('[AstrologyTranslate] Could not parse Gemini JSON');
      return null;
    }
  }
};

/**
 * Adds *Tamil fields onto a normalized horoscope record (mutates + returns).
 */
export const enrichHoroscopeWithTamil = async (record) => {
  if (!record) return record;

  const english = {};
  for (const key of TEXT_FIELDS) {
    const val = String(record[key] || '').trim();
    if (val && !hasTamil(val)) english[key] = val;
    // If already Tamil in primary field, copy into Tamil field
    if (val && hasTamil(val) && !record[`${key}Tamil`]) {
      record[`${key}Tamil`] = val;
    }
  }

  if (!Object.keys(english).length) return record;

  let translated = await translateBatchWithGemini(english);

  if (!translated) {
    translated = {};
    for (const [key, val] of Object.entries(english)) {
      try {
        const ta = await translateWithMyMemory(val);
        if (ta) translated[key] = ta;
        await sleep(120);
      } catch (err) {
        console.warn(`[AstrologyTranslate] MyMemory ${key}:`, err.message);
      }
    }
  }

  for (const [key, val] of Object.entries(translated || {})) {
    const ta = String(val || '').trim();
    if (ta) record[`${key}Tamil`] = ta;
  }

  return record;
};

export default { enrichHoroscopeWithTamil };
