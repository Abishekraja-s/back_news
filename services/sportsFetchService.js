/**
 * Sports data fetcher — provider-aware (CricLive, SportScore, Chess, custom).
 * API keys stay on the server; responses are validated and mapped to a common match shape.
 */

const DEFAULT_TIMEOUT_MS = 15000;
const MAX_RETRIES = 2;
const UA = 'GreatIndiaNews-SportsBot/1.0';

/** In-memory response cache: key → { expiresAt, value } */
const responseCache = new Map();

const CACHE_TTL = {
  live: 60 * 1000,
  schedule: 15 * 60 * 1000,
  series: 30 * 60 * 1000,
  teams: 60 * 60 * 1000,
  rankings: 60 * 60 * 1000,
  players: 60 * 60 * 1000,
  default: 5 * 60 * 1000,
};

const PROVIDER_ALIASES = {
  criclive: 'criclive',
  'cric-live': 'criclive',
  cricketlive: 'criclive',
  'cricket-live': 'criclive',
  sportscore: 'sportscore',
  'sport-score': 'sportscore',
  chess: 'chess',
  'chess-com': 'chess',
  chesscom: 'chess',
  lichess: 'lichess',
  custom: 'custom',
};

const SPORTSCORE_SPORT_PARAM = {
  cricket: 'cricket',
  football: 'football',
  basketball: 'basketball',
  tennis: 'tennis',
};

const hash = (s) => {
  let h = 0;
  const str = String(s);
  for (let i = 0; i < str.length; i += 1) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return `s${Math.abs(h)}`;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getCache = (key) => {
  const hit = responseCache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    responseCache.delete(key);
    return null;
  }
  return hit.value;
};

const setCache = (key, value, ttlMs) => {
  responseCache.set(key, { value, expiresAt: Date.now() + ttlMs });
};

/** Default provider when Admin left provider blank / "custom" */
const DEFAULT_PROVIDER_BY_SPORT = {
  cricket: 'sportscore',
  football: 'sportscore',
  basketball: 'sportscore',
  tennis: 'sportscore',
  chess: 'lichess',
};

/** Recommended admin defaults (never overwrite saved keys) */
export const getProviderPreset = (sport) => {
  if (sport === 'cricket') {
    return {
      apiBaseUrl: 'https://sportscore.com',
      apiEndpoint: '/api/widget/matches/',
      apiProvider: 'SportScore',
      fetchIntervalSeconds: 60,
      apiKeyRequired: false,
      apiKeyHint:
        'SportScore needs no key. Optional: switch Provider to CricLive + paste Bearer API key',
      sportParam: 'cricket',
    };
  }
  if (sport === 'football' || sport === 'basketball' || sport === 'tennis') {
    return {
      apiBaseUrl: 'https://sportscore.com',
      apiEndpoint: '/api/widget/matches/',
      apiProvider: 'SportScore',
      fetchIntervalSeconds: 60,
      apiKeyRequired: false,
      apiKeyHint: 'Optional / leave empty for SportScore',
      sportParam: SPORTSCORE_SPORT_PARAM[sport],
    };
  }
  if (sport === 'chess') {
    return {
      apiBaseUrl: 'https://lichess.org',
      apiEndpoint: '/api/tv/channels',
      apiProvider: 'lichess',
      fetchIntervalSeconds: 60,
      apiKeyRequired: false,
      apiKeyHint: 'Lichess TV — no API key required (override URL only if using another Chess API)',
    };
  }
  return {
    apiBaseUrl: '',
    apiEndpoint: '',
    apiProvider: 'custom',
    fetchIntervalSeconds: 60,
    apiKeyRequired: false,
    apiKeyHint: 'Optional',
  };
};

export const resolveProvider = (modeConfig = {}, sport = '') => {
  const raw = String(modeConfig.apiProvider || '').trim().toLowerCase();
  const base = String(modeConfig.apiBaseUrl || '').toLowerCase();
  const hasKey = Boolean(String(modeConfig.apiKey || '').trim());

  if (base.includes('sportscore.com')) return 'sportscore';
  if (base.includes('lichess.org') || raw === 'lichess') return 'lichess';
  if (base.includes('chess.com')) return 'chess';

  // Cricket: CricLive only when an API key is present; otherwise SportScore (free, no key)
  if (sport === 'cricket') {
    if (hasKey && (raw.includes('cric') || PROVIDER_ALIASES[raw] === 'criclive' || base.includes('cricketlive'))) {
      return 'criclive';
    }
    if (PROVIDER_ALIASES[raw] === 'sportscore' || !raw || raw === 'custom') return 'sportscore';
    if (PROVIDER_ALIASES[raw] === 'criclive' && !hasKey) return 'sportscore';
  }

  if (raw && raw !== 'custom' && PROVIDER_ALIASES[raw]) return PROVIDER_ALIASES[raw];
  if (base.includes('cricketliveapi.com') || base.includes('criclive')) return 'criclive';

  if (sport === 'chess') return 'lichess';
  if (DEFAULT_PROVIDER_BY_SPORT[sport]) return DEFAULT_PROVIDER_BY_SPORT[sport];
  if (raw && PROVIDER_ALIASES[raw]) return PROVIDER_ALIASES[raw];
  return 'custom';
};

