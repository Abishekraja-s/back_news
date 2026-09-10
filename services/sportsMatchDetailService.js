/**
 * Enrich a stored SportsMatch with provider detail APIs (SportScore / CricLive / Lichess).
 * Never invents stats — missing fields stay null/empty and are hidden by the UI.
 */

import {
  applyProviderDefaults,
  fetchCricLiveResource,
  isLiveStatus,
  mapStatus,
  resolveProvider,
} from './sportsFetchService.js';

const UA = 'GreatIndiaNews-SportsBot/1.0';
const DETAIL_CACHE = new Map();
const PAYLOAD_CACHE = new Map();
const DETAIL_TTL_LIVE = 25 * 1000;
const DETAIL_TTL_STATIC = 3 * 60 * 1000;
const PAYLOAD_TTL_LIVE = 12 * 1000;
const PAYLOAD_TTL_STATIC = 60 * 1000;
const EXTERNAL_TIMEOUT_MS = 7000;

const getCache = (key) => {
  const hit = DETAIL_CACHE.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    DETAIL_CACHE.delete(key);
    return null;
  }
  return hit.value;
};

const setCache = (key, value, ttlMs) => {
  DETAIL_CACHE.set(key, { value, expiresAt: Date.now() + ttlMs });
};

const httpGetJson = async (url, headers = {}, timeoutMs = EXTERNAL_TIMEOUT_MS) => {
  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json', 'User-Agent': UA, ...headers },
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    const err = new Error(`Detail API HTTP ${res.status}`);
    err.statusCode = res.status;
    throw err;
  }
  return res.json();
};

export const extractMatchSlug = (sourceUrl = '', externalId = '') => {
  const fromUrl = String(sourceUrl || '')
    .replace(/\/$/, '')
    .split('/')
    .filter(Boolean)
    .pop();
  if (fromUrl && !/^[a-f0-9]{24}$/i.test(fromUrl)) return fromUrl;
  const ext = String(externalId || '').trim();
  if (ext && !/^\d+$/.test(ext) && ext.length > 4) return ext;
  return '';
};

const toCompetitionSlug = (name = '') =>
  String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const playerKey = (name = '', team = '') =>
  `${String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${String(team)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')}`
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);

const hasValue = (v) => {
  if (v == null) return false;
  if (typeof v === 'string') return v.trim() !== '';
  if (typeof v === 'number') return !Number.isNaN(v);
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return Boolean(v);
};

const omitEmpty = (obj) => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (!hasValue(v) && v !== 0 && v !== false) continue;
    out[k] = v;
  }
  return out;
};

/** Parse cricket score strings like "245/6 (48.2 ov)" — ignore bare placeholders like "0" */
export const parseCricketScoreText = (text = '') => {
  const s = String(text || '').trim();
  if (!s || s === '0' || s === '-' || s === '—') return null;
  const m = s.match(/(\d+)\s*\/\s*(\d+)(?:\s*\(([^)]+)\))?/);
  if (!m) {
    // Only accept plain totals when they look like real cricket scores (e.g. "245")
    const runsOnly = s.match(/^(\d+)$/);
    if (runsOnly && Number(runsOnly[1]) > 0) return { runs: Number(runsOnly[1]), display: s };
    if (/[a-z]/i.test(s)) return { display: s };
    return null;
  }
  const oversPart = String(m[3] || '').replace(/\s*ov(ers?)?/i, '').trim();
  return omitEmpty({
    runs: Number(m[1]),
    wickets: Number(m[2]),
    overs: oversPart || undefined,
    display: s,
  });
};

const mapSportScoreIncidents = (incidents = [], homeTeam = '', awayTeam = '') => {
  if (!Array.isArray(incidents) || !incidents.length) return [];
  return incidents.map((inc, i) =>
    omitEmpty({
      id: String(inc.id || `inc-${i}`),
      minute: inc.time ?? inc.minute ?? inc.period ?? null,
      type: inc.type || inc.event || '',
      typeId: inc.type_id,
      side: inc.side,
      team: inc.side === 'home' ? homeTeam : inc.side === 'away' ? awayTeam : inc.team || '',
      player: inc.player || inc.player_name || '',
      assist: inc.assist || inc.assist_player || '',
      isGoal: Boolean(inc.is_goal || /goal/i.test(inc.type || '')),
      homeScore: inc.home_score,
      awayScore: inc.away_score,
      detail: inc.detail || inc.subtype || '',
    })
  );
};

