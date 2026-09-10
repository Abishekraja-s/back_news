import mongoose from 'mongoose';
import { SPORT_TYPES, LIVE_STATUSES } from './SportsConfig.js';

const MATCH_STATUS = ['scheduled', 'live', 'halftime', 'finished', 'postponed', 'cancelled', 'abandoned'];

const sportsMatchSchema = new mongoose.Schema(
  {
    /** Unique: provider + sport + externalId */
    fingerprint: { type: String, required: true, unique: true, index: true },
    externalId: { type: String, required: true, trim: true, index: true },
    provider: { type: String, default: 'custom', trim: true, index: true },
    sport: { type: String, enum: SPORT_TYPES, required: true, index: true },
    league: { type: String, default: '', trim: true },
    tournament: { type: String, default: '', trim: true },
    competition: { type: String, default: '', trim: true },
    homeTeam: { type: String, required: true, trim: true },
    awayTeam: { type: String, required: true, trim: true },
    homeScore: { type: Number, default: 0 },
    awayScore: { type: Number, default: 0 },
    homeScoreText: { type: String, default: '' },
    awayScoreText: { type: String, default: '' },
    status: { type: String, enum: MATCH_STATUS, default: 'scheduled', index: true },
    statusDetail: { type: String, default: '' },
    liveClock: { type: String, default: '' },
    startTime: { type: Date, index: true },
    venue: { type: String, default: '' },
    stats: { type: mongoose.Schema.Types.Mixed, default: {} },
    players: [
      {
        name: String,
        team: String,
        role: String,
        stats: mongoose.Schema.Types.Mixed,
      },
    ],
    source: { type: String, default: 'api' },
    sourceUrl: { type: String, default: '' },
    rawPayload: { type: mongoose.Schema.Types.Mixed },
    isActive: { type: Boolean, default: true },
    isPublished: { type: Boolean, default: true },
    lastUpdatedAt: { type: Date, default: Date.now },
    lastSyncedAt: { type: Date, default: Date.now },
    fetchedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

sportsMatchSchema.index({ provider: 1, sport: 1, externalId: 1 }, { unique: true });
sportsMatchSchema.index({ sport: 1, status: 1, isActive: 1, isPublished: 1 });
sportsMatchSchema.index({ sport: 1, status: 1, startTime: -1 });
sportsMatchSchema.index({ isPublished: 1, isActive: 1, status: 1 });

export { LIVE_STATUSES, MATCH_STATUS };
export default mongoose.model('SportsMatch', sportsMatchSchema);
