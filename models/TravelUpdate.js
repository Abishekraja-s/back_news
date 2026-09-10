import mongoose from 'mongoose';

const STATUS_TYPES = [
  'on_time',
  'delayed',
  'cancelled',
  'arrived',
  'departed',
  'scheduled',
  'diverted',
  'info',
];

const UPDATE_TYPES = [
  'schedule',
  'delay',
  'cancellation',
  'arrival',
  'departure',
  'status',
  'general',
];

const travelUpdateSchema = new mongoose.Schema(
  {
    /** Unique fingerprint to prevent duplicates */
    fingerprint: { type: String, required: true, unique: true, index: true },
    mode: { type: String, enum: ['train', 'bus', 'flight'], required: true, index: true },
    title: { type: String, required: true, trim: true },
    message: { type: String, default: '' },
    transportNumber: { type: String, default: '', trim: true, index: true },
    route: { type: String, default: '', trim: true },
    fromLocation: { type: String, default: '', trim: true },
    toLocation: { type: String, default: '', trim: true },
    status: { type: String, enum: STATUS_TYPES, default: 'info', index: true },
    updateType: { type: String, enum: UPDATE_TYPES, default: 'general' },
    scheduledAt: { type: Date },
    actualAt: { type: Date },
    delayMinutes: { type: Number, default: 0 },
    platform: { type: String, default: '', trim: true },
    gate: { type: String, default: '', trim: true },
    journeyDate: { type: String, default: '', trim: true, index: true },
    apiReferenceId: { type: String, default: '', trim: true, index: true },
    departureAt: { type: Date },
    arrivalAt: { type: Date },
    source: { type: String, default: 'manual', trim: true },
    sourceUrl: { type: String, default: '' },
    rawPayload: { type: mongoose.Schema.Types.Mixed },
    isActive: { type: Boolean, default: true },
    isPublished: { type: Boolean, default: true },
    channels: [{ type: String }],
    fetchedAt: { type: Date, default: Date.now },
    lastFetchedAt: { type: Date, default: Date.now },
    lastUpdatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

travelUpdateSchema.index({ mode: 1, fetchedAt: -1 });
travelUpdateSchema.index({ isPublished: 1, isActive: 1, mode: 1, fetchedAt: -1 });

export default mongoose.model('TravelUpdate', travelUpdateSchema);