const mapSportScoreStats = (stats) => {
  if (!stats) return [];
  if (Array.isArray(stats)) {
    return stats
      .map((row) => {
        if (!row || typeof row !== 'object') return null;
        return omitEmpty({
          label: row.type || row.name || row.label || row.stat || '',
          home: row.home ?? row.home_value ?? row.h,
          away: row.away ?? row.away_value ?? row.a,
        });
      })
      .filter((r) => r && r.label && (hasValue(r.home) || hasValue(r.away)));
  }
  if (typeof stats === 'object') {
    return Object.entries(stats)
      .map(([label, val]) => {
        if (val && typeof val === 'object' && !Array.isArray(val)) {
          return omitEmpty({
            label,
            home: val.home ?? val.h,
            away: val.away ?? val.a,
          });
        }
        return null;
      })
      .filter((r) => r && (hasValue(r.home) || hasValue(r.away)));
  }
  return [];
};

const mapLineupsToPlayers = (lineups, homeTeam, awayTeam) => {
  const home = [];
  const away = [];
  if (!lineups || typeof lineups !== 'object') return { home, away };

  const pushSide = (list, side, teamName) => {
    const arr = Array.isArray(list) ? list : list?.players || list?.starting || [];
    if (!Array.isArray(arr)) return;
    for (const p of arr) {
      if (!p) continue;
      const name = p.name || p.player_name || p.player || '';
      if (!name) continue;
      side.push(
        omitEmpty({
          key: playerKey(name, teamName),
          name,
          team: teamName,
          position: p.position || p.role || p.pos || '',
          number: p.number ?? p.jersey ?? p.shirt_number,
          photo: p.photo || p.image || p.avatar || '',
          status: p.status || (p.substitute ? 'Substitute' : p.starter === false ? 'Substitute' : 'Playing'),
          stats: omitEmpty(p.stats || p.statistics || {}),
          points: p.points ?? p.pts,
          performance: p.performance || p.rating,
        })
      );
    }
  };

  pushSide(lineups.home || lineups.home_team || lineups.local, home, homeTeam);
  pushSide(lineups.away || lineups.away_team || lineups.visitor, away, awayTeam);
  return { home, away };
};

/** Flexible CricLive scorecard mapper */
export const mapCricLiveScorecard = (json) => {
  const root = json?.data || json?.scorecard || json || {};
  const inningsRaw =
    root.innings ||
    root.Innings ||
    root.scorecard?.innings ||
    (Array.isArray(root) ? root : null);
  if (!Array.isArray(inningsRaw) || !inningsRaw.length) return null;

  const innings = inningsRaw.map((inn, idx) => {
    const battingSrc =
      inn.batting || inn.batsmen || inn.batsman || inn.Batters || inn.batter || [];
    const bowlingSrc = inn.bowling || inn.bowlers || inn.Bowlers || [];
    const batting = (Array.isArray(battingSrc) ? battingSrc : []).map((b) =>
      omitEmpty({
        key: playerKey(b.name || b.batsman || b.player, inn.team || inn.name || ''),
        player: b.name || b.batsman || b.player || '',
        runs: b.runs ?? b.r ?? b.R,
        balls: b.balls ?? b.b ?? b.B,
        fours: b.fours ?? b['4s'] ?? b.fours_hit,
        sixes: b.sixes ?? b['6s'] ?? b.sixes_hit,
        strikeRate: b.strike_rate ?? b.sr ?? b.SR,
        status: b.dismissal || b.how_out || b.status || b.out_description || (b.is_out === false ? 'not out' : ''),
        team: inn.team || inn.name || '',
        role: 'batsman',
      })
    );
    const bowling = (Array.isArray(bowlingSrc) ? bowlingSrc : []).map((b) =>
      omitEmpty({
        key: playerKey(b.name || b.bowler || b.player, inn.team || ''),
        bowler: b.name || b.bowler || b.player || '',
        overs: b.overs ?? b.o ?? b.O,
        maidens: b.maidens ?? b.m ?? b.M,
        runs: b.runs ?? b.r ?? b.R,
        wickets: b.wickets ?? b.w ?? b.W,
        economy: b.economy ?? b.eco ?? b.ECO,
        dots: b.dots ?? b.dot_balls,
        boundaries: b.boundaries ?? b.fours_conceded,
        team: '',
        role: 'bowler',
      })
    );
    return omitEmpty({
      number: inn.number ?? inn.inning ?? idx + 1,
      team: inn.team || inn.name || inn.batting_team || '',
      runs: inn.runs ?? inn.total ?? inn.score,
      wickets: inn.wickets ?? inn.wicket,
      overs: inn.overs ?? inn.over,
      runRate: inn.run_rate ?? inn.rr ?? inn.crr,
      target: inn.target,
      requiredRunRate: inn.required_run_rate ?? inn.rrr,
      partnership: inn.partnership || inn.current_partnership,
      batting,
      bowling,
      extras: inn.extras,
      yetToBat: inn.yet_to_bat || inn.did_not_bat,
    });
  });

  return { innings };
};

