import mongoose from 'mongoose';
import { AD_POSITIONS } from '../config/constants.js';

const advertisementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    position: { type: String, enum: AD_POSITIONS, required: true },
    type: { type: String, enum: ['image', 'code'], default: 'image' },
    image: { type: String, default: '' },
    link: { type: String, default: '' },
    code: { type: String, default: '' },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date },
    isActive: { type: Boolean, default: true },
    priority: { type: Number, default: 0 },
  },
  { timestamps: true }
);

advertisementSchema.index({ position: 1, isActive: 1, priority: -1 });

export default mongoose.model('Advertisement', advertisementSchema);
