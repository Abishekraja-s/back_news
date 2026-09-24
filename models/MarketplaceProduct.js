import mongoose from 'mongoose';
import { MARKETPLACE_PRODUCT_STATUS } from '../config/constants.js';

const marketplaceProductSchema = new mongoose.Schema(
  {
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    price: { type: Number, required: true, min: 0 },
    location: { type: String, default: '', trim: true },
    image: { type: String, default: '' },
    images: [{ type: String }],
    category: { type: String, default: 'Electronics', trim: true },
    condition: {
      type: String,
      enum: ['new', 'like_new', 'good', 'fair', 'used'],
      default: 'used',
    },
    status: {
      type: String,
      enum: Object.values(MARKETPLACE_PRODUCT_STATUS),
      default: MARKETPLACE_PRODUCT_STATUS.APPROVED,
      index: true,
    },
    rejectionReason: { type: String, default: '' },
    approvedAt: Date,
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

marketplaceProductSchema.index({ status: 1, createdAt: -1 });
marketplaceProductSchema.index({ title: 'text', description: 'text', location: 'text' });

export default mongoose.model('MarketplaceProduct', marketplaceProductSchema);
