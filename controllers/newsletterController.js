import Newsletter from '../models/Newsletter.js';

export const subscribe = async (req, res, next) => {
  try {
    const { email } = req.body;
    const existing = await Newsletter.findOne({ email });

    if (existing) {
      if (existing.status === 'unsubscribed') {
        existing.status = 'active';
        await existing.save();
        return res.json({ success: true, message: 'Resubscribed successfully' });
      }
      return res.status(400).json({ success: false, message: 'Email already subscribed' });
    }

    await Newsletter.create({ email });
    res.status(201).json({ success: true, message: 'Subscribed successfully' });
  } catch (error) {
    next(error);
  }
};

export const getSubscribers = async (req, res, next) => {
  try {
    const subscribers = await Newsletter.find({ status: 'active' }).sort({ createdAt: -1 });
    res.json({ success: true, data: subscribers });
  } catch (error) {
    next(error);
  }
};
