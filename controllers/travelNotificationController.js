import TravelConfig, { TRAVEL_MODES, TRAVEL_CHANNELS } from '../models/TravelConfig.js';
import TravelUpdate from '../models/TravelUpdate.js';
import TravelFetchLog from '../models/TravelFetchLog.js';
import BreakingNews from '../models/BreakingNews.js';
import { maskApiKey } from '../services/geminiService.js';
import {
  buildFingerprint,
  fetchTravelUpdatesForMode,
  getEffectiveIntervalSeconds,
} from '../services/travelFetchService.js';

const defaultMode = () => ({
  enabled: true,
  autoFetchEnabled: false,
  apiBaseUrl: '',
  apiEndpoint: '',
  apiKey: '',
  apiProvider: 'custom',
  routes: [],
  locations: [],
  transportNumbers: [],
  keywords: [],
  channels: ['website'],
  fetchIntervalSeconds: 1800,
  updateFrequencyMinutes: 30,
  retryAttempts: 3,
  retryBackoffSeconds: 30,
  lastFetchStatus: '',
  lastFetchError: '',
  lastFetchCount: 0,
  lastUpdatedCount: 0,
  lastSkippedCount: 0,
  lastHttpStatus: 0,
});

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

const isMaskedKey = (val) => !val || val.includes('•••') || val === '__UNCHANGED__';

const sanitizeMode = (body = {}, existing = {}) => {
  const next = { ...(existing.toObject?.() || existing) };

  if (body.enabled !== undefined) next.enabled = Boolean(body.enabled);
  if (body.autoFetchEnabled !== undefined) next.autoFetchEnabled = Boolean(body.autoFetchEnabled);
  if (body.apiBaseUrl !== undefined) next.apiBaseUrl = String(body.apiBaseUrl || '').trim();
  if (body.apiEndpoint !== undefined) next.apiEndpoint = String(body.apiEndpoint || '').trim();
  if (body.apiKey !== undefined) {
    const val = String(body.apiKey || '').trim();
    if (!isMaskedKey(val)) next.apiKey = val;
  }
  if (body.apiProvider !== undefined) next.apiProvider = String(body.apiProvider || 'custom').trim();
  if (body.routes !== undefined) next.routes = parseList(body.routes);
  if (body.locations !== undefined) next.locations = parseList(body.locations);
  if (body.transportNumbers !== undefined) next.transportNumbers = parseList(body.transportNumbers);
  if (body.keywords !== undefined) next.keywords = parseList(body.keywords);
  if (body.channels !== undefined) {
    const channels = parseList(body.channels).filter((c) => TRAVEL_CHANNELS.includes(c));
    next.channels = channels.length ? channels : ['website'];
  }
  if (body.fetchIntervalSeconds !== undefined) {
    const sec = Number(body.fetchIntervalSeconds);
    if (Number.isNaN(sec) || sec < 10 || sec > 86400) {
      const err = new Error('Fetch interval must be 10–86400 seconds');
      err.statusCode = 400;
      throw err;
    }
    next.fetchIntervalSeconds = sec;
    next.updateFrequencyMinutes = Math.max(1, Math.round(sec / 60));
  } else if (body.updateFrequencyMinutes !== undefined) {
    const mins = Number(body.updateFrequencyMinutes);
    if (Number.isNaN(mins) || mins < 1 || mins > 1440) {
      const err = new Error('Update frequency must be 1–1440 minutes');
      err.statusCode = 400;
      throw err;
    }
    next.updateFrequencyMinutes = mins;
    if (!body.fetchIntervalSeconds) next.fetchIntervalSeconds = Math.max(10, mins * 60);
  }
  if (body.retryAttempts !== undefined) {
    const n = Number(body.retryAttempts);
    if (Number.isNaN(n) || n < 0 || n > 10) {
      const err = new Error('Retry attempts must be 0–10');
      err.statusCode = 400;
      throw err;
    }
    next.retryAttempts = n;
  }
  if (body.retryBackoffSeconds !== undefined) {
    const n = Number(body.retryBackoffSeconds);
    if (Number.isNaN(n) || n < 5 || n > 600) {
      const err = new Error('Retry backoff must be 5–600 seconds');
      err.statusCode = 400;
      throw err;
    }
    next.retryBackoffSeconds = n;
  }
  return next;
};