/** Map commentary / ball-by-ball into overs groups */
export const mapBallByBall = (json) => {
  const root = json?.data || json?.commentary || json || {};
  const balls =
    root.balls ||
    root.deliveries ||
    root.commentary ||
    root.ball_by_ball ||
    root.items ||
    (Array.isArray(root) ? root : null);
  if (!Array.isArray(balls) || !balls.length) return null;

  const oversMap = new Map();
  balls.forEach((b, i) => {
    const overNum =
      b.over ??
      b.over_number ??
      (typeof b.ball === 'string' && b.ball.includes('.')
        ? Number(String(b.ball).split('.')[0])
        : b.overs);
    const ballNum =
      b.ball_number ??
      b.ball_no ??
      (typeof b.ball === 'string' && b.ball.includes('.')
        ? Number(String(b.ball).split('.')[1])
        : b.ball);
    const key = Number.isFinite(Number(overNum)) ? Number(overNum) : Math.floor(i / 6);
    if (!oversMap.has(key)) oversMap.set(key, []);
    const runs = b.runs ?? b.total_runs ?? b.run;
    const isFour = Boolean(b.is_four || b.boundary === 4 || runs === 4);
    const isSix = Boolean(b.is_six || b.boundary === 6 || runs === 6);
    const isWicket = Boolean(b.is_wicket || b.wicket || /wicket|out/i.test(b.event || b.type || ''));
    const extrasType = b.extras_type || b.extra_type || (b.wide ? 'wide' : b.noball || b.no_ball ? 'no_ball' : b.bye ? 'bye' : b.legbye || b.leg_bye ? 'leg_bye' : '');
    oversMap.get(key).push(
      omitEmpty({
        id: String(b.id || `${key}.${ballNum || i}`),
        over: key,
        ball: ballNum,
        label:
          Number.isFinite(Number(ballNum)) && Number.isFinite(Number(key))
            ? `${key}.${ballNum}`
            : b.ball || b.label,
        bowler: b.bowler || b.bowler_name || '',
        batter: b.batter || b.batsman || b.batsman_name || b.striker || '',
        runs,
        batterRuns: b.batsman_runs ?? b.batter_runs,
        extras: b.extras ?? b.extra_runs,
        extrasType,
        wicket: isWicket
          ? omitEmpty({
              player: b.player_out || b.dismissed || b.wicket?.player,
              type: b.dismissal_type || b.wicket_type || b.wicket?.type || 'Wicket',
            })
          : undefined,
        boundary: isSix ? 6 : isFour ? 4 : undefined,
        totalAfter: b.score_after || b.total_after || b.running_total || b.score,
        text: b.commentary || b.text || b.description || '',
      })
    );
  });

  const overs = [...oversMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([over, deliveries]) => ({
      over,
      deliveries,
      runsInOver: deliveries.reduce((sum, d) => sum + (Number(d.runs) || 0), 0),
    }));

  return overs.length ? { overs } : null;
};

