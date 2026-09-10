import mongoose from 'mongoose';
import { GOV_CATEGORIES, GOV_LANGUAGES, GOV_LEVELS, GOV_STATUSES } from './GovernmentConfig.js';

const governmentNotificationSchema = new mongoose.Schema(
  {
    fingerprint: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true, trim: true },
    titleTamil: { type: String, default: '', trim: true },
    summary: { type: String, default: '' },
    summaryTamil: { type: String, default: '' },
    content: { type: String, default: '' },
    category: { type: String, enum: GOV_CATEGORIES, default: 'general', index: true },
    level: { type: String, enum: GOV_LEVELS, default: 'central', index: true },
    department: { type: String, default: '', trim: true, index: true },
    sourceName: { type: String, default: '', trim: true },
    sourceUrl: { type: String, default: '', trim: true },
    officialUrl: { type: String, default: '', trim: true },
    language: { type: String, enum: GOV_LANGUAGES, default: 'en' },
    publishedAt: { type: Date, index: true },
    status: { type: String, enum: GOV_STATUSES, default: 'pending', index: true },
    isImportant: { type: Boolean, default: false, index: true },
    isActive: { type: Boolean, default: true },
    keywords: [{ type: String, trim: true }],
    sourceId: { type: mongoose.Schema.Types.ObjectId },
    fetchedAt: { type: Date, default: Date.now },
    lastUpdatedAt: { type: Date, default: Date.now },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

governmentNotificationSchema.index({ status: 1, publishedAt: -1 });
governmentNotificationSchema.index({ isImportant: 1, status: 1, publishedAt: -1 });
governmentNotificationSchema.index({ title: 'text', summary: 'text', department: 'text' });

export default mongoose.model('GovernmentNotification', governmentNotificationSchema);
