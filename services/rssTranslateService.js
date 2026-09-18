/**
 * Translate RSS-imported news fields to Tamil (Gemini when configured).
 */

import { resolveGeminiApiKey, parseGeminiJson } from './geminiService.js';

const MODEL = process.env.GEMINI_TRANSLATE_MODEL || 'gemini-2.0-flash';

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

const hasTamil = (s = '') => /[\u0B80-\u0BFF]/.test(s);

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

  const { key } = await resolveGeminiApiKey();
  if (!key) {
    console.warn('[RssTranslate] Gemini API key missing — keeping English text');
    return null;
  }

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
    console.warn('[RssTranslate]', msg);
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

  return {
    title: outTitle,
    excerpt: outExcerpt.slice(0, 400),
    contentHtml: toHtmlParagraphs(outContent || outExcerpt),
  };
};

export default { translateNewsToTamil };
