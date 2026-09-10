import mongoose from 'mongoose';

const pageContentSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    title: { type: String, required: true, trim: true },
    content: { type: mongoose.Schema.Types.Mixed, required: true },
    isPublished: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model('PageContent', pageContentSchema);
