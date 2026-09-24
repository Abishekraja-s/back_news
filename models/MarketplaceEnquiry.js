import mongoose from 'mongoose';
import { MARKETPLACE_ENQUIRY_STATUS } from '../config/constants.js';

const marketplaceEnquirySchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'MarketplaceProduct', required: true, index: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    buyerName: { type: String, required: true, trim: true },
    buyerEmail: { type: String, required: true, trim: true, lowercase: true },
    buyerPhone: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: Object.values(MARKETPLACE_ENQUIRY_STATUS),
      default: MARKETPLACE_ENQUIRY_STATUS.NEW,
      index: true,
    },
    sellerNotes: { type: String, default: '' },
  },
  { timestamps: true }
);

marketplaceEnquirySchema.index({ seller: 1, createdAt: -1 });

export default mongoose.model('MarketplaceEnquiry', marketplaceEnquirySchema);
