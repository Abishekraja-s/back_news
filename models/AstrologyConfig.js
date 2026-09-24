import mongoose from 'mongoose';
import { DEFAULT_SYNC_TIME, DEFAULT_TIMEZONE } from '../config/astrologyConstants.js';

const astrologyConfigSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'default', unique: true },
    apiProvider: { type: String, default: 'free', trim: true },
    apiBaseUrl: { type: String, default: 'https://ohmanda.com/api/horoscope', trim: true },
    /** Encrypted at rest when stored via controller helpers */
    apiKeyEnc: { type: String, default: '' },
    apiSecretEnc: { type: String, default: '' },
    language: { type: String, default: 'Tamil', trim: true },
    country: { type: String, default: 'India', trim: true },
    state: { type: String, default: 'Tamil Nadu', trim: true },
    city: { type: String, default: 'Chennai', trim: true },
    timezone: { type: String, default: DEFAULT_TIMEZONE, trim: true },
    autoSync: { type: Boolean, default: true },
    /** 24h HH:mm in configured timezone — default 12:05 AM IST */
    syncTime: { type: String, default: DEFAULT_SYNC_TIME, trim: true },
    lat: { type: Number, default: 13.0827 },
    lon: { type: Number, default: 80.2707 },
    apiStatus: {
      type: String,
      enum: ['unknown', 'connected', 'failed'],
      default: 'unknown',
    },
    lastTestAt: { type: Date },
    lastTestMessage: { type: String, default: '' },
    lastSuccessfulSyncAt: { type: Date },
    lastSyncStatus: { type: String, default: '' },
    lastSyncError: { type: String, default: '' },
    lastSyncRecords: { type: Number, default: 0 },
    nextScheduledSyncAt: { type: Date },
    syncInProgress: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model('AstrologyConfig', astrologyConfigSchema);
