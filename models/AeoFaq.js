import mongoose from 'mongoose';

const aeoFaqSchema = new mongoose.Schema(
  {
    question: { type: String, required: true, trim: true },
    answer: { type: String, required: true, trim: true },
    pageType: { type: String, default: 'global', trim: true },
    pagePath: { type: String, default: '', trim: true },
    entityTags: [{ type: String, trim: true }],
    language: { type: String, default: 'ta', trim: true },
    isActive: { type: Boolean, default: true },
    priority: { type: Number, default: 0 },
    includeInSchema: { type: Boolean, default: true },
  },
  { timestamps: true }
);

aeoFaqSchema.index({ isActive: 1, priority: -1 });

export default mongoose.model('AeoFaq', aeoFaqSchema);
