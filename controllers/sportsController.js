import SportsConfig, { SPORT_TYPES, WIDGET_TYPES, WIDGET_PAGES, LIVE_STATUSES } from '../models/SportsConfig.js';
import SportsMatch from '../models/SportsMatch.js';
import SportsStanding from '../models/SportsStanding.js';
import { maskApiKey } from '../services/geminiService.js';
import {
  applyProviderDefaults,
  buildMatchFingerprint,
  buildStandingFingerprint,
  fetchSportsForMode,
  getEffectiveIntervalSeconds,
  getProviderPreset,
  isLiveStatus,
} from '../services/sportsFetchService.js';
import {
  buildMatchDetailPayload,
  findPlayerInDetail,
} from '../services/sportsMatchDetailService.js';
import mongoose from 'mongoose';

const defaultSport = (sport = '') => {
  const preset = sport ? getProviderPreset(sport) : {};
  return {
    enabled: sport === 'other' ? false : true,
    autoFetchEnabled: false,
    apiBaseUrl: preset.apiBaseUrl || '',
    apiEndpoint: preset.apiEndpoint || '',
    apiKey: '',
    apiProvider: preset.apiProvider || 'custom',
    leagues: [],
    tournaments: [],
    teams: [],
    competitions: [],
    fetchIntervalSeconds: preset.fetchIntervalSeconds || 60,
    refreshIntervalMinutes: 1,
    lastFetchStatus: '',
    lastFetchError: '',
    lastFetchCount: 0,
    lastLiveCount: 0,
    lastHttpStatus: 0,
  };
};

/** Fill empty URL/provider from known presets without overwriting API keys or custom URLs */
const ensureSportDefaults = (config) => {
  let changed = false;
  for (const sport of SPORT_TYPES) {
    if (!config[sport]) {
      config[sport] = defaultSport(sport);
      config.markModified(sport);
      changed = true;
      continue;
    }
    const mode = config[sport];
    const preset = getProviderPreset(sport);
    if (!preset.apiBaseUrl && !preset.apiEndpoint) continue;

    let sportChanged = false;
    const emptyUrl = !(mode.apiBaseUrl || '').trim();
    const emptyEndpoint = !(mode.apiEndpoint || '').trim();
    const emptyOrCustomProvider = !(mode.apiProvider || '').trim() || mode.apiProvider === 'custom';
    const hasKey = Boolean(String(mode.apiKey || '').trim());
    // Migrate cricket off CricLive when no API key (use SportScore instead)
    // Prefer SportScore for cricket unless a CricLive key is saved (SportScore needs no key)
    const migrateCricketToSportScore =
      sport === 'cricket' &&
      (!hasKey || /sportscore/i.test(mode.apiProvider || '')) &&
      (/criclive|cricketliveapi/i.test(mode.apiProvider || '') ||
        /cricketliveapi\.com/i.test(mode.apiBaseUrl || '') ||
        !(mode.apiBaseUrl || '').trim());
    // Migrate chess to Lichess when URL was never configured
    const migrateChessToLichess =
      sport === 'chess' && emptyUrl && (!(mode.apiProvider || '').trim() || mode.apiProvider === 'chess' || mode.apiProvider === 'custom');

    if ((emptyUrl || migrateCricketToSportScore || migrateChessToLichess) && preset.apiBaseUrl) {
      mode.apiBaseUrl = preset.apiBaseUrl;
      sportChanged = true;
    }
    if ((emptyEndpoint || migrateCricketToSportScore || migrateChessToLichess) && preset.apiEndpoint) {
      mode.apiEndpoint = preset.apiEndpoint;
      sportChanged = true;
    }
    if ((emptyOrCustomProvider || migrateCricketToSportScore || migrateChessToLichess) && preset.apiProvider) {
      mode.apiProvider = preset.apiProvider;
      sportChanged = true;
    }
    // Cricket full-fixture sync is heavy — never allow sub-60s intervals
    const minInterval = sport === 'cricket' ? 60 : 30;
    if (!mode.fetchIntervalSeconds || mode.fetchIntervalSeconds < minInterval) {
      mode.fetchIntervalSeconds = Math.max(preset.fetchIntervalSeconds || 60, minInterval);
      sportChanged = true;
    }
    if (sportChanged) {
      config.markModified(sport);
      changed = true;
    }
  }
  return changed;
};

const defaultWidgets = () =>
  WIDGET_TYPES.map((type) => ({
    type,
    enabled: ['live_score', 'upcoming', 'results', 'standings'].includes(type),
    pages: type === 'live_score' || type === 'upcoming' ? ['homepage', 'category', 'article'] : ['homepage'],
    title: '',
    sports: [...SPORT_TYPES.filter((s) => s !== 'other')],
    maxItems: type === 'standings' ? 8 : 6,
  }));

