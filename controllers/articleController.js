import mongoose from 'mongoose';
import Article from '../models/Article.js';
import { sanitizeContent } from '../utils/sanitize.js';
import { generateSlug, paginate } from '../utils/helpers.js';
import { ARTICLE_STATUS } from '../config/constants.js';
import { invalidateRssCache } from '../services/rssFeedService.js';

const MUST_READ_POPULATE = {
  path: 'mustReadArticles',
  select: 'title slug featuredImage imageAlt excerpt publishedAt status category',
  populate: { path: 'category', select: 'name nameTamil slug' },
};

const populateFields = [
  { path: 'category', select: 'name nameTamil slug' },
  { path: 'subCategory', select: 'name nameTamil slug' },
  { path: 'district', select: 'name nameTamil slug' },
  { path: 'author', select: 'name slug profileImage designation' },
  MUST_READ_POPULATE,
];

const MAX_MUST_READ = 10;

/** Normalize editor-picked Must Read article IDs (unique, valid, exclude self, capped). */
const sanitizeMustReadArticles = (raw, excludeId = null) => {
  if (raw == null) return undefined;
  if (!Array.isArray(raw)) return [];
  const exclude = excludeId ? String(excludeId) : null;
  const seen = new Set();
  const out = [];
  for (const item of raw) {
    const id = String(item?._id || item || '').trim();
    if (!mongoose.Types.ObjectId.isValid(id)) continue;
    if (exclude && id === exclude) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= MAX_MUST_READ) break;
  }
  return out;
};

/** Build published filter with current time (do not cache Date at startup). */
const getPublishedQuery = () => ({
  status: ARTICLE_STATUS.PUBLISHED,
  $or: [
    { publishedAt: { $lte: new Date() } },
    { publishedAt: null },
    { publishedAt: { $exists: false } },
  ],
});

/** Ensure PUBLISHED articles always have a usable publishedAt */
const applyPublishTimestamp = (data = {}, existing = null) => {
  if (data.publishedAt === '' || data.publishedAt === undefined) {
    delete data.publishedAt;
  }
  if (data.status !== ARTICLE_STATUS.PUBLISHED) return data;

  const current = data.publishedAt || existing?.publishedAt;
  const parsed = current ? new Date(current) : null;
  const invalid = !parsed || Number.isNaN(parsed.getTime());
  if (invalid) {
    data.publishedAt = new Date();
  }
  return data;
};

export const getArticles = async (req, res, next) => {
  try {
    const { page, limit, skip } = paginate(req.query.page, req.query.limit);
    const query = {};

    if (req.query.status) query.status = req.query.status;
    if (req.query.category) query.category = req.query.category;
    if (req.query.author) query.author = req.query.author;
    if (req.query.district) query.district = req.query.district;

    if (!req.user) {
      Object.assign(query, getPublishedQuery());
    }

    const sort =
      query.status === ARTICLE_STATUS.PUBLISHED
        ? { publishedAt: -1, createdAt: -1 }
        : { createdAt: -1 };

    const [articles, total] = await Promise.all([
      Article.find(query)
        .populate(populateFields)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Article.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: articles,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

export const getArticleBySlug = async (req, res, next) => {
  try {
    const article = await Article.findOne({
      slug: req.params.slug,
      ...getPublishedQuery(),
    }).populate(populateFields);

    if (!article) {
      return res.status(404).json({ success: false, message: 'Article not found' });
    }

    article.views += 1;
    await article.save({ validateBeforeSave: false });

    const data = article.toObject();
    // Public response only — do not persist this filter (would wipe draft links)
    if (Array.isArray(data.mustReadArticles)) {
      data.mustReadArticles = data.mustReadArticles.filter(
        (a) => a && a.status === ARTICLE_STATUS.PUBLISHED
      );
    }

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getArticleById = async (req, res, next) => {
  try {
    const article = await Article.findById(req.params.id).populate(populateFields);
    if (!article) {
      return res.status(404).json({ success: false, message: 'Article not found' });
    }
    res.json({ success: true, data: article });
  } catch (error) {
    next(error);
  }
};

export const getLatest = async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 30);
    /** published (default) = real latest news; updated = recently touched, but not ancient seeds */
    const by = String(req.query.by || 'published').toLowerCase() === 'updated' ? 'updated' : 'published';
    const daysRaw = parseInt(req.query.days, 10);
    const days = Number.isFinite(daysRaw) ? Math.min(Math.max(daysRaw, 0), 90) : by === 'updated' ? 7 : 0;

    const query = { ...getPublishedQuery() };
    const now = new Date();

    if (by === 'updated') {
      const updatedSince = new Date(now.getTime() - (days || 7) * 24 * 60 * 60 * 1000);
      // Ignore seed/old posts that only got an updatedAt bump
      const publishedSince = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      query.updatedAt = { $gte: updatedSince };
      query.publishedAt = { $gte: publishedSince, $lte: now };
    } else if (days > 0) {
      const publishedSince = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      query.publishedAt = { $gte: publishedSince, $lte: now };
    }

    const sort =
      by === 'updated' ? { updatedAt: -1, publishedAt: -1 } : { publishedAt: -1, updatedAt: -1 };

    let articles = await Article.find(query)
      .populate(populateFields)
      .sort(sort)
      .limit(limit)
      .select('title slug excerpt featuredImage imageAlt category author publishedAt updatedAt')
      .lean();

    // Fallback: if "updated" window is empty, return newest published
    if (!articles.length && by === 'updated') {
      articles = await Article.find(getPublishedQuery())
        .populate(populateFields)
        .sort({ publishedAt: -1, updatedAt: -1 })
        .limit(limit)
        .select('title slug excerpt featuredImage imageAlt category author publishedAt updatedAt')
        .lean();
    }

    res.json({ success: true, data: articles, meta: { by, days } });
  } catch (error) {
    next(error);
  }
};

export const getFeatured = async (req, res, next) => {
  try {
    const articles = await Article.find({ ...getPublishedQuery(), isFeatured: true })
      .populate(populateFields)
      .sort({ publishedAt: -1 })
      .limit(5)
      .lean();

    res.json({ success: true, data: articles });
  } catch (error) {
    next(error);
  }
};

export const getMustWatch = async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 8, 20);
    const articles = await Article.find({ ...getPublishedQuery(), isMustWatch: true })
      .populate(populateFields)
      .sort({ publishedAt: -1 })
      .limit(limit)
      .lean();

    res.json({ success: true, data: articles });
  } catch (error) {
    next(error);
  }
};

