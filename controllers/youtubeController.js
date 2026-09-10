import YoutubeChannel from '../models/YoutubeChannel.js';
import YoutubeVideo from '../models/YoutubeVideo.js';
import {
  resolveChannelId,
  fetchChannelVideos,
  extractVideoId,
  buildWatchUrl,
  thumbnailFor,
} from '../services/youtubeFetchService.js';

const getOrCreatePrimary = async () => {
  let ch = await YoutubeChannel.findOne({ key: 'primary' });
  if (!ch) {
    ch = await YoutubeChannel.create({ key: 'primary', name: 'Primary Channel' });
  }
  return ch;
};

/** Sync one channel: upsert feed videos, preserve locks, prune excess auto videos */
export const syncChannel = async (channel, { triggeredBy = 'cron' } = {}) => {
  channel.lastFetchStatus = 'running';
  channel.lastFetchMessage = `Sync started (${triggeredBy})…`;
  await channel.save();

  try {
    if (!channel.channelUrl && !channel.channelId) {
      throw Object.assign(new Error('Configure a YouTube channel URL first'), { statusCode: 400 });
    }

    if (!channel.channelId) {
      const resolved = await resolveChannelId(channel.channelUrl || channel.channelId);
      channel.channelId = resolved.channelId;
      if (resolved.channelHandle) channel.channelHandle = resolved.channelHandle;
    }

    const max = channel.maxVideos || 15;
    const { channelTitle, videos } = await fetchChannelVideos(channel.channelId, max);
    if (channelTitle) channel.channelTitle = channelTitle;

    let upserted = 0;
    let created = 0;

    // Assign displayOrder from feed rank so newest = 0,1,2…
    for (let i = 0; i < videos.length; i += 1) {
      const item = videos[i];
      const existing = await YoutubeVideo.findOne({ channel: channel._id, videoId: item.videoId });
      if (existing) {
        if (!existing.titleLocked) existing.title = item.title;
        if (!existing.descriptionLocked) existing.description = item.description;
        if (!existing.thumbnailLocked) existing.thumbnail = item.thumbnail || existing.thumbnail;
        existing.youtubeUrl = item.youtubeUrl;
        existing.publishedAt = item.publishedAt;
        existing.displayOrder = i;
        existing.isActive = true;
        existing.metadata = { ...(existing.metadata?.toObject?.() || existing.metadata || {}), ...item.metadata };
        await existing.save();
        upserted += 1;
      } else {
        await YoutubeVideo.create({
          channel: channel._id,
          videoId: item.videoId,
          title: item.title,
          description: item.description,
          thumbnail: item.thumbnail,
          youtubeUrl: item.youtubeUrl,
          publishedAt: item.publishedAt,
          displayOrder: i,
          isActive: true,
          isManual: false,
          metadata: item.metadata,
        });
        created += 1;
        upserted += 1;
      }
    }

    // Prune auto-fetched videos not in latest feed (keep manual)
    const keepIds = videos.map((v) => v.videoId);
    const autoVideos = await YoutubeVideo.find({ channel: channel._id, isManual: false }).sort({
      publishedAt: -1,
    });

    let pruned = 0;
    for (const v of autoVideos) {
      const inFeed = keepIds.includes(v.videoId);
      const rank = keepIds.indexOf(v.videoId);
      if (!inFeed || rank >= max) {
        await v.deleteOne();
        pruned += 1;
      }
    }

    // Cap: if still more than max auto videos, delete oldest auto
    const autoCount = await YoutubeVideo.countDocuments({ channel: channel._id, isManual: false });
    if (autoCount > max) {
      const excess = await YoutubeVideo.find({ channel: channel._id, isManual: false })
        .sort({ publishedAt: 1 })
        .limit(autoCount - max);
      for (const v of excess) {
        await v.deleteOne();
        pruned += 1;
      }
    }

    channel.lastFetchAt = new Date();
    channel.lastFetchStatus = 'success';
    channel.lastFetchCount = created;
    channel.lastFetchMessage = `OK — ${created} new, ${upserted - created} updated, ${pruned} pruned (${triggeredBy})`;
    await channel.save();

    return {
      success: true,
      created,
      updated: upserted - created,
      pruned,
      totalFetched: videos.length,
      channel,
    };
  } catch (error) {
    channel.lastFetchStatus = 'error';
    channel.lastFetchMessage = error.message || 'Fetch failed';
    channel.lastFetchAt = new Date();
    await channel.save().catch(() => {});
    throw error;
  }
};

