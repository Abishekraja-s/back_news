import mongoose from 'mongoose';

const astrologyPanchangSchema = new mongoose.Schema(
  {
    date: { type: String, required: true, unique: true, index: true },
    locationLabel: { type: String, default: 'Chennai, Tamil Nadu, India' },
    city: { type: String, default: 'Chennai' },
    state: { type: String, default: 'Tamil Nadu' },
    country: { type: String, default: 'India' },
    timezone: { type: String, default: 'Asia/Kolkata' },
    tithi: { type: String, default: '' },
    nakshatra: { type: String, default: '' },
    nakshatraTamil: { type: String, default: '' },
    nakshatraEnglish: { type: String, default: '' },
    yoga: { type: String, default: '' },
    karana: { type: String, default: '' },
    sunrise: { type: String, default: '' },
    sunset: { type: String, default: '' },
    moonrise: { type: String, default: '' },
    moonset: { type: String, default: '' },
    rahuKalam: { type: String, default: '' },
    yamagandam: { type: String, default: '' },
    kuligai: { type: String, default: '' },
    abhijitMuhurtham: { type: String, default: '' },
    tamilMonth: { type: String, default: '' },
    tamilYear: { type: String, default: '' },
    apiProvider: { type: String, default: '' },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    rawSnapshot: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

export default mongoose.model('AstrologyPanchang', astrologyPanchangSchema);