const mapStandingsRows = (json) => {
  const tables = json?.tables || json?.standings || json?.data?.tables || [];
  const tableList = Array.isArray(tables) ? tables : [];
  const rows = [];
  for (const table of tableList) {
    const src = table.rows || table.standings || table.teams || [];
    if (!Array.isArray(src)) continue;
    for (const r of src) {
      rows.push(
        omitEmpty({
          rank: r.pos ?? r.rank ?? r.position,
          team: r.team || r.team_name || r.name || r.player || '',
          teamLogo: r.team_logo || r.logo,
          played: r.played ?? r.p ?? r.mp,
          won: r.won ?? r.w,
          drawn: r.drawn ?? r.d ?? r.draw,
          lost: r.lost ?? r.l,
          points: r.points ?? r.pts,
          goalsFor: r.goals_for ?? r.gf,
          goalsAgainst: r.goals_against ?? r.ga,
          netRunRate: r.nrr ?? r.net_run_rate,
          form: r.form,
          group: table.group || table.name || '',
        })
      );
    }
  }
  return rows.length ? rows : null;
};

const parsePgnMoves = (pgn = '') => {
  const movesPart = String(pgn || '')
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\$\d+/g, ' ')
    .replace(/\d+\.(\.\.)?/g, ' ')
    .trim();
  return movesPart
    .split(/\s+/)
    .filter((t) => t && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(t));
};

const fetchSportScoreDetail = async (sport, slug) => {
  const cacheKey = `ss:detail:${sport}:${slug}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;
  const url = `https://sportscore.com/api/widget/match/?sport=${encodeURIComponent(sport)}&slug=${encodeURIComponent(slug)}`;
  const json = await httpGetJson(url);
  setCache(cacheKey, json, DETAIL_TTL_LIVE);
  return json;
};

const fetchSportScoreStandings = async (sport, competitionName) => {
  const slug = toCompetitionSlug(competitionName);
  if (!slug) return null;
  const cacheKey = `ss:standings:${sport}:${slug}`;
  const cached = getCache(cacheKey);
  if (cached !== null && cached !== undefined) return cached;
  try {
    const url = `https://sportscore.com/api/widget/standings/?sport=${encodeURIComponent(sport)}&slug=${encodeURIComponent(slug)}`;
    const json = await httpGetJson(url);
    setCache(cacheKey, json, DETAIL_TTL_STATIC);
    return json;
  } catch {
    setCache(cacheKey, null, DETAIL_TTL_STATIC);
    return null;
  }
};

const fetchLichessGame = async (gameId) => {
  if (!gameId) return null;
  const cacheKey = `lichess:detail:${gameId}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;
  const url = `https://lichess.org/game/export/${encodeURIComponent(gameId)}?pgnInJson=true&clocks=true&accuracy=true`;
  const json = await httpGetJson(url, { Accept: 'application/json' }, 12000);
  setCache(cacheKey, json, DETAIL_TTL_LIVE);
  return json;
};

const buildAvailability = (detail) => ({
  overview: true,
  scoreStats: Boolean(
    (detail.pairStats && detail.pairStats.length) ||
      detail.scorecard ||
      detail.football ||
      detail.basketball ||
      detail.tennis ||
      detail.chess
  ),
  players: Boolean(
    (detail.players?.home?.length || 0) + (detail.players?.away?.length || 0)
  ),
  standings: Boolean(detail.standings?.length),
  timeline: Boolean(detail.timeline?.length || detail.ballByBall),
  ballByBall: Boolean(detail.ballByBall?.overs?.length),
  scorecard: Boolean(detail.scorecard?.innings?.length),
});

