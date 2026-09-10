/**
 * Fetch og:image, description, and full article paragraphs from publisher pages.
 */

import { isValidImageUrl } from './googleNewsService.js';
import {
  stripHtmlBlocks,
  htmlToPlainText,
  extractParagraphsFromHtml,
  paragraphsToFullText,
  cleanGoogleNewsText,
  isJunkArticleContent,
  prepareGoogleNewsTextFields,
} from './googleNewsTextUtils.js';
import { resolveGoogleNewsUrl, isGoogleNewsWrapper } from './googleNewsUrlDecoder.js';
import {
  isGenericGoogleDescription,
  isGenericGoogleImage,
} from './googleNewsContentFilter.js';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const decodeHtml = (s = '') =>
  String(s)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();

const extractMeta = (html, key) => {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${key}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${key}["']`, 'i'),
    new RegExp(`<meta[^>]+name=["']${key}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${key}["']`, 'i'),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return decodeHtml(m[1]);
  }
  return '';
};

const extractJsonLdBlocks = (html) => {
  const blocks = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  const items = [];
  for (const block of blocks) {
    try {
      const json = JSON.parse(block.replace(/<\/?script[^>]*>/gi, '').trim());
      if (Array.isArray(json)) items.push(...json);
      else items.push(json);
    } catch {
      /* ignore */
    }
  }
  return items;
};

const extractJsonLdImage = (html) => {
  for (const item of extractJsonLdBlocks(html)) {
    if (item['@type'] === 'NewsArticle' || item['@type'] === 'Article') {
      const img = item.image?.url || item.image?.[0]?.url || item.image?.[0] || item.image;
      if (typeof img === 'string' && isValidImageUrl(img) && !isGenericGoogleImage(img)) return img;
    }
  }
  return '';
};

/** articleBody from JSON-LD is often the cleanest full text */
const extractJsonLdArticleBody = (html) => {
  for (const item of extractJsonLdBlocks(html)) {
    if ((item['@type'] === 'NewsArticle' || item['@type'] === 'Article') && item.articleBody) {
      const body = String(item.articleBody);
      const paragraphs = extractParagraphsFromHtml(body);
      if (paragraphs.length >= 2) return paragraphsToFullText(paragraphs);
      const plain = cleanGoogleNewsText(body);
      if (plain.length > 200 && !isJunkArticleContent(plain)) return plain;
    }
  }
  return '';
};

