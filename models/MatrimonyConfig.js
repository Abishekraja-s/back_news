import mongoose from 'mongoose';

const matrimonyConfigSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'default', unique: true },
    enabled: { type: Boolean, default: true },
    homepageTitle: { type: String, default: 'Matrimony Profiles' },
    homepageTitleTa: { type: String, default: 'திருமண சுயவிவரங்கள்' },
    showOnExplore: { type: Boolean, default: true },
    /** Public contact visibility */
    showMobilePublic: { type: Boolean, default: false },
    showEmailPublic: { type: Boolean, default: false },
    showAddressPublic: { type: Boolean, default: false },
    showAlternateMobilePublic: { type: Boolean, default: false },
    requireApproval: { type: Boolean, default: true },
    autoGenerateProfileId: { type: Boolean, default: true },
    profileIdPrefix: { type: String, default: 'GIN-M' },
    allowHoroscopeDownload: { type: Boolean, default: false },
    maxProfilesPerPage: { type: Number, default: 18 },
  },
  { timestamps: true }
);

export default mongoose.model('MatrimonyConfig', matrimonyConfigSchema);
