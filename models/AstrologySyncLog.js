import mongoose from 'mongoose';

const astrologySyncLogSchema = new mongoose.Schema(
  {
    syncDate: { type: String, index: true }, // YYYY-MM-DD calendar date synced for
    syncStartedAt: { type: Date, required: true, index: true },
    syncCompletedAt: { type: Date },
    status: {
      type: String,
      enum: ['running', 'success', 'partial', 'failed'],
      default: 'running',
      index: true,
    },
    trigger: {
      type: String,
      enum: ['manual', 'cron', 'startup'],
      default: 'manual',
      index: true,
    },
    recordsFetched: { type: Number, default: 0 },
    recordsUpdated: { type: Number, default: 0 },
    responseCode: { type: Number, default: 0 },
    errorMessage: { type: String, default: '' },
    apiProvider: { type: String, default: '' },
    details: { type: mongoose.Schema.Types.Mixed },
    durationMs: { type: Number, default: 0 },
  },
  { timestamps: true }
);

astrologySyncLogSchema.index({ syncStartedAt: -1 });

export default mongoose.model('AstrologySyncLog', astrologySyncLogSchema);