/** Fill built-in base URL / endpoint / provider label for known sports */
export const applyProviderDefaults = (sport, modeConfig = {}) => {
  const next = { ...(modeConfig?.toObject ? modeConfig.toObject() : modeConfig) };
  const provider = resolveProvider(next, sport);
  const preset = getProviderPreset(sport);

  if (!next.apiProvider || next.apiProvider === 'custom') {
    next.apiProvider = preset.apiProvider || provider;
  }
  if (!String(next.apiBaseUrl || '').trim() && preset.apiBaseUrl) {
    next.apiBaseUrl = preset.apiBaseUrl;
  }
  if (!String(next.apiEndpoint || '').trim() && preset.apiEndpoint) {
    next.apiEndpoint = preset.apiEndpoint;
  }
  if (!next.fetchIntervalSeconds || next.fetchIntervalSeconds < 10) {
    next.fetchIntervalSeconds = preset.fetchIntervalSeconds || 60;
  }
  return { ...next, _resolvedProvider: provider };
};

export const getConfigurationGap = (sport, modeConfig = {}) => {
  const effective = applyProviderDefaults(sport, modeConfig);
  const provider = effective._resolvedProvider || resolveProvider(effective, sport);

  if (provider === 'sportscore' || provider === 'lichess') return null;
  if (provider === 'criclive' && !String(effective.apiKey || '').trim()) {
    return 'missing_api_key';
  }
  if (provider === 'chess' || provider === 'custom') {
    const hasUrl =
      String(effective.apiBaseUrl || '').trim() || String(effective.apiEndpoint || '').trim();
    if (!hasUrl) return 'missing_api_url';
  }
  return null;
};

/** Unique key: provider + sport + external_match_id */
export const buildMatchFingerprint = (sport, item, provider = 'custom') => {
  const extId = String(item.externalId || item.matchId || item.id || item.match_id || '').trim();
  if (!extId) return null;
  return hash(`${provider}|${sport}|${extId}`);
};

export const buildStandingFingerprint = (sport, league, season = '') =>
  hash([sport, league, season].join('|'));

export const isLiveStatus = (status) => ['live', 'halftime'].includes(status);

export const mapStatus = (s, detail = '') => {
  const raw = String(s || '').trim();
  const detailRaw = String(detail || '').trim();
  const v = `${raw} ${detailRaw}`.toUpperCase().replace(/[\s-]+/g, '_');

  if (v.includes('HALF')) return 'halftime';

  const liveTokens = [
    'LIVE',
    'IN_PLAY',
    'IN_PROGRESS',
    'INPROGRESS',
    'PLAYING',
    'ACTIVE',
    '1H',
    '2H',
    'ONGOING',
    'STARTED',
    'BATTING',
    'INNINGS',
    '1ST_SET',
    '2ND_SET',
  ];
  if (liveTokens.some((t) => v.includes(t))) return 'live';
  if (
    v.includes('FINISH') ||
    v.includes('FT') ||
    v.includes('COMPLETE') ||
    v.includes('ENDED') ||
    v === 'FULL_TIME' ||
    v.includes('CLOSED') ||
    v.includes('RESULT')
  ) {
    return 'finished';
  }
  if (v.includes('POSTPONE')) return 'postponed';
  if (v.includes('CANCEL')) return 'cancelled';
  if (v.includes('ABANDON')) return 'abandoned';
  if (v.includes('SCHED') || v.includes('UPCOMING') || v === 'NS' || v === 'NOT_STARTED') {
    return 'scheduled';
  }
  if (['live', 'halftime', 'finished', 'postponed', 'cancelled', 'abandoned', 'scheduled'].includes(raw.toLowerCase())) {
    return raw.toLowerCase();
  }
  return 'scheduled';
};

const pickTeamName = (...candidates) => {
  for (const c of candidates) {
    if (c == null) continue;
    if (typeof c === 'string' && c.trim()) return c.trim();
    if (typeof c === 'object') {
      const name = c.name || c.short_name || c.shortName || c.title || c.team_name;
      if (name) return String(name).trim();
    }
  }
  return '';
};

const pickScore = (...candidates) => {
  for (const c of candidates) {
    if (c == null || c === '') continue;
    const n = Number(c);
    if (!Number.isNaN(n)) return n;
  }
  return 0;
};

const pickScoreText = (...candidates) => {
  for (const c of candidates) {
    if (c == null || c === '') continue;
    return String(c).trim();
  }
  return '';
};

/**
 * Map any provider payload into the common internal match fields.
 */
