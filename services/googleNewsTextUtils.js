/**
 * Google News text utilities — clean HTML/JSON junk, extract readable paragraphs.
 */

export const decodeHtmlEntities = (s = '') =>
  String(s)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));

/** Remove script/style and non-content blocks */
export const stripHtmlBlocks = (html = '') =>
  String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, ' ')
    .replace(/<head[\s\S]*?<\/head>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');

const JUNK_LINE_PATTERNS = [
  /^[\s\S]*function\s+\w+\s*\(/,
  /^\s*[\[{]/,
  /"@context"\s*:/,
  /"@type"\s*:/,
  /document\.(querySelector|createElement|getElementById)/,
  /window\.location/,
  /addEventListener\s*\(/,
  /@media\s*\(/,
  /^\s*\.\w+[\s\S]*\{\s*display\s*:/,
  /^\s*\{\s*display\s*:/,
  /^\s*\{\s*--[\w-]+:/,
  /\bsrc=["']/,
  /\bclass=["']/,
  /^https?:\/\/[^\s]+$/,
  /^(Twitter|WhatsApp|Facebook|Reddit|Email|Share)$/i,
  /^(Read Comments|Last Updated|Reported by)/i,
];

export const isJunkLine = (line = '') => {
  const t = String(line).trim();
  if (!t || t.length < 20) return true;
  if (JUNK_LINE_PATTERNS.some((re) => re.test(t))) return true;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length < 4) return true;
  const urlCount = (t.match(/https?:\/\/[^\s]+/gi) || []).length;
  if (urlCount >= 2) return true;
  return false;
};

export const isJunkArticleContent = (text = '') => {
  const t = String(text).trim();
  if (!t) return true;
  const hits = [
    /function\s+\w+\s*\(/,
    /"@context"\s*:/,
    /\{\s*display\s*:/,
    /document\.querySelector/,
    /<html[\s>]/i,
  ].filter((re) => re.test(t)).length;
  if (hits >= 2) return true;
  if (hits >= 1 && t.length > 2000) return true;
  return false;
};

/** Single HTML fragment → plain text (one line) */
export const htmlToPlainText = (html = '') => {
  let t = stripHtmlBlocks(decodeHtmlEntities(html))
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/https?:\/\/[^\s]+\.(jpe?g|png|gif|webp)(\?[^\s]*)?/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return t;
};

/** Extract readable paragraphs from HTML — preserves sentence structure */
export const extractParagraphsFromHtml = (html = '') => {
  const safe = stripHtmlBlocks(html);
  const paragraphs = [];

  const pMatches = safe.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [];
  for (const block of pMatches) {
    const inner = block.replace(/<\/?p[^>]*>/gi, '');
    let text = htmlToPlainText(inner);
    text = text.replace(/\s+/g, ' ').trim();
    if (!isJunkLine(text) && text.length >= 40) {
      paragraphs.push(text);
    }
  }

  if (paragraphs.length >= 2) return paragraphs;

  // h2 + following content for some news sites
  const h2Blocks = safe.match(/<h2[^>]*>([\s\S]*?)<\/h2>/gi) || [];
  for (const h2 of h2Blocks) {
    const text = htmlToPlainText(h2);
    if (text.length >= 20 && !isJunkLine(text)) paragraphs.push(text);
  }

  return paragraphs;
};

/** Join paragraphs into full article text */
export const paragraphsToFullText = (paragraphs = []) =>
  paragraphs.filter(Boolean).join('\n\n');

/** Full clean article text from HTML or plain string */
export const cleanGoogleNewsText = (text = '') => {
  let t = String(text || '').trim();
  if (!t) return '';

  if (t.includes('<') || t.includes('&lt;')) {
    const paragraphs = extractParagraphsFromHtml(t);
    if (paragraphs.length) {
      t = paragraphsToFullText(paragraphs);
    } else {
      t = htmlToPlainText(t);
    }
  } else {
    t = decodeHtmlEntities(t);
  }

  t = t
    .replace(/\{[\s\S]*?"@context"[\s\S]*?\}/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (isJunkArticleContent(t)) {
    // Last resort: split by double newlines and keep only good lines
    const good = t
      .split(/\n\n+/)
      .map((p) => p.replace(/\s+/g, ' ').trim())
      .filter((p) => !isJunkLine(p) && p.length >= 40);
    t = good.length ? good.join('\n\n') : '';
  }

  return t;
};

const LISTING_EXCERPT_LEN = 200;

/** Short excerpt for listing cards */
export const buildGoogleNewsExcerpt = (text = '', maxLen = LISTING_EXCERPT_LEN) => {
  const cleaned = cleanGoogleNewsText(text);
  if (!cleaned) return '';

  const flat = cleaned.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
  if (flat.length <= maxLen) return flat;

  const cut = flat.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(' ');
  const trimmed = (lastSpace > maxLen * 0.55 ? cut.slice(0, lastSpace) : cut).trim();
  return `${trimmed}…`;
};

export const resolveGoogleNewsExcerpt = (item = {}) => {
  for (const c of [item.excerpt, item.description, item.content]) {
    const ex = buildGoogleNewsExcerpt(c);
    if (ex) return ex;
  }
  return '';
};

/** Sanitize fields on import */
export const prepareGoogleNewsTextFields = (item = {}) => {
  const content = cleanGoogleNewsText(item.content || item.description || '');
  const description = cleanGoogleNewsText(item.description || content);
  const excerpt = buildGoogleNewsExcerpt(item.excerpt || description || content);

  return {
    description,
    content: content || description,
    excerpt,
    descriptionHtml: String(item.descriptionHtml || '').trim(),
  };
};

/** Public listing — short excerpt only */
export const sanitizeItemForListing = (item) => {
  const data = typeof item.toObject === 'function' ? item.toObject() : { ...item };
  return {
    _id: data._id,
    slug: data.slug,
    title: data.title,
    image: data.image,
    sourceName: data.sourceName,
    category: data.category,
    publishedAt: data.publishedAt,
    isMustRead: data.isMustRead,
    isMustWatch: data.isMustWatch,
    link: data.link,
    guid: data.guid,
    excerpt: resolveGoogleNewsExcerpt(data) || '',
  };
};

/** Public detail — full cleaned content with paragraphs */
export const sanitizeItemForDetail = (item) => {
  const data = typeof item.toObject === 'function' ? item.toObject() : { ...item };
  const content = cleanGoogleNewsText(data.content || data.description || '');
  const description = cleanGoogleNewsText(data.description || content);
  const excerpt = buildGoogleNewsExcerpt(description || content);

  return {
    ...data,
    description,
    content: content || description,
    excerpt,
    descriptionHtml: undefined,
  };
};

export default {
  stripHtmlBlocks,
  decodeHtmlEntities,
  htmlToPlainText,
  extractParagraphsFromHtml,
  paragraphsToFullText,
  cleanGoogleNewsText,
  isJunkArticleContent,
  buildGoogleNewsExcerpt,
  prepareGoogleNewsTextFields,
  sanitizeItemForListing,
  sanitizeItemForDetail,
};
