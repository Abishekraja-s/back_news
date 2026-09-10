/**
 * Fetch and parse Google News RSS feeds (no API key required).
 * Preserves full original title, description, dates, URLs, and image URLs.
 */

import { isGenericGoogleImage } from './googleNewsContentFilter.js';
import {
  htmlToPlainText,
  prepareGoogleNewsTextFields,
  buildGoogleNewsExcerpt,
} from './googleNewsTextUtils.js';

export { htmlToPlainText, cleanGoogleNewsText, stripHtmlBlocks } from './googleNewsTextUtils.js';

const decodeXml = (s = '') =>
  String(s)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim();

const extractTag = (block, tag) => {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const m = block.match(re);
  return m ? m[1] : '';
};

const extractAttr = (block, tag, attr) => {
  const re = new RegExp(`<${tag}[^>]*\\s${attr}=["']([^"']+)["'][^>]*/?>`, 'i');
  const m = block.match(re);
  return m ? decodeXml(m[1]) : '';
};

export const isValidImageUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
  try {
    const u = new URL(url.trim());
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    return /\.(jpe?g|png|gif|webp|avif|bmp|svg)(\?|$)/i.test(u.pathname) || u.hostname.length > 0;
  } catch {
    return false;
  }
};

const extractImageFromHtml = (html = '') => {
  const imgMatch = String(html).match(/<img[^>]+src=["']([^"']+)["']/i);
  return imgMatch ? decodeXml(imgMatch[1]) : '';
};

/** Build Google News RSS search URL */
export const buildGoogleNewsRssUrl = ({ query, language = 'en', country = 'IN' }) => {
  const hl = language.includes('-') ? language : `${language}-${country}`;
  const gl = country.toUpperCase();
  const ceid = `${gl}:${language.split('-')[0]}`;
  const q = encodeURIComponent(query);
  return `https://news.google.com/rss/search?q=${q}&hl=${hl}&gl=${gl}&ceid=${ceid}`;
};

export const buildTopicRssUrl = ({ topic, language = 'en', country = 'IN' }) => {
  const hl = language.includes('-') ? language : `${language}-${country}`;
  const gl = country.toUpperCase();
  const ceid = `${gl}:${language.split('-')[0]}`;
  const t = encodeURIComponent(String(topic).toUpperCase());
  return `https://news.google.com/rss/headlines/section/topic/${t}?hl=${hl}&gl=${gl}&ceid=${ceid}`;
};

const parseRssItems = (xml = '') => {
  const items = [];
  const itemBlocks = xml.match(/<item[\s\S]*?<\/item>/gi) || [];

  for (const block of itemBlocks) {
    const titleRaw = extractTag(block, 'title');
    const title = htmlToPlainText(titleRaw) || decodeXml(titleRaw);
    const link = decodeXml(extractTag(block, 'link') || extractAttr(block, 'link', 'href'));
    const guid = decodeXml(extractTag(block, 'guid') || link);
    const pubDate = extractTag(block, 'pubDate');
    const descriptionRaw = extractTag(block, 'description');
    const descriptionHtml = decodeXml(descriptionRaw);
    const textFields = prepareGoogleNewsTextFields({
      descriptionHtml,
      description: htmlToPlainText(descriptionHtml),
    });
    const description = textFields.description;
    const sourceName = htmlToPlainText(extractTag(block, 'source')) || decodeXml(extractTag(block, 'source'));
    const sourceUrl = extractAttr(block, 'source', 'url');

    const imageCandidate =
      extractAttr(block, 'media:content', 'url') ||
      extractAttr(block, 'media:thumbnail', 'url') ||
      extractAttr(block, 'enclosure', 'url') ||
      extractImageFromHtml(descriptionHtml) ||
      '';

    const image = isValidImageUrl(imageCandidate) && !isGenericGoogleImage(imageCandidate)
      ? imageCandidate.trim()
      : '';

    if (!title || !link) continue;

    items.push({
      guid: guid || link,
      title,
      link,
      description,
      descriptionHtml,
      content: textFields.content || description,
      excerpt: textFields.excerpt || buildGoogleNewsExcerpt(description),
      image,
      sourceName,
      sourceUrl,
      publishedAt: pubDate ? new Date(pubDate) : null,
    });
  }

  return items;
};

export const fetchRssFeed = async (url) => {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; GreatIndiaNewsBot/1.0)',
      Accept: 'application/rss+xml, application/xml, text/xml, */*',
    },
    redirect: 'follow',
  });

  if (!res.ok) {
    const err = new Error(`Google News RSS fetch failed (${res.status})`);
    err.statusCode = 502;
    throw err;
  }

  const xml = await res.text();
  return parseRssItems(xml);
};

export const fetchGoogleNewsFromConfig = async (config) => {
  const language = config.language || 'en';
  const country = config.country || 'IN';
  const maxItems = config.maxItemsPerFetch || 20;

  const queries = [];

  (config.keywords || []).forEach((k) => {
    if (k?.trim()) queries.push({ type: 'search', value: k.trim() });
  });
  (config.sources || []).forEach((s) => {
    if (s?.trim()) queries.push({ type: 'search', value: s.trim() });
  });
  (config.categories || []).forEach((c) => {
    if (c?.trim()) queries.push({ type: 'topic', value: c.trim() });
  });

  if (!queries.length) {
    queries.push({ type: 'search', value: 'India news' });
  }

  const seen = new Set();
  const collected = [];

  for (const q of queries) {
    if (collected.length >= maxItems) break;

    const url =
      q.type === 'topic'
        ? buildTopicRssUrl({ topic: q.value, language, country })
        : buildGoogleNewsRssUrl({ query: q.value, language, country });

    try {
      const items = await fetchRssFeed(url);
      for (const item of items) {
        if (seen.has(item.guid) || seen.has(item.link)) continue;
        seen.add(item.guid);
        seen.add(item.link);
        collected.push({
          ...item,
          category: q.type === 'topic' ? q.value : '',
          keywords: q.type === 'search' ? [q.value] : [],
          language,
          country,
        });
        if (collected.length >= maxItems) break;
      }
    } catch (err) {
      console.warn(`[GoogleNews] feed error (${q.value}):`, err.message);
    }
  }

  return collected;
};

export default {
  buildGoogleNewsRssUrl,
  buildTopicRssUrl,
  fetchRssFeed,
  fetchGoogleNewsFromConfig,
  htmlToPlainText,
  isValidImageUrl,
};