export const normalizeMatch = (sport, raw = {}, provider = 'custom') => {
  const teams = raw.teams || raw.team || {};
  const scores = raw.scores || raw.score || {};
  const homeObj = raw.home || raw.home_team || teams.home || teams.a || raw.team1 || raw.t1;
  const awayObj = raw.away || raw.away_team || teams.away || teams.b || raw.team2 || raw.t2;

  const homeTeam = pickTeamName(
    raw.homeTeam,
    homeObj,
    raw.home_name,
    raw.team_a,
    raw.player1,
    raw.white,
    sport === 'chess' ? raw.white_player : null
  );
  const awayTeam = pickTeamName(
    raw.awayTeam,
    awayObj,
    raw.away_name,
    raw.team_b,
    raw.player2,
    raw.black,
    sport === 'chess' ? raw.black_player : null
  );

  const urlSlug = String(raw.url || raw.sourceUrl || '')
    .replace(/\/$/, '')
    .split('/')
    .filter(Boolean)
    .pop();

  let externalId = String(
    raw.externalId ||
      raw.matchId ||
      raw.match_id ||
      raw.id ||
      raw.fixture_id ||
      raw.fixtureId ||
      raw.game_id ||
      raw.gameId ||
      raw.uid ||
      urlSlug ||
      ''
  ).trim();

  // SportScore has no numeric id — derive a stable key from teams + kickoff
  if (!externalId) {
    const stamp = raw.time || raw.startTime || raw.start_time || raw.date || '';
    const comp = raw.competition || raw.league || '';
    externalId = hash(`${sport}|${homeTeam}|${awayTeam}|${stamp}|${comp}`);
  }

  const homeScoreText = pickScoreText(
    raw.homeScoreText,
    raw.home_score_text,
    raw.home_score,
    raw.home_runs,
    scores.home_text,
    typeof scores.home === 'string' ? scores.home : '',
    homeObj?.score_text,
    homeObj?.runs != null ? String(homeObj.runs) : ''
  );
  const awayScoreText = pickScoreText(
    raw.awayScoreText,
    raw.away_score_text,
    raw.away_score,
    raw.away_runs,
    scores.away_text,
    typeof scores.away === 'string' ? scores.away : '',
    awayObj?.score_text,
    awayObj?.runs != null ? String(awayObj.runs) : ''
  );

  const homeScore = pickScore(
    raw.homeScore,
    raw.home_score,
    scores.home,
    homeObj?.score,
    homeObj?.runs,
    homeObj?.points
  );
  const awayScore = pickScore(
    raw.awayScore,
    raw.away_score,
    scores.away,
    awayObj?.score,
    awayObj?.runs,
    awayObj?.points
  );

  const league = String(
    raw.league || raw.competition || raw.tournament || raw.series || raw.series_name || raw.event || ''
  ).trim();
  const tournament = String(raw.tournament || raw.series || raw.series_name || '').trim();
  const competition = String(raw.competition || raw.league || league).trim();
  const seriesId = String(raw.seriesId || raw.series_id || raw.series?.id || '').trim();
  const logo = String(
    raw.logo ||
      raw.image ||
      raw.thumbnail ||
      raw.competition_logo ||
      raw.home_logo ||
      homeObj?.logo ||
      awayObj?.logo ||
      ''
  ).trim();
  const winner = String(
    raw.winner || raw.winning_team || raw.result?.winner || ''
  ).trim();

  const status = mapStatus(
    raw.status || raw.match_status || raw.state || raw.matchState || raw.game_status || raw.status_str,
    raw.status_text || raw.statusDetail || raw.status_detail || raw.status_note || ''
  );

  return {
    sport,
    matchId: externalId,
    externalId,
    seriesId,
    competition,
    tournament,
    league,
    homeTeam,
    awayTeam,
    homeScore,
    awayScore,
    homeScoreText,
    awayScoreText,
    status,
    statusDetail: String(
      raw.statusDetail || raw.status_detail || raw.minute || raw.clock || raw.status_note || raw.note || ''
    ).trim(),
    liveClock: String(
      raw.liveClock || raw.live_clock || raw.clock || raw.elapsed || raw.minute || raw.overs || ''
    ).trim(),
    startTime: raw.startTime || raw.start_time || raw.time || raw.date || raw.datetime || raw.start_at || null,
    venue: String(raw.venue || raw.stadium || raw.ground || raw.location || '').trim(),
    logo,
    winner,
    stats: {
      ...(raw.stats && typeof raw.stats === 'object' ? raw.stats : {}),
      ...(seriesId ? { seriesId } : {}),
      ...(logo ? { logo } : {}),
      ...(winner ? { winner } : {}),
    },
    players: Array.isArray(raw.players) ? raw.players : [],
    sourceUrl: String(raw.url || raw.sourceUrl || raw.link || '').trim(),
    rawData: raw,
    rawPayload: raw,
    lastUpdated: new Date().toISOString(),
    provider,
  };
};

export const validateLiveMatch = (item) => {
  if (!item?.externalId?.trim()) return false;
  if (!item.homeTeam?.trim() || !item.awayTeam?.trim()) return false;
  if (item.homeTeam.toLowerCase() === 'home' || item.awayTeam.toLowerCase() === 'away') return false;
  return isLiveStatus(item.status);
};

/** Accept any valid fixture (live / upcoming / finished) — never require league fields */
export const validateMatchRecord = (item) => {
  if (!item?.externalId?.trim()) return false;
  if (!item.homeTeam?.trim() || !item.awayTeam?.trim()) return false;
  if (item.homeTeam.toLowerCase() === 'home' || item.awayTeam.toLowerCase() === 'away') return false;
  return true;
};

const UNIQUE_NORMAL = 'Bilateral / Tour Match';

