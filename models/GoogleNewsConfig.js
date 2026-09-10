import mongoose from 'mongoose';

const googleNewsConfigSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'default', unique: true },
    /** Custom RSS / search source labels or query strings */
    sources: [{ type: String, trim: true }],
    /** Topic categories used when building queries (e.g. politics, sports) */
    categories: [{ type: String, trim: true }],
    /** Keywords for Google News RSS search */
    keywords: [{ type: String, trim: true }],
    /** Google News language code, e.g. en, ta, hi */
    language: { type: String, default: 'en', trim: true, lowercase: true },
    /** Country / region for Google News, e.g. IN, US */
    country: { type: String, default: 'IN', trim: true, uppercase: true },
    /** Minutes between automatic fetches */
    updateFrequencyMinutes: { type: Number, default: 60, min: 15, max: 1440 },
    /** Enable/disable background auto-fetch */
    autoFetchEnabled: { type: Boolean, default: false },
    /** Enable 10s auto-sync while Google News admin panel is open */
    autoSyncEnabled: { type: Boolean, default: false },
    /** Seconds between admin-panel auto-sync runs (default 10) */
    autoSyncIntervalSeconds: { type: Number, default: 10, min: 10, max: 300 },
    /** Max items to import per fetch run */
    maxItemsPerFetch: { type: Number, default: 20, min: 5, max: 50 },
    /** Auto-publish fetched items without admin review */
    autoPublish: { type: Boolean, default: false },
    /** Show published items on public homepage */
    showOnHomepage: { type: Boolean, default: true },
    homepageTitle: { type: String, default: 'Google News', trim: true },
    lastFetchAt: { type: Date },
    lastFetchStatus: { type: String, default: '' },
    lastFetchError: { type: String, default: '' },
    lastFetchCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model('GoogleNewsConfig', googleNewsConfigSchema);
