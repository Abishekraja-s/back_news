import mongoose from 'mongoose';

const matrimonyCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    nameTamil: { type: String, default: '', trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    description: { type: String, default: '' },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

matrimonyCategorySchema.index({ isActive: 1, order: 1 });

export default mongoose.model('MatrimonyCategory', matrimonyCategorySchema);