/** If API omits league/tournament/competition, keep the fixture under a Normal category */
export const ensureMatchCategory = (item = {}) => {
  const next = { ...item };
  const hasAny = Boolean(
    String(next.league || '').trim() ||
      String(next.tournament || '').trim() ||
      String(next.competition || '').trim()
  );
  if (!hasAny) {
    next.competition = UNIQUE_NORMAL;
    next.league = UNIQUE_NORMAL;
    next.tournament = '';
    next.stats = { ...(next.stats || {}), matchCategory: 'normal_tour_bilateral' };
  }
  return next;
};

export const dedupeMatches = (matches = []) => {
  const seen = new Set();
  const out = [];
  for (const m of matches) {
    const key = String(m.externalId || '').trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(m);
  }
  return out;
};

export const extractCatalogFromMatches = (matches = []) => {
  const leagues = new Set();
  const tournaments = new Set();
  const competitions = new Set();
  const teams = new Set();
  for (const m of matches) {
    if (m.league?.trim()) leagues.add(m.league.trim());
    if (m.tournament?.trim()) tournaments.add(m.tournament.trim());
    if (m.competition?.trim()) competitions.add(m.competition.trim());
    if (m.homeTeam?.trim()) teams.add(m.homeTeam.trim());
    if (m.awayTeam?.trim()) teams.add(m.awayTeam.trim());
  }
  const sort = (s) => [...s].sort((a, b) => a.localeCompare(b));
  return {
    leagues: sort(leagues),
    tournaments: sort(tournaments),
    competitions: sort(competitions),
    teams: sort(teams),
  };
};

const mergeUniqueLists = (...lists) => {
  const set = new Set();
  for (const list of lists) {
    for (const item of list || []) {
      const v = String(item || '').trim();
      if (v) set.add(v);
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b));
};