export const getPopular = async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 30);
    /** Default: last 7 days only (ignore older high-view articles) */
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 7, 1), 30);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const now = new Date();

    const articles = await Article.find({
      status: ARTICLE_STATUS.PUBLISHED,
      $and: [
        {
          $or: [
            { publishedAt: { $gte: since, $lte: now } },
            // Fallback when publishedAt missing — still must be recent
            {
              $and: [
                {
                  $or: [{ publishedAt: null }, { publishedAt: { $exists: false } }],
                },
                { createdAt: { $gte: since, $lte: now } },
              ],
            },
          ],
        },
      ],
    })
      .populate(populateFields)
      .sort({ views: -1, publishedAt: -1 })
      .limit(limit)
      .select('title slug excerpt featuredImage category author publishedAt views createdAt')
      .lean();

    res.json({ success: true, data: articles, meta: { days, since } });
  } catch (error) {
    next(error);
  }
};

export const getByCategory = async (req, res, next) => {
  try {
    const { page, limit, skip } = paginate(req.query.page, req.query.limit);
    const Category = (await import('../models/Category.js')).default;
    const category = await Category.findOne({ slug: req.params.slug });

    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    const query = { ...getPublishedQuery(), category: category._id };
    const [articles, total] = await Promise.all([
      Article.find(query).populate(populateFields).sort({ publishedAt: -1 }).skip(skip).limit(limit).lean(),
      Article.countDocuments(query),
    ]);

    res.json({
      success: true,
      category,
      data: articles,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

export const getByDistrict = async (req, res, next) => {
  try {
    const { page, limit, skip } = paginate(req.query.page, req.query.limit);
    const Category = (await import('../models/Category.js')).default;
    const district = await Category.findOne({ slug: req.params.district, isDistrict: true });

    if (!district) {
      return res.status(404).json({ success: false, message: 'District not found' });
    }

    const query = { ...getPublishedQuery(), district: district._id };
    const [articles, total] = await Promise.all([
      Article.find(query).populate(populateFields).sort({ publishedAt: -1 }).skip(skip).limit(limit).lean(),
      Article.countDocuments(query),
    ]);

    res.json({
      success: true,
      district,
      data: articles,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

export const searchArticles = async (req, res, next) => {
  try {
    const q = req.query.q?.trim();
    if (!q) {
      return res.json({ success: true, data: [], total: 0 });
    }

    const { page, limit, skip } = paginate(req.query.page, req.query.limit);

    const query = {
      ...getPublishedQuery(),
      $text: { $search: q },
    };

    const [articles, total] = await Promise.all([
      Article.find(query, { score: { $meta: 'textScore' } })
        .populate(populateFields)
        .sort({ score: { $meta: 'textScore' } })
        .skip(skip)
        .limit(limit)
        .lean(),
      Article.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: articles,
      total,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

export const getRelated = async (req, res, next) => {
  try {
    const article = await Article.findOne({ slug: req.params.slug });
    if (!article) {
      return res.status(404).json({ success: false, message: 'Article not found' });
    }

    const related = await Article.find({
      ...getPublishedQuery(),
      _id: { $ne: article._id },
      category: article.category,
    })
      .populate(populateFields)
      .sort({ publishedAt: -1 })
      .limit(6)
      .lean();

    res.json({ success: true, data: related });
  } catch (error) {
    next(error);
  }
};

export const createArticle = async (req, res, next) => {
  try {
    const data = applyPublishTimestamp({ ...req.body, createdBy: req.user._id });
    data.content = sanitizeContent(data.content);
    data.slug = data.slug || (await generateSlug(data.title));
    if (Object.prototype.hasOwnProperty.call(req.body, 'mustReadArticles')) {
      data.mustReadArticles = sanitizeMustReadArticles(req.body.mustReadArticles);
    }

    if (data.status === ARTICLE_STATUS.PUBLISHED && !data.publishedAt) {
      data.publishedAt = new Date();
    }

    const article = await Article.create(data);
    const populated = await Article.findById(article._id).populate(populateFields);
    if (data.status === ARTICLE_STATUS.PUBLISHED) invalidateRssCache();
    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    next(error);
  }
};

export const updateArticle = async (req, res, next) => {
  try {
    let article = await Article.findById(req.params.id);
    if (!article) {
      return res.status(404).json({ success: false, message: 'Article not found' });
    }

    if (req.user.role === 'AUTHOR' && article.createdBy?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const data = applyPublishTimestamp({ ...req.body }, article);
    if (data.content) data.content = sanitizeContent(data.content);
    if (data.title && !data.slug) data.slug = await generateSlug(data.title, req.params.id);
    if (Object.prototype.hasOwnProperty.call(req.body, 'mustReadArticles')) {
      data.mustReadArticles = sanitizeMustReadArticles(req.body.mustReadArticles, req.params.id);
    }

    if (data.status === ARTICLE_STATUS.PUBLISHED && !data.publishedAt && !article.publishedAt) {
      data.publishedAt = new Date();
    }

    article = await Article.findByIdAndUpdate(req.params.id, data, {
      new: true,
      runValidators: true,
    }).populate(populateFields);

    invalidateRssCache();
    res.json({ success: true, data: article });
  } catch (error) {
    next(error);
  }
};

export const deleteArticle = async (req, res, next) => {
  try {
    const article = await Article.findById(req.params.id);
    if (!article) {
      return res.status(404).json({ success: false, message: 'Article not found' });
    }

    const permanent =
      req.query.permanent === 'true' || article.status === ARTICLE_STATUS.TRASH;

    if (permanent) {
      await Article.findByIdAndDelete(req.params.id);
      invalidateRssCache();
      return res.json({ success: true, message: 'Article permanently deleted' });
    }

    await Article.findByIdAndUpdate(req.params.id, {
      status: ARTICLE_STATUS.TRASH,
    });
    invalidateRssCache();
    res.json({ success: true, message: 'Article moved to trash' });
  } catch (error) {
    next(error);
  }
};

export const addLiveUpdate = async (req, res, next) => {
  try {
    const article = await Article.findById(req.params.id);
    if (!article) {
      return res.status(404).json({ success: false, message: 'Article not found' });
    }

    article.liveUpdates.push(req.body);
    article.isLive = true;
    await article.save();

    res.json({ success: true, data: article.liveUpdates });
  } catch (error) {
    next(error);
  }
};

export const getDashboardStats = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      todayCount,
      published,
      drafts,
      pending,
      scheduled,
      totalViews,
      breakingCount,
      authorCount,
      userCount,
      adCount,
    ] = await Promise.all([
      Article.countDocuments({ createdAt: { $gte: today } }),
      Article.countDocuments({ status: ARTICLE_STATUS.PUBLISHED }),
      Article.countDocuments({ status: ARTICLE_STATUS.DRAFT }),
      Article.countDocuments({ status: ARTICLE_STATUS.PENDING }),
      Article.countDocuments({ status: ARTICLE_STATUS.SCHEDULED }),
      Article.aggregate([{ $group: { _id: null, total: { $sum: '$views' } } }]),
      (await import('../models/BreakingNews.js')).default.countDocuments({ isActive: true }),
      (await import('../models/Author.js')).default.countDocuments({ status: 'active' }),
      (await import('../models/User.js')).default.countDocuments(),
      (await import('../models/Advertisement.js')).default.countDocuments({ isActive: true }),
    ]);

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dailyViews = await Article.aggregate([
      { $match: { publishedAt: { $gte: thirtyDaysAgo }, status: ARTICLE_STATUS.PUBLISHED } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$publishedAt' } },
          views: { $sum: '$views' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const topArticles = await Article.find({ status: ARTICLE_STATUS.PUBLISHED })
      .sort({ views: -1 })
      .limit(5)
      .select('title slug views')
      .lean();

    const categoryStats = await Article.aggregate([
      { $match: { status: ARTICLE_STATUS.PUBLISHED } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    res.json({
      success: true,
      data: {
        todayCount,
        published,
        drafts,
        pending,
        scheduled,
        totalViews: totalViews[0]?.total || 0,
        breakingCount,
        authorCount,
        userCount,
        adCount,
        dailyViews,
        topArticles,
        categoryStats,
      },
    });
  } catch (error) {
    next(error);
  }
};

