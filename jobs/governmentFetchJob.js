import { getOrCreateGovConfig, runGovernmentFetch } from '../controllers/governmentNotificationController.js';

let intervalHandle = null;
const MIN_MS = 60 * 1000;

export const startGovernmentFetchJob = () => {
  const run = async (label) => {
    try {
      const config = await getOrCreateGovConfig();
      if (!config.autoFetchEnabled) return;
      const result = await runGovernmentFetch(label);
      console.log(
        `[GovNotify] ${label}: created=${result.created} skipped=${result.skipped} status=${result.success ? 'ok' : result.error}`
      );
    } catch (err) {
      console.warn('[GovNotify] sync error:', err.message);
    }
  };

  const schedule = async () => {
    if (intervalHandle) clearInterval(intervalHandle);
    try {
      const config = await getOrCreateGovConfig();
      const mins = Math.max(15, config.refreshIntervalMinutes || 60);
      intervalHandle = setInterval(() => run('cron'), mins * MIN_MS);
      console.log(`[GovNotify] Auto-fetch every ${mins} minutes (enabled=${config.autoFetchEnabled})`);
    } catch {
      intervalHandle = setInterval(() => run('cron'), 60 * MIN_MS);
    }
  };

  setTimeout(() => {
    run('startup');
    schedule();
  }, 105_000);

  setInterval(schedule, 6 * 60 * MIN_MS);
  console.log('[GovNotify] Job registered (first run in ~105s)');
};

export default startGovernmentFetchJob;
