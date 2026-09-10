import mongoose from 'mongoose';

const travelFetchLogSchema = new mongoose.Schema(
  {
    mode: { type: String, enum: ['train', 'bus', 'flight'], required: true, index: true },
    provider: { type: String, default: '', trim: true },
    trigger: { type: String, enum: ['manual', 'cron', 'startup'], default: 'manual', index: true },
    startedAt: { type: Date, required: true, index: true },
    completedAt: { type: Date },
    status: {
      type: String,
      enum: ['running', 'success', 'partial', 'error'],
      default: 'running',
      index: true,
    },
    httpStatus: { type: Number, default: 0 },
    newRecords: { type: Number, default: 0 },
    updatedRecords: { type: Number, default: 0 },
    skippedRecords: { type: Number, default: 0 },
    totalReceived: { type: Number, default: 0 },
    errorMessage: { type: String, default: '' },
    durationMs: { type: Number, default: 0 },
  },
  { timestamps: true }
);

travelFetchLogSchema.index({ startedAt: -1 });
travelFetchLogSchema.index({ mode: 1, startedAt: -1 });

export default mongoose.model('TravelFetchLog', travelFetchLogSchema);
