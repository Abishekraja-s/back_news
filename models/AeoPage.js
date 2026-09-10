import mongoose from 'mongoose';
import { AEO_PAGE_TYPES, AEO_PAGE_STATUS } from '../config/aeoDefaults.js';

const aeoPageSchema = new mongoose.Schema(
  {
    path: { type: String, required: true, trim: true, unique: true },
    title: { type: String, default: '', trim: true },
    pageType: { type: String, enum: AEO_PAGE_TYPES, default: 'custom' },
    metaTitle: { type: String, default: '' },
    metaDescription: { type: String, default: '' },
    focusKeyword: { type: String, default: '' },
    secondaryKeywords: [{ type: String }],
    canonicalUrl: { type: String, default: '' },
    ogTitle: { type: String, default: '' },
    ogDescription: { type: String, default: '' },
    ogImage: { type: String, default: '' },
    h1: { type: String, default: '' },
    headings: [{ type: String }],
    directAnswer: { type: String, default: '' },
    aiSummary: { type: String, default: '' },
    entities: [{ type: String }],
    internalLinks: [{ label: String, url: String }],
    faqIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'AeoFaq' }],
    schemaTypes: [{ type: String }],
    customJsonLd: { type: String, default: '' },
    robots: { type: String, default: 'index,follow' },
    status: { type: String, enum: AEO_PAGE_STATUS, default: 'draft' },
    score: { type: Number, default: 0 },
    suggestions: [{ type: String }],
    lastScoredAt: Date,
    notes: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    generatedByGemini: { type: Boolean, default: false },
    lastGeminiAt: Date,
  },
  { timestamps: true }
);

aeoPageSchema.index({ pageType: 1, status: 1 });
aeoPageSchema.index({ score: -1 });

export default mongoose.model('AeoPage', aeoPageSchema);
