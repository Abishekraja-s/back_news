import slugify from 'slugify';
import Article from '../models/Article.js';
import GoogleNewsItem from '../models/GoogleNewsItem.js';

export const generateSlug = async (title, excludeId = null) => {
  let baseSlug = slugify(title, { lower: true, strict: true, locale: 'ta' });
  if (!baseSlug) {
    baseSlug = slugify(title, { lower: true, strict: false }) || `article-${Date.now()}`;
  }

  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const query = { slug };
    if (excludeId) query._id = { $ne: excludeId };
    const existing = await Article.findOne(query);
    if (!existing) break;
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
};

export const generateGoogleNewsSlug = async (title, excludeId = null) => {
  let baseSlug = slugify(title, { lower: true, strict: true, locale: 'ta' });
  if (!baseSlug) {
    baseSlug = slugify(title, { lower: true, strict: false }) || `news-${Date.now()}`;
  }

  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const gnQuery = { slug };
    if (excludeId) gnQuery._id = { $ne: excludeId };
    const [articleExists, gnExists] = await Promise.all([
      Article.findOne({ slug }).select('_id').lean(),
      GoogleNewsItem.findOne(gnQuery).select('_id').lean(),
    ]);
    if (!articleExists && !gnExists) break;
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
};

export const paginate = (page = 1, limit = 10) => {
  const p = Math.max(1, parseInt(page, 10));
  const l = Math.min(50, Math.max(1, parseInt(limit, 10)));
  return { page: p, limit: l, skip: (p - 1) * l };
};

export const getImageUrl = (req, path) => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${req.protocol}://${req.get('host')}${path}`;
};
