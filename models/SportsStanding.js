import mongoose from 'mongoose';
import { SPORT_TYPES } from './SportsConfig.js';

const sportsStandingSchema = new mongoose.Schema(
  {
    fingerprint: { type: String, required: true, unique: true },
    sport: { type: String, enum: SPORT_TYPES, required: true, index: true },
    league: { type: String, required: true, trim: true },
    tournament: { type: String, default: '' },
    season: { type: String, default: '' },
    rows: [
      {
        rank: Number,
        team: String,
        played: Number,
        won: Number,
        drawn: Number,
        lost: Number,
        points: Number,
        goalsFor: Number,
        goalsAgainst: Number,
        netRunRate: String,
        form: String,
      },
    ],
    source: { type: String, default: 'config' },
    isActive: { type: Boolean, default: true },
    isPublished: { type: Boolean, default: true },
    lastUpdatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

sportsStandingSchema.index({ sport: 1, league: 1 });

export default mongoose.model('SportsStanding', sportsStandingSchema);