const maskConfigForClient = (config) => {
  const obj = config.toObject ? config.toObject() : { ...config };
  for (const mode of TRAVEL_MODES) {
    if (obj[mode]) {
      const key = obj[mode].apiKey || '';
      obj[mode].hasApiKey = Boolean(key);
      obj[mode].apiKeyMasked = key ? maskApiKey(key) : '';
      delete obj[mode].apiKey;
    }
  }
  return obj;
};

const UPDATE_FIELDS = [
  'title',
  'message',
  'transportNumber',
  'route',
  'fromLocation',
  'toLocation',
  'status',
  'updateType',
  'scheduledAt',
  'actualAt',
  'departureAt',
  'arrivalAt',
  'journeyDate',
  'delayMinutes',
  'platform',
  'gate',
  'apiReferenceId',
  'sourceUrl',
  'rawPayload',
];

const fieldChanged = (existing, next, key) => {
  if (next[key] === undefined) return false;
  if (['scheduledAt', 'actualAt', 'departureAt', 'arrivalAt'].includes(key)) {
    const a = existing[key] ? new Date(existing[key]).getTime() : null;
    const b = next[key] ? new Date(next[key]).getTime() : null;
    return a !== b;
  }
  if (key === 'rawPayload') return JSON.stringify(existing[key] || null) !== JSON.stringify(next[key] || null);
  return String(existing[key] ?? '') !== String(next[key] ?? '');
};

const importItems = async (mode, items, source, channels, provider) => {
  let created = 0;
  let skipped = 0;
  let updated = 0;
  const now = new Date();

  for (const item of items) {
    const fingerprint = buildFingerprint(mode, item, provider);
    const nextFields = {
      title: item.title,
      message: item.message || '',
      transportNumber: item.transportNumber || '',
      route: item.route || '',
      fromLocation: item.fromLocation || '',
      toLocation: item.toLocation || '',
      status: item.status || 'info',
      updateType: item.updateType || 'general',
      scheduledAt: item.scheduledAt ? new Date(item.scheduledAt) : undefined,
      actualAt: item.actualAt ? new Date(item.actualAt) : undefined,
      departureAt: item.departureAt ? new Date(item.departureAt) : undefined,
      arrivalAt: item.arrivalAt ? new Date(item.arrivalAt) : undefined,
      journeyDate: item.journeyDate || '',
      delayMinutes: item.delayMinutes || 0,
      platform: item.platform || '',
      gate: item.gate || '',
      apiReferenceId: item.apiReferenceId || '',
      source,
      sourceUrl: item.sourceUrl || '',
      rawPayload: item.rawPayload,
      lastFetchedAt: now,
    };

    const existing = await TravelUpdate.findOne({ fingerprint });
    if (existing) {
      let changed = false;
      UPDATE_FIELDS.forEach((key) => {
        if (fieldChanged(existing, nextFields, key)) {
          existing[key] = nextFields[key];
          changed = true;
        }
      });
      existing.lastFetchedAt = now;
      if (changed) {
        existing.lastUpdatedAt = now;
        await existing.save();
        updated += 1;
      } else {
        await existing.save();
        skipped += 1;
      }
      continue;
    }

    try {
      const doc = await TravelUpdate.create({
        fingerprint,
        mode,
        ...nextFields,
        channels: channels || ['website'],
        isActive: true,
        isPublished: !(channels || []).includes('admin_only') || (channels || []).includes('website'),
        fetchedAt: now,
        lastUpdatedAt: now,
      });

      if ((channels || []).includes('breaking_ticker') && ['cancelled', 'delayed'].includes(doc.status)) {
        try {
          await BreakingNews.create({
            text: doc.title,
            link: '/travel-updates',
            priority: doc.status === 'cancelled' ? 10 : 5,
            isActive: true,
            startTime: new Date(),
            endTime: new Date(Date.now() + 6 * 60 * 60 * 1000),
          });
        } catch {
          // non-fatal
        }
      }

      created += 1;
    } catch (err) {
      if (err.code === 11000) skipped += 1;
      else throw err;
    }
  }

  return { created, skipped, updated, total: items.length };
};

