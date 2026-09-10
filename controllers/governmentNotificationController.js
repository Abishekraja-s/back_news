import GovernmentConfig, {
  GOV_CATEGORIES,
  GOV_LEVELS,
  GOV_LANGUAGES,
  GOV_STATUSES,
} from '../models/GovernmentConfig.js';
import GovernmentNotification from '../models/GovernmentNotification.js';
import {
  buildFingerprint,
  DEFAULT_SOURCES,
  fetchFromSource,
  normalizeKnownFeedUrl,
} from '../services/governmentFetchService.js';
import { isMostlyEnglish } from '../services/governmentTextUtils.js';

/** Filter notification rows for public display (Mongo Atlas cannot use \\u in regex) */
const filterByPreferredLanguage = (items, preferred = 'en') => {
  if (preferred === 'both') return items;
  if (preferred === 'en') {
    return items.filter((n) => isMostlyEnglish(`${n.title || ''} ${n.summary || ''}`));
  }
  return items.filter((n) => !isMostlyEnglish(`${n.title || ''} ${n.summary || ''}`));
};

/** Disable imported Hindi items when site is English-only */
const disableNonEnglishNotifications = async (preferred = 'en') => {
  if (preferred !== 'en') return { disabled: 0 };
  const candidates = await GovernmentNotification.find({
    status: { $in: ['published', 'approved', 'pending'] },
  })
    .select('_id title summary')
    .lean();
  const ids = candidates
    .filter((n) => !isMostlyEnglish(`${n.title || ''} ${n.summary || ''}`))
    .map((n) => n._id);
  if (!ids.length) return { disabled: 0 };
  const result = await GovernmentNotification.updateMany(
    { _id: { $in: ids } },
    { status: 'disabled', isActive: false, lastUpdatedAt: new Date() }
  );
  return { disabled: result.modifiedCount };
};

export const getOrCreateGovConfig = async () => {
  let config = await GovernmentConfig.findOne({ key: 'default' });
  if (!config) {
    config = await GovernmentConfig.create({
      key: 'default',
      sources: DEFAULT_SOURCES,
      categories: [...GOV_CATEGORIES],
      keywords: [],
      autoFetchEnabled: false,
      autoPublish: true,
      refreshIntervalMinutes: 60,
      maxItemsPerFetch: 30,
      showLatestWidget: true,
      showAlertsWidget: true,
      showOnHomepage: true,
      preferredLanguage: 'en',
    });
    return config;
  }

  let changed = false;

  if (!config.preferredLanguage) {
    config.preferredLanguage = 'en';
    changed = true;
  }

  // Empty sources → seed official defaults (PIB active)
  if (!config.sources?.length) {
    config.sources = DEFAULT_SOURCES.map((s) => ({ ...s }));
    changed = true;
  } else {
    config.sources.forEach((s) => {
      const fixed = normalizeKnownFeedUrl(s.feedUrl);
      if (fixed !== s.feedUrl) {
        s.feedUrl = fixed;
        changed = true;
      }
      if (/press information bureau|pib\.gov\.in/i.test(`${s.name || ''} ${s.feedUrl || ''}`)) {
        if (s.language !== 'en') {
          s.language = 'en';
          changed = true;
        }
      }
    });

    // Ensure at least one active source with a feed URL (PIB)
    const hasActiveFeed = config.sources.some(
      (s) => s.isActive !== false && (s.feedUrl?.trim() || s.apiUrl?.trim())
    );
    if (!hasActiveFeed) {
      const pib = config.sources.find((s) =>
        /press information bureau|pib\.gov\.in/i.test(`${s.name || ''} ${s.feedUrl || ''} ${s.websiteUrl || ''}`)
      );
      const defaultPib = DEFAULT_SOURCES[0];
      if (pib) {
        pib.isActive = true;
        if (!pib.feedUrl?.trim()) pib.feedUrl = defaultPib.feedUrl;
        else pib.feedUrl = normalizeKnownFeedUrl(pib.feedUrl) || defaultPib.feedUrl;
        changed = true;
      } else {
        config.sources.unshift({ ...defaultPib });
        changed = true;
      }
    }
  }

  if (changed) {
    config.markModified('sources');
    await config.save();
  }

  if (config.preferredLanguage === 'en') {
    await disableNonEnglishNotifications('en');
  }

  return config;
};

