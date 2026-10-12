import DailyHoroscope from '../models/DailyHoroscope.js';
import {
  getOrCreateAstrologyConfig,
  syncAstrologyNow,
  getNextSyncDate,
  dateInTimezone,
} from '../services/astrologyService.js';
import { DEFAULT_TIMEZONE } from '../config/astrologyConstants.js';

let timer = null;
let catchUpInterval = null;
let rescheduleInterval = null;
let running = false;

const clearTimer = () => {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
};

/** Clear stuck syncInProgress from crashed/interrupted runs */
const clearStaleSyncLock = async (config) => {
  if (!config.syncInProgress) return config;
  const lockedAt = config.updatedAt ? new Date(config.updatedAt).getTime() : 0;
  const staleMs = 20 * 60 * 1000;
  if (!lockedAt || Date.now() - lockedAt > staleMs) {
    config.syncInProgress = false;
    await config.save();
    console.log('[Astrology] Cleared stale syncInProgress lock');
  }
  return config;
};

const todayRasiCount = async (tz) => {
  const today = dateInTimezone(tz);
  return DailyHoroscope.countDocuments({ date: today, status: 'active' });
};

/**
 * If today's horoscopes are missing/incomplete, sync now.
 * Covers servers that were offline at the nightly syncTime.
 */
const maybeCatchUpSync = async (label = 'cron') => {
  if (running) return { skipped: true, reason: 'busy' };

  try {
    let config = await getOrCreateAstrologyConfig();
    if (!config.autoSync) return { skipped: true, reason: 'autoSync-off' };

    config = await clearStaleSyncLock(config);
    if (config.syncInProgress) return { skipped: true, reason: 'in-progress' };

    const tz = config.timezone || DEFAULT_TIMEZONE;
    const count = await todayRasiCount(tz);
    if (count >= 12) return { skipped: true, reason: 'complete', count };

    running = true;
    console.log(`[Astrology] Catch-up sync (${label}) — today has ${count}/12 rasis`);
    const result = await syncAstrologyNow(label);
    console.log(
      `[Astrology] ${label}: ${result.status || (result.success ? 'success' : 'failed')} date=${result.date} rasis=${result.rasiUpdated || 0}`
    );
    return result;
  } catch (err) {
    console.warn(`[Astrology] ${label} catch-up error:`, err.message);
    return { success: false, error: err.message };
  } finally {
    running = false;
  }
};

const scheduleNext = async () => {
  clearTimer();

  try {
    let config = await getOrCreateAstrologyConfig();
    config = await clearStaleSyncLock(config);

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
          console.log('[Astrology] Auto sync disabled — skipping nightly');
          return;
        }
        await clearStaleSyncLock(fresh);
        if (fresh.syncInProgress) {
          console.log('[Astrology] Sync already in progress — will retry via catch-up');
          return;
        }
        if (running) return;
        running = true;
        const result = await syncAstrologyNow('cron');
        console.log(
          `[Astrology] cron: ${result.status || (result.success ? 'success' : 'failed')} date=${result.date} rasis=${result.rasiUpdated || 0}`
        );
      } catch (err) {
        console.warn('[Astrology] cron error:', err.message);
      } finally {
        running = false;
        scheduleNext();
      }
    }, ms);

    console.log(`[Astrology] Next nightly sync at ${next.toISOString()} (in ${Math.round(ms / 1000)}s)`);
  } catch (err) {
    console.warn('[Astrology] schedule error:', err.message);
    timer = setTimeout(() => scheduleNext(), 60_000);
  }
};

/**
 * Daily astrology sync + catch-up when today's data is missing.
 * - Nightly at configured syncTime (default 00:05 Asia/Kolkata)
 * - Startup catch-up if today incomplete
 * - Periodic catch-up every 30 min (covers offline-at-midnight)
 */
export const startAstrologySyncJob = () => {
  setTimeout(async () => {
    await maybeCatchUpSync('startup');
    await scheduleNext();
  }, 45_000);

  if (catchUpInterval) clearInterval(catchUpInterval);
  catchUpInterval = setInterval(() => {
    maybeCatchUpSync('cron');
  }, 30 * 60 * 1000);

  if (rescheduleInterval) clearInterval(rescheduleInterval);
  rescheduleInterval = setInterval(() => {
    scheduleNext();
  }, 10 * 60 * 1000);

  console.log('[Astrology] Job registered (catch-up in ~45s, then nightly schedule)');
};

export const rescheduleAstrologySyncJob = async () => {
  await scheduleNext();
  // After settings change, also fill today if incomplete
  setTimeout(() => maybeCatchUpSync('cron'), 2_000);
};

export default startAstrologySyncJob;
