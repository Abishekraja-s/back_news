import mongoose from 'mongoose';

const newsletterSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    status: { type: String, enum: ['active', 'unsubscribed'], default: 'active' },
  },
  { timestamps: true }
);

export default mongoose.model('Newsletter', newsletterSchema);
