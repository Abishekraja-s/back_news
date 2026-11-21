import mongoose from 'mongoose';

const albumSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
    description: { type: String, default: '', trim: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'AlbumCategory', default: null, index: true },
    coverImage: { type: String, default: '' },
    albumDate: { type: Date, default: Date.now, index: true },
    status: {
      type: String,
      enum: ['draft', 'published'],
      default: 'draft',
      index: true,
    },
    displayOrder: { type: Number, default: 0, index: true },
    imageCount: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

albumSchema.index({ status: 1, displayOrder: 1, albumDate: -1 });
albumSchema.index({ status: 1, category: 1, albumDate: -1 });

export default mongoose.model('Album', albumSchema);
