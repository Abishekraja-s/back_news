import dotenv from 'dotenv';
import mongoose from 'mongoose';
import SiteFeature from '../models/SiteFeature.js';
import FeatureItem from '../models/FeatureItem.js';
import { DEFAULT_FEATURES, DEMO_FEATURE_ITEMS } from '../config/features.js';

dotenv.config();

/**
 * Upserts feature registry + seeds demo content when empty.
 * Safe to re-run: features sync; demo items only if collection is empty.
 */
export const syncFeatures = async ({ seedDemo = true } = {}) => {
  let created = 0;
  let updated = 0;

  for (const def of DEFAULT_FEATURES) {
    const existing = await SiteFeature.findOne({ key: def.key });
    if (existing) {
      await SiteFeature.updateOne(
        { key: def.key },
        {
          $set: {
            name: def.name,
            nameTamil: def.nameTamil,
            description: def.description,
            category: def.category,
            icon: def.icon,
            order: def.order,
            row: def.row,
            colSpan: def.colSpan,
            // Keep admin toggles / config overrides; only fill missing config keys
            config: { ...def.config, ...(existing.config || {}) },
          },
        }
      );
      updated += 1;
    } else {
      await SiteFeature.create(def);
      created += 1;
    }
  }

  // Retire Events Near You in favor of Matrimony
  await SiteFeature.updateOne({ key: 'events' }, { $set: { enabled: false, status: 'disabled' } });
  await FeatureItem.updateMany({ featureKey: 'events' }, { $set: { isActive: false } });

  // Retire Jobs for You in favor of Government Notifications
  await SiteFeature.updateOne({ key: 'jobs' }, { $set: { enabled: false, status: 'disabled' } });
  await FeatureItem.updateMany({ featureKey: 'jobs' }, { $set: { isActive: false } });

  let demoCreated = 0;
  if (seedDemo) {
    const count = await FeatureItem.countDocuments();
    if (count === 0) {
      await FeatureItem.insertMany(
        DEMO_FEATURE_ITEMS.map((item) => ({ ...item, isActive: true }))
      );
      demoCreated = DEMO_FEATURE_ITEMS.length;
    }
  }

  return { created, updated, demoCreated, totalFeatures: DEFAULT_FEATURES.length };
};

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const result = await syncFeatures({ seedDemo: true });
  console.log('Feature sync complete:', result);
  await mongoose.disconnect();
};

const isDirect = process.argv[1] && process.argv[1].includes('syncFeatures');
if (isDirect) {
  run().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export default syncFeatures;