const sportSpecificFromDetail = (sport, matchDoc, apiMatch, pairStats, incidents) => {
  const home = matchDoc.homeTeam;
  const away = matchDoc.awayTeam;

  if (sport === 'football') {
    const goals = incidents.filter((i) => i.isGoal || /goal|penalty/i.test(i.type || ''));
    const cards = incidents.filter((i) => /card|yellow|red/i.test(i.type || ''));
    const subs = incidents.filter((i) => /sub/i.test(i.type || ''));
    const findStat = (...labels) =>
      pairStats.find((s) => labels.some((l) => String(s.label).toLowerCase().includes(l)));
    return omitEmpty({
      homeHtScore: apiMatch?.home_ht_score,
      awayHtScore: apiMatch?.away_ht_score,
      possession: findStat('possession'),
      shots: findStat('shot'),
      shotsOnTarget: findStat('on target', 'shots on'),
      corners: findStat('corner'),
      fouls: findStat('foul'),
      goals: goals.length ? goals : undefined,
      cards: cards.length ? cards : undefined,
      substitutions: subs.length ? subs : undefined,
      pairStats: pairStats.length ? pairStats : undefined,
    });
  }

  if (sport === 'basketball') {
    const quarters = [];
    for (const q of [1, 2, 3, 4, 'ot', 'OT']) {
      const h = apiMatch?.[`home_q${q}`] ?? apiMatch?.[`home_period_${q}`];
      const a = apiMatch?.[`away_q${q}`] ?? apiMatch?.[`away_period_${q}`];
      if (h != null || a != null) {
        quarters.push({ label: typeof q === 'number' ? `Q${q}` : 'OT', home: h, away: a });
      }
    }
    const periodScores = apiMatch?.period_scores || apiMatch?.scores_by_period;
    if (Array.isArray(periodScores)) {
      periodScores.forEach((p, i) => {
        quarters.push({
          label: p.name || `Q${i + 1}`,
          home: p.home ?? p.h,
          away: p.away ?? p.a,
        });
      });
    }
    return omitEmpty({
      quarters: quarters.length ? quarters : undefined,
      total: { home: matchDoc.homeScoreText || matchDoc.homeScore, away: matchDoc.awayScoreText || matchDoc.awayScore },
      pairStats: pairStats.length ? pairStats : undefined,
      playByPlay: incidents.length
        ? incidents.map((i) =>
            omitEmpty({
              time: i.minute,
              player: i.player,
              event: i.type,
              points: i.detail,
              team: i.team,
            })
          )
        : undefined,
    });
  }

  if (sport === 'tennis') {
    return omitEmpty({
      sets: matchDoc.homeScoreText || matchDoc.awayScoreText
        ? { home: matchDoc.homeScoreText, away: matchDoc.awayScoreText }
        : undefined,
      statusText: matchDoc.statusDetail || apiMatch?.status_text,
      serve: apiMatch?.serve || apiMatch?.serving,
      pairStats: pairStats.length ? pairStats : undefined,
      pointTimeline: incidents.length ? incidents : undefined,
    });
  }

  if (sport === 'cricket') {
    const homeParsed = parseCricketScoreText(matchDoc.homeScoreText || apiMatch?.home_score);
    const awayParsed = parseCricketScoreText(matchDoc.awayScoreText || apiMatch?.away_score);
    return omitEmpty({
      homeInnings: homeParsed,
      awayInnings: awayParsed,
      pairStats: pairStats.length ? pairStats : undefined,
    });
  }

  return omitEmpty({ pairStats: pairStats.length ? pairStats : undefined, home, away });
};

/**
 * Build enriched public match detail payload.
 * @param {object} matchDoc lean SportsMatch
 * @param {object} modeConfig sport config from SportsConfig
 */
