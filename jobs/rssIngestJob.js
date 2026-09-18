import RssFeedSource from '../models/RssFeedSource.js';
import { runAllRssIngest } from '../services/rssIngestService.js';

let intervalHandle = null;
let bootTimer = null;

const MIN_MS = 60 * 1000;

/**
 * Background RSS → Article ingest for sources with autoFetchEnabled.
 */
export const startRssIngestJob = () => {
  const run = async (label) => {
    try {
      const autoSources = await RssFeedSource.countDocuments({
        enabled: true,
        autoFetchEnabled: true,
      });
      if (!autoSources) return;

      const result = await runAllRssIngest({ onlyAuto: true });
      console.log(
        `[RssIngest] ${label}: sources=${result.sources} fetched=${result.fetched} created=${result.created} skipped=${result.skipped}`
      );
    } catch (err) {
      console.warn('[RssIngest] sync error:', err.message);
    }
  };

  const schedule = async () => {
    if (intervalHandle) clearInterval(intervalHandle);
    try {
      const sources = await RssFeedSource.find({
        enabled: true,
        autoFetchEnabled: true,
      }).select('fetchIntervalMinutes');
      const mins = sources.length
        ? Math.min(...sources.map((s) => Math.max(15, s.fetchIntervalMinutes || 60)))
        : 60;
      intervalHandle = setInterval(() => run('cron'), mins * MIN_MS);
      console.log(`[RssIngest] Auto-fetch scheduled every ${mins} minutes (sources=${sources.length})`);
    } catch (err) {
      intervalHandle = setInterval(() => run('cron'), 60 * MIN_MS);
      console.warn('[RssIngest] Using default 60m interval:', err.message);
    }
  };

  bootTimer = setTimeout(() => {
    run('startup');
    schedule();
  }, 90_000);

  setInterval(schedule, 6 * 60 * MIN_MS);
  console.log('[RssIngest] Job registered (first run in ~90s)');
};

export const stopRssIngestJob = () => {
  if (intervalHandle) clearInterval(intervalHandle);
  if (bootTimer) clearTimeout(bootTimer);
};

export default startRssIngestJob;
