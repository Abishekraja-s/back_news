import GoogleNewsConfig from '../models/GoogleNewsConfig.js';
import GoogleNewsItem from '../models/GoogleNewsItem.js';
import { fetchGoogleNewsFromConfig, isValidImageUrl } from '../services/googleNewsService.js';
import {
  prepareGoogleNewsTextFields,
  sanitizeItemForListing,
  sanitizeItemForDetail,
  isJunkArticleContent,
} from '../services/googleNewsTextUtils.js';
import { enrichArticleFromUrl, enrichRssItem } from '../services/articleEnrichmentService.js';
import { isGenericGoogleImage, isGenericGoogleDescription } from '../services/googleNewsContentFilter.js';
import { generateGoogleNewsSlug } from '../utils/helpers.js';

const DEFAULT_CONFIG = {
  key: 'default',
  sources: [],
  categories: ['WORLD', 'NATION', 'BUSINESS', 'TECHNOLOGY', 'SPORTS'],
  keywords: ['Tamil Nadu', 'India'],
  language: 'en',
  country: 'IN',
  updateFrequencyMinutes: 60,
  autoFetchEnabled: false,
  maxItemsPerFetch: 20,
  autoPublish: false,
  showOnHomepage: true,
  homepageTitle: 'Google News',
};

const publishedFilter = { status: 'published', isActive: true };

export const getOrCreateConfig = async () => {
  let config = await GoogleNewsConfig.findOne({ key: 'default' });
  if (!config) {
    config = await GoogleNewsConfig.create(DEFAULT_CONFIG);
  }
  return config;
};

const parseList = (value) => {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  if (typeof value === 'string') {
    return value.split(/[\n,]+/).map((v) => v.trim()).filter(Boolean);
  }
  return [];
};

/** Prepare new item for DB — plain text only */
const prepareImportItem = async (item, config) => {
  const title = String(item.title || '').trim();
  const textFields = prepareGoogleNewsTextFields(item);
  const image = isValidImageUrl(item.image) && !isGenericGoogleImage(item.image) ? String(item.image).trim() : '';
  const slug = await generateGoogleNewsSlug(title);

  return {
    guid: item.guid || item.link,
    slug,
    title,
    link: String(item.link).trim(),
    sourceName: String(item.sourceName || '').trim(),
    sourceUrl: String(item.sourceUrl || '').trim(),
    description: textFields.description,
    descriptionHtml: textFields.descriptionHtml,
    content: textFields.content,
    excerpt: textFields.excerpt,
    image,
    category: String(item.category || '').trim(),
    keywords: item.keywords || [],
    language: item.language || config.language,
    country: item.country || config.country,
    publishedAt: item.publishedAt ? new Date(item.publishedAt) : new Date(),
    adminEdited: false,
  };
};

/** Import — skip duplicates, never overwrite existing records */
export const importFetchedItems = async (items, config) => {
  let created = 0;
  let skipped = 0;
  const status = config.autoPublish ? 'published' : 'pending';

  for (const item of items) {
    const existing = await GoogleNewsItem.findOne({
      $or: [{ guid: item.guid }, { link: item.link }],
    });
    if (existing) {
      skipped += 1;
      continue;
    }

    try {
      let enriched = item;
      const needsEnrich =
        isGenericGoogleImage(item.image) ||
        isGenericGoogleDescription(item.content) ||
        isGenericGoogleDescription(item.description) ||
        isJunkArticleContent(item.content) ||
        isJunkArticleContent(item.description) ||
        !isValidImageUrl(item.image) ||
        (item.content || item.description || '').length < 120;
      if (needsEnrich) {
        enriched = await enrichRssItem(item);
      }
      const doc = await prepareImportItem(enriched, config);
      await GoogleNewsItem.create({
        ...doc,
        fetchedAt: new Date(),
        status,
        isActive: true,
      });
      created += 1;
    } catch (err) {
      if (err.code === 11000) skipped += 1;
      else throw err;
    }
  }

  return { created, skipped, total: items.length };
};

let syncInProgress = false;

