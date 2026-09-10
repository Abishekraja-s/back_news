import mongoose from 'mongoose';

const featureItemSchema = new mongoose.Schema(
  {
    featureKey: { type: String, required: true, trim: true, lowercase: true, index: true },
    itemType: { type: String, required: true, trim: true, index: true },
    title: { type: String, required: true, trim: true },
    titleTamil: { type: String, default: '', trim: true },
    subtitle: { type: String, default: '' },
    description: { type: String, default: '' },
    image: { type: String, default: '' },
    link: { type: String, default: '' },
    icon: { type: String, default: '' },
    color: { type: String, default: '' },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    isActive: { type: Boolean, default: true },
    priority: { type: Number, default: 0 },
    startDate: { type: Date },
    endDate: { type: Date },
  },
  { timestamps: true }
);

featureItemSchema.index({ featureKey: 1, isActive: 1, priority: -1 });

export default mongoose.model('FeatureItem', featureItemSchema);
