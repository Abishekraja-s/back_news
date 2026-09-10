import mongoose from 'mongoose';

const authorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    profileImage: { type: String, default: '' },
    bio: { type: String, default: '' },
    designation: { type: String, default: 'Reporter' },
    socialLinks: {
      twitter: { type: String, default: '' },
      facebook: { type: String, default: '' },
      instagram: { type: String, default: '' },
      linkedin: { type: String, default: '' },
    },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  },
  { timestamps: true }
);

authorSchema.index({ status: 1 });

export default mongoose.model('Author', authorSchema);