export const buildApiUrl = (modeConfig) => {
  const base = (modeConfig.apiBaseUrl || '').trim().replace(/\/$/, '');
  const endpoint = (modeConfig.apiEndpoint || '').trim();
  if (!base) return '';

  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }
  if (endpoint) {
    return `${base}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
  }
  return base;
};

const joinUrl = (base, path) => {
  const b = String(base || '').replace(/\/$/, '');
  const p = String(path || '');
  if (!p) return b;
  if (p.startsWith('http://') || p.startsWith('https://')) return p;
  return `${b}${p.startsWith('/') ? '' : '/'}${p}`;
};

const extractMatchArray = (json) => {
  if (Array.isArray(json)) return json;
  if (!json || typeof json !== 'object') return [];

  const candidates = [
    json.matches,
    json.data?.matches,
    json.fixtures,
    json.live,
    json.games,
    json.events,
    json.results,
    json.data?.live,
    json.data?.fixtures,
    json.data?.games,
    json.data?.events,
    Array.isArray(json.data) ? json.data : null,
    json.response,
    Array.isArray(json.response?.data) ? json.response.data : null,
  ];

  for (const c of candidates) {
    if (Array.isArray(c)) return c;
  }
  return [];
};

const extractStandings = (json) => {
  if (!json || typeof json !== 'object') return [];
  const list = json.standings || json.data?.standings || json.table || [];
  return Array.isArray(list) ? list : [];
};

const buildAuthHeaders = (provider, modeConfig) => {
  const headers = {
    Accept: 'application/json',
    'User-Agent': UA,
  };

  const key = String(modeConfig.apiKey || '').trim();

  if (provider === 'criclive') {
    if (key) headers.Authorization = `Bearer ${key}`;
    return headers;
  }

  if (provider === 'sportscore') {
    // SportScore widget API — API key optional / unused
    return headers;
  }

  if (key) {
    headers.Authorization = `Bearer ${key}`;
    headers['X-API-Key'] = key;
  }
  return headers;
};

const httpGetJson = async (url, headers, { timeoutMs = DEFAULT_TIMEOUT_MS, retries = MAX_RETRIES } = {}) => {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers,
        redirect: 'follow',
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (res.status === 429) {
        const err = new Error('API rate limit exceeded');
        err.statusCode = 429;
        if (attempt < retries) {
          await sleep(1000 * (attempt + 1));
          lastError = err;
          continue;
        }
        throw err;
      }

      if (!res.ok) {
        const err = new Error(`API returned HTTP ${res.status}`);
        err.statusCode = res.status;
        if (res.status >= 500 && attempt < retries) {
          await sleep(500 * (attempt + 1));
          lastError = err;
          continue;
        }
        throw err;
      }

      let json;
      try {
        json = await res.json();
      } catch {
        const err = new Error('API did not return valid JSON');
        err.statusCode = 422;
        throw err;
      }

      return { json, httpStatus: res.status };
    } catch (err) {
      lastError = err;
      const retryable =
        err.name === 'AbortError' ||
        err.name === 'TimeoutError' ||
        /fetch failed|network|ECONNRESET|ETIMEDOUT/i.test(err.message || '');
      if (retryable && attempt < retries) {
        await sleep(500 * (attempt + 1));
        continue;
      }
      if (err.name === 'AbortError' || err.name === 'TimeoutError') {
        const timeoutErr = new Error(`API request timed out after ${Math.round(timeoutMs / 1000)}s`);
        timeoutErr.statusCode = 504;
        throw timeoutErr;
      }
      throw err;
    }
  }
  throw lastError || new Error('API request failed');
};

const cachedGet = async (cacheKey, ttlMs, fetcher) => {
  const cached = getCache(cacheKey);
  if (cached) return { ...cached, fromCache: true };
  const value = await fetcher();
  setCache(cacheKey, value, ttlMs);
  return { ...value, fromCache: false };
};

/** CricLive — live scores only on refresh; other endpoints use slower cache when requested */
const fetchCricLive = async (sport, modeConfig) => {
  if (sport !== 'cricket') {
    return {
      matches: [],
      standings: [],
      source: 'criclive',
      error: 'CricLive provider is only supported for cricket',
      httpStatus: 0,
    };
  }

  if (!String(modeConfig.apiKey || '').trim()) {
    return {
      matches: [],
      standings: [],
      source: 'criclive',
      error: null,
      skipped: true,
      reason: 'missing_api_key',
      message: 'Add your CricLive API key in Admin → Cricket (Authorization: Bearer)',
      httpStatus: 0,
    };
  }

  const base = (modeConfig.apiBaseUrl || 'https://cricketliveapi.com').trim().replace(/\/$/, '');
  const endpoint = (modeConfig.apiEndpoint || '/api/v1/cricket/live').trim();
  const url = joinUrl(base, endpoint);
  const headers = buildAuthHeaders('criclive', modeConfig);
  const cacheKey = `criclive:live:${url}`;

  const { json, httpStatus, fromCache } = await cachedGet(cacheKey, CACHE_TTL.live, async () => {
    const result = await httpGetJson(url, headers);
    return result;
  });

  const matchList = extractMatchArray(json);
  const normalized = matchList
    .map((m) => normalizeMatch(sport, m, 'criclive'))
    .map(ensureMatchCategory)
    .filter(validateMatchRecord);

  return {
    matches: normalized,
    standings: extractStandings(json),
    source: 'criclive',
    error: null,
    httpStatus,
    fromCache: Boolean(fromCache),
    catalog: extractCatalogFromMatches(normalized),
    meta: {
      provider: 'criclive',
      endpoints: {
        live: '/api/v1/cricket/live',
        schedule: '/api/v1/cricket/schedule',
        series: '/api/v1/cricket/series',
        scorecard: '/api/v1/cricket/match/{id}/scorecard',
        commentary: '/api/v1/cricket/match/{id}/commentary',
        teams: '/api/v1/cricket/teams',
        players: '/api/v1/cricket/teams/{id}/players',
        player: '/api/v1/cricket/players/{id}',
        rankings: '/api/v1/cricket/rankings',
      },
    },
  };
};

/** Optional slower CricLive resource fetch (not used on every live refresh) */
export const fetchCricLiveResource = async (modeConfig, resource = 'schedule', { id } = {}) => {
  const base = (modeConfig.apiBaseUrl || 'https://cricketliveapi.com').trim().replace(/\/$/, '');
  const paths = {
    schedule: '/api/v1/cricket/schedule',
    series: '/api/v1/cricket/series',
    teams: '/api/v1/cricket/teams',
    rankings: '/api/v1/cricket/rankings',
    scorecard: id ? `/api/v1/cricket/match/${id}/scorecard` : '',
    commentary: id ? `/api/v1/cricket/match/${id}/commentary` : '',
    players: id ? `/api/v1/cricket/teams/${id}/players` : '',
    player: id ? `/api/v1/cricket/players/${id}` : '',
  };
  const path = paths[resource];
  if (!path) {
    const err = new Error(`Unknown CricLive resource: ${resource}`);
    err.statusCode = 400;
    throw err;
  }

  const ttl = CACHE_TTL[resource] || CACHE_TTL.default;
  const url = joinUrl(base, path);
  const headers = buildAuthHeaders('criclive', modeConfig);
  const cacheKey = `criclive:${resource}:${url}`;

  return cachedGet(cacheKey, ttl, async () => httpGetJson(url, headers));
};

/**
 * SportScore widget matches.
 * Cricket: fetch ALL statuses (live/upcoming/finished), never filter by admin team/league lists.
 * Other sports: live-only (homepage widgets).
 */
const fetchSportScore = async (sport, modeConfig, options = {}) => {
  const sportParam = SPORTSCORE_SPORT_PARAM[sport];
  if (!sportParam) {
    return {
      matches: [],
      standings: [],
      source: 'sportscore',
      error: `SportScore provider does not support sport "${sport}"`,
      httpStatus: 0,
    };
  }

  const allFixtures = sport === 'cricket' || options.allFixtures === true;
  const base = (modeConfig.apiBaseUrl || 'https://sportscore.com').trim().replace(/\/$/, '');
  const endpoint = (modeConfig.apiEndpoint || '/api/widget/matches/').trim();
  const headers = buildAuthHeaders('sportscore', modeConfig);

  const pageSize = allFixtures ? 40 : 30;
  // Cron: 2 pages max (fast). Manual/admin: up to 4. Avoid 8× slow SportScore round-trips.
  const maxPages = allFixtures
    ? Number(options.maxPages) || (options.bypassCache ? 4 : 2)
    : 1;
  const collected = [];
  const seenKeys = new Set();
  let lastHttp = 0;
  let fromCache = false;
  let standings = [];

  for (let page = 1; page <= maxPages; page += 1) {
    const urlObj = new URL(joinUrl(base, endpoint));
    urlObj.searchParams.set('sport', sportParam);
    urlObj.searchParams.set('limit', String(pageSize));
    if (page > 1) {
      urlObj.searchParams.set('page', String(page));
      urlObj.searchParams.set('offset', String((page - 1) * pageSize));
    }

    // Cricket: do not send admin leagues/teams as API filters — those are catalogs after fetch
    if (!allFixtures) {
      if (modeConfig.leagues?.length) urlObj.searchParams.set('leagues', modeConfig.leagues.join(','));
      if (modeConfig.tournaments?.length) {
        urlObj.searchParams.set('tournaments', modeConfig.tournaments.join(','));
      }
      if (modeConfig.competitions?.length) {
        urlObj.searchParams.set('competitions', modeConfig.competitions.join(','));
      }
      if (modeConfig.teams?.length) urlObj.searchParams.set('teams', modeConfig.teams.join(','));
    }

    const cacheKey = `sportscore:${allFixtures ? 'all' : 'live'}:${urlObj.toString()}`;
    const result = await cachedGet(cacheKey, CACHE_TTL.live, async () =>
      httpGetJson(urlObj.toString(), headers)
    );
    lastHttp = result.httpStatus;
    fromCache = fromCache || Boolean(result.fromCache);
    if (!standings.length) standings = extractStandings(result.json);

    const batch = extractMatchArray(result.json);
    if (!batch.length) break;

    let added = 0;
    for (const raw of batch) {
      const key = String(raw.url || raw.id || `${raw.home}|${raw.away}|${raw.time}`).toLowerCase();
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      collected.push(raw);
      added += 1;
    }

    // API ignores pagination (same payload) or end of list
    if (added === 0 || batch.length < pageSize) break;
  }

  const normalized = dedupeMatches(
    collected
      .map((m) => normalizeMatch(sport, m, 'sportscore'))
      .map(ensureMatchCategory)
      .filter(allFixtures ? validateMatchRecord : validateLiveMatch)
  );

  const catalog = extractCatalogFromMatches(normalized);

  return {
    matches: normalized,
    standings,
    source: 'sportscore',
    error: null,
    httpStatus: lastHttp,
    fromCache,
    catalog,
  };
};

/** CricLive: live + schedule (+ series/teams catalog) when API key present */
const fetchCricLiveAll = async (modeConfig) => {
  const live = await fetchCricLive('cricket', modeConfig);
  if (live.error || live.skipped) return live;

  let scheduleMatches = [];
  let seriesCatalog = [];
  let teamsCatalog = [];

  try {
    const sched = await fetchCricLiveResource(modeConfig, 'schedule');
    scheduleMatches = extractMatchArray(sched.json)
      .map((m) => normalizeMatch('cricket', m, 'criclive'))
      .map(ensureMatchCategory)
      .filter(validateMatchRecord);
  } catch {
    /* schedule optional */
  }

  try {
    const series = await fetchCricLiveResource(modeConfig, 'series');
    const list = extractMatchArray(series.json);
    seriesCatalog = list
      .map((s) => s.name || s.title || s.series_name || s.competition || '')
      .filter(Boolean);
  } catch {
    /* optional */
  }

  try {
    const teams = await fetchCricLiveResource(modeConfig, 'teams');
    const list = extractMatchArray(teams.json);
    teamsCatalog = list.map((t) => t.name || t.team_name || t.title || '').filter(Boolean);
  } catch {
    /* optional */
  }

  // Re-normalize live without live-only filter for full catalog merge
  const liveAll = (live.matches || [])
    .map(ensureMatchCategory)
    .filter(validateMatchRecord);

  // Also pull raw live list again without validateLiveMatch if fetchCricLive filtered
  // fetchCricLive already filtered live — schedule covers upcoming/finished
  const matches = dedupeMatches([...liveAll, ...scheduleMatches]);
  const fromMatches = extractCatalogFromMatches(matches);

  return {
    matches,
    standings: live.standings || [],
    source: 'criclive',
    error: null,
    httpStatus: live.httpStatus,
    fromCache: live.fromCache,
    catalog: {
      leagues: mergeUniqueLists(fromMatches.leagues, seriesCatalog),
      tournaments: mergeUniqueLists(fromMatches.tournaments, seriesCatalog),
      competitions: mergeUniqueLists(fromMatches.competitions, seriesCatalog),
      teams: mergeUniqueLists(fromMatches.teams, teamsCatalog),
    },
  };
};

/** Lichess TV — free, no API key */
const fetchLichessTv = async (modeConfig = {}) => {
  const base = (modeConfig.apiBaseUrl || 'https://lichess.org').trim().replace(/\/$/, '');
  const endpoint = (modeConfig.apiEndpoint || '/api/tv/channels').trim();
  const channelsUrl = joinUrl(base, endpoint);
  const headers = {
    Accept: 'application/json',
    'User-Agent': UA,
  };
  const cacheKey = `lichess:tv:${channelsUrl}`;

  const { json, httpStatus, fromCache } = await cachedGet(cacheKey, CACHE_TTL.live, async () =>
    httpGetJson(channelsUrl, headers)
  );

  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    return {
      matches: [],
      standings: [],
      source: 'lichess',
      error: 'Lichess TV did not return channel data',
      httpStatus,
      fromCache: Boolean(fromCache),
    };
  }

  const channelEntries = Object.entries(json).slice(0, 10);
  const matches = [];

  for (const [channel, info] of channelEntries) {
    const gameId = info?.gameId;
    if (!gameId) continue;

    try {
      const gameUrl = joinUrl(base, `/game/export/${gameId}?pgnInJson=true`);
      const gameCacheKey = `lichess:game:${gameId}`;
      const gameHit = await cachedGet(gameCacheKey, CACHE_TTL.live, async () =>
        httpGetJson(gameUrl, headers, { timeoutMs: 10000, retries: 1 })
      );
      const g = gameHit.json || {};
      const white = g.players?.white?.user?.name || g.players?.white?.userId || 'White';
      const black = g.players?.black?.user?.name || g.players?.black?.userId || 'Black';
      const isLive = g.status === 'started' || !g.status;
      matches.push(
        normalizeMatch(
          'chess',
          {
            id: g.id || gameId,
            home: white,
            away: black,
            home_score: 0,
            away_score: 0,
            status: isLive ? 'live' : g.status === 'mate' || g.status === 'resign' || g.status === 'draw' ? 'finished' : 'live',
            status_text: `${channel}${g.speed ? ` · ${g.speed}` : ''}`,
            competition: `Lichess TV · ${channel}`,
            time: g.createdAt ? new Date(g.createdAt).toISOString() : null,
            url: `https://lichess.org/${g.id || gameId}`,
            logo: '',
          },
          'lichess'
        )
      );
    } catch {
      // Still show channel featured game with one known player
      const featured = info?.user?.name || info?.user?.id || 'Player';
      const color = info?.color || 'white';
      matches.push(
        normalizeMatch(
          'chess',
          {
            id: gameId,
            home: color === 'white' ? featured : 'Opponent',
            away: color === 'black' ? featured : 'Opponent',
            status: 'live',
            status_text: channel,
            competition: `Lichess TV · ${channel}`,
            url: `https://lichess.org/${gameId}`,
          },
          'lichess'
        )
      );
    }
  }

  return {
    matches: matches.filter(validateLiveMatch),
    standings: [],
    source: 'lichess',
    error: null,
    httpStatus,
    fromCache: Boolean(fromCache),
  };
};

