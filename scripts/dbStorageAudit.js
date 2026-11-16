import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection.db;
const articles = db.collection('articles');

const total = await articles.countDocuments();
const byStatus = await articles.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]).toArray();
const byImport = await articles
  .aggregate([{ $group: { _id: '$importSource', n: { $sum: 1 } } }, { $sort: { n: -1 } }])
  .toArray();
const withImport = await articles.countDocuments({ importSource: { $nin: ['', null] } });
const withoutImport = total - withImport;

const now = Date.now();
const d7 = new Date(now - 7 * 864e5);
const d14 = new Date(now - 14 * 864e5);
const d30 = new Date(now - 30 * 864e5);
const older7 = await articles.countDocuments({ importSource: { $nin: ['', null] }, createdAt: { $lt: d7 } });
const older14 = await articles.countDocuments({ importSource: { $nin: ['', null] }, createdAt: { $lt: d14 } });
const older30 = await articles.countDocuments({ importSource: { $nin: ['', null] }, createdAt: { $lt: d30 } });

const idxs = await articles.indexes();
const stats = await db.command({ dbStats: 1, scale: 1024 * 1024 });

console.log(
  JSON.stringify(
    {
      total,
      byStatus,
      byImport,
      withImport,
      withoutImport,
      older7,
      older14,
      older30,
      indexCount: idxs.length,
      indexes: idxs.map((i) => ({ name: i.name, key: i.key, unique: !!i.unique })),
      dbStatsMB: {
        dataSize: +stats.dataSize.toFixed(2),
        storageSize: +stats.storageSize.toFixed(2),
        indexSize: +stats.indexSize.toFixed(2),
        total: +(stats.dataSize + stats.indexSize).toFixed(2),
      },
    },
    null,
    2
  )
);

await mongoose.disconnect();
