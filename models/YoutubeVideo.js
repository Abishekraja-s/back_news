import mongoose from 'mongoose';

const youtubeVideoSchema = new mongoose.Schema(
  {
    channel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'YoutubeChannel',
      required: true,
      index: true,
    },
    videoId: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    thumbnail: { type: String, default: '' },
    youtubeUrl: { type: String, required: true, trim: true },
    publishedAt: { type: Date },
    displayOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    /** Manual add or admin-created — never auto-pruned */
    isManual: { type: Boolean, default: false },
    /** Preserve admin edits on sync */
    titleLocked: { type: Boolean, default: false },
    descriptionLocked: { type: Boolean, default: false },
    thumbnailLocked: { type: Boolean, default: false },
    metadata: {
      author: { type: String, default: '' },
      duration: { type: String, default: '' },
      viewCount: { type: String, default: '' },
      raw: { type: mongoose.Schema.Types.Mixed },
    },
  },
  { timestamps: true }
);

youtubeVideoSchema.index({ channel: 1, videoId: 1 }, { unique: true });
youtubeVideoSchema.index({ isActive: 1, displayOrder: 1, publishedAt: -1 });

export default mongoose.model('YoutubeVideo', youtubeVideoSchema);
