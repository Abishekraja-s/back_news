import EventGif from '../models/EventGif.js';

const dayStart = (value) => {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
};

const dayEnd = (value) => {
  const d = new Date(value);
  d.setHours(23, 59, 59, 999);
  return d;
};

const parseDateInput = (value, end = false) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return end ? dayEnd(d) : dayStart(d);
};

/** Public: current active event GIF (if any) */
export const getActiveEventGif = async (req, res, next) => {
  try {
    const now = new Date();
    const event = await EventGif.findOne({
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
    })
      .sort({ displayOrder: 1, createdAt: -1 })
      .lean();

    res.json({ success: true, data: event || null });
  } catch (error) {
    next(error);
  }
};

export const getAllEventGifs = async (req, res, next) => {
  try {
    const events = await EventGif.find().sort({ displayOrder: 1, createdAt: -1 });
    res.json({ success: true, data: events });
  } catch (error) {
    next(error);
  }
};

export const createEventGif = async (req, res, next) => {
  try {
    const { title, gifUrl, eventUrl, startDate, endDate, isActive, displayOrder } = req.body;
    if (!title?.trim()) {
      return res.status(400).json({ success: false, message: 'Event title is required' });
    }
    if (!gifUrl?.trim()) {
      return res.status(400).json({ success: false, message: 'GIF upload / URL is required' });
    }
    const start = parseDateInput(startDate, false);
    const end = parseDateInput(endDate, true);
    if (!start || !end) {
      return res.status(400).json({ success: false, message: 'Valid start and end dates are required' });
    }
    if (end < start) {
      return res.status(400).json({ success: false, message: 'End date must be on or after start date' });
    }

    const event = await EventGif.create({
      title: title.trim(),
      gifUrl: gifUrl.trim(),
      eventUrl: eventUrl?.trim() || '',
      startDate: start,
      endDate: end,
      isActive: isActive !== false,
      displayOrder: Number(displayOrder) || 0,
    });

    res.status(201).json({ success: true, data: event, message: 'Event GIF created' });
  } catch (error) {
    next(error);
  }
};

export const updateEventGif = async (req, res, next) => {
  try {
    const allowed = ['title', 'gifUrl', 'eventUrl', 'startDate', 'endDate', 'isActive', 'displayOrder'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    if (updates.title != null) {
      updates.title = String(updates.title).trim();
      if (!updates.title) {
        return res.status(400).json({ success: false, message: 'Event title is required' });
      }
    }
    if (updates.gifUrl != null) {
      updates.gifUrl = String(updates.gifUrl).trim();
      if (!updates.gifUrl) {
        return res.status(400).json({ success: false, message: 'GIF URL is required' });
      }
    }
    if (updates.eventUrl != null) updates.eventUrl = String(updates.eventUrl).trim();
    if (updates.displayOrder != null) updates.displayOrder = Number(updates.displayOrder) || 0;
    if (updates.startDate != null) {
      const start = parseDateInput(updates.startDate, false);
      if (!start) return res.status(400).json({ success: false, message: 'Invalid start date' });
      updates.startDate = start;
    }
    if (updates.endDate != null) {
      const end = parseDateInput(updates.endDate, true);
      if (!end) return res.status(400).json({ success: false, message: 'Invalid end date' });
      updates.endDate = end;
    }

    const existing = await EventGif.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Event GIF not found' });
    }

    const start = updates.startDate || existing.startDate;
    const end = updates.endDate || existing.endDate;
    if (end < start) {
      return res.status(400).json({ success: false, message: 'End date must be on or after start date' });
    }

    Object.assign(existing, updates);
    await existing.save();

    res.json({ success: true, data: existing, message: 'Event GIF updated' });
  } catch (error) {
    next(error);
  }
};

export const deleteEventGif = async (req, res, next) => {
  try {
    const event = await EventGif.findByIdAndDelete(req.params.id);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event GIF not found' });
    }
    res.json({ success: true, message: 'Event GIF deleted' });
  } catch (error) {
    next(error);
  }
};