/** Chess — Lichess by default; custom Chess API if Admin sets another URL */
const fetchChess = async (sport, modeConfig) => {
  const provider = resolveProvider(modeConfig, sport);
  if (provider === 'lichess' || !buildApiUrl(modeConfig) || String(modeConfig.apiBaseUrl || '').includes('lichess')) {
    const effective = applyProviderDefaults('chess', modeConfig);
    return fetchLichessTv(effective);
  }

  const urlStr = buildApiUrl(modeConfig);
  if (!urlStr) {
    return fetchLichessTv(applyProviderDefaults('chess', modeConfig));
  }

  const url = new URL(urlStr);
  if (!url.searchParams.has('sport')) url.searchParams.set('sport', 'chess');
  if (modeConfig.tournaments?.length) {
    url.searchParams.set('tournaments', modeConfig.tournaments.join(','));
  }
  if (modeConfig.competitions?.length) {
    url.searchParams.set('competitions', modeConfig.competitions.join(','));
  }

  const headers = buildAuthHeaders('chess', modeConfig);
  const cacheKey = `chess:live:${url.toString()}`;

  const { json, httpStatus, fromCache } = await cachedGet(cacheKey, CACHE_TTL.live, async () =>
    httpGetJson(url.toString(), headers)
  );

  const matchList = extractMatchArray(json);
  const normalized = matchList
    .map((m) => normalizeMatch(sport, m, provider))
    .filter(validateLiveMatch);

  return {
    matches: normalized,
    standings: extractStandings(json),
    source: provider,
    error: null,
    httpStatus,
    fromCache: Boolean(fromCache),
  };
};

