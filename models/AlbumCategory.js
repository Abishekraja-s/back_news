import mongoose from 'mongoose';

const albumCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    description: { type: String, default: '', trim: true },
    isActive: { type: Boolean, default: true },
    displayOrder: { type: Number, default: 0, index: true },
  },
  { timestamps: true }
);

albumCategorySchema.index({ isActive: 1, displayOrder: 1, name: 1 });

export default mongoose.model('AlbumCategory', albumCategorySchema);
