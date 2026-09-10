/**
 * One-shot: publish pending/approved government notifications to the website.
 * Usage: node utils/publishGovNotifications.js
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const notif = mongoose.connection.db.collection('governmentnotifications');
  const cfg = mongoose.connection.db.collection('governmentconfigs');

  const result = await notif.updateMany(
    { status: { $in: ['pending', 'approved'] }, isActive: true },
    { $set: { status: 'published', lastUpdatedAt: new Date(), reviewedAt: new Date() } }
  );

  await cfg.updateOne(
    { key: 'default' },
    { $set: { autoPublish: true, showOnHomepage: true, showLatestWidget: true } }
  );

  const published = await notif.countDocuments({ status: 'published', isActive: true });
  const hub = await notif.countDocuments({
    status: 'published',
    isActive: true,
    level: { $in: ['central', 'tamil_nadu'] },
  });

  console.log(`Published now: ${result.modifiedCount}`);
  console.log(`Total published: ${published}`);
  console.log(`Explore hub eligible: ${hub}`);
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
