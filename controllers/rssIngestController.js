import RssFeedSource from '../models/RssFeedSource.js';
import Article from '../models/Article.js';
import { ARTICLE_STATUS } from '../config/constants.js';
import { ingestFeedSource, runAllRssIngest } from '../services/rssIngestService.js';
import { invalidateRssCache } from '../services/rssFeedService.js';
import { paginate } from '../utils/helpers.js';

const populateSource = [
  { path: 'category', select: 'name nameTamil slug' },
  { path: 'author', select: 'name slug' },
];

export const listSources = async (req, res, next) => {
  try {
    const sources = await RssFeedSource.find()
      .populate(populateSource)
      .sort({ updatedAt: -1 });
    res.json({ success: true, data: sources });
  } catch (error) {
    next(error);
  }
};

export const createSource = async (req, res, next) => {
  try {
    const {
      name,
      feedUrl,
      category,
      author,
      tags,
      enabled,
      autoFetchEnabled,
      fetchIntervalMinutes,
      createAsStatus,
      maxItemsPerFetch,
      fetchFullContent,
      translateToTamil,
    } = req.body;

    if (!name?.trim() || !feedUrl?.trim() || !category || !author) {
      return res.status(400).json({
        success: false,
        message: 'Name, feed URL, category and author are required',
      });
    }

    const source = await RssFeedSource.create({
      name: name.trim(),
      feedUrl: feedUrl.trim(),
      category,
      author,
      tags: Array.isArray(tags)
        ? tags
        : String(tags || '')
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
      enabled: enabled !== false,
      autoFetchEnabled: Boolean(autoFetchEnabled),
      fetchIntervalMinutes: Number(fetchIntervalMinutes) || 60,
      createAsStatus: createAsStatus || ARTICLE_STATUS.DRAFT,
      maxItemsPerFetch: Number(maxItemsPerFetch) || 20,
      fetchFullContent: fetchFullContent !== false,
      translateToTamil: translateToTamil !== false,
      createdBy: req.user._id,
    });

    const populated = await RssFeedSource.findById(source._id).populate(populateSource);
    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'This feed URL already exists' });
    }
    next(error);
  }
};

export const updateSource = async (req, res, next) => {
  try {
    const source = await RssFeedSource.findById(req.params.id);
    if (!source) {
      return res.status(404).json({ success: false, message: 'RSS source not found' });
    }

    const fields = [
      'name',
      'feedUrl',
      'category',
      'author',
      'enabled',
      'autoFetchEnabled',
      'fetchIntervalMinutes',
      'createAsStatus',
      'maxItemsPerFetch',
      'fetchFullContent',
      'translateToTamil',
    ];
    fields.forEach((key) => {
      if (req.body[key] !== undefined) source[key] = req.body[key];
    });
    if (req.body.tags !== undefined) {
      source.tags = Array.isArray(req.body.tags)
        ? req.body.tags
        : String(req.body.tags || '')
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean);
    }

    await source.save();
    const populated = await RssFeedSource.findById(source._id).populate(populateSource);
    res.json({ success: true, data: populated });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'This feed URL already exists' });
    }
    next(error);
  }
};

export const deleteSource = async (req, res, next) => {
  try {
    const source = await RssFeedSource.findByIdAndDelete(req.params.id);
    if (!source) {
      return res.status(404).json({ success: false, message: 'RSS source not found' });
    }
    res.json({ success: true, message: 'RSS source deleted' });
  } catch (error) {
    next(error);
  }
};

