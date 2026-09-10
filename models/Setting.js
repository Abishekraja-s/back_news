import mongoose from 'mongoose';

const settingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: mongoose.Schema.Types.Mixed, default: '' },
    group: { type: String, default: 'general' },
  },
  { timestamps: true }
);

export default mongoose.model('Setting', settingSchema);
