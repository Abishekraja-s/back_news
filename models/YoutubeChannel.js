import mongoose from 'mongoose';

/**
 * Scalable channel config — supports multiple channels later.
 */
const youtubeChannelSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'primary', unique: true, trim: true },
    name: { type: String, default: 'Primary Channel', trim: true },
    channelUrl: { type: String, default: '', trim: true },
    channelId: { type: String, default: '', trim: true, index: true },
    channelTitle: { type: String, default: '' },
    channelHandle: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    autoFetchEnabled: { type: Boolean, default: true },
    maxVideos: { type: Number, default: 15, min: 1, max: 50 },
    sliderEnabled: { type: Boolean, default: true },
    sliderTitle: { type: String, default: 'YouTube' },
    sliderTitleTamil: { type: String, default: 'யூடியூப்' },
    lastFetchAt: { type: Date },
    lastFetchStatus: {
      type: String,
      enum: ['idle', 'success', 'error', 'running'],
      default: 'idle',
    },
    lastFetchMessage: { type: String, default: '' },
    lastFetchCount: { type: Number, default: 0 },
    fetchIntervalMinutes: { type: Number, default: 60 },
  },
  { timestamps: true }
);

export default mongoose.model('YoutubeChannel', youtubeChannelSchema);