export const getOrCreateSportsConfig = async () => {
  let config = await SportsConfig.findOne({ key: 'default' });
  if (!config) {
    config = await SportsConfig.create({
      key: 'default',
      cricket: defaultSport('cricket'),
      football: defaultSport('football'),
      basketball: defaultSport('basketball'),
      tennis: defaultSport('tennis'),
      other: defaultSport('other'),
      chess: defaultSport('chess'),
      widgets: defaultWidgets(),
      homepageTitle: 'Live Sports',
      showOnHomepage: true,
    });
  } else {
    let changed = false;
    if (!config.chess) {
      config.chess = defaultSport('chess');
      config.markModified('chess');
      changed = true;
    }
    if (!config.widgets?.length) {
      config.widgets = defaultWidgets();
      changed = true;
    }
    if (ensureSportDefaults(config)) changed = true;
    if (changed) await config.save();
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

const isMaskedKey = (val) => !val || val.includes('•••') || val === '__UNCHANGED__';

const sanitizeSport = (body = {}, existing = {}) => {
  const base = existing?.toObject ? existing.toObject() : { ...existing };
  const next = { ...defaultSport(), ...base };

  if (body.enabled !== undefined) next.enabled = Boolean(body.enabled);
  if (body.autoFetchEnabled !== undefined) next.autoFetchEnabled = Boolean(body.autoFetchEnabled);
  if (body.apiBaseUrl !== undefined) next.apiBaseUrl = String(body.apiBaseUrl || '').trim();
  if (body.apiEndpoint !== undefined) next.apiEndpoint = String(body.apiEndpoint || '').trim();
  if (body.apiKey !== undefined) {
    const val = String(body.apiKey || '').trim();
    if (!isMaskedKey(val)) next.apiKey = val;
  }
  if (body.apiProvider !== undefined) next.apiProvider = String(body.apiProvider || 'custom').trim();
  if (body.leagues !== undefined) next.leagues = parseList(body.leagues);
  if (body.tournaments !== undefined) next.tournaments = parseList(body.tournaments);
  if (body.teams !== undefined) next.teams = parseList(body.teams);
  if (body.competitions !== undefined) next.competitions = parseList(body.competitions);
  if (body.fetchIntervalSeconds !== undefined) {
    const sec = Number(body.fetchIntervalSeconds);
    if (Number.isNaN(sec) || sec < 10 || sec > 300) {
      const err = new Error('Fetch interval must be 10–300 seconds');
      err.statusCode = 400;
      throw err;
    }
    next.fetchIntervalSeconds = sec;
  } else if (body.refreshIntervalMinutes !== undefined) {
    const mins = Number(body.refreshIntervalMinutes);
    if (Number.isNaN(mins) || mins < 1 || mins > 60) {
      const err = new Error('Refresh interval must be 1–60 minutes');
      err.statusCode = 400;
      throw err;
    }
    next.refreshIntervalMinutes = mins;
  }
  return next;
};

const maskConfigForClient = (config) => {
  const obj = config.toObject ? config.toObject() : { ...config };
  for (const sport of SPORT_TYPES) {
    if (obj[sport]) {
      const key = obj[sport].apiKey || '';
      obj[sport].hasApiKey = Boolean(key);
      obj[sport].apiKeyMasked = key ? maskApiKey(key) : '';
      delete obj[sport].apiKey;
    }
  }
  return obj;
};

const getLiveCounts = async () => {
  const liveAgg = await SportsMatch.aggregate([
    {
      $match: {
        status: { $in: LIVE_STATUSES },
        isActive: true,
        isPublished: true,
      },
    },
    { $group: { _id: '$sport', count: { $sum: 1 } } },
  ]);
  const bySportLive = Object.fromEntries(liveAgg.map((s) => [s._id, s.count]));
  const totalLive = liveAgg.reduce((a, b) => a + b.count, 0);

  const statusAgg = await SportsMatch.aggregate([
    { $group: { _id: { sport: '$sport', status: '$status' }, count: { $sum: 1 } } },
  ]);
  const bySport = await SportsMatch.aggregate([{ $group: { _id: '$sport', count: { $sum: 1 } } }]);

  return {
    bySportLive,
    totalLive,
    byStatus: statusAgg,
    bySport: Object.fromEntries(bySport.map((s) => [s._id, s.count])),
    total: bySport.reduce((a, b) => a + b.count, 0),
  };
};

/**
 * Upsert fixtures from API via bulkWrite (fast).
 * Preserves admin publish flag on existing rows.
 * Never drops matches for missing league/tournament/competition.
 * Only marks previously-live rows as finished when they disappear from the live set.
 */
const syncLiveMatches = async (sport, matches, provider, source) => {
  const now = new Date();
  const liveFingerprints = [];
  const ops = [];

  for (const item of matches) {
    const fingerprint = buildMatchFingerprint(sport, item, provider);
    if (!fingerprint) continue;
    if (isLiveStatus(item.status)) liveFingerprints.push(fingerprint);

    const setFields = {
      externalId: item.externalId,
      provider,
      sport,
      homeTeam: item.homeTeam,
      awayTeam: item.awayTeam,
      homeScore: item.homeScore ?? 0,
      awayScore: item.awayScore ?? 0,
      status: item.status || 'scheduled',
      source,
      isActive: true,
      lastSyncedAt: now,
      lastUpdatedAt: now,
    };
    if (item.league) setFields.league = item.league;
    if (item.tournament) setFields.tournament = item.tournament;
    if (item.competition) setFields.competition = item.competition;
    if (item.homeScoreText) setFields.homeScoreText = item.homeScoreText;
    if (item.awayScoreText) setFields.awayScoreText = item.awayScoreText;
    if (item.statusDetail || item.liveClock) {
      setFields.statusDetail = item.statusDetail || item.liveClock || '';
      setFields.liveClock = item.liveClock || item.statusDetail || '';
    }
    if (item.startTime) setFields.startTime = new Date(item.startTime);
    if (item.venue) setFields.venue = item.venue;
    if (item.sourceUrl) setFields.sourceUrl = item.sourceUrl;

    // Keep payloads smaller on hot sync path — store raw only for live rows
    if (isLiveStatus(item.status) && (item.rawPayload || item.rawData)) {
      setFields.rawPayload = item.rawPayload || item.rawData;
    }
    if (item.stats && typeof item.stats === 'object') {
      setFields.stats = item.stats;
    }
    if (item.players?.length) {
      setFields.players = item.players;
    }

    ops.push({
      updateOne: {
        filter: { fingerprint },
        update: {
          $set: setFields,
          $setOnInsert: {
            fingerprint,
            isPublished: true,
            fetchedAt: now,
          },
        },
        upsert: true,
      },
    });
  }

  let created = 0;
  let updated = 0;
  const CHUNK = 100;
  for (let i = 0; i < ops.length; i += CHUNK) {
    const chunk = ops.slice(i, i + CHUNK);
    const result = await SportsMatch.bulkWrite(chunk, { ordered: false });
    created += result.upsertedCount || 0;
    updated += result.modifiedCount || 0;
  }

  // Only expire LIVE rows that the API no longer reports as live (keep them as finished results)
  if (liveFingerprints.length || matches.some((m) => isLiveStatus(m.status))) {
    await SportsMatch.updateMany(
      {
        sport,
        provider,
        source: { $ne: 'manual' },
        status: { $in: LIVE_STATUSES },
        fingerprint: liveFingerprints.length ? { $nin: liveFingerprints } : { $exists: true },
      },
      {
        $set: {
          status: 'finished',
          isActive: true,
          lastUpdatedAt: now,
          lastSyncedAt: now,
        },
      }
    );
  }

  // Soft-disable legacy demo/config fallback live rows when real API sync runs
  await SportsMatch.updateMany(
    {
      sport,
      source: { $in: ['config', 'fallback', 'none'] },
      status: { $in: LIVE_STATUSES },
    },
    {
      $set: {
        status: 'finished',
        isActive: false,
        isPublished: false,
        lastUpdatedAt: now,
        lastSyncedAt: now,
      },
    }
  );

  const [liveCount, totalActive] = await Promise.all([
    SportsMatch.countDocuments({
      sport,
      status: { $in: LIVE_STATUSES },
      isActive: true,
      isPublished: true,
    }),
    SportsMatch.countDocuments({
      sport,
      isActive: true,
      isPublished: true,
    }),
  ]);

  return {
    created,
    updated,
    liveCount,
    totalCount: totalActive,
    received: matches.length,
  };
};

const mergeCatalogIntoSportConfig = (modeConfig, catalog) => {
  if (!catalog) return false;
  const merge = (existing = [], incoming = []) => {
    const set = new Set([...(existing || []), ...(incoming || [])].map((v) => String(v).trim()).filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b));
  };
  modeConfig.leagues = merge(modeConfig.leagues, catalog.leagues);
  modeConfig.tournaments = merge(modeConfig.tournaments, catalog.tournaments);
  modeConfig.competitions = merge(modeConfig.competitions, catalog.competitions);
  modeConfig.teams = merge(modeConfig.teams, catalog.teams);
  return true;
};

const importStandings = async (sport, standings, source) => {
  if (!standings?.length || source === 'none' || source === 'disabled') {
    return { upserted: 0 };
  }
  let upserted = 0;
  for (const table of standings) {
    if (!table?.rows?.length) continue;
    const league = table.league || 'League';
    const fingerprint = buildStandingFingerprint(sport, league, table.season || '');
    await SportsStanding.findOneAndUpdate(
      { fingerprint },
      {
        fingerprint,
        sport,
        league,
        tournament: table.tournament || '',
        season: table.season || '',
        rows: table.rows || [],
        source,
        isActive: true,
        isPublished: true,
        lastUpdatedAt: new Date(),
      },
      { upsert: true, new: true }
    );
    upserted += 1;
  }
  return { upserted };
};

export const runSportsFetch = async (sports = SPORT_TYPES, label = 'manual', options = {}) => {
  const config = await getOrCreateSportsConfig();

  // Clear stuck lock older than 3 minutes (crash / timeout safety)
  if (config.fetchInProgress) {
    const started = config.lastGlobalFetchAt ? new Date(config.lastGlobalFetchAt).getTime() : 0;
    const stuckMs = Date.now() - started;
    if (!started || stuckMs > 3 * 60 * 1000) {
      config.fetchInProgress = false;
      await config.save();
    } else {
      return { results: [], config, skipped: true, reason: 'fetch_in_progress' };
    }
  }

  config.fetchInProgress = true;
  config.lastGlobalFetchAt = new Date();
  await config.save();

  const results = [];
  const startedGlobal = new Date();
  const bypassCache = Boolean(options.bypassCache) || label === 'manual';

  try {
    for (const sport of sports) {
      const modeConfig = config[sport];
      if (!modeConfig?.enabled) {
        results.push({ sport, success: true, skipped: true, reason: 'disabled', label });
        continue;
      }

      try {
        const effectiveMode = applyProviderDefaults(sport, modeConfig);
        const {
          matches,
          standings,
          source,
          error,
          httpStatus,
          fromCache,
          skipped,
          reason,
          message: skipMessage,
          catalog,
        } = await fetchSportsForMode(sport, effectiveMode, { bypassCache });
        const provider = source || effectiveMode.apiProvider || 'custom';

        // Persist inferred provider/URL so Admin forms stay in sync (never wipe apiKey)
        if (!(modeConfig.apiBaseUrl || '').trim() && effectiveMode.apiBaseUrl) {
          modeConfig.apiBaseUrl = effectiveMode.apiBaseUrl;
        }
        if (!(modeConfig.apiEndpoint || '').trim() && effectiveMode.apiEndpoint) {
          modeConfig.apiEndpoint = effectiveMode.apiEndpoint;
        }
        if (!(modeConfig.apiProvider || '').trim() || modeConfig.apiProvider === 'custom') {
          if (effectiveMode.apiProvider) modeConfig.apiProvider = effectiveMode.apiProvider;
        }

        if (skipped) {
          modeConfig.lastFetchAt = new Date();
          modeConfig.lastFetchStatus = 'skipped';
          modeConfig.lastFetchError = skipMessage || reason || 'skipped';
          modeConfig.lastHttpStatus = httpStatus || 0;
          config.markModified(sport);
          results.push({
            sport,
            success: true,
            skipped: true,
            reason: reason || 'skipped',
            message: skipMessage || '',
            source,
            provider,
            apiError: null,
            httpStatus: httpStatus || 0,
            liveCount: 0,
            created: 0,
            updated: 0,
            label,
          });
          continue;
        }

        let matchStats = { created: 0, updated: 0, liveCount: 0, received: 0, totalCount: 0 };
        if (!error && source !== 'none' && source !== 'disabled') {
          matchStats = await syncLiveMatches(sport, matches, provider, source);
          await importStandings(sport, standings, source);
          if (catalog && (sport === 'cricket' || catalog.teams?.length)) {
            mergeCatalogIntoSportConfig(modeConfig, catalog);
          }
        } else if (error && !matches.length) {
          // API failed — do not wipe existing saved fixtures
          matchStats.liveCount = await SportsMatch.countDocuments({
            sport,
            status: { $in: LIVE_STATUSES },
            isActive: true,
            isPublished: true,
          });
          matchStats.totalCount = await SportsMatch.countDocuments({
            sport,
            isActive: true,
            isPublished: true,
          });
        }

        const fetchStatus = error ? 'error' : 'success';
        modeConfig.lastFetchAt = new Date();
        modeConfig.lastFetchStatus = fetchStatus;
        modeConfig.lastFetchError = error || '';
        modeConfig.lastFetchCount = matchStats.created + matchStats.updated;
        modeConfig.lastLiveCount = matchStats.liveCount;
        modeConfig.lastHttpStatus = httpStatus || 0;
        config.markModified(sport);

        results.push({
          sport,
          success: !error,
          source,
          provider,
          apiError: error || null,
          httpStatus: httpStatus || 0,
          liveCount: matchStats.liveCount,
          totalCount: matchStats.totalCount,
          received: matchStats.received,
          fromCache: Boolean(fromCache),
          catalogCounts: catalog
            ? {
                leagues: catalog.leagues?.length || 0,
                tournaments: catalog.tournaments?.length || 0,
                competitions: catalog.competitions?.length || 0,
                teams: catalog.teams?.length || 0,
              }
            : null,
          ...matchStats,
          label,
        });
      } catch (err) {
        modeConfig.lastFetchAt = new Date();
        modeConfig.lastFetchStatus = 'error';
        modeConfig.lastFetchError = err.message;
        config.markModified(sport);
        results.push({ sport, success: false, error: err.message, created: 0, updated: 0, label });
      }
    }

    config.lastGlobalFetchAt = startedGlobal;
    await config.save();
    return { results, config };
  } finally {
    const fresh = await SportsConfig.findOne({ key: 'default' });
    if (fresh) {
      fresh.fetchInProgress = false;
      await fresh.save();
    }
  }
};

export const getConfig = async (req, res, next) => {
  try {
    const config = await getOrCreateSportsConfig();
    const counts = await getLiveCounts();
    const presets = Object.fromEntries(SPORT_TYPES.map((s) => [s, getProviderPreset(s)]));
    res.json({
      success: true,
      data: maskConfigForClient(config),
      meta: {
        sports: SPORT_TYPES,
        widgets: WIDGET_TYPES,
        pages: WIDGET_PAGES,
        liveStatuses: LIVE_STATUSES,
        presets,
      },
      counts: {
        bySport: counts.bySportLive,
        bySportLive: counts.bySportLive,
        total: counts.totalLive,
        totalLive: counts.totalLive,
        allMatches: counts.total,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getStatus = async (req, res, next) => {
  try {
    const config = await getOrCreateSportsConfig();
    const counts = await getLiveCounts();
    const sports = {};
    for (const sport of SPORT_TYPES) {
      const m = config[sport] || {};
      sports[sport] = {
        enabled: m.enabled !== false,
        autoFetchEnabled: Boolean(m.autoFetchEnabled),
        hasApi: Boolean((m.apiBaseUrl || '').trim()),
        lastFetchAt: m.lastFetchAt,
        lastFetchStatus: m.lastFetchStatus || '',
        lastFetchError: m.lastFetchError || '',
        lastLiveCount: m.lastLiveCount ?? 0,
        lastHttpStatus: m.lastHttpStatus || 0,
        fetchIntervalSeconds: getEffectiveIntervalSeconds(m),
        provider: m.apiProvider || 'custom',
      };
    }
    res.json({
      success: true,
      fetchInProgress: Boolean(config.fetchInProgress),
      lastGlobalFetchAt: config.lastGlobalFetchAt,
      sports,
      counts: {
        bySport: counts.bySportLive,
        total: counts.totalLive,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateConfig = async (req, res, next) => {
  try {
    const config = await getOrCreateSportsConfig();
    const body = req.body || {};

    for (const sport of SPORT_TYPES) {
      if (body[sport]) {
        config[sport] = sanitizeSport(body[sport], config[sport] || defaultSport());
        // Cricket full-fixture sync is heavy — enforce a sane minimum interval
        if (sport === 'cricket' && Number(config[sport].fetchIntervalSeconds) < 60) {
          config[sport].fetchIntervalSeconds = 60;
        } else if (sport !== 'cricket' && Number(config[sport].fetchIntervalSeconds) < 30) {
          config[sport].fetchIntervalSeconds = 30;
        }
        config.markModified(sport);
      }
    }

    if (body.widgets !== undefined && Array.isArray(body.widgets)) {
      const seen = new Set();
      config.widgets = body.widgets
        .filter((w) => w && WIDGET_TYPES.includes(w.type) && !seen.has(w.type) && seen.add(w.type))
        .map((w) => {
          const pages = (w.pages || ['homepage']).filter((p) => WIDGET_PAGES.includes(p));
          const sports = (w.sports || SPORT_TYPES).filter((s) => SPORT_TYPES.includes(s));
          return {
            type: w.type,
            enabled: w.enabled !== false,
            pages: pages.length ? pages : ['homepage'],
            title: String(w.title || ''),
            sports: sports.length ? sports : SPORT_TYPES.filter((s) => s !== 'other'),
            maxItems: Math.min(20, Math.max(1, Number(w.maxItems) || 6)),
          };
        });
      WIDGET_TYPES.forEach((type) => {
        if (!config.widgets.some((w) => w.type === type)) {
          config.widgets.push({
            type,
            enabled: false,
            pages: ['homepage'],
            title: '',
            sports: SPORT_TYPES.filter((s) => s !== 'other'),
            maxItems: 6,
          });
        }
      });
    }

    if (body.showOnHomepage !== undefined) config.showOnHomepage = Boolean(body.showOnHomepage);
    if (body.homepageTitle !== undefined) {
      config.homepageTitle = String(body.homepageTitle).trim() || 'Live Sports';
    }

    await config.save();
    res.json({ success: true, data: maskConfigForClient(config), message: 'Sports configuration saved' });
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};

export const fetchNow = async (req, res, next) => {
  try {
    const sports = req.body?.sports?.length
      ? req.body.sports.filter((s) => SPORT_TYPES.includes(s))
      : SPORT_TYPES;
    if (!sports.length) {
      return res.status(400).json({ success: false, message: 'Select at least one sport' });
    }

    const config = await getOrCreateSportsConfig();
    if (config.fetchInProgress) {
      return res.status(409).json({
        success: false,
        message: 'Fetch already in progress — wait for it to finish',
        inProgress: true,
      });
    }

    // Await real backend request so Admin can show success/error immediately
    const { results, skipped: fetchSkipped, reason } = await runSportsFetch(sports, 'manual', {
      bypassCache: true,
    });
    if (fetchSkipped) {
      return res.status(409).json({
        success: false,
        message: reason === 'fetch_in_progress' ? 'Fetch already in progress' : 'Fetch skipped',
        inProgress: true,
      });
    }

    const failed = results.filter((r) => r.success === false || r.apiError);
    const ok = results.filter((r) => r.success !== false && !r.apiError && !r.skipped);
    const skippedResults = results.filter((r) => r.skipped);
    let message;
    if (failed.length) {
      message = `Fetch finished with errors: ${failed.map((r) => `${r.sport}: ${r.apiError || r.error}`).join('; ')}`;
    } else if (ok.length) {
      const skipHint = skippedResults.length
        ? ` (${skippedResults.length} skipped: ${skippedResults.map((r) => r.sport).join(', ')})`
        : '';
      message = `Fetched ${ok.length} sport(s) successfully${skipHint}`;
    } else if (skippedResults.length) {
      message = `Nothing fetched — ${skippedResults.map((r) => `${r.sport}: ${r.message || r.reason}`).join('; ')}`;
    } else {
      message = 'Fetch finished';
    }

    const counts = await getLiveCounts();
    const fresh = await getOrCreateSportsConfig();

    res.status(failed.length && !ok.length ? 502 : 200).json({
      success: failed.length === 0 || ok.length > 0,
      message,
      inProgress: false,
      sports,
      results,
      data: maskConfigForClient(fresh),
      counts: {
        bySport: counts.bySportLive,
        total: counts.totalLive,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getMatches = async (req, res, next) => {
  try {
    const { sport, status, q, page = 1, limit = 40 } = req.query;
    const filter = {};
    if (sport && SPORT_TYPES.includes(sport)) filter.sport = sport;
    if (status && status !== 'all') {
      if (status === 'live') filter.status = { $in: LIVE_STATUSES };
      else filter.status = status;
    }
    if (q?.trim()) {
      filter.$or = [
        { homeTeam: new RegExp(q.trim(), 'i') },
        { awayTeam: new RegExp(q.trim(), 'i') },
        { league: new RegExp(q.trim(), 'i') },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 40));
    const skip = (pageNum - 1) * limitNum;

    const adminSelect =
      '_id fingerprint externalId provider sport league tournament competition homeTeam awayTeam homeScore awayScore homeScoreText awayScoreText status statusDetail liveClock startTime venue sourceUrl isActive isPublished lastSyncedAt createdAt updatedAt';
    const [items, total] = await Promise.all([
      SportsMatch.find(filter)
        .select(adminSelect)
        .sort({ lastSyncedAt: -1, startTime: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      SportsMatch.countDocuments(filter),
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

export const updateMatch = async (req, res, next) => {
  try {
    const match = await SportsMatch.findById(req.params.id);
    if (!match) return res.status(404).json({ success: false, message: 'Match not found' });

    const allowed = [
      'homeScore', 'awayScore', 'homeScoreText', 'awayScoreText', 'status', 'statusDetail',
      'isActive', 'isPublished', 'venue', 'stats', 'players', 'liveClock',
    ];
    allowed.forEach((k) => {
      if (req.body[k] !== undefined) match[k] = req.body[k];
    });
    match.lastUpdatedAt = new Date();
    await match.save();
    res.json({ success: true, data: match, message: 'Match updated' });
  } catch (error) {
    next(error);
  }
};

export const deleteMatch = async (req, res, next) => {
  try {
    const match = await SportsMatch.findByIdAndDelete(req.params.id);
    if (!match) return res.status(404).json({ success: false, message: 'Match not found' });
    res.json({ success: true, message: 'Deleted' });
  } catch (error) {
    next(error);
  }
};

export const getStandings = async (req, res, next) => {
  try {
    const filter = { isActive: true };
    if (req.query.sport && SPORT_TYPES.includes(req.query.sport)) filter.sport = req.query.sport;
    if (req.query.all === '1' || req.query.all === 'true') {
      delete filter.isActive;
    }
    const items = await SportsStanding.find(filter).sort({ updatedAt: -1 }).lean();
    res.json({ success: true, data: items });
  } catch (error) {
    next(error);
  }
};

export const deleteStanding = async (req, res, next) => {
  try {
    const item = await SportsStanding.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Standing not found' });
    res.json({ success: true, message: 'Standing table removed' });
  } catch (error) {
    next(error);
  }
};

export const getPublicWidgets = async (req, res, next) => {
  try {
    const config = await getOrCreateSportsConfig();
    const page = String(req.query.page || 'homepage').toLowerCase();
    const sportFilter = req.query.sport;

    if (page === 'homepage' && !config.showOnHomepage) {
      return res.json({ success: true, data: { widgets: [], matches: {}, standings: [] }, enabled: false });
    }

    const enabledWidgets = (config.widgets || []).filter(
      (w) => w.enabled && (w.pages || []).includes(page)
    );

    if (!enabledWidgets.length) {
      return res.json({
        success: true,
        enabled: false,
        title: config.homepageTitle || 'Live Sports',
        data: { widgets: [], matches: { live: [], upcoming: [], results: [], all: [] }, standings: [] },
      });
    }

    const sportsNeeded = [
      ...new Set(enabledWidgets.flatMap((w) => (w.sports?.length ? w.sports : SPORT_TYPES))),
    ].filter((s) => SPORT_TYPES.includes(s) && config[s]?.enabled !== false);

    const activeSports = sportFilter && SPORT_TYPES.includes(sportFilter)
      ? sportsNeeded.filter((s) => s === sportFilter)
      : sportsNeeded;

    const emptyMatches = { live: [], upcoming: [], results: [], all: [] };

    if (!activeSports.length) {
      return res.json({
        success: true,
        enabled: true,
        title: config.homepageTitle || 'Live Sports',
        refreshIntervalSeconds: 10,
        lastUpdatedAt: new Date(),
        data: { widgets: enabledWidgets, matches: emptyMatches, standings: [] },
      });
    }

    const liveFilter = {
      sport: { $in: activeSports },
      status: { $in: LIVE_STATUSES },
      isActive: true,
      isPublished: true,
    };

    const widgetSelect =
      '_id fingerprint externalId provider sport league tournament competition homeTeam awayTeam homeScore awayScore homeScoreText awayScoreText status statusDetail liveClock startTime venue sourceUrl lastSyncedAt';
    const [live, standings] = await Promise.all([
      SportsMatch.find(liveFilter).select(widgetSelect).sort({ lastSyncedAt: -1 }).limit(20).lean(),
      SportsStanding.find({
        sport: { $in: activeSports },
        isActive: true,
        isPublished: true,
      })
        .sort({ updatedAt: -1 })
        .limit(10)
        .lean(),
    ]);

    res.json({
      success: true,
      enabled: true,
      title: config.homepageTitle || 'Live Sports',
      refreshIntervalSeconds: 10,
      lastUpdatedAt: config.lastGlobalFetchAt || new Date(),
      data: {
        widgets: enabledWidgets,
        matches: {
          live,
          upcoming: [],
          results: [],
          all: live,
        },
        standings,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getPublicList = async (req, res, next) => {
  try {
    const config = await getOrCreateSportsConfig();
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
    const skip = (page - 1) * limit;

    const filter = {
      isActive: true,
      isPublished: true,
    };

    if (req.query.sport && SPORT_TYPES.includes(req.query.sport)) {
      filter.sport = req.query.sport;
    }

    const status = String(req.query.status || 'live').toLowerCase();
    if (status === 'all') {
      // live + upcoming + finished
    } else if (status === 'live') {
      filter.status = { $in: LIVE_STATUSES };
    } else if (status === 'upcoming' || status === 'scheduled') {
      filter.status = 'scheduled';
    } else if (status === 'finished' || status === 'results') {
      filter.status = 'finished';
    } else if (['halftime', 'postponed', 'cancelled', 'abandoned'].includes(status)) {
      filter.status = status;
    } else {
      filter.status = { $in: LIVE_STATUSES };
    }

    const listSelect =
      '_id fingerprint externalId provider sport league tournament competition homeTeam awayTeam homeScore awayScore homeScoreText awayScoreText status statusDetail liveClock startTime venue sourceUrl lastSyncedAt isActive isPublished';
    const [matches, total] = await Promise.all([
      SportsMatch.find(filter)
        .select(listSelect)
        .sort({ lastSyncedAt: -1, startTime: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SportsMatch.countDocuments(filter),
    ]);

    res.json({
      success: true,
      enabled: config.showOnHomepage !== false || total > 0,
      title: config.homepageTitle || 'Live Sports',
      titleTa: 'நேரடி விளையாட்டு',
      data: { matches, standings: [] },
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(Math.ceil(total / limit), 1),
      },
    });
  } catch (error) {
    next(error);
  }
};

/** Public match detail — enriches stored match with provider detail APIs */
export const getPublicMatchDetail = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid match id' });
    }

    const matchDoc = await SportsMatch.findOne({
      _id: id,
      isActive: true,
      isPublished: true,
    }).lean();

    if (!matchDoc) {
      return res.status(404).json({ success: false, message: 'Match not found' });
    }

    const config = await getOrCreateSportsConfig();
    const modeConfig = config[matchDoc.sport] || {};
    const payload = await buildMatchDetailPayload(matchDoc, modeConfig);

    // League standings from DB if provider standings empty
    if (!payload.detail.standings?.length) {
      const leagueName = payload.match.competition || payload.match.league;
      if (leagueName) {
        const standing = await SportsStanding.findOne({
          sport: matchDoc.sport,
          isActive: true,
          isPublished: true,
          $or: [
            { league: new RegExp(`^${leagueName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
            { tournament: new RegExp(`^${leagueName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
          ],
        }).lean();
        if (standing?.rows?.length) {
          payload.detail.standings = standing.rows;
          payload.detail.availability.standings = true;
        }
      }
    }

    // Soft-refresh stored score/status from live detail (no fake data)
    if (payload.match && isLiveStatus(payload.match.status)) {
      const updates = {};
      if (payload.match.homeScoreText && payload.match.homeScoreText !== matchDoc.homeScoreText) {
        updates.homeScoreText = payload.match.homeScoreText;
      }
      if (payload.match.awayScoreText && payload.match.awayScoreText !== matchDoc.awayScoreText) {
        updates.awayScoreText = payload.match.awayScoreText;
      }
      if (payload.match.status && payload.match.status !== matchDoc.status) {
        updates.status = payload.match.status;
      }
      if (payload.match.statusDetail && payload.match.statusDetail !== matchDoc.statusDetail) {
        updates.statusDetail = payload.match.statusDetail;
      }
      if (Object.keys(updates).length) {
        updates.lastSyncedAt = new Date();
        updates.lastUpdatedAt = new Date();
        SportsMatch.updateOne({ _id: matchDoc._id }, { $set: updates }).catch(() => {});
      }
    }

    res.json({
      success: true,
      data: payload,
    });
  } catch (error) {
    next(error);
  }
};

/** Public player detail within a match context */
export const getPublicMatchPlayer = async (req, res, next) => {
  try {
    const { id, playerKey } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid match id' });
    }
    if (!playerKey) {
      return res.status(400).json({ success: false, message: 'Player key required' });
    }

    const matchDoc = await SportsMatch.findOne({
      _id: id,
      isActive: true,
      isPublished: true,
    }).lean();

    if (!matchDoc) {
      return res.status(404).json({ success: false, message: 'Match not found' });
    }

    const config = await getOrCreateSportsConfig();
    const modeConfig = config[matchDoc.sport] || {};
    const payload = await buildMatchDetailPayload(matchDoc, modeConfig);
    const player = findPlayerInDetail(payload.detail, playerKey);

    if (!player) {
      return res.status(404).json({
        success: false,
        message: 'Player statistics are not available for this match',
      });
    }

    res.json({
      success: true,
      data: {
        match: payload.match,
        player,
        sport: matchDoc.sport,
      },
    });
  } catch (error) {
    next(error);
  }
};
