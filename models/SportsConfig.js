import mongoose from 'mongoose';

export const SPORT_TYPES = ['cricket', 'football', 'basketball', 'tennis', 'other', 'chess'];

export const WIDGET_TYPES = [
  'live_score',
  'upcoming',
  'results',
  'standings',
  'team_info',
  'player_stats',
  'match_details',
];

export const WIDGET_PAGES = ['homepage', 'category', 'article'];

export const LIVE_STATUSES = ['live', 'halftime'];

const sportModeSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: true },
    autoFetchEnabled: { type: Boolean, default: false },
    apiBaseUrl: { type: String, default: '', trim: true },
    apiEndpoint: { type: String, default: '', trim: true },
    apiKey: { type: String, default: '', trim: true },
    apiProvider: { type: String, default: 'custom', trim: true },
    leagues: [{ type: String, trim: true }],
    tournaments: [{ type: String, trim: true }],
    teams: [{ type: String, trim: true }],
    competitions: [{ type: String, trim: true }],
    /** Fetch interval in seconds (10–300). Default 60 for live scores */
    fetchIntervalSeconds: { type: Number, default: 60, min: 10, max: 300 },
    /** @deprecated use fetchIntervalSeconds */
    refreshIntervalMinutes: { type: Number, default: 1, min: 1, max: 60 },
    lastFetchAt: { type: Date },
    lastFetchStatus: { type: String, default: '' },
    lastFetchError: { type: String, default: '' },
    lastFetchCount: { type: Number, default: 0 },
    lastLiveCount: { type: Number, default: 0 },
    lastHttpStatus: { type: Number, default: 0 },
  },
  { _id: false }
);

const widgetSchema = new mongoose.Schema(
  {
    type: { type: String, enum: WIDGET_TYPES, required: true },
    enabled: { type: Boolean, default: true },
    pages: [{ type: String, enum: WIDGET_PAGES }],
    title: { type: String, default: '' },
    sports: [{ type: String, enum: SPORT_TYPES }],
    maxItems: { type: Number, default: 6, min: 1, max: 20 },
  },
  { _id: false }
);

const sportsConfigSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'default', unique: true },
    cricket: { type: sportModeSchema, default: () => ({}) },
    football: { type: sportModeSchema, default: () => ({}) },
    basketball: { type: sportModeSchema, default: () => ({}) },
    tennis: { type: sportModeSchema, default: () => ({}) },
    other: { type: sportModeSchema, default: () => ({}) },
    chess: { type: sportModeSchema, default: () => ({}) },
    widgets: [widgetSchema],
    homepageTitle: { type: String, default: 'Live Sports', trim: true },
    showOnHomepage: { type: Boolean, default: true },
    fetchInProgress: { type: Boolean, default: false },
    lastGlobalFetchAt: { type: Date },
    /** Stale live match timeout in seconds — mark finished if not confirmed live */
    staleLiveSeconds: { type: Number, default: 120, min: 30, max: 600 },
  },
  { timestamps: true }
);

export default mongoose.model('SportsConfig', sportsConfigSchema);
