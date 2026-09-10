import { getOrCreateSportsConfig, runSportsFetch } from '../controllers/sportsController.js';
import SportsConfig, { SPORT_TYPES } from '../models/SportsConfig.js';
import { getEffectiveIntervalSeconds } from '../services/sportsFetchService.js';

const sportTimers = {};
let rescheduleTimer = null;
let scheduledOnce = {};

const clearSportTimer = (sport) => {
  if (sportTimers[sport]) {
    clearTimeout(sportTimers[sport]);
    delete sportTimers[sport];
  }
};

const scheduleSport = async (sport, { quiet = false } = {}) => {
  clearSportTimer(sport);

  try {
    const config = await getOrCreateSportsConfig();
    const modeConfig = config[sport];

    if (!modeConfig?.enabled || !modeConfig?.autoFetchEnabled) return;
    if (!(modeConfig.apiBaseUrl || '').trim()) return;

    const seconds = getEffectiveIntervalSeconds(modeConfig, sport);
    const ms = Math.max(seconds * 1000, sport === 'cricket' ? 60_000 : 30_000);

    sportTimers[sport] = setTimeout(async () => {
      try {
        const fresh = await getOrCreateSportsConfig();
        if (fresh.fetchInProgress) {
          // Retry soon without re-logging / stacking work
          sportTimers[sport] = setTimeout(() => scheduleSport(sport, { quiet: true }), 15_000);
          return;
        }
        const { results } = await runSportsFetch([sport], 'cron');
        console.log(
          `[Sports] cron ${sport}:`,
          results.map((r) =>
            r.success === false ? r.error || r.apiError : `live=${r.liveCount ?? 0}`
          ).join(', ')
        );
      } catch (err) {
        console.warn(`[Sports] cron ${sport} error:`, err.message);
      } finally {
        scheduleSport(sport, { quiet: true });
      }
    }, ms);

    if (!quiet || !scheduledOnce[sport]) {
      console.log(`[Sports] ${sport} auto-fetch every ${Math.round(ms / 1000)}s`);
      scheduledOnce[sport] = true;
    }
  } catch (err) {
    console.warn(`[Sports] schedule ${sport} error:`, err.message);
    sportTimers[sport] = setTimeout(() => scheduleSport(sport, { quiet: true }), 30_000);
  }
};

const rescheduleAll = async () => {
  SPORT_TYPES.forEach(clearSportTimer);
  scheduledOnce = {};
  try {
    const config = await getOrCreateSportsConfig();
    for (const sport of SPORT_TYPES) {
      if (config[sport]?.enabled && config[sport]?.autoFetchEnabled) {
        await scheduleSport(sport);
      }
    }
  } catch (err) {
    console.warn('[Sports] reschedule error:', err.message);
  }
};

export const startSportsFetchJob = () => {
  const runStartup = async () => {
    try {
      // Clear any stuck lock from a previous crash
      await SportsConfig.updateOne({ key: 'default' }, { $set: { fetchInProgress: false } });

      const config = await getOrCreateSportsConfig();
      // Enforce cricket minimum interval on startup
      if (config.cricket && Number(config.cricket.fetchIntervalSeconds) < 60) {
        config.cricket.fetchIntervalSeconds = 60;
        config.markModified('cricket');
        await config.save();
      }

      const sports = SPORT_TYPES.filter(
        (s) => config[s]?.enabled && config[s]?.autoFetchEnabled && (config[s]?.apiBaseUrl || '').trim()
      );
      if (!sports.length) {
        console.log('[Sports] No auto-fetch sports with API configured');
        return;
      }
      const { results } = await runSportsFetch(sports, 'startup');
      console.log(
        '[Sports] startup:',
        results.map((r) => `${r.sport}=${r.success === false ? r.error : `live=${r.liveCount ?? 0}`}`).join(', ')
      );
    } catch (err) {
      console.warn('[Sports] startup error:', err.message);
    } finally {
      await rescheduleAll();
    }
  };

  setTimeout(runStartup, 90_000);

  if (rescheduleTimer) clearInterval(rescheduleTimer);
  rescheduleTimer = setInterval(rescheduleAll, 6 * 60 * 1000);

  console.log('[Sports] Job registered (startup in ~90s, cricket min 60s refresh)');
};

export const stopSportsFetchJob = () => {
  SPORT_TYPES.forEach(clearSportTimer);
  if (rescheduleTimer) clearInterval(rescheduleTimer);
};

export default startSportsFetchJob;
