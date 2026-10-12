import dotenv from 'dotenv';
import mongoose from 'mongoose';
import SiteFeature from '../models/SiteFeature.js';
import { getDefaultTrafficConfig } from '../services/trafficService.js';

dotenv.config();

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const config = getDefaultTrafficConfig();
  const result = await SiteFeature.updateOne(
    { key: 'traffic' },
    {
      $set: {
        description: 'Live Tamil Nadu district and city-area traffic',
        config,
      },
    }
  );
  const doc = await SiteFeature.findOne({ key: 'traffic' }).lean();
  console.log(JSON.stringify({
    matched: result.matchedCount,
    modified: result.modifiedCount,
    areaCount: doc?.config?.areas?.length || 0,
    city: doc?.config?.city,
    auto_update: doc?.config?.auto_update,
  }));
  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error(err.message);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