/** Generic / custom provider */
const fetchCustom = async (sport, modeConfig) => {
  const urlStr = buildApiUrl(modeConfig);
  if (!urlStr) {
    return {
      matches: [],
      standings: [],
      source: 'none',
      error: 'API URL not configured',
      httpStatus: 0,
    };
  }

  const url = new URL(urlStr);
  if (!url.searchParams.has('sport')) url.searchParams.set('sport', sport);
  if (!url.searchParams.has('status')) url.searchParams.set('status', 'live');
  if (modeConfig.leagues?.length) url.searchParams.set('leagues', modeConfig.leagues.join(','));
  if (modeConfig.teams?.length) url.searchParams.set('teams', modeConfig.teams.join(','));
  if (modeConfig.tournaments?.length) {
    url.searchParams.set('tournaments', modeConfig.tournaments.join(','));
  }
  if (modeConfig.competitions?.length) {
    url.searchParams.set('competitions', modeConfig.competitions.join(','));
  }

  const provider = resolveProvider(modeConfig, sport);
  const headers = buildAuthHeaders(provider, modeConfig);
  const cacheKey = `custom:live:${url.toString()}`;

  const { json, httpStatus, fromCache } = await cachedGet(cacheKey, CACHE_TTL.live, async () =>
    httpGetJson(url.toString(), headers)
  );

  const matchList = extractMatchArray(json);
  const normalized = matchList
    .map((m) => normalizeMatch(sport, m, provider))
    .filter(validateLiveMatch);

  return {
    matches: normalized,
    standings: extractStandings(json),
    source: provider || modeConfig.apiProvider || 'api',
    error: null,
    httpStatus,
    fromCache: Boolean(fromCache),
  };
};

