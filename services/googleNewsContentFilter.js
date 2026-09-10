/**
 * Detect generic Google News placeholder content (not real article data).
 */

export const GENERIC_GOOGLE_NEWS_DESC =
  'Comprehensive, up-to-date news coverage, aggregated from sources all over the world by Google News.';

/** Same generic Google News logo used for all items when publisher image unavailable */
export const GENERIC_GOOGLE_NEWS_IMAGE_ID = 'J6_coFbogxhRI9iM864NL_liGXvsQp2AupsKei7z0cNNfDvGUmWUy20nuUhkREQyrpY4bEeIBuc';

export const isGenericGoogleDescription = (text = '') => {
  const t = String(text).trim();
  if (!t) return true;
  return (
    /Comprehensive, up-to-date news coverage, aggregated from sources all over the world by Google News/i.test(t) ||
    t.length < 80
  );
};

export const isGenericGoogleImage = (url = '') => {
  if (!url?.trim()) return true;
  const u = url.trim();
  if (u.includes(GENERIC_GOOGLE_NEWS_IMAGE_ID)) return true;
  // Google News proxy thumbnails without real article photos
  if (u.includes('googleusercontent.com') && u.includes('=s0-w300')) return true;
  return false;
};

export const needsPublisherEnrichment = (item = {}) => {
  const desc = item.description || item.content || '';
  const image = item.image || '';
  return isGenericGoogleDescription(desc) || isGenericGoogleImage(image);
};

export default {
  isGenericGoogleDescription,
  isGenericGoogleImage,
  needsPublisherEnrichment,
};
