import mongoose from 'mongoose';

const tagSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    count: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model('Tag', tagSchema);
