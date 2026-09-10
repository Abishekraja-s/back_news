import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Advertisement from '../models/Advertisement.js';

dotenv.config();

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const result = await Advertisement.updateMany(
    {},
    { $set: { isActive: true, startDate: new Date() } }
  );
  console.log(`Activated ${result.modifiedCount} advertisement(s)`);
  const active = await Advertisement.countDocuments({ isActive: true });
  console.log(`Active ads now: ${active}`);
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