export const buildMatchDetailPayload = async (matchDoc, modeConfig = {}) => {
  const sport = matchDoc.sport;
  const payloadKey = `payload:${String(matchDoc._id)}:${matchDoc.lastSyncedAt || ''}:${matchDoc.status}:${matchDoc.homeScoreText || ''}:${matchDoc.awayScoreText || ''}`;
  const hit = PAYLOAD_CACHE.get(payloadKey);
  if (hit && Date.now() < hit.expiresAt) {
    return hit.value;
  }

  const effective = applyProviderDefaults(sport, modeConfig);
  const provider = resolveProvider(effective, sport);
  const slug = extractMatchSlug(matchDoc.sourceUrl, matchDoc.externalId);

  let apiMatch = null;
  let apiError = null;
  let scorecard = null;
  let ballByBall = null;
  let chess = null;
  let standingsRows = null;
  let players = { home: [], away: [] };
  let pairStats = [];
  let incidents = [];
  let summary = '';

  // SportScore detail + standings in parallel (short timeout)
  if (['cricket', 'football', 'basketball', 'tennis'].includes(sport) && slug) {
    const competitionHint = matchDoc.competition || matchDoc.league || '';
    const [detailResult, standingsResult] = await Promise.allSettled([
      fetchSportScoreDetail(sport, slug),
      fetchSportScoreStandings(sport, competitionHint),
    ]);
    if (detailResult.status === 'fulfilled') {
      const json = detailResult.value;
      apiMatch = json?.match || json;
      if (apiMatch) {
        incidents = mapSportScoreIncidents(apiMatch.incidents, matchDoc.homeTeam, matchDoc.awayTeam);
        pairStats = mapSportScoreStats(apiMatch.stats);
        players = mapLineupsToPlayers(apiMatch.lineups, matchDoc.homeTeam, matchDoc.awayTeam);
        summary = String(apiMatch.status_text || apiMatch.note || matchDoc.statusDetail || '').trim();
      }
    } else {
      apiError = detailResult.reason?.message || 'Detail enrich timeout';
    }
    if (standingsResult.status === 'fulfilled') {
      standingsRows = mapStandingsRows(standingsResult.value);
    }
  }

  // CricLive scorecard / commentary only for matches stored from CricLive
  if (
    sport === 'cricket' &&
    matchDoc.provider === 'criclive' &&
    String(effective.apiKey || '').trim()
  ) {
    const matchId = matchDoc.externalId;
    try {
      const sc = await fetchCricLiveResource(effective, 'scorecard', { id: matchId });
      scorecard = mapCricLiveScorecard(sc.json);
      if (scorecard?.innings) {
        const allBat = [];
        const allBowl = [];
        for (const inn of scorecard.innings) {
          for (const b of inn.batting || []) {
            allBat.push({
              ...b,
              team: inn.team || b.team,
              photo: '',
              position: 'Batsman',
              status: b.status || '',
              stats: omitEmpty({
                runs: b.runs,
                balls: b.balls,
                fours: b.fours,
                sixes: b.sixes,
                strikeRate: b.strikeRate,
              }),
              points: b.runs,
            });
          }
          for (const b of inn.bowling || []) {
            allBowl.push({
              ...b,
              name: b.bowler,
              photo: '',
              position: 'Bowler',
              status: 'Playing',
              stats: omitEmpty({
                overs: b.overs,
                maidens: b.maidens,
                runs: b.runs,
                wickets: b.wickets,
                economy: b.economy,
                dots: b.dots,
              }),
              points: b.wickets,
            });
          }
        }
        const homeName = matchDoc.homeTeam.toLowerCase();
        players = {
          home: allBat.filter((p) => String(p.team || '').toLowerCase().includes(homeName.slice(0, 6)))
            .concat(allBowl.filter((p) => !String(p.team || '').toLowerCase().includes(homeName.slice(0, 6)))),
          away: allBat.filter((p) => !String(p.team || '').toLowerCase().includes(homeName.slice(0, 6)))
            .concat(allBowl.filter((p) => String(p.team || '').toLowerCase().includes(homeName.slice(0, 6)))),
        };
        // If team matching failed, put batting of innings 1 as home-ish
        if (!players.home.length && !players.away.length) {
          const inn1 = scorecard.innings[0];
          const inn2 = scorecard.innings[1];
          players = {
            home: [...(inn1?.batting || []), ...(inn2?.bowling || [])],
            away: [...(inn2?.batting || []), ...(inn1?.bowling || [])],
          };
        }
      }
    } catch (err) {
      if (!apiError) apiError = err.message;
    }
    try {
      const com = await fetchCricLiveResource(effective, 'commentary', { id: matchId });
      ballByBall = mapBallByBall(com.json);
    } catch {
      /* optional */
    }
  }

  // Chess / Lichess
  if (sport === 'chess') {
    const gameId = String(matchDoc.externalId || '').replace(/^lichess[-_]?/i, '') || extractMatchSlug(matchDoc.sourceUrl);
    try {
      const g = await fetchLichessGame(gameId);
      if (g) {
        const moves = Array.isArray(g.moves)
          ? g.moves
          : typeof g.moves === 'string'
            ? g.moves.split(/\s+/).filter(Boolean)
            : parsePgnMoves(g.pgn);
        const white = g.players?.white || {};
        const black = g.players?.black || {};
        chess = omitEmpty({
          white: omitEmpty({
            name: white.user?.name || white.userId || matchDoc.homeTeam,
            rating: white.rating,
            result: white.result || (g.winner === 'white' ? '1' : g.status === 'draw' ? '½' : undefined),
          }),
          black: omitEmpty({
            name: black.user?.name || black.userId || matchDoc.awayTeam,
            rating: black.rating,
            result: black.result || (g.winner === 'black' ? '1' : g.status === 'draw' ? '½' : undefined),
          }),
          opening: g.opening?.name || g.opening?.eco,
          status: g.status,
          winner: g.winner,
          moveNumber: moves.length ? Math.ceil(moves.length / 2) : undefined,
          moves,
          pgn: g.pgn,
          clocks: g.clocks,
          speed: g.speed,
          variant: g.variant,
          lastFen: g.lastFen || g.fen,
          sourceUrl: `https://lichess.org/${g.id || gameId}`,
        });
        players = {
          home: [
            omitEmpty({
              key: playerKey(chess.white?.name || matchDoc.homeTeam, 'white'),
              name: chess.white?.name || matchDoc.homeTeam,
              team: 'White',
              position: 'White',
              stats: omitEmpty({ rating: chess.white?.rating }),
              status: 'Playing',
            }),
          ],
          away: [
            omitEmpty({
              key: playerKey(chess.black?.name || matchDoc.awayTeam, 'black'),
              name: chess.black?.name || matchDoc.awayTeam,
              team: 'Black',
              position: 'Black',
              stats: omitEmpty({ rating: chess.black?.rating }),
              status: 'Playing',
            }),
          ],
        };
        summary = [g.status, g.opening?.name, g.speed].filter(Boolean).join(' · ');
      }
    } catch (err) {
      apiError = err.message;
    }
  }

  // DB-stored players fallback
  if (!players.home.length && !players.away.length && Array.isArray(matchDoc.players) && matchDoc.players.length) {
    for (const p of matchDoc.players) {
      const row = omitEmpty({
        key: playerKey(p.name, p.team),
        name: p.name,
        team: p.team,
        position: p.role,
        stats: p.stats || {},
        status: 'Playing',
      });
      if (String(p.team || '').toLowerCase() === String(matchDoc.homeTeam).toLowerCase()) {
        players.home.push(row);
      } else {
        players.away.push(row);
      }
    }
  }

  // DB standings fallback handled in controller

  const homeLogo = apiMatch?.home_logo || matchDoc.stats?.homeLogo || matchDoc.rawPayload?.home_logo || '';
  const awayLogo = apiMatch?.away_logo || matchDoc.stats?.awayLogo || matchDoc.rawPayload?.away_logo || '';
  const competitionLogo =
    apiMatch?.competition_logo || matchDoc.stats?.logo || matchDoc.rawPayload?.competition_logo || '';

  const mergedStatus = apiMatch
    ? mapStatus(apiMatch.status, apiMatch.status_text || apiMatch.live_minute)
    : matchDoc.status;
  const statusDetail =
    apiMatch?.status_text ||
    (apiMatch?.live_minute != null ? `${apiMatch.live_minute}'` : '') ||
    matchDoc.statusDetail ||
    matchDoc.liveClock ||
    '';

  const homeScoreText =
    apiMatch?.home_score != null && apiMatch.home_score !== ''
      ? String(apiMatch.home_score)
      : matchDoc.homeScoreText || String(matchDoc.homeScore ?? '');
  const awayScoreText =
    apiMatch?.away_score != null && apiMatch.away_score !== ''
      ? String(apiMatch.away_score)
      : matchDoc.awayScoreText || String(matchDoc.awayScore ?? '');

  const sportBlock = sportSpecificFromDetail(sport, {
    ...matchDoc,
    homeScoreText,
    awayScoreText,
    statusDetail,
  }, apiMatch, pairStats, incidents);

  if (sport === 'cricket' && scorecard) sportBlock.scorecard = scorecard;
  if (sport === 'cricket' && ballByBall) sportBlock.ballByBall = ballByBall;
  if (sport === 'chess' && chess) {
    /* attached below */
  }

  const timeline = incidents.length
    ? incidents
    : ballByBall?.overs
      ? ballByBall.overs.flatMap((o) =>
          o.deliveries.map((d) =>
            omitEmpty({
              minute: d.label,
              type: d.wicket ? 'Wicket' : d.boundary === 6 ? 'SIX' : d.boundary === 4 ? 'FOUR' : 'Ball',
              player: d.batter,
              team: '',
              detail: [d.bowler && `Bowler: ${d.bowler}`, d.runs != null && `${d.runs} run(s)`, d.text]
                .filter(Boolean)
                .join(' · '),
            })
          )
        )
      : [];

  const detail = {
    sport,
    provider: matchDoc.provider || provider,
    summary: summary || matchDoc.statusDetail || '',
    venue: matchDoc.venue || apiMatch?.venue || '',
    homeLogo,
    awayLogo,
    competitionLogo,
    pairStats,
    timeline,
    incidents,
    players,
    standings: standingsRows,
    scorecard,
    ballByBall,
    chess,
    football: sport === 'football' ? sportBlock : null,
    basketball: sport === 'basketball' ? sportBlock : null,
    tennis: sport === 'tennis' ? sportBlock : null,
    cricket: sport === 'cricket' ? { ...sportBlock, scorecard, ballByBall } : null,
    tracker: apiMatch?.tracker || null,
    availability: null,
    apiError: apiError || null,
    enrichedAt: new Date().toISOString(),
  };
  detail.availability = buildAvailability(detail);

  const match = {
    _id: matchDoc._id,
    fingerprint: matchDoc.fingerprint,
    externalId: matchDoc.externalId,
    provider: matchDoc.provider,
    sport: matchDoc.sport,
    league: matchDoc.league || apiMatch?.competition || '',
    tournament: matchDoc.tournament || '',
    competition: matchDoc.competition || apiMatch?.competition || matchDoc.league || '',
    homeTeam: matchDoc.homeTeam || apiMatch?.home || '',
    awayTeam: matchDoc.awayTeam || apiMatch?.away || '',
    homeScore: matchDoc.homeScore,
    awayScore: matchDoc.awayScore,
    homeScoreText,
    awayScoreText,
    status: mergedStatus,
    statusDetail,
    liveClock: apiMatch?.live_minute != null ? String(apiMatch.live_minute) : matchDoc.liveClock || '',
    startTime: matchDoc.startTime || apiMatch?.time || null,
    venue: detail.venue,
    sourceUrl: matchDoc.sourceUrl || apiMatch?.url || '',
    homeLogo,
    awayLogo,
    competitionLogo,
    lastSyncedAt: matchDoc.lastSyncedAt,
    isLive: isLiveStatus(mergedStatus),
  };

  const payload = {
    match,
    detail,
    refreshIntervalSeconds: isLiveStatus(mergedStatus) ? 15 : 60,
  };
  PAYLOAD_CACHE.set(payloadKey, {
    value: payload,
    expiresAt: Date.now() + (isLiveStatus(mergedStatus) ? PAYLOAD_TTL_LIVE : PAYLOAD_TTL_STATIC),
  });
  // Bound memory
  if (PAYLOAD_CACHE.size > 200) {
    const firstKey = PAYLOAD_CACHE.keys().next().value;
    if (firstKey) PAYLOAD_CACHE.delete(firstKey);
  }
  return payload;
};

