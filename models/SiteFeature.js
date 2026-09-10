import mongoose from 'mongoose';
import { FEATURE_CATEGORIES, FEATURE_STATUSES } from '../config/features.js';

const siteFeatureSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true, lowercase: true },
    name: { type: String, required: true, trim: true },
    nameTamil: { type: String, default: '', trim: true },
    description: { type: String, default: '' },
    category: { type: String, enum: FEATURE_CATEGORIES, required: true },
    icon: { type: String, default: 'spark' },
    status: { type: String, enum: FEATURE_STATUSES, default: 'live' },
    enabled: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
    row: { type: Number, default: 1 },
    colSpan: { type: Number, default: 4, min: 1, max: 12 },
    config: { type: mongoose.Schema.Types.Mixed, default: {} },
    manageRoles: {
      type: [String],
      default: ['SUPER_ADMIN', 'EDITOR'],
    },
  },
  { timestamps: true }
);

siteFeatureSchema.index({ enabled: 1, order: 1 });
siteFeatureSchema.index({ category: 1, order: 1 });

export default mongoose.model('SiteFeature', siteFeatureSchema);
