/**
 * Resolve post-2024 Google News article wrappers (news.google.com/rss/articles/CBMi…)
 * to the real publisher URL using Google's batchexecute RPC.
 */

const BATCH_EXECUTE_URL = 'https://news.google.com/_/DotsSplashUi/data/batchexecute';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export const isGoogleNewsWrapper = (url = '') =>
  typeof url === 'string' && url.includes('news.google.com') && url.includes('/articles/');

const extractArticleId = (url) => {
  try {
    const u = new URL(url);
    const match = u.pathname.match(/\/articles\/([^/]+)/);
    return match?.[1]?.split('?')[0] || null;
  } catch {
    return null;
  }
};

const fetchDecodeParams = async (articleId) => {
  const paths = [
    `https://news.google.com/rss/articles/${articleId}`,
    `https://news.google.com/articles/${articleId}`,
  ];

  for (const pageUrl of paths) {
    try {
      const res = await fetch(pageUrl, {
        headers: { 'User-Agent': UA, Accept: 'text/html' },
        redirect: 'follow',
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) continue;
      const html = await res.text();
      const signature = html.match(/data-n-a-sg="([^"]+)"/)?.[1];
      const timestamp = html.match(/data-n-a-ts="([^"]+)"/)?.[1];
      if (signature && timestamp && /^\d+$/.test(timestamp)) {
        return { signature, timestamp, pageUrl: res.url || pageUrl };
      }
    } catch {
      /* try next path */
    }
  }
  return null;
};

const callBatchExecute = async (articleId, timestamp, signature) => {
  const rpcInner = JSON.stringify([
    'garturlreq',
    [
      [
        'X',
        'X',
        ['X', 'X'],
        null,
        null,
        1,
        1,
        'IN:en',
        null,
        1,
        null,
        null,
        null,
        null,
        null,
        0,
        1,
      ],
      'X',
      'X',
      1,
      [1, 1, 1],
      1,
      1,
      null,
      0,
      0,
      null,
      0,
    ],
    articleId,
    Number(timestamp),
    signature,
  ]);

  const fReq = JSON.stringify([[['Fbv4je', rpcInner, null, 'generic']]]);

  const body = new URLSearchParams({ 'f.req': fReq }).toString();

  const res = await fetch(BATCH_EXECUTE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      Referer: 'https://news.google.com/',
      'User-Agent': UA,
    },
    body,
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) return null;

  let text = await res.text();
  text = text.replace(/^\)\]\}'[\r\n]*/, '').trim();
  const firstLine = text.split('\n')[0]?.trim();
  if (/^\d+$/.test(firstLine)) {
    text = text.slice(firstLine.length).trim();
  }

  const envelopes = JSON.parse(text);
  for (const env of envelopes) {
    if (Array.isArray(env) && env[0] === 'wrb.fr' && env[1] === 'Fbv4je' && env[2]) {
      const payload = JSON.parse(env[2]);
      if (payload?.[0] === 'garturlres' && typeof payload[1] === 'string') {
        return payload[1];
      }
    }
  }
  return null;
};

/** Resolve Google News wrapper → publisher article URL */
export const resolveGoogleNewsUrl = async (url) => {
  if (!isGoogleNewsWrapper(url)) return null;

  const articleId = extractArticleId(url);
  if (!articleId) return null;

  const params = await fetchDecodeParams(articleId);
  if (!params) return null;

  try {
    const publisherUrl = await callBatchExecute(articleId, params.timestamp, params.signature);
    if (publisherUrl && !publisherUrl.includes('news.google.com')) {
      return publisherUrl;
    }
  } catch (err) {
    console.warn('[GoogleNewsDecoder]', articleId.slice(0, 20), err.message);
  }
  return null;
};

export default { resolveGoogleNewsUrl, isGoogleNewsWrapper };
