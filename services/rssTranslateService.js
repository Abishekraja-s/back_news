/**
 * Translate RSS-imported news English → Tamil.
 * Order: Gemini (when keyed) → Google gtx → MyMemory, with retries + global queue
 * so bulk auto-fetch does not drop Tamil conversion intermittently.
 */

import { resolveGeminiApiKey, parseGeminiJson } from './geminiService.js';

const MODEL = process.env.GEMINI_TRANSLATE_MODEL || 'gemini-3.8-flash';
const hasTamil = (s = '') => /[\u0B80-\u0BFF]/.test(String(s || ''));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const plain = (html = '') =>
  String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const toHtmlParagraphs = (text = '') => {
  const parts = String(text)
    .split(/\n{2,}|\r\n{2,}/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  if (!parts.length) return '';
  return parts.map((p) => `<p>${p}</p>`).join('\n');
};

/** Skip Gemini for a short window after billing/quota failures */
let geminiCooldownUntil = 0;

/** Serialize free-translator calls across concurrent ingest items */
let freeQueue = Promise.resolve();
const enqueueFree = (fn) => {
  const run = freeQueue.then(fn, fn);
  freeQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
};

const translateChunkGoogle = async (text) => {
  const q = String(text || '').trim();
  if (!q) return '';
  if (hasTamil(q)) return q;
  const chunk = q.slice(0, 900);
  const url =
    'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ta&dt=t&q=' +
    encodeURIComponent(chunk);
  const res = await fetch(url, {
    signal: AbortSignal.timeout(20000),
    headers: { 'User-Agent': 'Mozilla/5.0 GreatIndiaNews/1.0' },
  });
  if (!res.ok) return '';
  const data = await res.json().catch(() => null);
  if (!Array.isArray(data?.[0])) return '';
  const out = data[0]
    .map((row) => (Array.isArray(row) ? row[0] : ''))
    .filter(Boolean)
    .join('')
    .trim();
  return hasTamil(out) ? out : '';
};

const translateChunkMyMemory = async (text) => {
  const q = String(text || '').trim();
  if (!q) return '';
  if (hasTamil(q)) return q;
  const chunk = q.slice(0, 450);
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=en|ta`;
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  const data = await res.json().catch(() => ({}));
  const out = String(data?.responseData?.translatedText || '').trim();
  if (!out || /MYMEMORY WARNING/i.test(out)) return '';
  return hasTamil(out) ? out : '';
};

const translateChunkFree = async (text, { retries = 2 } = {}) => {
  const q = String(text || '').trim();
  if (!q) return '';
  if (hasTamil(q)) return q;

  return enqueueFree(async () => {
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        const g = await translateChunkGoogle(q);
        if (g) return g;
      } catch (err) {
        console.warn('[RssTranslate] Google gtx:', err.message);
      }
      try {
        const m = await translateChunkMyMemory(q);
        if (m) return m;
      } catch (err) {
        console.warn('[RssTranslate] MyMemory:', err.message);
      }
      if (attempt < retries) await sleep(600 * (attempt + 1));
    }
    return '';
  });
};

const translateLongFree = async (text, { maxChars = 3500, pauseMs = 400 } = {}) => {
  const full = String(text || '').trim();
  if (!full) return '';
  if (hasTamil(full)) return full;

  const limited = full.slice(0, maxChars);
  const sentences = limited.match(/[^.!?\n]+[.!?\n]+|[^.!?\n]+$/g) || [limited];
  const chunks = [];
  let buf = '';
  for (const s of sentences) {
    const next = (buf + s).trim();
    if (next.length > 800 && buf) {
      chunks.push(buf);
      buf = s.trim();
    } else {
      buf = next;
    }
  }
  if (buf) chunks.push(buf);

  const parts = [];
  for (let i = 0; i < chunks.length; i += 1) {
    const ta = await translateChunkFree(chunks[i]);
    if (ta) parts.push(ta);
    if (i < chunks.length - 1) await sleep(pauseMs);
  }
  return parts.join(' ').trim();
};

const translateWithGemini = async ({ titleIn, excerptIn, contentPlain }) => {
  if (Date.now() < geminiCooldownUntil) return null;

  const { key } = await resolveGeminiApiKey();
  if (!key) return null;

  const prompt = `You are a professional Tamil news translator for a Tamil Nadu news website.
Translate the following English news into natural, journalistic Tamil (தமிழ்).

Rules:
- Keep facts accurate; do not invent details.
- Title: clear Tamil headline.
- Excerpt: 1–2 Tamil sentences summary.
- Content: full Tamil article body as plain text with blank lines between paragraphs (no HTML tags).
- Keep names of people/places in commonly used Tamil form when natural; otherwise keep English names.
- Return ONLY valid JSON with keys: title, excerpt, content

INPUT TITLE:
${titleIn}

INPUT EXCERPT:
${excerptIn}

INPUT CONTENT:
${contentPlain || excerptIn}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(key)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(90000),
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
      },
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || `Gemini HTTP ${res.status}`;
    console.warn('[RssTranslate] Gemini:', msg);
    if (res.status === 402 || res.status === 429 || /quota|billing|prepayment|credits/i.test(msg)) {
      geminiCooldownUntil = Date.now() + 15 * 60 * 1000;
      console.warn('[RssTranslate] Gemini cooldown 15m (billing/quota)');
    }
    return null;
  }

  const text =
    data?.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join('\n') || '';
  if (!text.trim()) return null;

  let parsed;
  try {
    parsed = parseGeminiJson(text);
  } catch {
    try {
      parsed = JSON.parse(text);
    } catch {
      console.warn('[RssTranslate] Could not parse Gemini JSON');
      return null;
    }
  }

  const outTitle = String(parsed.title || '').trim() || titleIn;
  const outExcerpt = String(parsed.excerpt || '').trim() || excerptIn;
  const outContent = String(parsed.content || '').trim();

  if (!hasTamil(outTitle) && !hasTamil(outContent || outExcerpt)) return null;

  return {
    title: outTitle,
    excerpt: outExcerpt.slice(0, 400),
    contentHtml: toHtmlParagraphs(outContent || outExcerpt),
  };
};

