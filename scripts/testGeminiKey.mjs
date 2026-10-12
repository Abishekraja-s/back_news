/**
 * Probe Gemini key from .env (never prints the raw key).
 * Usage: node scripts/testGeminiKey.mjs
 */
import dotenv from 'dotenv';
dotenv.config();
import { maskApiKey } from '../services/geminiService.js';

const key = (process.env.GEMINI_API_KEY || '').trim();
if (!key) {
  console.log(JSON.stringify({ ok: false, message: 'No GEMINI_API_KEY in .env' }));
  process.exit(1);
}

console.log('key', maskApiKey(key), 'len', key.length);

const models = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-2.5-flash'];
for (const model of models) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(30000),
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'Reply with OK only' }] }],
        generationConfig: { maxOutputTokens: 16 },
      }),
    });
    const data = await res.json().catch(() => ({}));
    const msg =
      data?.error?.message ||
      data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ||
      '';
    console.log('generateContent', model, res.status, String(msg).slice(0, 200));
  } catch (e) {
    console.log('generateContent', model, 'ERR', e.message);
  }
}

try {
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': key,
      'Api-Revision': '2026-05-20',
    },
    signal: AbortSignal.timeout(30000),
    body: JSON.stringify({
      model: 'gemini-3.6-flash',
      input: 'Reply OK',
      generation_config: { max_output_tokens: 16 },
    }),
  });
  const data = await res.json().catch(() => ({}));
  console.log(
    'interactions',
    res.status,
    String(data?.error?.message || data?.status || JSON.stringify(data)).slice(0, 250)
  );
} catch (e) {
  console.log('interactions ERR', e.message);
}
