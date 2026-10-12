/**
 * From Our Community — automatic daily post rotation (IST).
 */

import {
  COMMUNITY_AUTHORS,
  COMMUNITY_POST_BANK,
  COMMUNITY_WIDGET_SIZE,
  COMMUNITY_FULL_SIZE,
} from '../config/communityPosts.js';

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

const istClock = () => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return { hour: Number(get('hour')), minute: Number(get('minute')) };
};

const hash = (str) => {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h);
};

const pickUnique = (size, poolLen, seed) => {
  const idxs = [];
  let x = seed;
  while (idxs.length < Math.min(size, poolLen)) {
    x = (Math.imul(x, 1103515245) + 12345) >>> 0;
    const i = x % poolLen;
    if (!idxs.includes(i)) idxs.push(i);
  }
  return idxs;
};

const postedAgoLabel = (hoursAgo) => {
  if (hoursAgo < 1) return 'Just now';
  if (hoursAgo === 1) return '1 hour ago';
  if (hoursAgo < 24) return `${hoursAgo} hours ago`;
  if (hoursAgo < 48) return 'Yesterday';
  return `${Math.floor(hoursAgo / 24)} days ago`;
};

const postedAgoTamil = (hoursAgo) => {
  if (hoursAgo < 1) return 'இப்போது';
  if (hoursAgo === 1) return '1 மணி நேரம் முன்';
  if (hoursAgo < 24) return `${hoursAgo} மணி நேரம் முன்`;
  if (hoursAgo < 48) return 'நேற்று';
  return `${Math.floor(hoursAgo / 24)} நாட்கள் முன்`;
};

export const fetchLiveCommunityFeed = async ({
  force = false,
  limit = COMMUNITY_FULL_SIZE,
} = {}) => {
  const dateKey = istDateKey();
  const size = Math.min(
    Math.max(Number(limit) || COMMUNITY_FULL_SIZE, COMMUNITY_WIDGET_SIZE),
    COMMUNITY_POST_BANK.length
  );

  if (!force && cache.data && cache.key === `${dateKey}|${size}` && Date.now() - cache.at < CACHE_MS) {
    return { ...cache.data, fetchedAt: new Date().toISOString() };
  }

  const seed = hash(`community|${dateKey}`);
  const postIdxs = pickUnique(size, COMMUNITY_POST_BANK.length, seed);
  const authorIdxs = pickUnique(size, COMMUNITY_AUTHORS.length, seed ^ 0x9e3779b9);
  const clock = istClock();

  const items = postIdxs.map((pi, order) => {
    const post = COMMUNITY_POST_BANK[pi];
    const author = COMMUNITY_AUTHORS[authorIdxs[order] ?? order % COMMUNITY_AUTHORS.length];
    const h = hash(`${dateKey}|${post.text}|${author.name}`);
    const hoursAgo = 1 + (h % 10) + (order % 3);
    const likes = 12 + (h % 90) + order * 3;
    const comments = 3 + (h % 28) + (order % 5);
    const avatar = `https://picsum.photos/seed/${author.seed}-${dateKey}/64/64`;

    return {
      id: `community-${dateKey}-${order + 1}`,
      author: author.name,
      avatar,
      text: post.text,
      area: post.area,
      likes,
      comments,
      hoursAgo,
      postedAgo: postedAgoLabel(hoursAgo),
      postedAgoTamil: postedAgoTamil(hoursAgo),
      clockHint: `${String(Math.max(0, clock.hour - (hoursAgo % 12))).padStart(2, '0')}:${String(clock.minute).padStart(2, '0')}`,
    };
  });

  const payload = {
    dateKey,
    language: 'ta',
    note: 'தினசரி தானியங்கி புதுப்பிப்பு · Daily community refresh',
    total: items.length,
    items,
    widgetSize: COMMUNITY_WIDGET_SIZE,
    updatedAt: new Date().toISOString(),
    fetchedAt: new Date().toISOString(),
  };

  cache.key = `${dateKey}|${size}`;
  cache.data = payload;
  cache.at = Date.now();
  return payload;
};

export default { fetchLiveCommunityFeed };
