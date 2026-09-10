import { syncAllActiveChannels } from '../controllers/youtubeController.js';

const HOUR_MS = 60 * 60 * 1000;

/**
 * Background YouTube auto-fetch — every hour (and once shortly after boot).
 */
export const startYoutubeFetchJob = () => {
  const run = async (label) => {
    try {
      const results = await syncAllActiveChannels(label);
      if (results.length) {
        console.log(
          `[YouTube] ${label}:`,
          results.map((r) => `${r.key}=${r.success === false ? r.error : `+${r.created || 0}`}`).join(', ')
        );
      }
    } catch (err) {
      console.warn('[YouTube] sync error:', err.message);
    }
  };

  // Delay first run so DB/server settle
  setTimeout(() => run('startup'), 45_000);
  setInterval(() => run('cron'), HOUR_MS);

  console.log('[YouTube] Auto-fetch scheduled every 60 minutes');
};

export default startYoutubeFetchJob;
