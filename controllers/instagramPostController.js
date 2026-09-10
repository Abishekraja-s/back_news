import InstagramPost from '../models/InstagramPost.js';
import {
  parseInstagramUrl,
  fetchInstagramPostData,
  resolveInstagramAccessToken,
  saveInstagramAccessToken,
  maskToken,
} from '../services/instagramApiService.js';

export const getConfigStatus = async (req, res, next) => {
  try {
    const { token, source } = await resolveInstagramAccessToken();
    res.json({
      success: true,
      data: {
        configured: Boolean(token),
        source,
        maskedToken: token ? maskToken(token) : '',
        businessAccountConfigured: Boolean(process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID),
        note:
          'Uses Meta Instagram oEmbed (official). Optional INSTAGRAM_BUSINESS_ACCOUNT_ID enables carousel/media enrichment for your own IG Business posts.',
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateConfig = async (req, res, next) => {
  try {
    if (typeof req.body.accessToken === 'string') {
      await saveInstagramAccessToken(req.body.accessToken);
    }
    const { token, source } = await resolveInstagramAccessToken();
    res.json({
      success: true,
      message: 'Instagram API settings saved',
      data: { configured: Boolean(token), source, maskedToken: token ? maskToken(token) : '' },
    });
  } catch (error) {
    next(error);
  }
};

/** Preview fetch — does not save */
export const fetchPreview = async (req, res, next) => {
  try {
    const url = req.body.url || req.body.instagramUrl;
    parseInstagramUrl(url); // validate early

    const data = await fetchInstagramPostData(url);
    const existing = await InstagramPost.findOne({ shortcode: data.shortcode }).select('_id status title').lean();

    res.json({
      success: true,
      data: {
        ...data,
        alreadyImported: Boolean(existing),
        existingId: existing?._id || null,
        existingStatus: existing?.status || null,
      },
      message: existing
        ? 'This Instagram post was already imported — you can sync or edit the existing entry'
        : 'Preview ready — edit and approve to publish',
    });
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({
      success: false,
      message: error.message || 'Failed to fetch Instagram post',
      code: error.code || 'API_ERROR',
    });
  }
};

export const getPublicPosts = async (req, res, next) => {
  try {
    const posts = await InstagramPost.find({ status: 'published', isActive: true })
      .sort({ displayOrder: 1, publishedAt: -1, createdAt: -1 })
      .lean();
    res.json({ success: true, data: posts });
  } catch (error) {
    next(error);
  }
};

export const getAdminPosts = async (req, res, next) => {
  try {
    const posts = await InstagramPost.find()
      .sort({ displayOrder: 1, createdAt: -1 })
      .lean();
    res.json({ success: true, data: posts });
  } catch (error) {
    next(error);
  }
};

/** Create from approved preview / import */
export const createPost = async (req, res, next) => {
  try {
    const url = req.body.instagramUrl || req.body.url;
    const parsed = parseInstagramUrl(url);

    const dup = await InstagramPost.findOne({ shortcode: parsed.shortcode });
    if (dup) {
      return res.status(409).json({
        success: false,
        message: 'This Instagram post is already imported',
        data: { id: dup._id, shortcode: dup.shortcode },
        code: 'DUPLICATE',
      });
    }

    let fetched = null;
    try {
      fetched = await fetchInstagramPostData(url);
    } catch (err) {
      // Allow manual create if API fails but admin provided image
      if (!req.body.image && !req.body.thumbnailUrl) {
        return res.status(err.statusCode || 502).json({
          success: false,
          message: err.message,
          code: err.code,
        });
      }
    }

    const max = await InstagramPost.findOne().sort({ displayOrder: -1 }).select('displayOrder').lean();
    const displayOrder =
      req.body.displayOrder != null ? Number(req.body.displayOrder) : (max?.displayOrder ?? -1) + 1;

    const status = req.body.status || 'published';
    const carousel =
      Array.isArray(req.body.carouselImages) && req.body.carouselImages.length
        ? req.body.carouselImages
        : fetched?.carouselImages || [];

    const post = await InstagramPost.create({
      shortcode: parsed.shortcode,
      instagramUrl: parsed.canonicalUrl,
      title: req.body.title || fetched?.title || '',
      description: req.body.description || fetched?.description || '',
      caption: req.body.caption || fetched?.caption || '',
      category: req.body.category || '',
      image: req.body.image || fetched?.image || '',
      thumbnailUrl: req.body.thumbnailUrl || fetched?.thumbnailUrl || req.body.image || '',
      mediaUrl: req.body.mediaUrl || fetched?.mediaUrl || '',
      mediaType: req.body.mediaType || fetched?.mediaType || 'UNKNOWN',
      carouselImages: carousel,
      embedHtml: req.body.embedHtml || fetched?.embedHtml || '',
      authorName: req.body.authorName || fetched?.authorName || '',
      authorUrl: req.body.authorUrl || fetched?.authorUrl || '',
      publishedAt: req.body.publishedAt
        ? new Date(req.body.publishedAt)
        : fetched?.publishedAt || new Date(),
      displayOrder,
      status,
      isActive: req.body.isActive !== false && status === 'published',
      graphMediaId: fetched?.graphMediaId || '',
      lastSyncAt: new Date(),
      lastSyncStatus: fetched ? 'success' : 'unavailable',
      lastSyncMessage: fetched ? 'Imported via Meta API' : 'Saved with manual/fallback fields',
      rawPayload: fetched?.rawPayload || null,
      createdBy: req.user?._id,
    });

    res.status(201).json({ success: true, data: post, message: 'Instagram post published to the website' });
  } catch (error) {
    next(error);
  }
};

export const updatePost = async (req, res, next) => {
  try {
    const post = await InstagramPost.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

    const fields = [
      'title',
      'description',
      'caption',
      'category',
      'image',
      'thumbnailUrl',
      'mediaUrl',
      'mediaType',
      'embedHtml',
      'authorName',
      'status',
      'displayOrder',
    ];
    for (const key of fields) {
      if (req.body[key] != null) post[key] = req.body[key];
    }
    if (Array.isArray(req.body.carouselImages)) post.carouselImages = req.body.carouselImages;
    if (typeof req.body.isActive === 'boolean') post.isActive = req.body.isActive;
    if (req.body.status === 'published') post.isActive = req.body.isActive !== false;
    if (req.body.status === 'inactive') post.isActive = false;
    if (req.body.publishedAt) post.publishedAt = new Date(req.body.publishedAt);

    await post.save();
    res.json({ success: true, data: post, message: 'Post updated' });
  } catch (error) {
    next(error);
  }
};

export const deletePost = async (req, res, next) => {
  try {
    const post = await InstagramPost.findByIdAndDelete(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });
    res.json({ success: true, message: 'Post deleted' });
  } catch (error) {
    next(error);
  }
};

export const reorderPosts = async (req, res, next) => {
  try {
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds)) {
      return res.status(400).json({ success: false, message: 'orderedIds required' });
    }
    await Promise.all(
      orderedIds.map((id, index) => InstagramPost.findByIdAndUpdate(id, { displayOrder: index + 1 }))
    );
    const posts = await InstagramPost.find().sort({ displayOrder: 1, createdAt: -1 }).lean();
    res.json({ success: true, data: posts, message: 'Order updated' });
  } catch (error) {
    next(error);
  }
};

/** Re-fetch metadata for one post (Sync Now) */
export const syncPost = async (req, res, next) => {
  try {
    const post = await InstagramPost.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

    try {
      const data = await fetchInstagramPostData(post.instagramUrl);
      if (!post.title) post.title = data.title;
      // Preserve admin edits for title/description if set; refresh media unless locked via empty overwrite
      if (req.body.overwriteMedia !== false) {
        post.image = data.image || post.image;
        post.thumbnailUrl = data.thumbnailUrl || post.thumbnailUrl;
        post.mediaUrl = data.mediaUrl || post.mediaUrl;
        post.mediaType = data.mediaType || post.mediaType;
        if (data.carouselImages?.length) post.carouselImages = data.carouselImages;
        post.embedHtml = data.embedHtml || post.embedHtml;
      }
      if (req.body.overwriteCaption) {
        post.caption = data.caption;
        post.description = data.description;
      }
      if (data.publishedAt) post.publishedAt = data.publishedAt;
      post.graphMediaId = data.graphMediaId || post.graphMediaId;
      post.rawPayload = data.rawPayload;
      post.lastSyncAt = new Date();
      post.lastSyncStatus = 'success';
      post.lastSyncMessage = data.enrichment
        ? 'Synced via oEmbed + Graph enrichment'
        : 'Synced via Instagram oEmbed';
      await post.save();
      res.json({ success: true, data: post, message: post.lastSyncMessage });
    } catch (err) {
      post.lastSyncAt = new Date();
      post.lastSyncStatus = err.code === 'UNAVAILABLE' ? 'unavailable' : 'error';
      post.lastSyncMessage = err.message;
      await post.save();
      return res.status(err.statusCode || 502).json({
        success: false,
        message: err.message,
        code: err.code,
        data: post,
      });
    }
  } catch (error) {
    next(error);
  }
};

/** Sync all published/active posts */
export const syncAll = async (req, res, next) => {
  try {
    const posts = await InstagramPost.find({ status: { $in: ['published', 'draft'] } });
    let ok = 0;
    let fail = 0;
    for (const post of posts) {
      try {
        const data = await fetchInstagramPostData(post.instagramUrl);
        post.image = data.image || post.image;
        post.thumbnailUrl = data.thumbnailUrl || post.thumbnailUrl;
        post.mediaUrl = data.mediaUrl || post.mediaUrl;
        post.mediaType = data.mediaType || post.mediaType;
        if (data.carouselImages?.length) post.carouselImages = data.carouselImages;
        post.embedHtml = data.embedHtml || post.embedHtml;
        post.lastSyncAt = new Date();
        post.lastSyncStatus = 'success';
        post.lastSyncMessage = 'Bulk sync OK';
        await post.save();
        ok += 1;
      } catch (err) {
        post.lastSyncAt = new Date();
        post.lastSyncStatus = 'error';
        post.lastSyncMessage = err.message;
        await post.save();
        fail += 1;
      }
    }
    const list = await InstagramPost.find().sort({ displayOrder: 1, createdAt: -1 }).lean();
    res.json({
      success: true,
      data: list,
      message: `Sync finished — ${ok} ok, ${fail} failed`,
    });
  } catch (error) {
    next(error);
  }
};
