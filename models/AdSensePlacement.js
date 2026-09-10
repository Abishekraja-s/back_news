import mongoose from 'mongoose';
import { ADSENSE_LOCATIONS, ADSENSE_FORMATS } from '../config/constants.js';

const adSensePlacementSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    location: {
      type: String,
      enum: ADSENSE_LOCATIONS,
      required: true,
      index: true,
    },
    /** Used when location === 'custom' */
    customLocation: { type: String, default: '', trim: true, lowercase: true },
    publisherId: { type: String, required: true, trim: true },
    adSlotId: { type: String, required: true, trim: true },
    adFormat: {
      type: String,
      enum: ADSENSE_FORMATS,
      default: 'auto',
    },
    sizeMode: {
      type: String,
      enum: ['responsive', 'fixed'],
      default: 'responsive',
    },
    width: { type: Number, default: 336 },
    height: { type: Number, default: 280 },
    isActive: { type: Boolean, default: true, index: true },
    /** Pages where this ad may show: all, home, article, category, … */
    pages: [{ type: String, trim: true, lowercase: true }],
    /** Category slugs; empty = all categories */
    categories: [{ type: String, trim: true, lowercase: true }],
    priority: { type: Number, default: 0 },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

adSensePlacementSchema.index(
  { location: 1, customLocation: 1, adSlotId: 1 },
  { unique: true }
);

export default mongoose.model('AdSensePlacement', adSensePlacementSchema);
