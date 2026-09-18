import Article from '../models/Article.js';
import { sanitizeContent } from '../utils/sanitize.js';
import { generateSlug, paginate } from '../utils/helpers.js';
import { ARTICLE_STATUS } from '../config/constants.js';
import { invalidateRssCache } from '../services/rssFeedService.js';

const populateFields = [
  { path: 'category', select: 'name nameTamil slug' },
  { path: 'subCategory', select: 'name nameTamil slug' },
  { path: 'district', select: 'name nameTamil slug' },
  { path: 'author', select: 'name slug profileImage designation' },
];

const publishedQuery = {
  status: ARTICLE_STATUS.PUBLISHED,
  publishedAt: { $lte: new Date() },
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
      Object.assign(query, publishedQuery);
    }

    const [articles, total] = await Promise.all([
      Article.find(query)
        .populate(populateFields)
        .sort({ createdAt: -1 })
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
      ...publishedQuery,
    }).populate(populateFields);

    if (!article) {
      return res.status(404).json({ success: false, message: 'Article not found' });
    }

    article.views += 1;
    await article.save({ validateBeforeSave: false });

    res.json({ success: true, data: article });
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
    const limit = Math.min(parseInt(req.query.limit) || 10, 30);
    const articles = await Article.find(publishedQuery)
      .populate(populateFields)
      .sort({ publishedAt: -1 })
      .limit(limit)
      .select('title slug excerpt featuredImage category author publishedAt')
      .lean();

    res.json({ success: true, data: articles });
  } catch (error) {
    next(error);
  }
};

export const getFeatured = async (req, res, next) => {
  try {
    const articles = await Article.find({ ...publishedQuery, isFeatured: true })
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
    const articles = await Article.find({ ...publishedQuery, isMustWatch: true })
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
    const limit = Math.min(parseInt(req.query.limit) || 10, 30);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const articles = await Article.find({
      ...publishedQuery,
      publishedAt: { $gte: sevenDaysAgo },
    })
      .populate(populateFields)
      .sort({ views: -1 })
      .limit(limit)
      .select('title slug excerpt featuredImage category author publishedAt views')
      .lean();

    res.json({ success: true, data: articles });
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

    const query = { ...publishedQuery, category: category._id };
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

    const query = { ...publishedQuery, district: district._id };
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
      ...publishedQuery,
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
      ...publishedQuery,
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
    const data = { ...req.body, createdBy: req.user._id };
    data.content = sanitizeContent(data.content);
    data.slug = data.slug || (await generateSlug(data.title));

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

    const data = { ...req.body };
    if (data.content) data.content = sanitizeContent(data.content);
    if (data.title && !data.slug) data.slug = await generateSlug(data.title, req.params.id);

    if (data.status === ARTICLE_STATUS.PUBLISHED && !article.publishedAt) {
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
