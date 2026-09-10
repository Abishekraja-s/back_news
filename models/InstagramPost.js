import mongoose from 'mongoose';

const MEDIA_TYPES = ['IMAGE', 'VIDEO', 'CAROUSEL_ALBUM', 'REEL', 'UNKNOWN'];

const instagramPostSchema = new mongoose.Schema(
  {
    shortcode: { type: String, required: true, unique: true, trim: true, index: true },
    instagramUrl: { type: String, required: true, trim: true },
    /** Website fields (editable) */
    title: { type: String, default: '', trim: true },
    description: { type: String, default: '' },
    caption: { type: String, default: '' },
    category: { type: String, default: '', trim: true },
    image: { type: String, default: '' },
    thumbnailUrl: { type: String, default: '' },
    mediaUrl: { type: String, default: '' },
    mediaType: { type: String, enum: MEDIA_TYPES, default: 'UNKNOWN' },
    carouselImages: [{ type: String }],
    embedHtml: { type: String, default: '' },
    authorName: { type: String, default: '' },
    authorUrl: { type: String, default: '' },
    publishedAt: { type: Date },
    displayOrder: { type: Number, default: 0, index: true },
    status: {
      type: String,
      enum: ['draft', 'published', 'inactive'],
      default: 'draft',
      index: true,
    },
    isActive: { type: Boolean, default: true },
    /** Meta / sync metadata */
    graphMediaId: { type: String, default: '' },
    lastSyncAt: { type: Date },
    lastSyncStatus: {
      type: String,
      enum: ['idle', 'success', 'error', 'unavailable'],
      default: 'idle',
    },
    lastSyncMessage: { type: String, default: '' },
    rawPayload: { type: mongoose.Schema.Types.Mixed },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

instagramPostSchema.index({ status: 1, isActive: 1, displayOrder: 1, publishedAt: -1 });

export default mongoose.model('InstagramPost', instagramPostSchema);
