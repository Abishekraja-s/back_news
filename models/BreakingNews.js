import mongoose from 'mongoose';

const breakingNewsSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true },
    link: { type: String, default: '' },
    priority: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    /** Homepage ticker impressions — incremented automatically, not editable */
    views: { type: Number, default: 0, min: 0 },
    startTime: { type: Date, default: Date.now },
    endTime: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

breakingNewsSchema.index({ isActive: 1, priority: -1, startTime: -1 });

export default mongoose.model('BreakingNews', breakingNewsSchema);