export const fetchNow = async (req, res, next) => {
  try {
    const { sourceId } = req.body || {};
    if (sourceId) {
      const source = await RssFeedSource.findById(sourceId);
      if (!source) {
        return res.status(404).json({ success: false, message: 'RSS source not found' });
      }
      if (!source.enabled) {
        return res.status(400).json({ success: false, message: 'Source is disabled' });
      }
      const result = await ingestFeedSource(source, { userId: req.user._id });
      return res.json({
        success: result.success,
        message: result.message || result.error,
        data: result,
      });
    }

    const result = await runAllRssIngest({ userId: req.user._id, onlyAuto: false });
    res.json({
      success: true,
      message: `Fetched ${result.fetched} items · created ${result.created} · skipped ${result.skipped}`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const listRssArticles = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, q, feedId } = req.query;
    const filter = { importSource: 'rss' };
    if (status) filter.status = status;
    if (feedId) filter.rssFeed = feedId;
    if (q?.trim()) {
      filter.$or = [
        { title: new RegExp(q.trim(), 'i') },
        { excerpt: new RegExp(q.trim(), 'i') },
      ];
    }

    const { page: pageNum, limit: limitNum, skip } = paginate(page, limit);
    const [items, total] = await Promise.all([
      Article.find(filter)
        .populate('category', 'name nameTamil slug')
        .populate('author', 'name slug')
        .populate('rssFeed', 'name feedUrl')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Article.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: items,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.max(Math.ceil(total / limitNum), 1),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const publishRssArticle = async (req, res, next) => {
  try {
    const article = await Article.findOne({ _id: req.params.id, importSource: 'rss' });
    if (!article) {
      return res.status(404).json({ success: false, message: 'RSS article not found' });
    }
    article.status = ARTICLE_STATUS.PUBLISHED;
    if (!article.publishedAt) article.publishedAt = new Date();
    await article.save();
    invalidateRssCache();
    res.json({ success: true, data: article, message: 'Published' });
  } catch (error) {
    next(error);
  }
};

export const bulkPublishRssArticles = async (req, res, next) => {
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
    if (!ids.length) {
      return res.status(400).json({ success: false, message: 'No article ids provided' });
    }
    const result = await Article.updateMany(
      { _id: { $in: ids }, importSource: 'rss' },
      {
        $set: {
          status: ARTICLE_STATUS.PUBLISHED,
          publishedAt: new Date(),
        },
      }
    );
    invalidateRssCache();
    res.json({
      success: true,
      message: `Published ${result.modifiedCount} articles`,
      data: { modified: result.modifiedCount },
    });
  } catch (error) {
    next(error);
  }
};

export const bulkDeleteRssArticles = async (req, res, next) => {
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids.filter(Boolean) : [];
    if (!ids.length) {
      return res.status(400).json({ success: false, message: 'No article ids provided' });
    }

    const toDelete = await Article.find({ _id: { $in: ids }, importSource: 'rss' })
      .select('status')
      .lean();
    if (!toDelete.length) {
      return res.status(404).json({ success: false, message: 'No matching RSS articles found' });
    }

    const hadPublished = toDelete.some((a) => a.status === ARTICLE_STATUS.PUBLISHED);
    const result = await Article.deleteMany({
      _id: { $in: toDelete.map((a) => a._id) },
      importSource: 'rss',
    });

    if (hadPublished) invalidateRssCache();
    res.json({
      success: true,
      message: `Deleted ${result.deletedCount} articles`,
      data: { deleted: result.deletedCount },
    });
  } catch (error) {
    next(error);
  }
};

const buildImportDateFilter = (from, to) => {
  const createdAt = {};
  if (from) {
    const start = new Date(`${String(from).slice(0, 10)}T00:00:00.000`);
    if (!Number.isNaN(start.getTime())) createdAt.$gte = start;
  }
  if (to) {
    const end = new Date(`${String(to).slice(0, 10)}T23:59:59.999`);
    if (!Number.isNaN(end.getTime())) createdAt.$lte = end;
  }
  return Object.keys(createdAt).length ? { createdAt } : null;
};

export const deleteRssArticlesByDate = async (req, res, next) => {
  try {
    const { from, to, status, dryRun } = req.body || {};
    if (!from && !to) {
      return res.status(400).json({
        success: false,
        message: 'Provide from and/or to date (YYYY-MM-DD)',
      });
    }

    const dateFilter = buildImportDateFilter(from, to);
    if (!dateFilter) {
      return res.status(400).json({ success: false, message: 'Invalid date range' });
    }

    const filter = { importSource: 'rss', ...dateFilter };
    if (status && Object.values(ARTICLE_STATUS).includes(status)) {
      filter.status = status;
    }

    const count = await Article.countDocuments(filter);
    if (dryRun) {
      return res.json({
        success: true,
        data: { count, filter: { from: from || null, to: to || null, status: status || null } },
        message: `${count} articles match`,
      });
    }

    if (!count) {
      return res.json({
        success: true,
        message: 'No articles matched that date range',
        data: { deleted: 0 },
      });
    }

    const hadPublished = await Article.exists({
      ...filter,
      status: ARTICLE_STATUS.PUBLISHED,
    });
    const result = await Article.deleteMany(filter);
    if (hadPublished) invalidateRssCache();

    res.json({
      success: true,
      message: `Deleted ${result.deletedCount} articles by date`,
      data: { deleted: result.deletedCount },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteRssArticle = async (req, res, next) => {
  try {
    const article = await Article.findOneAndDelete({
      _id: req.params.id,
      importSource: 'rss',
    });
    if (!article) {
      return res.status(404).json({ success: false, message: 'RSS article not found' });
    }
    if (article.status === ARTICLE_STATUS.PUBLISHED) invalidateRssCache();
    res.json({ success: true, message: 'Deleted' });
  } catch (error) {
    next(error);
  }
};
