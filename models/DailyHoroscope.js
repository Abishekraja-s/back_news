import mongoose from 'mongoose';

const dailyHoroscopeSchema = new mongoose.Schema(
  {
    date: { type: String, required: true, index: true }, // YYYY-MM-DD (Asia/Kolkata calendar date)
    rasi: { type: String, required: true, index: true }, // slug e.g. mesham
    rasiTamil: { type: String, default: '' },
    rasiEnglish: { type: String, default: '' },
    prediction: { type: String, default: '' },
    predictionTamil: { type: String, default: '' },
    career: { type: String, default: '' },
    careerTamil: { type: String, default: '' },
    business: { type: String, default: '' },
    businessTamil: { type: String, default: '' },
    finance: { type: String, default: '' },
    financeTamil: { type: String, default: '' },
    love: { type: String, default: '' },
    loveTamil: { type: String, default: '' },
    family: { type: String, default: '' },
    familyTamil: { type: String, default: '' },
    health: { type: String, default: '' },
    healthTamil: { type: String, default: '' },
    education: { type: String, default: '' },
    educationTamil: { type: String, default: '' },
    luckyNumber: { type: String, default: '' },
    luckyColor: { type: String, default: '' },
    luckyColorTamil: { type: String, default: '' },
    luckyTime: { type: String, default: '' },
    advice: { type: String, default: '' },
    adviceTamil: { type: String, default: '' },
    compatibility: { type: String, default: '' },
    compatibilityTamil: { type: String, default: '' },
    nakshatra: { type: String, default: '' },
    nakshatraTamil: { type: String, default: '' },
    nakshatraEnglish: { type: String, default: '' },
    apiProvider: { type: String, default: '' },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true,
    },
    rawSnapshot: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

dailyHoroscopeSchema.index({ date: 1, rasi: 1 }, { unique: true });

export default mongoose.model('DailyHoroscope', dailyHoroscopeSchema);
