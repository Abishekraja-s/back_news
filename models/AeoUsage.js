import mongoose from 'mongoose';

const aeoUsageSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    action: {
      type: String,
      enum: ['generate', 'regenerate', 'apply_page', 'apply_article', 'config_test'],
      default: 'generate',
    },
    model: { type: String, default: '' },
    topic: { type: String, default: '' },
    targetType: { type: String, enum: ['page', 'article', 'preview', ''], default: 'preview' },
    targetId: { type: String, default: '' },
    success: { type: Boolean, default: true },
    errorMessage: { type: String, default: '' },
    promptTokens: { type: Number, default: 0 },
    outputTokens: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 },
    latencyMs: { type: Number, default: 0 },
    language: { type: String, default: 'ta' },
  },
  { timestamps: true }
);

aeoUsageSchema.index({ createdAt: -1 });
aeoUsageSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model('AeoUsage', aeoUsageSchema);
