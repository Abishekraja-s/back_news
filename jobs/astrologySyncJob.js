import {
  getOrCreateAstrologyConfig,
  syncAstrologyNow,
  getNextSyncDate,
} from '../services/astrologyService.js';
import { DEFAULT_TIMEZONE } from '../config/astrologyConstants.js';

let timer = null;
let rescheduleInterval = null;

const clearTimer = () => {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
};

const scheduleNext = async () => {
  clearTimer();

  try {
    const config = await getOrCreateAstrologyConfig();
    if (!config.autoSync) {
      config.nextScheduledSyncAt = null;
      await config.save();
      console.log('[Astrology] Auto sync OFF — scheduler idle');
      return;
    }

    const tz = config.timezone || DEFAULT_TIMEZONE;
    const next = getNextSyncDate(config.syncTime, tz);
    const ms = Math.max(5_000, next.getTime() - Date.now());

    config.nextScheduledSyncAt = next;
    await config.save();

    timer = setTimeout(async () => {
      try {
        const fresh = await getOrCreateAstrologyConfig();
        if (!fresh.autoSync) {
          console.log('[Astrology] Auto sync disabled — skipping');
          return;
        }
        if (fresh.syncInProgress) {
          console.log('[Astrology] Sync already in progress — reschedule');
          scheduleNext();
          return;
        }
        const result = await syncAstrologyNow('cron');
        console.log(
          `[Astrology] cron: ${result.status} date=${result.date} rasis=${result.rasiUpdated || 0}`
        );
      } catch (err) {
        console.warn('[Astrology] cron error:', err.message);
      } finally {
        scheduleNext();
      }
    }, ms);

    console.log(`[Astrology] Next auto sync at ${next.toISOString()} (in ${Math.round(ms / 1000)}s)`);
  } catch (err) {
    console.warn('[Astrology] schedule error:', err.message);
    timer = setTimeout(() => scheduleNext(), 60_000);
  }
};

/**
 * Daily astrology sync in Asia/Kolkata (or configured timezone).
 * Uses setTimeout (same pattern as Travel/Sports jobs) — no node-cron dependency.
 * Re-reads Auto Sync + Sync Time periodically so admin changes apply.
 */
export const startAstrologySyncJob = () => {
  setTimeout(() => {
    scheduleNext();
  }, 90_000);

  if (rescheduleInterval) clearInterval(rescheduleInterval);
  rescheduleInterval = setInterval(() => {
    scheduleNext();
  }, 10 * 60 * 1000);

  console.log('[Astrology] Job registered (first schedule in ~90s)');
};

export const rescheduleAstrologySyncJob = () => scheduleNext();

export default startAstrologySyncJob;
