import { getOrCreateTravelConfig, runTravelFetch } from '../controllers/travelNotificationController.js';
import { TRAVEL_MODES } from '../models/TravelConfig.js';
import { getEffectiveIntervalSeconds } from '../services/travelFetchService.js';

const modeTimers = {};
let rescheduleTimer = null;

const clearModeTimer = (mode) => {
  if (modeTimers[mode]) {
    clearTimeout(modeTimers[mode]);
    delete modeTimers[mode];
  }
};

const scheduleMode = async (mode) => {
  clearModeTimer(mode);

  try {
    const config = await getOrCreateTravelConfig();
    const modeConfig = config[mode];

    if (!modeConfig?.enabled || !modeConfig?.autoFetchEnabled) {
      return;
    }

    const seconds = getEffectiveIntervalSeconds(modeConfig);
    const ms = Math.max(10_000, seconds * 1000);

    modeConfig.nextScheduledFetchAt = new Date(Date.now() + ms);
    config.markModified(mode);
    await config.save();

    modeTimers[mode] = setTimeout(async () => {
      try {
        const fresh = await getOrCreateTravelConfig();
        if (fresh.fetchInProgress) {
          scheduleMode(mode);
          return;
        }
        const { results } = await runTravelFetch([mode], 'cron');
        console.log(
          `[Travel] cron ${mode}:`,
          results.map((r) =>
            r.success === false ? r.error : `+${r.created || 0}/~${r.updated || 0}`
          ).join(', ')
        );
      } catch (err) {
        console.warn(`[Travel] cron ${mode} error:`, err.message);
      } finally {
        scheduleMode(mode);
      }
    }, ms);

    console.log(`[Travel] ${mode} auto-fetch in ${Math.round(ms / 1000)}s`);
  } catch (err) {
    console.warn(`[Travel] schedule ${mode} error:`, err.message);
    modeTimers[mode] = setTimeout(() => scheduleMode(mode), 60_000);
  }
};

const rescheduleAll = async () => {
  TRAVEL_MODES.forEach(clearModeTimer);
  try {
    const config = await getOrCreateTravelConfig();
    for (const mode of TRAVEL_MODES) {
      if (config[mode]?.enabled && config[mode]?.autoFetchEnabled) {
        await scheduleMode(mode);
      }
    }
  } catch (err) {
    console.warn('[Travel] reschedule error:', err.message);
  }
};

/**
 * Backend scheduled auto-fetch — per-mode intervals, overlap-safe.
 */
export const startTravelFetchJob = () => {
  const runStartup = async () => {
    try {
      const config = await getOrCreateTravelConfig();
      const modes = TRAVEL_MODES.filter((m) => config[m]?.enabled && config[m]?.autoFetchEnabled);
      if (!modes.length) {
        console.log('[Travel] No auto-fetch modes enabled');
        return;
      }
      const { results } = await runTravelFetch(modes, 'startup');
      console.log(
        '[Travel] startup:',
        results.map((r) => `${r.mode}=${r.success === false ? r.error : `+${r.created || 0}`}`).join(', ')
      );
    } catch (err) {
      console.warn('[Travel] startup error:', err.message);
    } finally {
      await rescheduleAll();
    }
  };

  setTimeout(runStartup, 75_000);

  if (rescheduleTimer) clearInterval(rescheduleTimer);
  rescheduleTimer = setInterval(rescheduleAll, 6 * 60 * 1000);

  console.log('[Travel] Job registered (startup in ~75s, per-mode intervals)');
};

export default startTravelFetchJob;
