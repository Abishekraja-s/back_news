import mongoose from 'mongoose';
import { ARTICLE_STATUS } from '../config/constants.js';

const liveUpdateSchema = new mongoose.Schema({
  time: { type: String, required: true },
  updateText: { type: String, required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'Author' },
  createdAt: { type: Date, default: Date.now },
});

const articleSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    excerpt: { type: String, default: '' },
    content: { type: String, required: true },
    featuredImage: { type: String, default: '' },
    imageAlt: { type: String, default: '' },
    imageCaption: { type: String, default: '' },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    subCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    district: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'Author', required: true },
    tags: [{ type: String, trim: true }],
    status: {
      type: String,
      enum: Object.values(ARTICLE_STATUS),
      default: ARTICLE_STATUS.DRAFT,
    },
    publishedAt: { type: Date },
    scheduledAt: { type: Date },
    seoTitle: { type: String, default: '' },
    metaDescription: { type: String, default: '' },
    focusKeyword: { type: String, default: '' },
    secondaryKeywords: [{ type: String, trim: true }],
    canonicalUrl: { type: String, default: '' },
    ogTitle: { type: String, default: '' },
    ogDescription: { type: String, default: '' },
    ogImage: { type: String, default: '' },
    twitterTitle: { type: String, default: '' },
    twitterDescription: { type: String, default: '' },
    twitterImage: { type: String, default: '' },
    directAnswer: { type: String, default: '' },
    aiSummary: { type: String, default: '' },
    entities: [{ type: String, trim: true }],
    aeoHeadings: [{ type: String, trim: true }],
    internalLinks: [{ label: { type: String, default: '' }, url: { type: String, default: '' } }],
    faqs: [{ question: { type: String, required: true }, answer: { type: String, required: true } }],
    includeFaqSchema: { type: Boolean, default: true },
    customJsonLd: { type: String, default: '' },
    robots: { type: String, default: 'index,follow' },
    aeoScore: { type: Number, default: 0 },
    aeoSuggestions: [{ type: String }],
    aeoScoredAt: { type: Date },
    views: { type: Number, default: 0 },
    isFeatured: { type: Boolean, default: false },
    isBreaking: { type: Boolean, default: false },
    isLive: { type: Boolean, default: false },
    isMustWatch: { type: Boolean, default: false },
    audioReader: { type: String, default: '' },
    youtubeVideoLink: { type: String, default: '' },
    liveUpdates: [liveUpdateSchema],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

articleSchema.index({ status: 1, publishedAt: -1 });
articleSchema.index({ category: 1, status: 1, publishedAt: -1 });
articleSchema.index({ author: 1 });
articleSchema.index({ tags: 1 });
articleSchema.index({ views: -1 });
articleSchema.index({ isFeatured: 1, status: 1 });
articleSchema.index({ isMustWatch: 1, status: 1, publishedAt: -1 });
articleSchema.index(
  { title: 'text', excerpt: 'text', content: 'text', tags: 'text' },
  { weights: { title: 10, excerpt: 5, tags: 3, content: 1 } }
);

export default mongoose.model('Article', articleSchema);