export const runGoogleNewsFetch = async (label = 'manual') => {
  if (syncInProgress) {
    return {
      success: false,
      skipped: true,
      reason: 'sync_in_progress',
      label,
      created: 0,
      skipped: 0,
      fetched: 0,
    };
  }

  syncInProgress = true;
  const config = await getOrCreateConfig();

  try {
    const items = await fetchGoogleNewsFromConfig(config);
    const result = await importFetchedItems(items, config);
    config.lastFetchAt = new Date();
    config.lastFetchStatus = 'success';
    config.lastFetchError = '';
    config.lastFetchCount = result.created;
    await config.save();
    return { success: true, label, ...result, fetched: items.length };
  } catch (err) {
    config.lastFetchAt = new Date();
    config.lastFetchStatus = 'error';
    config.lastFetchError = err.message;
    await config.save();
    return { success: false, label, error: err.message, created: 0, skipped: 0, fetched: 0 };
  } finally {
    syncInProgress = false;
  }
};

export const getConfig = async (req, res, next) => {
  try {
    const config = await getOrCreateConfig();
    const counts = await GoogleNewsItem.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    const byStatus = Object.fromEntries(counts.map((c) => [c._id, c.count]));
    res.json({
      success: true,
      data: config,
      counts: {
        pending: byStatus.pending || 0,
        published: byStatus.published || 0,
        rejected: byStatus.rejected || 0,
        draft: byStatus.draft || 0,
        total: Object.values(byStatus).reduce((a, b) => a + b, 0),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateConfig = async (req, res, next) => {
  try {
    const config = await getOrCreateConfig();
    const body = req.body || {};

    if (body.sources !== undefined) config.sources = parseList(body.sources);
    if (body.categories !== undefined) config.categories = parseList(body.categories);
    if (body.keywords !== undefined) config.keywords = parseList(body.keywords);
    if (body.language !== undefined) config.language = String(body.language).trim().toLowerCase();
    if (body.country !== undefined) config.country = String(body.country).trim().toUpperCase();
    if (body.updateFrequencyMinutes !== undefined) config.updateFrequencyMinutes = Number(body.updateFrequencyMinutes);
    if (body.autoFetchEnabled !== undefined) config.autoFetchEnabled = Boolean(body.autoFetchEnabled);
    if (body.autoSyncEnabled !== undefined) config.autoSyncEnabled = Boolean(body.autoSyncEnabled);
    if (body.autoSyncIntervalSeconds !== undefined) {
      const sec = Number(body.autoSyncIntervalSeconds);
      if (Number.isNaN(sec) || sec < 10 || sec > 300) {
        return res.status(400).json({ success: false, message: 'Auto sync interval must be 10–300 seconds' });
      }
      config.autoSyncIntervalSeconds = sec;
    }
    if (body.autoPublish !== undefined) config.autoPublish = Boolean(body.autoPublish);
    if (body.showOnHomepage !== undefined) config.showOnHomepage = Boolean(body.showOnHomepage);
    if (body.maxItemsPerFetch !== undefined) config.maxItemsPerFetch = Number(body.maxItemsPerFetch);
    if (body.homepageTitle !== undefined) config.homepageTitle = String(body.homepageTitle).trim() || 'Google News';

    await config.save();
    res.json({ success: true, data: config, message: 'Google News configuration saved' });
  } catch (error) {
    next(error);
  }
};

export const fetchNow = async (req, res, next) => {
  try {
    const result = await runGoogleNewsFetch(req.body?.label || 'manual');
    if (result.skipped) {
      return res.json({
        success: true,
        message: 'Sync already in progress',
        inProgress: true,
        data: result,
      });
    }
    if (!result.success) {
      return res.status(502).json({ success: false, message: result.error || 'Fetch failed', data: result });
    }
    res.json({
      success: true,
      message: `Fetched ${result.fetched} items — ${result.created} new, ${result.skipped} duplicates skipped`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const buildAdminFilter = (query) => {
  const filter = {};
  if (query.status && query.status !== 'all') filter.status = query.status;
  if (query.category?.trim()) {
    filter.category = new RegExp(String(query.category).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  }
  if (query.source?.trim()) {
    filter.sourceName = new RegExp(String(query.source).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  }
  if (query.dateFrom || query.dateTo) {
    filter.publishedAt = {};
    if (query.dateFrom) filter.publishedAt.$gte = new Date(query.dateFrom);
    if (query.dateTo) {
      const end = new Date(query.dateTo);
      end.setHours(23, 59, 59, 999);
      filter.publishedAt.$lte = end;
    }
  }
  if (query.q?.trim()) filter.$text = { $search: query.q.trim() };
  return filter;
};

export const getAdminFilterOptions = async (req, res, next) => {
  try {
    const [categories, sources] = await Promise.all([
      GoogleNewsItem.distinct('category', { category: { $ne: '' } }),
      GoogleNewsItem.distinct('sourceName', { sourceName: { $ne: '' } }),
    ]);
    res.json({
      success: true,
      data: {
        categories: categories.filter(Boolean).sort(),
        sources: sources.filter(Boolean).sort(),
        statuses: ['pending', 'published', 'rejected', 'draft'],
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminItems = async (req, res, next) => {
  try {
    const filter = buildAdminFilter(req.query);
    const pageNum = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [items, total] = await Promise.all([
      GoogleNewsItem.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
      GoogleNewsItem.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: items,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) || 1 },
    });
  } catch (error) {
    next(error);
  }
};

export const createItem = async (req, res, next) => {
  try {
    if (!req.body.title?.trim()) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }
    if (!req.body.link?.trim()) {
      return res.status(400).json({ success: false, message: 'Original article URL is required' });
    }

    const doc = await prepareImportItem(
      {
        ...req.body,
        guid: req.body.guid || req.body.link,
        image: isValidImageUrl(req.body.image) ? req.body.image : '',
      },
      await getOrCreateConfig()
    );

    if (req.body.slug?.trim()) {
      doc.slug = await generateGoogleNewsSlug(req.body.slug.trim());
    }

    doc.status = req.body.status || 'draft';
    doc.isActive = req.body.isActive !== false;
    doc.isMustRead = Boolean(req.body.isMustRead);
    doc.isMustWatch = Boolean(req.body.isMustWatch);
    doc.displayOrder = Number(req.body.displayOrder) || 0;
    doc.notes = String(req.body.notes || '').trim();
    doc.adminEdited = true;
    doc.reviewedBy = req.user?._id;
    doc.reviewedAt = new Date();

    const item = await GoogleNewsItem.create(doc);
    res.status(201).json({ success: true, data: item, message: 'News item created' });
  } catch (error) {
    next(error);
  }
};

export const getItemById = async (req, res, next) => {
  try {
    const item = await GoogleNewsItem.findById(req.params.id).lean();
    if (!item) return res.status(404).json({ success: false, message: 'News item not found' });
    res.json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
};

export const updateItem = async (req, res, next) => {
  try {
    const item = await GoogleNewsItem.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'News item not found' });

    const textFields = ['title', 'description', 'descriptionHtml', 'content', 'excerpt', 'category', 'sourceName', 'sourceUrl', 'link', 'notes'];
    textFields.forEach((key) => {
      if (req.body[key] !== undefined) item[key] = req.body[key];
    });

    if (req.body.slug !== undefined) {
      item.slug = await generateGoogleNewsSlug(String(req.body.slug).trim() || item.title, item._id);
    }
    if (req.body.image !== undefined) {
      item.image = isValidImageUrl(req.body.image) ? String(req.body.image).trim() : '';
    }
    if (req.body.publishedAt !== undefined) item.publishedAt = new Date(req.body.publishedAt);
    if (req.body.isActive !== undefined) item.isActive = Boolean(req.body.isActive);
    if (req.body.isMustRead !== undefined) item.isMustRead = Boolean(req.body.isMustRead);
    if (req.body.isMustWatch !== undefined) item.isMustWatch = Boolean(req.body.isMustWatch);
    if (req.body.displayOrder !== undefined) item.displayOrder = Number(req.body.displayOrder) || 0;

    if (req.body.status && ['published', 'rejected', 'pending', 'draft'].includes(req.body.status)) {
      item.status = req.body.status;
      item.reviewedBy = req.user?._id;
      item.reviewedAt = new Date();
    }

    item.adminEdited = true;
    await item.save();
    res.json({ success: true, data: item, message: 'Item updated' });
  } catch (error) {
    next(error);
  }
};

export const bulkUpdateStatus = async (req, res, next) => {
  try {
    const { ids, status } = req.body;
    if (!Array.isArray(ids) || !ids.length) {
      return res.status(400).json({ success: false, message: 'ids array required' });
    }
    if (!['published', 'rejected', 'pending', 'draft'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const result = await GoogleNewsItem.updateMany(
      { _id: { $in: ids } },
      { status, reviewedBy: req.user?._id, reviewedAt: new Date() }
    );

    res.json({
      success: true,
      message: `Updated ${result.modifiedCount} items to ${status}`,
      data: { modifiedCount: result.modifiedCount },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteItem = async (req, res, next) => {
  try {
    const item = await GoogleNewsItem.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'News item not found' });
    res.json({ success: true, message: 'Item deleted' });
  } catch (error) {
    next(error);
  }
};

const buildCreatedAtFilter = (from, to) => {
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

/** Admin: delete items created within a date range (optional status filter) */
export const deleteItemsByDate = async (req, res, next) => {
  try {
    const { from, to, status, dryRun } = req.body || {};
    if (!from && !to) {
      return res.status(400).json({
        success: false,
        message: 'Provide from and/or to date (YYYY-MM-DD)',
      });
    }

    const dateFilter = buildCreatedAtFilter(from, to);
    if (!dateFilter) {
      return res.status(400).json({ success: false, message: 'Invalid date range' });
    }

    const filter = { ...dateFilter };
    if (status && status !== 'all' && ['pending', 'published', 'rejected', 'draft'].includes(status)) {
      filter.status = status;
    }

    const count = await GoogleNewsItem.countDocuments(filter);
    if (dryRun) {
      return res.json({
        success: true,
        data: { count, filter: { from: from || null, to: to || null, status: status || null } },
        message: `${count} items match`,
      });
    }

    if (!count) {
      return res.json({
        success: true,
        message: 'No items matched that date range',
        data: { deleted: 0 },
      });
    }

    const result = await GoogleNewsItem.deleteMany(filter);
    res.json({
      success: true,
      message: `Deleted ${result.deletedCount} item(s)`,
      data: { deleted: result.deletedCount },
    });
  } catch (error) {
    next(error);
  }
};

export const getPublicItems = async (req, res, next) => {
  try {
    const config = await getOrCreateConfig();
    if (!config.showOnHomepage && req.query.list !== '1') {
      return res.json({ success: true, data: [], title: config.homepageTitle, enabled: false });
    }

    const limit = Math.min(parseInt(req.query.limit, 10) || 12, 30);
    const items = await GoogleNewsItem.find(publishedFilter)
      .sort({ displayOrder: 1, publishedAt: -1 })
      .limit(limit)
      .lean();

    res.json({
      success: true,
      data: items.map(sanitizeItemForListing),
      title: config.homepageTitle || 'Google News',
      enabled: true,
    });
  } catch (error) {
    next(error);
  }
};

export const getPublicList = async (req, res, next) => {
  try {
    const config = await getOrCreateConfig();
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 18, 1), 50);
    const skip = (page - 1) * limit;

    const filter = { ...publishedFilter };
    if (req.query.category?.trim()) {
      filter.category = new RegExp(String(req.query.category).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    }
    const q = String(req.query.q || '').trim();
    if (q) {
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ title: re }, { description: re }, { excerpt: re }, { sourceName: re }, { category: re }];
    }

    const [items, total, categories] = await Promise.all([
      GoogleNewsItem.find(filter)
        .sort({ displayOrder: 1, publishedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      GoogleNewsItem.countDocuments(filter),
      GoogleNewsItem.distinct('category', publishedFilter),
    ]);

    res.json({
      success: true,
      enabled: true,
      data: items.map(sanitizeItemForListing),
      categories: categories.filter(Boolean).sort(),
      title: config.homepageTitle || 'Google News',
      titleTa: 'கூகுள் நியூஸ்',
      pagination: { page, limit, total, pages: Math.max(Math.ceil(total / limit), 1) },
    });
  } catch (error) {
    next(error);
  }
};

export const getPublicBySlug = async (req, res, next) => {
  try {
    const item = await GoogleNewsItem.findOne({ slug: req.params.slug, ...publishedFilter });
    if (!item) return res.status(404).json({ success: false, message: 'News not found' });

    item.views += 1;
    await item.save({ validateBeforeSave: false });

    let data = sanitizeItemForDetail(item);

    // Re-fetch full article from publisher when stored content is junk or missing
    const needsRefetch =
      !item.adminEdited &&
      item.link &&
      (!data.content || isJunkArticleContent(item.content) || isJunkArticleContent(item.description));

    if (needsRefetch) {
      try {
        const meta = await enrichArticleFromUrl(item.link);
        if (meta?.content && !isJunkArticleContent(meta.content)) {
          const textFields = prepareGoogleNewsTextFields({
            content: meta.content,
            description: meta.description || meta.content,
            excerpt: item.excerpt,
          });
          const patch = {
            content: textFields.content,
            description: textFields.description,
            excerpt: textFields.excerpt,
          };
          if (meta.image && isValidImageUrl(meta.image) && !isGenericGoogleImage(meta.image)) {
            patch.image = meta.image;
          }
          await GoogleNewsItem.updateOne({ _id: item._id }, { $set: patch });
          data = sanitizeItemForDetail({ ...item.toObject(), ...patch });
        }
      } catch {
        /* keep cleaned existing data */
      }
    }

    res.json({ success: true, data, type: 'google-news' });
  } catch (error) {
    next(error);
  }
};

export const getRelatedPublic = async (req, res, next) => {
  try {
    const current = await GoogleNewsItem.findOne({ slug: req.params.slug, ...publishedFilter }).lean();
    if (!current) return res.status(404).json({ success: false, message: 'News not found' });

    const limit = Math.min(parseInt(req.query.limit, 10) || 6, 12);
    const orConditions = [];
    if (current.category) orConditions.push({ category: current.category });
    if (current.keywords?.length) orConditions.push({ keywords: { $in: current.keywords } });
    if (current.sourceName) orConditions.push({ sourceName: current.sourceName });

    const filter = {
      ...publishedFilter,
      _id: { $ne: current._id },
      ...(orConditions.length ? { $or: orConditions } : {}),
    };

    let related = await GoogleNewsItem.find(filter)
      .sort({ publishedAt: -1 })
      .limit(limit)
      .select('title slug excerpt description image sourceName category publishedAt isMustRead isMustWatch guid')
      .lean();

    if (related.length < limit) {
      const filler = await GoogleNewsItem.find({
        ...publishedFilter,
        _id: { $nin: [current._id, ...related.map((r) => r._id)] },
      })
        .sort({ publishedAt: -1 })
        .limit(limit - related.length)
        .select('title slug excerpt description image sourceName category publishedAt isMustRead isMustWatch guid')
        .lean();
      related = [...related, ...filler];
    }

    res.json({ success: true, data: related.map(sanitizeItemForListing) });
  } catch (error) {
    next(error);
  }
};

/** Re-fetch images and content for existing items missing data (skips adminEdited) */
export const enrichExistingItems = async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.body.limit, 10) || 30, 50);
    const items = await GoogleNewsItem.find({
      adminEdited: { $ne: true },
      $or: [
        { image: { $in: ['', null] } },
        { image: /picsum\.photos/i },
        { image: /googleusercontent\.com/i },
        { description: /Comprehensive, up-to-date news coverage/i },
        { content: /function\s+\w+\s*\(/i },
        { content: /\{\s*display\s*:/i },
        { content: /"@context"/i },
        { description: /<[a-z][\s>]/i },
        { $expr: { $lt: [{ $strLenCP: { $ifNull: ['$content', ''] } }, 120] } },
      ],
    })
      .sort({ publishedAt: -1 })
      .limit(limit);

    let updated = 0;
    for (const item of items) {
      const meta = await enrichRssItem({
        link: item.link,
        image: item.image?.includes('picsum') ? '' : item.image,
        description: item.description,
        descriptionHtml: item.descriptionHtml,
        content: item.content,
        excerpt: item.excerpt,
      });

      const patch = {};
      if (meta.image && isValidImageUrl(meta.image) && !isGenericGoogleImage(meta.image)) patch.image = meta.image;

      const textFields = prepareGoogleNewsTextFields({
        description: meta.description || item.description,
        content: meta.content || item.content,
        excerpt: meta.excerpt || item.excerpt,
        descriptionHtml: meta.descriptionHtml || item.descriptionHtml,
      });

      if (textFields.content && (!item.content || isJunkArticleContent(item.content) || textFields.content.length > item.content.length)) {
        patch.content = textFields.content;
        patch.excerpt = textFields.excerpt;
      }
      if (textFields.description && textFields.description.length > (item.description?.length || 0)) {
        patch.description = textFields.description;
      }
      if (!patch.excerpt && textFields.excerpt) patch.excerpt = textFields.excerpt;
      if (Object.keys(patch).length) {
        await GoogleNewsItem.updateOne({ _id: item._id }, { $set: patch });
        updated += 1;
      }
    }

    res.json({
      success: true,
      message: `Enriched ${updated} of ${items.length} items with publisher images/content`,
      data: { processed: items.length, updated },
    });
  } catch (error) {
    next(error);
  }
};