const parseList = (value) => {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  if (typeof value === 'string') {
    return value
      .split(/[\n,]+/)
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
};

const importItems = async (items, autoPublish, sourceId, preferredLanguage = 'en') => {
  let created = 0;
  let skipped = 0;

  for (const item of items) {
    if (preferredLanguage === 'en' && !isMostlyEnglish(`${item.title} ${item.summary}`)) {
      skipped += 1;
      continue;
    }
    const fingerprint = buildFingerprint(item);
    const existing = await GovernmentNotification.findOne({ fingerprint });
    if (existing) {
      existing.lastUpdatedAt = new Date();
      if (item.summary && !existing.summary) existing.summary = item.summary;
      if (autoPublish && ['pending', 'approved'].includes(existing.status)) {
        existing.status = 'published';
        existing.reviewedAt = new Date();
      }
      await existing.save();
      skipped += 1;
      continue;
    }

    try {
      await GovernmentNotification.create({
        fingerprint,
        title: item.title,
        titleTamil: item.titleTamil || '',
        summary: item.summary || '',
        summaryTamil: item.summaryTamil || '',
        content: item.content || '',
        category: item.category || 'general',
        level: item.level || 'central',
        department: item.department || '',
        sourceName: item.sourceName || '',
        sourceUrl: item.sourceUrl || '',
        officialUrl: item.officialUrl || '',
        language: item.language || 'en',
        publishedAt: item.publishedAt || new Date(),
        status: autoPublish ? 'published' : 'pending',
        isImportant: Boolean(item.isImportant) || item.category === 'alert',
        isActive: true,
        keywords: item.keywords || [],
        sourceId: sourceId || undefined,
        fetchedAt: new Date(),
        lastUpdatedAt: new Date(),
      });
      created += 1;
    } catch (err) {
      if (err.code === 11000) skipped += 1;
      else throw err;
    }
  }

  return { created, skipped, total: items.length };
};

export const runGovernmentFetch = async (label = 'manual') => {
  const config = await getOrCreateGovConfig();
  const sources = (config.sources || []).filter(
    (s) => s.isActive !== false && (s.feedUrl?.trim() || s.apiUrl?.trim())
  );
  const results = [];
  let totalCreated = 0;
  let totalSkipped = 0;
  const errors = [];

  if (!sources.length) {
    const msg =
      'No active sources with a feed/API URL. Open Sources, enable PIB (or add an official RSS URL), then Save.';
    config.lastFetchAt = new Date();
    config.lastFetchStatus = 'error';
    config.lastFetchError = msg;
    config.lastFetchCount = 0;
    await config.save();
    return {
      success: false,
      label,
      created: 0,
      skipped: 0,
      results: [],
      error: msg,
    };
  }

  for (const source of sources) {
    try {
      const { items, skipped: sourceSkipped, reason } = await fetchFromSource(
        source,
        config.keywords || [],
        config.maxItemsPerFetch || 30
      );
      if (sourceSkipped) {
        results.push({ name: source.name, success: true, skipped: true, reason });
        continue;
      }
      const stats = await importItems(
        items,
        config.autoPublish,
        source._id,
        config.preferredLanguage || 'en'
      );
      totalCreated += stats.created;
      totalSkipped += stats.skipped;
      results.push({ name: source.name, success: true, ...stats });
    } catch (err) {
      errors.push(`${source.name}: ${err.message}`);
      results.push({ name: source.name, success: false, error: err.message });
    }
  }

  config.lastFetchAt = new Date();
  config.lastFetchStatus = errors.length ? (totalCreated ? 'partial' : 'error') : 'success';
  config.lastFetchError = errors.join('; ');
  config.lastFetchCount = totalCreated;
  await config.save();

  return {
    success: !errors.length || totalCreated > 0,
    label,
    created: totalCreated,
    skipped: totalSkipped,
    results,
    error: errors.length ? errors.join('; ') : null,
  };
};

export const getConfig = async (req, res, next) => {
  try {
    const config = await getOrCreateGovConfig();
    const statusCounts = await GovernmentNotification.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    const levelCounts = await GovernmentNotification.aggregate([
      { $group: { _id: '$level', count: { $sum: 1 } } },
    ]);
    res.json({
      success: true,
      data: config,
      meta: {
        categories: GOV_CATEGORIES,
        levels: GOV_LEVELS,
        languages: GOV_LANGUAGES,
        statuses: GOV_STATUSES,
      },
      counts: {
        byStatus: Object.fromEntries(statusCounts.map((s) => [s._id, s.count])),
        byLevel: Object.fromEntries(levelCounts.map((s) => [s._id, s.count])),
        total: statusCounts.reduce((a, b) => a + b.count, 0),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateConfig = async (req, res, next) => {
  try {
    const config = await getOrCreateGovConfig();
    const body = req.body || {};

    if (body.sources !== undefined) {
      if (!Array.isArray(body.sources)) {
        return res.status(400).json({ success: false, message: 'sources must be an array' });
      }
      config.sources = body.sources.map((s) => ({
        name: String(s.name || '').trim(),
        level: GOV_LEVELS.includes(s.level) ? s.level : 'central',
        department: String(s.department || '').trim(),
        feedUrl: String(s.feedUrl || '').trim(),
        apiUrl: String(s.apiUrl || '').trim(),
        websiteUrl: String(s.websiteUrl || '').trim(),
        category: GOV_CATEGORIES.includes(s.category) ? s.category : 'general',
        language: GOV_LANGUAGES.includes(s.language) ? s.language : 'en',
        keywords: parseList(s.keywords),
        isActive: s.isActive !== false,
        ...(s._id ? { _id: s._id } : {}),
      })).filter((s) => s.name);
    }

    if (body.categories !== undefined) config.categories = parseList(body.categories);
    if (body.keywords !== undefined) config.keywords = parseList(body.keywords);
    if (body.autoFetchEnabled !== undefined) config.autoFetchEnabled = Boolean(body.autoFetchEnabled);
    if (body.autoPublish !== undefined) config.autoPublish = Boolean(body.autoPublish);
    if (body.showLatestWidget !== undefined) config.showLatestWidget = Boolean(body.showLatestWidget);
    if (body.showAlertsWidget !== undefined) config.showAlertsWidget = Boolean(body.showAlertsWidget);
    if (body.showOnHomepage !== undefined) config.showOnHomepage = Boolean(body.showOnHomepage);
    if (body.preferredLanguage !== undefined && GOV_LANGUAGES.includes(body.preferredLanguage)) {
      config.preferredLanguage = body.preferredLanguage;
    }
    if (body.latestWidgetTitle !== undefined) config.latestWidgetTitle = String(body.latestWidgetTitle).trim();
    if (body.latestWidgetTitleTa !== undefined) config.latestWidgetTitleTa = String(body.latestWidgetTitleTa).trim();
    if (body.alertsWidgetTitle !== undefined) config.alertsWidgetTitle = String(body.alertsWidgetTitle).trim();
    if (body.alertsWidgetTitleTa !== undefined) config.alertsWidgetTitleTa = String(body.alertsWidgetTitleTa).trim();

    if (body.refreshIntervalMinutes !== undefined) {
      const mins = Number(body.refreshIntervalMinutes);
      if (Number.isNaN(mins) || mins < 15 || mins > 1440) {
        return res.status(400).json({ success: false, message: 'Refresh interval must be 15–1440 minutes' });
      }
      config.refreshIntervalMinutes = mins;
    }
    if (body.maxItemsPerFetch !== undefined) {
      const max = Number(body.maxItemsPerFetch);
      if (Number.isNaN(max) || max < 5 || max > 100) {
        return res.status(400).json({ success: false, message: 'Max items must be 5–100' });
      }
      config.maxItemsPerFetch = max;
    }

    await config.save();
    res.json({ success: true, data: config, message: 'Government notification settings saved' });
  } catch (error) {
    next(error);
  }
};

export const fetchNow = async (req, res, next) => {
  try {
    const result = await runGovernmentFetch('manual');
    if (!result.success && !result.created) {
      return res.status(502).json({
        success: false,
        message: result.error || 'Fetch failed',
        data: result,
      });
    }
    res.json({
      success: true,
      message: `Fetched — ${result.created} new, ${result.skipped} duplicates skipped`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getNotifications = async (req, res, next) => {
  try {
    const { status, level, category, q, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status && status !== 'all' && GOV_STATUSES.includes(status)) filter.status = status;
    if (level && level !== 'all' && GOV_LEVELS.includes(level)) filter.level = level;
    if (category && category !== 'all' && GOV_CATEGORIES.includes(category)) filter.category = category;
    if (q?.trim()) filter.$text = { $search: q.trim() };

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [items, total] = await Promise.all([
      GovernmentNotification.find(filter).sort({ publishedAt: -1, fetchedAt: -1 }).skip(skip).limit(limitNum).lean(),
      GovernmentNotification.countDocuments(filter),
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

export const updateNotification = async (req, res, next) => {
  try {
    const item = await GovernmentNotification.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Notification not found' });

    const allowed = [
      'title', 'titleTamil', 'summary', 'summaryTamil', 'content', 'category', 'level',
      'department', 'sourceName', 'sourceUrl', 'officialUrl', 'language', 'status',
      'isImportant', 'isActive', 'notes', 'publishedAt',
    ];
    allowed.forEach((k) => {
      if (req.body[k] !== undefined) item[k] = req.body[k];
    });

    if (req.body.status && GOV_STATUSES.includes(req.body.status)) {
      item.reviewedBy = req.user?._id;
      item.reviewedAt = new Date();
    }

    item.lastUpdatedAt = new Date();
    await item.save();
    res.json({ success: true, data: item, message: 'Notification updated' });
  } catch (error) {
    next(error);
  }
};

export const bulkStatus = async (req, res, next) => {
  try {
    const { ids, status } = req.body;
    if (!Array.isArray(ids) || !ids.length) {
      return res.status(400).json({ success: false, message: 'ids array required' });
    }
    if (!GOV_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    const result = await GovernmentNotification.updateMany(
      { _id: { $in: ids } },
      { status, reviewedBy: req.user?._id, reviewedAt: new Date(), lastUpdatedAt: new Date() }
    );
    res.json({
      success: true,
      message: `Updated ${result.modifiedCount} to ${status}`,
      data: { modifiedCount: result.modifiedCount },
    });
  } catch (error) {
    next(error);
  }
};

/** Publish all pending/approved active notifications to the website */
export const publishAll = async (req, res, next) => {
  try {
    const result = await GovernmentNotification.updateMany(
      {
        isActive: true,
        status: { $in: ['pending', 'approved'] },
      },
      {
        status: 'published',
        reviewedBy: req.user?._id,
        reviewedAt: new Date(),
        lastUpdatedAt: new Date(),
      }
    );

    const config = await getOrCreateGovConfig();
    if (!config.autoPublish) {
      config.autoPublish = true;
      await config.save();
    }

    res.json({
      success: true,
      message: `Published ${result.modifiedCount} notification(s) to the website`,
      data: { modifiedCount: result.modifiedCount },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteNotification = async (req, res, next) => {
  try {
    const item = await GovernmentNotification.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, message: 'Deleted' });
  } catch (error) {
    next(error);
  }
};

export const bulkDelete = async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || !ids.length) {
      return res.status(400).json({ success: false, message: 'ids array required' });
    }
    const result = await GovernmentNotification.deleteMany({ _id: { $in: ids } });
    res.json({
      success: true,
      message: `Removed ${result.deletedCount} notification(s)`,
      data: { deletedCount: result.deletedCount },
    });
  } catch (error) {
    next(error);
  }
};

export const getPublic = async (req, res, next) => {
  try {
    const config = await getOrCreateGovConfig();
    if (!config.showOnHomepage) {
      return res.json({ success: true, enabled: false, data: { latest: [], alerts: [] } });
    }

    const limit = Math.min(parseInt(req.query.limit, 10) || 8, 20);
    const preferred = config.preferredLanguage || 'en';
    const base = { status: { $in: ['published', 'approved'] }, isActive: true };

    const [latestRaw, alertsRaw] = await Promise.all([
      config.showLatestWidget
        ? GovernmentNotification.find(base).sort({ publishedAt: -1 }).limit(limit * 3).lean()
        : [],
      config.showAlertsWidget
        ? GovernmentNotification.find({
            ...base,
            $or: [{ isImportant: true }, { category: 'alert' }],
          })
            .sort({ publishedAt: -1 })
            .limit(limit * 3)
            .lean()
        : [],
    ]);

    const latest = filterByPreferredLanguage(latestRaw, preferred).slice(0, limit);
    const alerts = filterByPreferredLanguage(alertsRaw, preferred).slice(0, limit);

    res.json({
      success: true,
      enabled: true,
      refreshIntervalMinutes: config.refreshIntervalMinutes,
      data: {
        latest,
        alerts,
        titles: {
          latest: config.latestWidgetTitle,
          latestTa: config.latestWidgetTitleTa,
          alerts: config.alertsWidgetTitle,
          alertsTa: config.alertsWidgetTitleTa,
        },
        widgets: {
          latest: config.showLatestWidget,
          alerts: config.showAlertsWidget,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/** Explore hub — Central + Tamil Nadu published/approved notifications */
export const getHub = async (req, res, next) => {
  try {
    const config = await getOrCreateGovConfig();
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 6, 1), 12);

    const filter = {
      status: { $in: ['published', 'approved'] },
      isActive: true,
      level: { $in: ['central', 'tamil_nadu'] },
    };

    const preferred = config.preferredLanguage || 'en';
    const rawItems = await GovernmentNotification.find(filter)
      .sort({ publishedAt: -1, fetchedAt: -1 })
      .limit(limit * 4)
      .select('title titleTamil summary category level department publishedAt officialUrl sourceName isImportant')
      .lean();

    const items = filterByPreferredLanguage(rawItems, preferred).slice(0, limit);

    res.json({
      success: true,
      enabled: items.length > 0 || config.showOnHomepage !== false,
      title: config.latestWidgetTitle || 'Government Notifications',
      titleTa: config.latestWidgetTitleTa || 'அரசு அறிவிப்புகள்',
      data: items,
    });
  } catch (error) {
    next(error);
  }
};

/** Full public listing page — paginated published notifications */
export const getPublicList = async (req, res, next) => {
  try {
    const config = await getOrCreateGovConfig();
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
    const skip = (page - 1) * limit;

    const filter = {
      status: { $in: ['published', 'approved'] },
      isActive: true,
    };
    const preferred = config.preferredLanguage || 'en';
    if (req.query.level && GOV_LEVELS.includes(req.query.level)) {
      filter.level = req.query.level;
    }
    if (req.query.category && GOV_CATEGORIES.includes(req.query.category)) {
      filter.category = req.query.category;
    }
    if (req.query.important === '1' || req.query.important === 'true') {
      filter.$or = [{ isImportant: true }, { category: 'alert' }];
    }
    const q = String(req.query.q || '').trim();
    if (q) {
      filter.$text = { $search: q };
    }

    const sort = q ? { score: { $meta: 'textScore' }, publishedAt: -1 } : { publishedAt: -1 };
    const allRows = await GovernmentNotification.find(filter).sort(sort).lean();
    const filtered = filterByPreferredLanguage(allRows, preferred);
    const total = filtered.length;
    const items = filtered.slice(skip, skip + limit);

    res.json({
      success: true,
      enabled: config.showOnHomepage || total > 0,
      data: items,
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(Math.ceil(total / limit), 1),
      },
      titles: {
        latest: config.latestWidgetTitle || 'Government Notifications',
        latestTa: config.latestWidgetTitleTa || 'அரசு அறிவிப்புகள்',
        alerts: config.alertsWidgetTitle,
        alertsTa: config.alertsWidgetTitleTa,
      },
      filters: {
        categories: GOV_CATEGORIES,
        levels: GOV_LEVELS,
      },
    });
  } catch (error) {
    next(error);
  }
};
