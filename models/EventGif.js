import mongoose from 'mongoose';

const eventGifSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    gifUrl: { type: String, required: true, trim: true },
    eventUrl: { type: String, default: '', trim: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
    displayOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

eventGifSchema.index({ isActive: 1, startDate: 1, endDate: 1, displayOrder: 1 });

export default mongoose.model('EventGif', eventGifSchema);