const computeNextFetchAt = (modeConfig) => {
  if (!modeConfig?.autoFetchEnabled) return null;
  const sec = getEffectiveIntervalSeconds(modeConfig);
  return new Date(Date.now() + sec * 1000);
};

export const getOrCreateTravelConfig = async () => {
  let config = await TravelConfig.findOne({ key: 'default' });
  if (!config) {
    config = await TravelConfig.create({
      key: 'default',
      train: defaultMode(),
      bus: defaultMode(),
      flight: defaultMode(),
      showOnHomepage: true,
      homepageTitle: 'Travel Updates',
    });
  }
  return config;
};

export const runTravelFetch = async (modes = TRAVEL_MODES, trigger = 'manual') => {
  const config = await getOrCreateTravelConfig();

  if (config.fetchInProgress) {
    return { results: [], config, skipped: true, reason: 'fetch_in_progress' };
  }

  config.fetchInProgress = true;
  await config.save();

  const results = [];
  const startedGlobal = new Date();

  try {
    for (const mode of modes) {
      const modeConfig = config[mode];
      if (!modeConfig?.enabled) {
        results.push({ mode, success: true, skipped: true, reason: 'disabled', trigger });
        continue;
      }

      const logStarted = new Date();
      const log = await TravelFetchLog.create({
        mode,
        provider: modeConfig.apiProvider || 'custom',
        trigger,
        startedAt: logStarted,
        status: 'running',
      });

      try {
        const { items, source, error, httpStatus } = await fetchTravelUpdatesForMode(mode, modeConfig);
        const provider = modeConfig.apiProvider || source || 'custom';
        const channels = modeConfig.channels?.length ? modeConfig.channels : ['website'];

        let stats = { created: 0, skipped: 0, updated: 0, total: 0 };
        if (items.length && !error) {
          stats = await importItems(mode, items, source, channels, provider);
        } else if (items.length && source === 'config') {
          stats = await importItems(mode, items, source, channels, provider);
        }

        const fetchStatus = error ? (stats.total ? 'partial' : 'error') : 'success';
        const completedAt = new Date();

        modeConfig.lastFetchAt = completedAt;
        modeConfig.lastFetchStatus = fetchStatus;
        modeConfig.lastFetchError = error || '';
        modeConfig.lastFetchCount = stats.created;
        modeConfig.lastUpdatedCount = stats.updated;
        modeConfig.lastSkippedCount = stats.skipped;
        modeConfig.lastHttpStatus = httpStatus || 0;
        modeConfig.nextScheduledFetchAt = computeNextFetchAt(modeConfig);
        config.markModified(mode);

        log.completedAt = completedAt;
        log.status = fetchStatus;
        log.httpStatus = httpStatus || 0;
        log.newRecords = stats.created;
        log.updatedRecords = stats.updated;
        log.skippedRecords = stats.skipped;
        log.totalReceived = stats.total;
        log.errorMessage = error || '';
        log.durationMs = completedAt - logStarted;
        await log.save();

        results.push({
          mode,
          success: fetchStatus !== 'error',
          source,
          apiError: error || null,
          httpStatus: httpStatus || 0,
          trigger,
          ...stats,
        });
      } catch (err) {
        const completedAt = new Date();
        modeConfig.lastFetchAt = completedAt;
        modeConfig.lastFetchStatus = 'error';
        modeConfig.lastFetchError = err.message;
        modeConfig.nextScheduledFetchAt = computeNextFetchAt(modeConfig);
        config.markModified(mode);

        log.completedAt = completedAt;
        log.status = 'error';
        log.errorMessage = err.message;
        log.durationMs = completedAt - logStarted;
        await log.save();

        results.push({ mode, success: false, error: err.message, created: 0, updated: 0, skipped: 0, trigger });
      }
    }

    config.lastGlobalFetchAt = startedGlobal;
    const nextTimes = TRAVEL_MODES.map((m) => config[m]?.nextScheduledFetchAt).filter(Boolean);
    config.nextScheduledFetchAt = nextTimes.length ? new Date(Math.min(...nextTimes.map((d) => d.getTime()))) : null;
    await config.save();

    return { results, config };
  } finally {
    const fresh = await TravelConfig.findOne({ key: 'default' });
    if (fresh) {
      fresh.fetchInProgress = false;
      await fresh.save();
    }
  }
};

