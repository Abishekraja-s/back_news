import mongoose from 'mongoose';

export const GOV_LEVELS = ['central', 'tamil_nadu', 'department', 'other'];

export const GOV_CATEGORIES = [
  'announcement',
  'scheme',
  'job',
  'tender',
  'order',
  'circular',
  'welfare',
  'public_notice',
  'alert',
  'general',
];

export const GOV_LANGUAGES = ['en', 'ta', 'both'];

export const GOV_STATUSES = ['pending', 'approved', 'rejected', 'published', 'disabled'];

const sourceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    level: { type: String, enum: GOV_LEVELS, default: 'central' },
    department: { type: String, default: '', trim: true },
    feedUrl: { type: String, default: '', trim: true },
    apiUrl: { type: String, default: '', trim: true },
    websiteUrl: { type: String, default: '', trim: true },
    category: { type: String, enum: GOV_CATEGORIES, default: 'general' },
    language: { type: String, enum: GOV_LANGUAGES, default: 'en' },
    keywords: [{ type: String, trim: true }],
    isActive: { type: Boolean, default: true },
  },
  { _id: true }
);

const governmentConfigSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'default', unique: true },
    sources: [sourceSchema],
    categories: [{ type: String, trim: true }],
    keywords: [{ type: String, trim: true }],
    autoFetchEnabled: { type: Boolean, default: false },
    autoPublish: { type: Boolean, default: false },
    refreshIntervalMinutes: { type: Number, default: 60, min: 15, max: 1440 },
    maxItemsPerFetch: { type: Number, default: 30, min: 5, max: 100 },
    showLatestWidget: { type: Boolean, default: true },
    showAlertsWidget: { type: Boolean, default: true },
    latestWidgetTitle: { type: String, default: 'Latest Government Notifications' },
    latestWidgetTitleTa: { type: String, default: 'அரசு அறிவிப்புகள்' },
    alertsWidgetTitle: { type: String, default: 'Important Government Alerts' },
    alertsWidgetTitleTa: { type: String, default: 'முக்கிய அரசு எச்சரிக்கைகள்' },
    showOnHomepage: { type: Boolean, default: true },
    /** Website content language: en = English only, ta = Tamil, both = no filter */
    preferredLanguage: { type: String, enum: GOV_LANGUAGES, default: 'en' },
    lastFetchAt: { type: Date },
    lastFetchStatus: { type: String, default: '' },
    lastFetchError: { type: String, default: '' },
    lastFetchCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model('GovernmentConfig', governmentConfigSchema);
