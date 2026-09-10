import { getOrCreateConfig, runGoogleNewsFetch } from '../controllers/googleNewsController.js';

let intervalHandle = null;
let bootTimer = null;

const MIN_MS = 60 * 1000;

/**
 * Background Google News auto-fetch.
 * Interval follows config.updateFrequencyMinutes when autoFetchEnabled.
 */
export const startGoogleNewsFetchJob = () => {
  const run = async (label) => {
    try {
      const config = await getOrCreateConfig();
      if (!config.autoFetchEnabled) return;

      const result = await runGoogleNewsFetch(label);
      if (result.success) {
        console.log(
          `[GoogleNews] ${label}: fetched=${result.fetched || 0} created=${result.created} skipped=${result.skipped}`
        );
      } else {
        console.warn(`[GoogleNews] ${label} failed:`, result.error);
      }
    } catch (err) {
      console.warn('[GoogleNews] sync error:', err.message);
    }
  };

  const schedule = async () => {
    if (intervalHandle) clearInterval(intervalHandle);
    try {
      const config = await getOrCreateConfig();
      const mins = Math.max(15, config.updateFrequencyMinutes || 60);
      intervalHandle = setInterval(() => run('cron'), mins * MIN_MS);
      console.log(`[GoogleNews] Auto-fetch scheduled every ${mins} minutes (enabled=${config.autoFetchEnabled})`);
    } catch (err) {
      intervalHandle = setInterval(() => run('cron'), 60 * MIN_MS);
      console.warn('[GoogleNews] Using default 60m interval:', err.message);
    }
  };

  bootTimer = setTimeout(() => {
    run('startup');
    schedule();
  }, 60_000);

  // Re-read schedule every 6 hours in case frequency changed
  setInterval(schedule, 6 * 60 * MIN_MS);

  console.log('[GoogleNews] Job registered (first run in ~60s)');
};

export const stopGoogleNewsFetchJob = () => {
  if (intervalHandle) clearInterval(intervalHandle);
  if (bootTimer) clearTimeout(bootTimer);
};

export default startGoogleNewsFetchJob;