const getCounts = async () => {
  const [counts, modeTotals] = await Promise.all([
    TravelUpdate.aggregate([{ $group: { _id: { mode: '$mode', status: '$status' }, count: { $sum: 1 } } }]),
    TravelUpdate.aggregate([{ $group: { _id: '$mode', count: { $sum: 1 } } }]),
  ]);
  return {
    byStatus: counts,
    byMode: Object.fromEntries(modeTotals.map((m) => [m._id, m.count])),
    total: modeTotals.reduce((a, b) => a + b.count, 0),
  };
};

export const getConfig = async (req, res, next) => {
  try {
    const config = await getOrCreateTravelConfig();
    const counts = await getCounts();
    res.json({
      success: true,
      data: maskConfigForClient(config),
      meta: { modes: TRAVEL_MODES, channels: TRAVEL_CHANNELS },
      counts,
    });
  } catch (error) {
    next(error);
  }
};

export const getStatus = async (req, res, next) => {
  try {
    const config = await getOrCreateTravelConfig();
    const counts = await getCounts();
    const modes = {};
    for (const mode of TRAVEL_MODES) {
      const m = config[mode] || {};
      modes[mode] = {
        enabled: m.enabled !== false,
        autoFetchEnabled: Boolean(m.autoFetchEnabled),
        lastFetchAt: m.lastFetchAt,
        lastFetchStatus: m.lastFetchStatus || '',
        lastFetchError: m.lastFetchError || '',
        lastFetchCount: m.lastFetchCount || 0,
        lastUpdatedCount: m.lastUpdatedCount || 0,
        lastSkippedCount: m.lastSkippedCount || 0,
        lastHttpStatus: m.lastHttpStatus || 0,
        nextScheduledFetchAt: m.nextScheduledFetchAt,
        fetchIntervalSeconds: getEffectiveIntervalSeconds(m),
        provider: m.apiProvider || 'custom',
        hasApi: Boolean((m.apiBaseUrl || '').trim()),
      };
    }
    res.json({
      success: true,
      fetchInProgress: Boolean(config.fetchInProgress),
      lastGlobalFetchAt: config.lastGlobalFetchAt,
      nextScheduledFetchAt: config.nextScheduledFetchAt,
      modes,
      counts,
    });
  } catch (error) {
    next(error);
  }
};

export const getFetchLogs = async (req, res, next) => {
  try {
    const { mode, page = 1, limit = 30 } = req.query;
    const filter = {};
    if (mode && TRAVEL_MODES.includes(mode)) filter.mode = mode;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 30));
    const skip = (pageNum - 1) * limitNum;

    const [items, total] = await Promise.all([
      TravelFetchLog.find(filter).sort({ startedAt: -1 }).skip(skip).limit(limitNum).lean(),
      TravelFetchLog.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: items,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    next(error);
  }
};