export const syncAllActiveChannels = async (triggeredBy = 'cron') => {
  const channels = await YoutubeChannel.find({ isActive: true, autoFetchEnabled: true });
  const results = [];
  for (const ch of channels) {
    if (!ch.channelUrl && !ch.channelId) continue;
    try {
      results.push({ key: ch.key, ...(await syncChannel(ch, { triggeredBy })) });
    } catch (err) {
      results.push({ key: ch.key, success: false, error: err.message });
    }
  }
  return results;
};

// ─── Controllers ────────────────────────────────────────

export const getPublicSlider = async (req, res, next) => {
  try {
    const channel = await YoutubeChannel.findOne({ key: 'primary', isActive: true, sliderEnabled: true }).lean();
    if (!channel) {
      return res.json({ success: true, data: { channel: null, videos: [] } });
    }

    const videos = await YoutubeVideo.find({ channel: channel._id, isActive: true })
      .sort({ publishedAt: -1, displayOrder: 1 })
      .limit(channel.maxVideos || 15)
      .lean();

    res.json({
      success: true,
      data: {
        channel: {
          name: channel.name,
          sliderTitle: channel.sliderTitle,
          sliderTitleTamil: channel.sliderTitleTamil,
          channelUrl: channel.channelUrl,
          channelTitle: channel.channelTitle,
        },
        videos,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminOverview = async (req, res, next) => {
  try {
    const channel = await getOrCreatePrimary();
    const videos = await YoutubeVideo.find({ channel: channel._id })
      .sort({ publishedAt: -1, displayOrder: 1 })
      .lean();
    res.json({ success: true, data: { channel, videos } });
  } catch (error) {
    next(error);
  }
};

export const updateChannelSettings = async (req, res, next) => {
  try {
    const channel = await getOrCreatePrimary();
    const {
      channelUrl,
      name,
      isActive,
      autoFetchEnabled,
      maxVideos,
      sliderEnabled,
      sliderTitle,
      sliderTitleTamil,
    } = req.body;

    if (typeof channelUrl === 'string' && channelUrl.trim() && channelUrl.trim() !== channel.channelUrl) {
      channel.channelUrl = channelUrl.trim();
      try {
        const resolved = await resolveChannelId(channel.channelUrl);
        channel.channelId = resolved.channelId;
        channel.channelHandle = resolved.channelHandle || channel.channelHandle;
      } catch (err) {
        return res.status(err.statusCode || 400).json({ success: false, message: err.message });
      }
    }

    if (name != null) channel.name = name;
    if (typeof isActive === 'boolean') channel.isActive = isActive;
    if (typeof autoFetchEnabled === 'boolean') channel.autoFetchEnabled = autoFetchEnabled;
    if (typeof sliderEnabled === 'boolean') channel.sliderEnabled = sliderEnabled;
    if (maxVideos != null) channel.maxVideos = Math.min(50, Math.max(1, Number(maxVideos) || 15));
    if (sliderTitle != null) channel.sliderTitle = sliderTitle;
    if (sliderTitleTamil != null) channel.sliderTitleTamil = sliderTitleTamil;

    await channel.save();

    // Auto-fetch latest videos after saving channel URL / settings
    let syncResult = null;
    if (req.body.syncNow !== false && (channel.channelUrl || channel.channelId)) {
      try {
        syncResult = await syncChannel(channel, { triggeredBy: 'save' });
      } catch (syncErr) {
        return res.json({
          success: true,
          data: channel,
          message: `Settings saved, but sync failed: ${syncErr.message}`,
          syncError: syncErr.message,
        });
      }
    }

    const videos = await YoutubeVideo.find({ channel: channel._id })
      .sort({ publishedAt: -1, displayOrder: 1 })
      .lean();

    res.json({
      success: true,
      data: syncResult?.channel || channel,
      videos,
      message: syncResult
        ? `Saved & synced — ${syncResult.created} new, ${syncResult.updated} updated`
        : 'Channel settings saved',
    });
  } catch (error) {
    next(error);
  }
};

export const syncNow = async (req, res, next) => {
  try {
    const channel = await getOrCreatePrimary();
    const result = await syncChannel(channel, { triggeredBy: 'manual' });
    const videos = await YoutubeVideo.find({ channel: channel._id })
      .sort({ publishedAt: -1, displayOrder: 1 })
      .lean();
    res.json({
      success: true,
      data: { ...result, videos, channel: result.channel },
      message: result.channel.lastFetchMessage,
    });
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({
      success: false,
      message: error.message || 'Sync failed',
      data: { channel: await YoutubeChannel.findOne({ key: 'primary' }) },
    });
  }
};

export const listVideos = async (req, res, next) => {
  try {
    const channel = await getOrCreatePrimary();
    const videos = await YoutubeVideo.find({ channel: channel._id })
      .sort({ publishedAt: -1, displayOrder: 1 })
      .lean();
    res.json({ success: true, data: videos });
  } catch (error) {
    next(error);
  }
};

export const createVideo = async (req, res, next) => {
  try {
    const channel = await getOrCreatePrimary();
    const videoId = extractVideoId(req.body.youtubeUrl || req.body.videoId);
    if (!videoId) {
      return res.status(400).json({ success: false, message: 'Valid YouTube URL or video ID required' });
    }

    const exists = await YoutubeVideo.findOne({ channel: channel._id, videoId });
    if (exists) {
      return res.status(400).json({ success: false, message: 'This video already exists in the slider' });
    }

    const min = await YoutubeVideo.findOne({ channel: channel._id }).sort({ displayOrder: 1 }).select('displayOrder').lean();
    const displayOrder = req.body.displayOrder != null ? Number(req.body.displayOrder) : (min ? min.displayOrder - 1 : 0);

    const video = await YoutubeVideo.create({
      channel: channel._id,
      videoId,
      title: (req.body.title || 'YouTube Video').trim(),
      description: req.body.description || '',
      thumbnail: req.body.thumbnail || thumbnailFor(videoId),
      youtubeUrl: buildWatchUrl(videoId),
      publishedAt: req.body.publishedAt ? new Date(req.body.publishedAt) : new Date(),
      displayOrder,
      isActive: req.body.isActive !== false,
      isManual: true,
      titleLocked: true,
      descriptionLocked: Boolean(req.body.description),
      thumbnailLocked: Boolean(req.body.thumbnail),
      metadata: { raw: { source: 'manual' } },
    });

    res.status(201).json({ success: true, data: video });
  } catch (error) {
    next(error);
  }
};

export const updateVideo = async (req, res, next) => {
  try {
    const video = await YoutubeVideo.findById(req.params.id);
    if (!video) return res.status(404).json({ success: false, message: 'Video not found' });

    const {
      title,
      description,
      thumbnail,
      youtubeUrl,
      displayOrder,
      isActive,
      publishedAt,
      titleLocked,
      descriptionLocked,
      thumbnailLocked,
    } = req.body;

    if (youtubeUrl != null) {
      const id = extractVideoId(youtubeUrl);
      if (id) {
        video.videoId = id;
        video.youtubeUrl = buildWatchUrl(id);
      }
    }
    if (title != null) {
      video.title = title;
      video.titleLocked = true;
    }
    if (description != null) {
      video.description = description;
      video.descriptionLocked = true;
    }
    if (thumbnail != null) {
      video.thumbnail = thumbnail;
      video.thumbnailLocked = true;
    }
    if (displayOrder != null) video.displayOrder = Number(displayOrder);
    if (typeof isActive === 'boolean') video.isActive = isActive;
    if (publishedAt != null) video.publishedAt = new Date(publishedAt);
    if (typeof titleLocked === 'boolean') video.titleLocked = titleLocked;
    if (typeof descriptionLocked === 'boolean') video.descriptionLocked = descriptionLocked;
    if (typeof thumbnailLocked === 'boolean') video.thumbnailLocked = thumbnailLocked;

    await video.save();
    res.json({ success: true, data: video });
  } catch (error) {
    next(error);
  }
};

export const deleteVideo = async (req, res, next) => {
  try {
    const video = await YoutubeVideo.findByIdAndDelete(req.params.id);
    if (!video) return res.status(404).json({ success: false, message: 'Video not found' });
    res.json({ success: true, message: 'Video deleted' });
  } catch (error) {
    next(error);
  }
};

export const reorderVideos = async (req, res, next) => {
  try {
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds) || !orderedIds.length) {
      return res.status(400).json({ success: false, message: 'orderedIds array required' });
    }
    await Promise.all(
      orderedIds.map((id, index) =>
        YoutubeVideo.findByIdAndUpdate(id, { displayOrder: index + 1 })
      )
    );
    const channel = await getOrCreatePrimary();
    const videos = await YoutubeVideo.find({ channel: channel._id })
      .sort({ publishedAt: -1, displayOrder: 1 })
      .lean();
    res.json({ success: true, data: videos, message: 'Order updated' });
  } catch (error) {
    next(error);
  }
};

export { getOrCreatePrimary };