export const fetchFromExternalApi = async (sport, modeConfig, { bypassCache = false } = {}) => {
  const provider = resolveProvider(modeConfig, sport);

  if (bypassCache) {
    // Bust live cache keys for this sport/provider on Fetch Now
    for (const key of responseCache.keys()) {
      if (key.includes(`:${sport}`) || key.startsWith(`${provider}:live:`)) {
        responseCache.delete(key);
      }
    }
  }

  if (sport === 'cricket' && provider === 'criclive') {
    const cric = await fetchCricLiveAll(modeConfig);
    if (!cric.skipped && !cric.error && cric.matches?.length) return cric;
    // Fall back to SportScore so Fetch Now still fills fixtures without a working CricLive key
    const fallback = await fetchSportScore(
      'cricket',
      {
        ...modeConfig,
        apiBaseUrl: 'https://sportscore.com',
        apiEndpoint: '/api/widget/matches/',
        apiProvider: 'SportScore',
      },
      { allFixtures: true, bypassCache }
    );
    if (cric.skipped || cric.error) {
      fallback.fallbackFrom = 'criclive';
      fallback.fallbackNote = cric.message || cric.error || 'CricLive returned no fixtures';
    }
    return fallback;
  }
  if (provider === 'criclive') return fetchCricLive(sport, modeConfig);
  if (provider === 'sportscore') {
    return fetchSportScore(sport, modeConfig, {
      allFixtures: sport === 'cricket',
      bypassCache,
    });
  }
  if (provider === 'lichess' || provider === 'chess' || sport === 'chess') {
    return fetchChess(sport, modeConfig);
  }
  return fetchCustom(sport, modeConfig);
};

export const getEffectiveIntervalSeconds = (modeConfig = {}, sport = '') => {
  const floor = sport === 'cricket' ? 60 : 30;
  if (modeConfig.fetchIntervalSeconds && modeConfig.fetchIntervalSeconds >= 10) {
    return Math.min(300, Math.max(floor, Number(modeConfig.fetchIntervalSeconds)));
  }
  const mins = Number(modeConfig.refreshIntervalMinutes) || 1;
  return Math.max(floor, Math.min(300, mins * 60));
};

export const fetchSportsForMode = async (sport, modeConfig, options = {}) => {
  if (!modeConfig?.enabled) {
    return {
      matches: [],
      standings: [],
      source: 'disabled',
      error: null,
      skipped: true,
      reason: 'disabled',
      httpStatus: 0,
    };
  }

  const effectiveConfig = applyProviderDefaults(sport, modeConfig);
  const provider = effectiveConfig._resolvedProvider || resolveProvider(effectiveConfig, sport);

  const gap = getConfigurationGap(sport, effectiveConfig);
  if (gap === 'missing_api_key') {
    return {
      matches: [],
      standings: [],
      source: provider,
      error: null,
      skipped: true,
      reason: gap,
      message: 'Add your CricLive API key in Admin → Cricket (Authorization: Bearer)',
      httpStatus: 0,
    };
  }
  if (gap === 'missing_api_url') {
    return {
      matches: [],
      standings: [],
      source: provider === 'chess' ? 'chess' : 'none',
      error: null,
      skipped: true,
      reason: gap,
      message:
        sport === 'chess'
          ? 'Configure Chess API base URL and endpoint in Admin'
          : 'Configure API base URL to fetch live matches',
      httpStatus: 0,
    };
  }

  try {
    // When provider resolves to SportScore/Lichess, always use their endpoints
    // (avoids calling CricLive URL without a key after fallback)
    if (provider === 'sportscore') {
      effectiveConfig.apiBaseUrl = 'https://sportscore.com';
      effectiveConfig.apiEndpoint = '/api/widget/matches/';
      effectiveConfig.apiProvider = 'SportScore';
    }
    if (provider === 'lichess') {
      effectiveConfig.apiBaseUrl = 'https://lichess.org';
      effectiveConfig.apiEndpoint = '/api/tv/channels';
      effectiveConfig.apiProvider = 'lichess';
    }

    return await fetchFromExternalApi(sport, effectiveConfig, options);
  } catch (err) {
    return {
      matches: [],
      standings: [],
      source: provider || 'api',
      error: err.message,
      httpStatus: err.statusCode || 0,
    };
  }
};

export default {
  fetchSportsForMode,
  fetchFromExternalApi,
  fetchCricLiveResource,
  buildMatchFingerprint,
  buildStandingFingerprint,
  normalizeMatch,
  validateLiveMatch,
  validateMatchRecord,
  ensureMatchCategory,
  dedupeMatches,
  extractCatalogFromMatches,
  isLiveStatus,
  mapStatus,
  getEffectiveIntervalSeconds,
  getProviderPreset,
  resolveProvider,
  applyProviderDefaults,
  getConfigurationGap,
  buildApiUrl,
};
