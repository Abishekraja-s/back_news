import mongoose from 'mongoose';
import {
  MATRIMONY_PROFILE_STATUS,
  MATRIMONY_GENDERS,
  MATRIMONY_MARITAL_STATUSES,
} from '../config/constants.js';

const historySchema = new mongoose.Schema(
  {
    action: { type: String, required: true },
    note: { type: String, default: '' },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const matrimonyProfileSchema = new mongoose.Schema(
  {
    profileId: { type: String, required: true, unique: true, trim: true, uppercase: true, index: true },
    fullName: { type: String, required: true, trim: true },
    profilePhoto: { type: String, default: '' },
    photos: [{ type: String }],
    gender: { type: String, enum: MATRIMONY_GENDERS, required: true },
    dateOfBirth: { type: Date },
    age: { type: Number, min: 18, max: 100 },
    birthTime: { type: String, default: '' },
    birthPlace: { type: String, default: '' },
    nativePlace: { type: String, default: '' },
    currentLocation: { type: String, default: '' },
    maritalStatus: {
      type: String,
      enum: MATRIMONY_MARITAL_STATUSES,
      default: 'never_married',
    },
    motherTongue: { type: String, default: '' },

    religion: { type: String, default: '' },
    caste: { type: String, default: '' },
    subCaste: { type: String, default: '' },
    rasi: { type: String, default: '' },
    nakshatra: { type: String, default: '' },
    lagnam: { type: String, default: '' },
    gothram: { type: String, default: '' },
    birthStar: { type: String, default: '' },
    dosham: { type: String, default: '' },
    horoscopeUrl: { type: String, default: '' },

    height: { type: String, default: '' },
    weight: { type: String, default: '' },
    bodyType: { type: String, default: '' },
    complexion: { type: String, default: '' },
    physicalStatus: { type: String, default: 'normal' },
    bloodGroup: { type: String, default: '' },

    education: { type: String, default: '' },
    college: { type: String, default: '' },
    profession: { type: String, default: '' },
    company: { type: String, default: '' },
    jobLocation: { type: String, default: '' },
    annualIncome: { type: String, default: '' },
    workExperience: { type: String, default: '' },

    fatherName: { type: String, default: '' },
    fatherOccupation: { type: String, default: '' },
    motherName: { type: String, default: '' },
    motherOccupation: { type: String, default: '' },
    brotherName: { type: String, default: '' },
    brotherMaritalStatus: { type: String, default: '' },
    sisterName: { type: String, default: '' },
    sisterMaritalStatus: { type: String, default: '' },
    numberOfBrothers: { type: Number, default: 0 },
    numberOfSisters: { type: Number, default: 0 },
    familyType: { type: String, default: '' },
    familyStatus: { type: String, default: '' },
    familyLocation: { type: String, default: '' },

    address: { type: String, default: '' },
    city: { type: String, default: '' },
    district: { type: String, default: '' },
    state: { type: String, default: '' },
    country: { type: String, default: 'India' },
    mobile: { type: String, default: '' },
    alternateMobile: { type: String, default: '' },
    email: { type: String, default: '', lowercase: true, trim: true },
    preferredContactMethod: { type: String, default: 'mobile' },

    prefAgeMin: { type: Number },
    prefAgeMax: { type: Number },
    prefHeightMin: { type: String, default: '' },
    prefHeightMax: { type: String, default: '' },
    prefReligion: { type: String, default: '' },
    prefCaste: { type: String, default: '' },
    prefEducation: { type: String, default: '' },
    prefProfession: { type: String, default: '' },
    prefLocation: { type: String, default: '' },
    prefMaritalStatus: { type: String, default: '' },
    otherExpectations: { type: String, default: '' },

    aboutMe: { type: String, default: '' },
    hobbies: { type: String, default: '' },
    interests: { type: String, default: '' },
    foodHabits: { type: String, default: '' },
    smoking: { type: String, default: 'no' },
    drinking: { type: String, default: 'no' },
    languagesKnown: { type: String, default: '' },

    category: { type: mongoose.Schema.Types.ObjectId, ref: 'MatrimonyCategory', default: null },
    categoryName: { type: String, default: '' },

    status: {
      type: String,
      enum: Object.values(MATRIMONY_PROFILE_STATUS),
      default: MATRIMONY_PROFILE_STATUS.PENDING,
      index: true,
    },
    isActive: { type: Boolean, default: true, index: true },
    isVerified: { type: Boolean, default: false, index: true },
    isFeatured: { type: Boolean, default: false, index: true },
    isVisible: { type: Boolean, default: true },
    rejectionReason: { type: String, default: '' },
    adminNotes: { type: String, default: '' },
    /** Admin-only copy for edit screen (login still uses bcrypt on User) */
    memberLoginPasswordPlain: { type: String, default: '', select: false },
    approvedAt: Date,
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rejectedAt: Date,
    verifiedAt: Date,
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    featuredAt: Date,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    history: [historySchema],
    submissionHash: { type: String, default: '', index: true },
  },
  { timestamps: true }
);

matrimonyProfileSchema.index({ createdBy: 1 });
matrimonyProfileSchema.index({ status: 1, isActive: 1, isVisible: 1, createdAt: -1 });
matrimonyProfileSchema.index({ isFeatured: 1, status: 1 });
matrimonyProfileSchema.index({ isVerified: 1, status: 1 });
matrimonyProfileSchema.index({
  fullName: 'text',
  profileId: 'text',
  religion: 'text',
  caste: 'text',
  education: 'text',
  profession: 'text',
  city: 'text',
  currentLocation: 'text',
});

matrimonyProfileSchema.pre('validate', function calcAge(next) {
  if (this.dateOfBirth) {
    const dob = new Date(this.dateOfBirth);
    if (!Number.isNaN(dob.getTime())) {
      const today = new Date();
      let age = today.getFullYear() - dob.getFullYear();
      const m = today.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age -= 1;
      this.age = age;
    }
  }
  next();
});

export default mongoose.model('MatrimonyProfile', matrimonyProfileSchema);