export const findPlayerInDetail = (detail, playerKeyParam) => {
  const key = String(playerKeyParam || '').toLowerCase();
  const all = [...(detail?.players?.home || []), ...(detail?.players?.away || [])];
  let found = all.find((p) => String(p.key || '').toLowerCase() === key);
  if (found) return found;

  // Cricket scorecard deep search
  for (const inn of detail?.scorecard?.innings || detail?.cricket?.scorecard?.innings || []) {
    for (const b of inn.batting || []) {
      if (String(b.key || '').toLowerCase() === key || playerKey(b.player, inn.team) === key) {
        return {
          ...b,
          name: b.player,
          position: 'Batsman',
          role: 'batsman',
          team: inn.team,
          stats: omitEmpty({
            runs: b.runs,
            balls: b.balls,
            fours: b.fours,
            sixes: b.sixes,
            strikeRate: b.strikeRate,
            dismissal: b.status,
          }),
        };
      }
    }
    for (const b of inn.bowling || []) {
      if (String(b.key || '').toLowerCase() === key || playerKey(b.bowler, '') === key) {
        return {
          ...b,
          name: b.bowler,
          position: 'Bowler',
          role: 'bowler',
          stats: omitEmpty({
            overs: b.overs,
            maidens: b.maidens,
            runs: b.runs,
            wickets: b.wickets,
            economy: b.economy,
            dots: b.dots,
            boundaries: b.boundaries,
          }),
        };
      }
    }
  }

  // fuzzy by name slug
  found = all.find((p) => String(p.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-') === key);
  return found || null;
};

export default {
  buildMatchDetailPayload,
  findPlayerInDetail,
  extractMatchSlug,
  parseCricketScoreText,
  mapCricLiveScorecard,
  mapBallByBall,
};
