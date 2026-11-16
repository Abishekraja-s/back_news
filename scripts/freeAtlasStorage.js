/**
 * Free MongoDB Atlas storage when over quota.
 * Keeps: published articles, non-RSS articles, recent RSS drafts (default 7 days).
 * Also trims old gov notifications / logs and drops redundant article indexes.
 *
 * Usage: node scripts/freeAtlasStorage.js [--days=7] [--dry-run]
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const daysArg = args.find((a) => a.startsWith('--days='));
const keepDays = Number(daysArg?.split('=')[1] || 7);

const mb = (n) => `${(n / (1024 * 1024)).toFixed(2)} MB`;

async function dbStats(db) {
  const s = await db.command({ dbStats: 1 });
  return {
    dataSize: s.dataSize,
    storageSize: s.storageSize,
    indexSize: s.indexSize,
    total: s.dataSize + s.indexSize,
  };
}

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI missing');
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const articles = db.collection('articles');
  const cutoff = new Date(Date.now() - keepDays * 864e5);

  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'} | Keep RSS drafts newer than ${keepDays} days (since ${cutoff.toISOString()})`);
  const before = await dbStats(db);
  console.log('Before:', {
    data: mb(before.dataSize),
    storage: mb(before.storageSize),
    index: mb(before.indexSize),
    total: mb(before.total),
  });

  const rssDraftFilter = {
    importSource: 'rss',
    status: { $in: ['DRAFT', 'TRASH'] },
    createdAt: { $lt: cutoff },
  };
  const trashFilter = { status: 'TRASH' };
  const govCutoff = new Date(Date.now() - 30 * 864e5);
  const govFilter = { createdAt: { $lt: govCutoff } };
  const travelLogFilter = { createdAt: { $lt: cutoff } };
  const astrologyLogFilter = { createdAt: { $lt: cutoff } };

  const counts = {
    rssOldDrafts: await articles.countDocuments(rssDraftFilter),
    trash: await articles.countDocuments(trashFilter),
    govOld: await db.collection('governmentnotifications').countDocuments(govFilter),
    travelLogs: await db.collection('travelfetchlogs').countDocuments(travelLogFilter),
    astrologyLogs: await db.collection('astrologysynclogs').countDocuments(astrologyLogFilter),
  };
  console.log('Will remove:', counts);

  if (!dryRun) {
    if (counts.rssOldDrafts) {
      const r = await articles.deleteMany(rssDraftFilter);
      console.log(`Deleted RSS draft/trash articles: ${r.deletedCount}`);
    }
    if (counts.trash) {
      const r = await articles.deleteMany(trashFilter);
      console.log(`Deleted remaining TRASH articles: ${r.deletedCount}`);
    }
    if (counts.govOld) {
      const r = await db.collection('governmentnotifications').deleteMany(govFilter);
      console.log(`Deleted old government notifications: ${r.deletedCount}`);
    }
    if (counts.travelLogs) {
      const r = await db.collection('travelfetchlogs').deleteMany(travelLogFilter);
      console.log(`Deleted travel fetch logs: ${r.deletedCount}`);
    }
    if (counts.astrologyLogs) {
      const r = await db.collection('astrologysynclogs').deleteMany(astrologyLogFilter);
      console.log(`Deleted astrology sync logs: ${r.deletedCount}`);
    }

    // Redundant with compound importSource_1_importGuid_1 (prefix covers importSource alone)
    const idx = await articles.indexes();
    const names = new Set(idx.map((i) => i.name));
    for (const name of ['importSource_1', 'importGuid_1', 'aeoScore_-1']) {
      if (!names.has(name)) continue;
      // Keep importGuid_1 if used alone often — still drop; compound + filter works for most ingest
      try {
        await articles.dropIndex(name);
        console.log(`Dropped index: ${name}`);
      } catch (e) {
        console.log(`Skip drop ${name}: ${e.message}`);
      }
    }

    // Try reclaiming free space (may be unsupported on M0)
    try {
      await db.command({ compact: 'articles', force: true });
      console.log('Compacted articles collection');
    } catch (e) {
      console.log(`Compact skipped: ${e.message}`);
    }
  }

  const after = await dbStats(db);
  const remaining = await articles.countDocuments();
  const remainingRssDrafts = await articles.countDocuments({
    importSource: 'rss',
    status: 'DRAFT',
  });
  console.log('After:', {
    data: mb(after.dataSize),
    storage: mb(after.storageSize),
    index: mb(after.indexSize),
    total: mb(after.total),
    articles: remaining,
    rssDraftsLeft: remainingRssDrafts,
  });
  console.log(
    dryRun
      ? 'Dry run complete — re-run without --dry-run to apply.'
      : 'Cleanup complete. If Atlas still shows over quota, wait a few minutes or run compact from Atlas UI / upgrade tier.'
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
