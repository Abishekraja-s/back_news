import mongoose from 'mongoose';
import slugify from 'slugify';

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    nameTamil: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    description: { type: String, default: '' },
    image: { type: String, default: '' },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    isDistrict: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    seoTitle: { type: String, default: '' },
    metaDescription: { type: String, default: '' },
    focusKeyword: { type: String, default: '' },
  },
  { timestamps: true }
);

categorySchema.index({ status: 1, order: 1 });

export default mongoose.model('Category', categorySchema);