const extractArticleBody = (html) => {
  const safeHtml = stripHtmlBlocks(html);

  const jsonBody = extractJsonLdArticleBody(safeHtml);
  if (jsonBody) return jsonBody;

  const regionPatterns = [
    /<div[^>]+itemprop=["']articleBody["'][^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]+class=["'][^"']*ins_storybody[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]+class=["'][^"']*story[_-]?detail[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]+class=["'][^"']*story[_-]?body[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]+class=["'][^"']*content[_-]?text[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    /<article[\s\S]*?<\/article>/i,
    /<main[\s\S]*?<\/main>/i,
  ];

  for (const pattern of regionPatterns) {
    const match = safeHtml.match(pattern);
    if (!match) continue;
    const region = match[1] || match[0];
    const paragraphs = extractParagraphsFromHtml(region);
    if (paragraphs.length >= 2) {
      const full = paragraphsToFullText(paragraphs);
      if (!isJunkArticleContent(full)) return full;
    }
  }

  // Fallback: all <p> tags on page (filtered)
  const allParagraphs = extractParagraphsFromHtml(safeHtml);
  if (allParagraphs.length >= 2) {
    const full = paragraphsToFullText(allParagraphs.slice(0, 30));
    if (!isJunkArticleContent(full)) return full;
  }

  return '';
};

const pickImage = (html) => {
  const candidates = [
    extractMeta(html, 'og:image'),
    extractMeta(html, 'twitter:image'),
    extractMeta(html, 'twitter:image:src'),
    extractJsonLdImage(html),
  ];
  return candidates.find((img) => isValidImageUrl(img) && !isGenericGoogleImage(img)) || '';
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const resolveArticleUrl = async (url) => {
  if (!url?.trim()) return url;

  if (isGoogleNewsWrapper(url)) {
    const decoded = await resolveGoogleNewsUrl(url);
    if (decoded) return decoded;
  }

  try {
    const res = await fetch(url.trim(), {
      method: 'GET',
      redirect: 'follow',
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
      signal: AbortSignal.timeout(12000),
    });
    const finalUrl = res.url || url;
    if (!isGoogleNewsWrapper(finalUrl)) return finalUrl;
    const decoded = await resolveGoogleNewsUrl(finalUrl);
    return decoded || finalUrl;
  } catch {
    return url;
  }
};

/** Fetch full article paragraphs + image from publisher */
export const enrichArticleFromUrl = async (url) => {
  if (!url?.trim()) return null;

  try {
    const resolvedUrl = await resolveArticleUrl(url);
    if (isGoogleNewsWrapper(resolvedUrl)) {
      return { resolvedUrl, image: '', content: '', description: '' };
    }

    const res = await fetch(resolvedUrl, {
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,*/*' },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) return { resolvedUrl, image: '', content: '', description: '' };

    const html = await res.text();
    const image = pickImage(html);

    const metaDesc =
      extractMeta(html, 'og:description') ||
      extractMeta(html, 'description') ||
      extractMeta(html, 'twitter:description') ||
      '';

    const body = extractArticleBody(html);
    const plainDesc = cleanGoogleNewsText(metaDesc);
    let content = body || (isGenericGoogleDescription(plainDesc) ? '' : plainDesc);
    if (isJunkArticleContent(content)) content = '';

    return {
      resolvedUrl: res.url || resolvedUrl,
      image: isValidImageUrl(image) && !isGenericGoogleImage(image) ? image.trim() : '',
      description: isGenericGoogleDescription(plainDesc) ? '' : plainDesc,
      content,
    };
  } catch (err) {
    console.warn('[Enrich]', url.slice(0, 60), err.message);
    return null;
  }
};

export const enrichRssItem = async (item) => {
  const enriched = { ...item };

  if (isGenericGoogleImage(enriched.image)) enriched.image = '';

  if (!isValidImageUrl(enriched.image) && item.descriptionHtml) {
    const imgMatch = String(item.descriptionHtml).match(/<img[^>]+src=["']([^"']+)["']/i);
    if (imgMatch?.[1] && isValidImageUrl(imgMatch[1]) && !isGenericGoogleImage(imgMatch[1])) {
      enriched.image = decodeHtml(imgMatch[1]);
    }
  }

  const needsImage = !isValidImageUrl(enriched.image) || isGenericGoogleImage(enriched.image);
  const needsContent =
    isGenericGoogleDescription(enriched.content) ||
    isGenericGoogleDescription(enriched.description) ||
    isJunkArticleContent(enriched.content) ||
    isJunkArticleContent(enriched.description) ||
    (enriched.content || enriched.description || '').length < 120;

  if (!needsImage && !needsContent) {
    return { ...enriched, ...prepareGoogleNewsTextFields(enriched) };
  }

  await sleep(400);
  const meta = await enrichArticleFromUrl(enriched.link);
  if (!meta) {
    return { ...enriched, ...prepareGoogleNewsTextFields(enriched) };
  }

  if (needsImage && meta.image) enriched.image = meta.image;
  if (meta.resolvedUrl && !isGoogleNewsWrapper(meta.resolvedUrl)) {
    enriched.sourceUrl = enriched.sourceUrl || meta.resolvedUrl;
  }
  if (needsContent && meta.content) {
    enriched.content = meta.content;
    if (!enriched.description || enriched.description.length < (meta.description?.length || 0)) {
      enriched.description = meta.description || meta.content;
    }
  } else if (
    meta.description &&
    !isGenericGoogleDescription(meta.description) &&
    (isGenericGoogleDescription(enriched.description) || enriched.description.length < meta.description.length)
  ) {
    enriched.description = meta.description;
    enriched.content = enriched.content || meta.description;
  }

  return { ...enriched, ...prepareGoogleNewsTextFields(enriched) };
};

export default { enrichArticleFromUrl, enrichRssItem, resolveArticleUrl };
