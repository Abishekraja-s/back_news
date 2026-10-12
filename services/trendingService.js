/**
 * Trending Now — automatic daily updates (IST date rotation).
 * Merges site article tags with curated TN/India topic bank.
 */

import Article from '../models/Article.js';
import { ARTICLE_STATUS } from '../config/constants.js';
import {
  TRENDING_TOPIC_BANK,
  TRENDING_WIDGET_SIZE,
  TRENDING_FULL_SIZE,
} from '../config/trendingTopics.js';

const cache = { key: '', data: null, at: 0 };
const CACHE_MS = 60 * 1000;

const istDateKey = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
};

const hash = (str) => {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h);
};

const toHashtag = (raw) => {
  const cleaned = String(raw || '')
    .replace(/^#+/, '')
    .replace(/[^\p{L}\p{N}_]+/gu, '')
    .trim();
  if (!cleaned) return '';
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
};

const dailyScore = (tag, dateKey, base = 400) => {
  const h = hash(`${dateKey}|${tag.toLowerCase()}`);
  const bump = (h % 900) + (Math.floor(h / 900) % 400);
  return base + bump;
};

const fetchArticleTagTrends = async (dateKey) => {
  try {
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const rows = await Article.aggregate([
      {
        $match: {
          status: ARTICLE_STATUS.PUBLISHED,
          publishedAt: { $gte: since },
          tags: { $exists: true, $ne: [] },
        },
      },
      { $unwind: '$tags' },
      {
        $group: {
          _id: { $toLower: '$tags' },
          label: { $first: '$tags' },
          count: { $sum: 1 },
          views: { $sum: { $ifNull: ['$views', 0] } },
        },
      },
      { $sort: { count: -1, views: -1 } },
      { $limit: 30 },
    ]);

    return rows
      .map((r) => {
        const tag = toHashtag(r.label);
        if (!tag || tag.length < 2) return null;
        const posts = dailyScore(tag, dateKey, 500) + r.count * 40 + Math.min(r.views, 2000);
        return {
          tag,
          tagTamil: '',
          category: 'news',
          posts,
          source: 'articles',
        };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
};

const curatedDailyPool = (dateKey, size) => {
  const seed = hash(`trending|${dateKey}`);
  const idxs = [];
  let x = seed;
  const bank = TRENDING_TOPIC_BANK;
  while (idxs.length < Math.min(size, bank.length)) {
    x = (Math.imul(x, 1103515245) + 12345) >>> 0;
    const i = x % bank.length;
    if (!idxs.includes(i)) idxs.push(i);
  }
  return idxs.map((i) => {
    const t = bank[i];
    return {
      tag: t.tag,
      tagTamil: t.tagTamil,
      category: t.category,
      posts: dailyScore(t.tag, dateKey),
      source: 'daily',
    };
  });
};

const mergeTrends = (articleTrends, curated, limit) => {
  const byTag = new Map();
  [...articleTrends, ...curated].forEach((row) => {
    const key = row.tag.toLowerCase();
    const prev = byTag.get(key);
    if (!prev) {
      byTag.set(key, { ...row });
      return;
    }
    byTag.set(key, {
      ...prev,
      tagTamil: prev.tagTamil || row.tagTamil,
      posts: Math.max(prev.posts, row.posts) + Math.floor(Math.min(prev.posts, row.posts) * 0.15),
      source: prev.source === 'articles' || row.source === 'articles' ? 'mixed' : prev.source,
    });
  });
  return [...byTag.values()].sort((a, b) => b.posts - a.posts).slice(0, limit);
};

export const fetchLiveTrending = async ({ force = false, limit = TRENDING_FULL_SIZE } = {}) => {
  const dateKey = istDateKey();
  const size = Math.min(Math.max(Number(limit) || TRENDING_FULL_SIZE, TRENDING_WIDGET_SIZE), 40);

  if (!force && cache.data && cache.key === `${dateKey}|${size}` && Date.now() - cache.at < CACHE_MS) {
    return { ...cache.data, fetchedAt: new Date().toISOString() };
  }

  const curated = curatedDailyPool(dateKey, Math.max(size, 12));
  const articleTrends = await fetchArticleTagTrends(dateKey);
  const items = mergeTrends(articleTrends, curated, size).map((row, i) => ({
    id: `trend-${dateKey}-${i + 1}`,
    rank: i + 1,
    title: `#${row.tag}`,
    tag: row.tag,
    titleTamil: row.tagTamil || '',
    category: row.category,
    posts: row.posts,
    source: row.source,
  }));

  const payload = {
    dateKey,
    language: 'ta',
    note: 'தினசரி தானியங்கி புதுப்பிப்பு · Daily auto-refresh',
    total: items.length,
    items,
    widgetSize: TRENDING_WIDGET_SIZE,
    updatedAt: new Date().toISOString(),
    fetchedAt: new Date().toISOString(),
  };

  cache.key = `${dateKey}|${size}`;
  cache.data = payload;
  cache.at = Date.now();
  return payload;
};

export default { fetchLiveTrending };
