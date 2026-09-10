import mongoose from 'mongoose';
import { MARKETPLACE_ENQUIRY_STATUS } from '../config/constants.js';

const matrimonyEnquirySchema = new mongoose.Schema(
  {
    profile: { type: mongoose.Schema.Types.ObjectId, ref: 'MatrimonyProfile', required: true, index: true },
    profileOwner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    enquirerName: { type: String, required: true, trim: true },
    enquirerPhone: { type: String, required: true, trim: true },
    comment: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: Object.values(MARKETPLACE_ENQUIRY_STATUS),
      default: MARKETPLACE_ENQUIRY_STATUS.NEW,
      index: true,
    },
  },
  { timestamps: true }
);

matrimonyEnquirySchema.index({ profileOwner: 1, createdAt: -1 });
matrimonyEnquirySchema.index({ submittedBy: 1, createdAt: -1 });

export default mongoose.model('MatrimonyEnquiry', matrimonyEnquirySchema);
