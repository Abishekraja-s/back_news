import mongoose from 'mongoose';

const marketplaceCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    slug: { type: String, required: true, trim: true, lowercase: true, unique: true },
    isActive: { type: Boolean, default: true, index: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

marketplaceCategorySchema.index({ isActive: 1, sortOrder: 1, name: 1 });

export default mongoose.model('MarketplaceCategory', marketplaceCategorySchema);
