import mongoose from 'mongoose';

const matrimonyRegistrationOtpSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    name: { type: String, required: true, trim: true },
    password: { type: String, required: true, select: false },
    phone: { type: String, default: '', trim: true },
    city: { type: String, default: '', trim: true },
    profile: { type: mongoose.Schema.Types.Mixed, default: {} },
    otpHash: { type: String, required: true, select: false },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: true }
);

matrimonyRegistrationOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('MatrimonyRegistrationOtp', matrimonyRegistrationOtpSchema);
