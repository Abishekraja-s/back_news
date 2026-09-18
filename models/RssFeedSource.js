import mongoose from 'mongoose';
import { ARTICLE_STATUS } from '../config/constants.js';

const rssFeedSourceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    feedUrl: { type: String, required: true, trim: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'Author', required: true },
    tags: [{ type: String, trim: true }],
    enabled: { type: Boolean, default: true },
    autoFetchEnabled: { type: Boolean, default: false },
    fetchIntervalMinutes: { type: Number, default: 60, min: 15, max: 1440 },
    /** Pull full article text from the publisher page (not only RSS summary) */
    fetchFullContent: { type: Boolean, default: true },
    /** Translate title/excerpt/content to Tamil via Gemini */
    translateToTamil: { type: Boolean, default: true },
    /** New items are created as DRAFT unless set to PUBLISHED */
    createAsStatus: {
      type: String,
      enum: [ARTICLE_STATUS.DRAFT, ARTICLE_STATUS.PENDING, ARTICLE_STATUS.PUBLISHED],
      default: ARTICLE_STATUS.DRAFT,
    },
    maxItemsPerFetch: { type: Number, default: 20, min: 1, max: 50 },
    lastFetchAt: { type: Date },
    lastFetchStatus: { type: String, default: '', enum: ['', 'success', 'error', 'skipped'] },
    lastFetchMessage: { type: String, default: '' },
    lastFetchCounts: {
      fetched: { type: Number, default: 0 },
      created: { type: Number, default: 0 },
      skipped: { type: Number, default: 0 },
      errors: { type: Number, default: 0 },
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

rssFeedSourceSchema.index({ feedUrl: 1 }, { unique: true });
rssFeedSourceSchema.index({ enabled: 1, autoFetchEnabled: 1 });

export default mongoose.model('RssFeedSource', rssFeedSourceSchema);
