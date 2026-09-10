import mongoose from 'mongoose';

const mediaSchema = new mongoose.Schema(
  {
    filename: { type: String, required: true },
    originalName: { type: String, required: true },
    url: { type: String, required: true },
    thumbnailUrl: { type: String, default: '' },
    webpUrl: { type: String, default: '' },
    alt: { type: String, default: '' },
    caption: { type: String, default: '' },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    width: { type: Number },
    height: { type: Number },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

mediaSchema.index({ originalName: 'text', alt: 'text' });

export default mongoose.model('Media', mediaSchema);
