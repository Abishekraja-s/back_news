import mongoose from 'mongoose';

const MODE_TYPES = ['train', 'bus', 'flight'];
const CHANNELS = ['website', 'breaking_ticker', 'admin_only'];

const modeConfigSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: true },
    autoFetchEnabled: { type: Boolean, default: false },
    apiBaseUrl: { type: String, default: '', trim: true },
    apiEndpoint: { type: String, default: '', trim: true },
    apiKey: { type: String, default: '', trim: true },
    apiProvider: { type: String, default: 'custom', trim: true },
    routes: [{ type: String, trim: true }],
    locations: [{ type: String, trim: true }],
    transportNumbers: [{ type: String, trim: true }],
    keywords: [{ type: String, trim: true }],
    channels: [{ type: String, enum: CHANNELS }],
    /** Fetch interval in seconds (10–86400). Default 1800 = 30 min */
    fetchIntervalSeconds: { type: Number, default: 1800, min: 10, max: 86400 },
    /** @deprecated use fetchIntervalSeconds — kept for backward compatibility */
    updateFrequencyMinutes: { type: Number, default: 30, min: 1, max: 1440 },
    retryAttempts: { type: Number, default: 3, min: 0, max: 10 },
    retryBackoffSeconds: { type: Number, default: 30, min: 5, max: 600 },
    lastFetchAt: { type: Date },
    lastFetchStatus: { type: String, default: '' },
    lastFetchError: { type: String, default: '' },
    lastFetchCount: { type: Number, default: 0 },
    lastUpdatedCount: { type: Number, default: 0 },
    lastSkippedCount: { type: Number, default: 0 },
    lastHttpStatus: { type: Number, default: 0 },
    nextScheduledFetchAt: { type: Date },
  },
  { _id: false }
);

const travelConfigSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'default', unique: true },
    train: { type: modeConfigSchema, default: () => ({}) },
    bus: { type: modeConfigSchema, default: () => ({}) },
    flight: { type: modeConfigSchema, default: () => ({}) },
    showOnHomepage: { type: Boolean, default: true },
    homepageTitle: { type: String, default: 'Travel Updates', trim: true },
    fetchInProgress: { type: Boolean, default: false },
    lastGlobalFetchAt: { type: Date },
    nextScheduledFetchAt: { type: Date },
  },
  { timestamps: true }
);

export const TRAVEL_MODES = MODE_TYPES;
export const TRAVEL_CHANNELS = CHANNELS;

export default mongoose.model('TravelConfig', travelConfigSchema);
