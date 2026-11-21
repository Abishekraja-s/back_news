import mongoose from 'mongoose';

const albumImageSchema = new mongoose.Schema(
  {
    album: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Album',
      required: true,
      index: true,
    },
    url: { type: String, required: true, trim: true },
    webpUrl: { type: String, default: '' },
    thumbnailUrl: { type: String, default: '' },
    filename: { type: String, default: '' },
    originalName: { type: String, default: '' },
    caption: { type: String, default: '', trim: true },
    mimeType: { type: String, default: '' },
    size: { type: Number, default: 0 },
    width: { type: Number, default: 0 },
    height: { type: Number, default: 0 },
    displayOrder: { type: Number, default: 0, index: true },
  },
  { timestamps: true }
);

albumImageSchema.index({ album: 1, displayOrder: 1 });

export default mongoose.model('AlbumImage', albumImageSchema);
