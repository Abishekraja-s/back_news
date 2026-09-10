import mongoose from 'mongoose';
import { DEFAULT_AEO_CONFIG } from '../config/aeoDefaults.js';

const aeoConfigSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'global', unique: true },
    config: { type: mongoose.Schema.Types.Mixed, default: () => ({ ...DEFAULT_AEO_CONFIG }) },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export default mongoose.model('AeoConfig', aeoConfigSchema);