export const updateConfig = async (req, res, next) => {
  try {
    const config = await getOrCreateTravelConfig();
    const body = req.body || {};

    for (const mode of TRAVEL_MODES) {
      if (body[mode]) {
        config[mode] = sanitizeMode(body[mode], config[mode] || defaultMode());
        config[mode].nextScheduledFetchAt = computeNextFetchAt(config[mode]);
        config.markModified(mode);
      }
    }
    if (body.showOnHomepage !== undefined) config.showOnHomepage = Boolean(body.showOnHomepage);
    if (body.homepageTitle !== undefined) {
      config.homepageTitle = String(body.homepageTitle).trim() || 'Travel Updates';
    }

    await config.save();
    res.json({ success: true, data: maskConfigForClient(config), message: 'Travel configuration saved' });
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};

export const fetchNow = async (req, res, next) => {
  try {
    const modes = req.body?.modes?.length
      ? req.body.modes.filter((m) => TRAVEL_MODES.includes(m))
      : TRAVEL_MODES;
    if (!modes.length) {
      return res.status(400).json({ success: false, message: 'Select at least one mode: train, bus, flight' });
    }

    const config = await getOrCreateTravelConfig();
    if (config.fetchInProgress) {
      return res.json({
        success: true,
        message: 'A fetch is already in progress',
        inProgress: true,
      });
    }

    runTravelFetch(modes, 'manual').catch((err) => {
      console.warn('[Travel] manual fetch error:', err.message);
    });

    res.json({
      success: true,
      message: `Fetch started for ${modes.join(', ')}`,
      inProgress: true,
      modes,
    });
  } catch (error) {
    next(error);
  }
};

export const getUpdates = async (req, res, next) => {
  try {
    const { mode, status, q, page = 1, limit = 40 } = req.query;
    const filter = {};
    if (mode && TRAVEL_MODES.includes(mode)) filter.mode = mode;
    if (status && status !== 'all') filter.status = status;
    if (q?.trim()) {
      filter.$or = [
        { title: new RegExp(q.trim(), 'i') },
        { transportNumber: new RegExp(q.trim(), 'i') },
        { route: new RegExp(q.trim(), 'i') },
        { message: new RegExp(q.trim(), 'i') },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 40));
    const skip = (pageNum - 1) * limitNum;

    const [items, total] = await Promise.all([
      TravelUpdate.find(filter).sort({ lastFetchedAt: -1, fetchedAt: -1 }).skip(skip).limit(limitNum).lean(),
      TravelUpdate.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: items,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    next(error);
  }
};

export const updateItem = async (req, res, next) => {
  try {
    const item = await TravelUpdate.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Update not found' });

    const allowed = [
      'title', 'message', 'status', 'updateType', 'isActive', 'isPublished',
      'route', 'fromLocation', 'toLocation', 'transportNumber', 'delayMinutes', 'channels',
      'platform', 'gate', 'journeyDate',
    ];
    allowed.forEach((k) => {
      if (req.body[k] !== undefined) item[k] = req.body[k];
    });
    item.lastUpdatedAt = new Date();
    await item.save();
    res.json({ success: true, data: item, message: 'Update saved' });
  } catch (error) {
    next(error);
  }
};

export const deleteItem = async (req, res, next) => {
  try {
    const item = await TravelUpdate.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Update not found' });
    res.json({ success: true, message: 'Deleted' });
  } catch (error) {
    next(error);
  }
};

export const getPublicUpdates = async (req, res, next) => {
  try {
    const config = await getOrCreateTravelConfig();
    if (!config.showOnHomepage) {
      return res.json({ success: true, data: [], title: config.homepageTitle, enabled: false });
    }
    const mode = req.query.mode;
    const filter = { isActive: true, isPublished: true };
    if (mode && TRAVEL_MODES.includes(mode)) filter.mode = mode;

    const limit = Math.min(parseInt(req.query.limit, 10) || 12, 30);
    const items = await TravelUpdate.find(filter)
      .sort({ lastFetchedAt: -1, fetchedAt: -1 })
      .limit(limit)
      .lean();

    res.json({
      success: true,
      data: items,
      title: config.homepageTitle || 'Travel Updates',
      enabled: true,
    });
  } catch (error) {
    next(error);
  }
};

export const getPublicList = async (req, res, next) => {
  try {
    const config = await getOrCreateTravelConfig();
    const mode = req.query.mode;
    const status = req.query.status;
    const filter = { isActive: true, isPublished: true };
    if (mode && TRAVEL_MODES.includes(mode)) filter.mode = mode;
    if (status && status !== 'all') filter.status = status;

    const pageNum = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 18));
    const skip = (pageNum - 1) * limitNum;

    const [items, total] = await Promise.all([
      TravelUpdate.find(filter).sort({ lastFetchedAt: -1, fetchedAt: -1 }).skip(skip).limit(limitNum).lean(),
      TravelUpdate.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: items,
      title: config.homepageTitle || 'Travel Updates',
      titleTa: 'பயண அறிவிப்புகள்',
      enabled: config.showOnHomepage !== false,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    next(error);
  }
};
