import mongoose from 'mongoose';

const STATUSES = ['pending', 'published', 'rejected', 'draft'];

const googleNewsItemSchema = new mongoose.Schema(
  {
    guid: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    title: { type: String, required: true, trim: true },
    link: { type: String, required: true, trim: true, index: true },
    sourceName: { type: String, default: '', trim: true, index: true },
    sourceUrl: { type: String, default: '', trim: true },
    /** Full plain-text summary from RSS — never truncated in DB */
    description: { type: String, default: '' },
    /** Optional raw HTML from RSS for reference */
    descriptionHtml: { type: String, default: '' },
    /** Full available content from RSS (same as description when no separate body) */
    content: { type: String, default: '' },
    excerpt: { type: String, default: '' },
    /** Original image URL from source/API — empty if unavailable (no placeholder in DB) */
    image: { type: String, default: '' },
    category: { type: String, default: '', trim: true, index: true },
    keywords: [{ type: String, trim: true }],
    language: { type: String, default: 'en' },
    country: { type: String, default: 'IN' },
    publishedAt: { type: Date, index: true },
    fetchedAt: { type: Date, default: Date.now },
    status: { type: String, enum: STATUSES, default: 'pending', index: true },
    isActive: { type: Boolean, default: true },
    isMustRead: { type: Boolean, default: false },
    isMustWatch: { type: Boolean, default: false },
    displayOrder: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    adminEdited: { type: Boolean, default: false },
    notes: { type: String, default: '' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
  },
  { timestamps: true }
);

googleNewsItemSchema.index({ link: 1 });
googleNewsItemSchema.index({ status: 1, publishedAt: -1 });
googleNewsItemSchema.index({ status: 1, category: 1, publishedAt: -1 });
googleNewsItemSchema.index({ status: 1, sourceName: 1, publishedAt: -1 });
googleNewsItemSchema.index({ isActive: 1, status: 1, displayOrder: 1 });
googleNewsItemSchema.index({ title: 'text', description: 'text', sourceName: 'text', excerpt: 'text', content: 'text' });

export default mongoose.model('GoogleNewsItem', googleNewsItemSchema);