const translateWithFreeFallback = async ({ titleIn, excerptIn, contentPlain }) => {
  // Title first (must succeed for list UI)
  let title = await translateChunkFree(titleIn, { retries: 3 });
  if (!hasTamil(title)) {
    await sleep(800);
    title = await translateChunkFree(titleIn, { retries: 2 });
  }
  if (!hasTamil(title)) {
    console.warn('[RssTranslate] Free translators failed on title — keeping English');
    return null;
  }

  await sleep(300);
  let excerpt = await translateLongFree(excerptIn || contentPlain.slice(0, 500), {
    maxChars: 500,
    pauseMs: 350,
  });
  if (!hasTamil(excerpt)) excerpt = title;

  await sleep(300);
  let content = await translateLongFree(contentPlain || excerptIn, {
    maxChars: 2800,
    pauseMs: 400,
  });
  if (!hasTamil(content)) content = excerpt;

  return {
    title,
    excerpt: String(excerpt).slice(0, 400),
    contentHtml: toHtmlParagraphs(content),
  };
};

/**
 * @returns {Promise<null|{ title: string, excerpt: string, contentHtml: string }>}
 */
export const translateNewsToTamil = async ({ title = '', excerpt = '', content = '' } = {}) => {
  const titleIn = String(title || '').trim();
  const excerptIn = String(excerpt || '').trim();
  const contentPlain = plain(content).slice(0, 20000);

  // Already Tamil — skip API
  if (hasTamil(titleIn) && hasTamil(contentPlain || excerptIn)) {
    return {
      title: titleIn,
      excerpt: excerptIn || contentPlain.slice(0, 280),
      contentHtml: String(content || '').includes('<') ? content : toHtmlParagraphs(contentPlain),
    };
  }

  // Title already Tamil but body English — translate body only via free path
  if (hasTamil(titleIn) && contentPlain && !hasTamil(contentPlain)) {
    try {
      const body = await translateWithFreeFallback({
        titleIn,
        excerptIn: excerptIn || contentPlain.slice(0, 280),
        contentPlain,
      });
      if (body) return { ...body, title: titleIn };
    } catch (err) {
      console.warn('[RssTranslate] body-only free translate:', err.message);
    }
  }

  try {
    const gemini = await translateWithGemini({ titleIn, excerptIn, contentPlain });
    if (gemini?.title && hasTamil(gemini.title)) return gemini;
  } catch (err) {
    console.warn('[RssTranslate] Gemini error:', err.message);
  }

  try {
    console.log('[RssTranslate] Free en→ta (Google/MyMemory)');
    return await translateWithFreeFallback({ titleIn, excerptIn, contentPlain });
  } catch (err) {
    console.warn('[RssTranslate] Free fallback failed:', err.message);
    return null;
  }
};

export { hasTamil };

export default { translateNewsToTamil, hasTamil };
