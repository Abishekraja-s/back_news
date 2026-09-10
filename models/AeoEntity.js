import mongoose from 'mongoose';
import { AEO_ENTITY_TYPES } from '../config/aeoDefaults.js';

const aeoEntitySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    nameTamil: { type: String, default: '', trim: true },
    type: { type: String, enum: AEO_ENTITY_TYPES, default: 'topic' },
    aliases: [{ type: String, trim: true }],
    description: { type: String, default: '' },
    sameAs: [{ type: String, trim: true }],
    relatedKeywords: [{ type: String, trim: true }],
    isPrimary: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    priority: { type: Number, default: 0 },
  },
  { timestamps: true }
);

aeoEntitySchema.index({ type: 1, isActive: 1, priority: -1 });

export default mongoose.model('AeoEntity', aeoEntitySchema);
