import mongoose from 'mongoose';
import { COMMENT_STATUS } from '../config/constants.js';

const commentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    content: { type: String, required: true, trim: true },
    article: { type: mongoose.Schema.Types.ObjectId, ref: 'Article', required: true },
    status: {
      type: String,
      enum: Object.values(COMMENT_STATUS),
      default: COMMENT_STATUS.PENDING,
    },
  },
  { timestamps: true }
);

commentSchema.index({ article: 1, status: 1 });

export default mongoose.model('Comment', commentSchema);
