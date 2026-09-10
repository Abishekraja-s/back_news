import SiteFeature from '../models/SiteFeature.js';
import FeatureItem from '../models/FeatureItem.js';
import { DEFAULT_FEATURES } from '../config/features.js';
import { fetchLiveWeather, fetchDistrictsWeather } from '../services/weatherService.js';
import { fetchLiveGoldPrice } from '../services/goldPriceService.js';
import { fetchLiveFuel, fetchDistrictsFuel } from '../services/fuelPriceService.js';
import { findDistrict } from '../config/tamilNaduDistricts.js';
import { fuelDistrictSlug } from '../config/tamilNaduFuelSlugs.js';

/** Public hub payload: enabled features + their active items */
export const getHub = async (req, res, next) => {
  try {
    const features = await SiteFeature.find({
      enabled: true,
      status: { $in: ['live', 'beta'] },
    })
      .sort({ row: 1, order: 1 })
      .lean();

    const keys = features.map((f) => f.key);
    const now = new Date();
    const items = keys.length
      ? await FeatureItem.find({
          featureKey: { $in: keys },
          isActive: true,
          $and: [
            {
              $or: [
                { startDate: { $exists: false } },
                { startDate: null },
                { startDate: { $lte: now } },
              ],
            },
            {
              $or: [
                { endDate: { $exists: false } },
                { endDate: null },
                { endDate: { $gte: now } },
              ],
            },
          ],
        })
          .sort({ priority: -1, createdAt: -1 })
          .lean()
      : [];

    const itemsByKey = items.reduce((acc, item) => {
      if (!acc[item.featureKey]) acc[item.featureKey] = [];
      acc[item.featureKey].push(item);
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        features: features.map((f) => ({
          ...f,
          items: itemsByKey[f.key] || [],
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

/** Live weather from Open-Meteo (public) */
export const getLiveWeather = async (req, res, next) => {
  try {
    let config = {};

    const feature = await SiteFeature.findOne({ key: 'weather' }).lean();
    if (feature?.config) config = { ...feature.config };

    if (req.query.latitude && req.query.longitude) {
      config.latitude = req.query.latitude;
      config.longitude = req.query.longitude;
    }
    if (req.query.city) config.city = req.query.city;
    if (req.query.district) config.district = req.query.district;

    const data = await fetchLiveWeather(config);
    res.json({
      success: true,
      data: {
        ...data,
        state: data.state || config.state || 'Tamil Nadu',
        country: data.country || config.country || 'India',
      },
    });
  } catch (error) {
    res.status(502).json({
      success: false,
      message: error.message || 'Could not fetch live weather',
    });
  }
};

/** All Tamil Nadu district weather (public) */
export const getDistrictsWeather = async (req, res, next) => {
  try {
    let config = {};

    const feature = await SiteFeature.findOne({ key: 'weather' }).lean();
    if (feature?.config) config = { ...feature.config };

    const data = await fetchDistrictsWeather(config);
    res.json({ success: true, data });
  } catch (error) {
    res.status(502).json({
      success: false,
      message: error.message || 'Could not fetch district weather',
    });
  }
};

/** Single district weather by slug or name (public) */
export const getDistrictWeather = async (req, res, next) => {
  try {
    const d = findDistrict(req.params.district);
    if (!d) {
      return res.status(404).json({ success: false, message: 'District not found' });
    }

    let config = { district: d.district };
    const feature = await SiteFeature.findOne({ key: 'weather' }).lean();
    if (feature?.config) {
      config = { ...feature.config, district: d.district };
    }

    const data = await fetchLiveWeather(config);
    res.json({ success: true, data: { ...data, district: d.district, slug: d.slug } });
  } catch (error) {
    res.status(502).json({
      success: false,
      message: error.message || 'Could not fetch district weather',
    });
  }
};

/** Live gold price (public) */
export const getLiveGoldPrice = async (req, res, next) => {
  try {
    let config = {};

    const feature = await SiteFeature.findOne({ key: 'gold_price' }).lean();
    if (feature?.config) config = { ...feature.config };

    const data = await fetchLiveGoldPrice(config);
    res.json({ success: true, data });
  } catch (error) {
    try {
      const feature = await SiteFeature.findOne({ key: 'gold_price' }).lean();
      const fallback = feature?.config?.items?.length
        ? {
            type: 'precious_metals',
            state: feature.config.state || 'Tamil Nadu',
            auto_update: false,
            items: feature.config.items,
            source: 'config',
          }
        : feature?.config?.gold
          ? {
              state: feature.config.state || 'Tamil Nadu',
              currency: feature.config.currency || 'INR',
              unit: feature.config.unit || '1 gram',
              gold: feature.config.gold,
              auto_update: false,
              source: 'config',
            }
          : null;
      if (fallback) {
        return res.json({ success: true, data: fallback, fallback: true });
      }
    } catch {
      /* ignore */
    }
    res.status(502).json({
      success: false,
      message: error.message || 'Could not fetch live gold price',
    });
  }
};

/** Live fuel price — default district (public) */
export const getLiveFuel = async (req, res, next) => {
  try {
    let config = {};
    const feature = await SiteFeature.findOne({ key: 'fuel_price' }).lean();
    if (feature?.config) config = { ...feature.config };

    const district = req.query.district || req.query.city;
    const data = await fetchLiveFuel(config, district);
    res.json({ success: true, data });
  } catch (error) {
    res.status(502).json({
      success: false,
      message: error.message || 'Could not fetch live fuel price',
    });
  }
};

/** All Tamil Nadu district fuel prices (public) */
export const getDistrictsFuel = async (req, res, next) => {
  try {
    let config = {};
    const feature = await SiteFeature.findOne({ key: 'fuel_price' }).lean();
    if (feature?.config) config = { ...feature.config };

    const data = await fetchDistrictsFuel(config);
    res.json({ success: true, data });
  } catch (error) {
    res.status(502).json({
      success: false,
      message: error.message || 'Could not fetch district fuel prices',
    });
  }
};

/** Single district fuel by slug or name (public) */
export const getDistrictFuel = async (req, res, next) => {
  try {
    const q = String(req.params.district || '').trim();
    let districtName = q;

    const feature = await SiteFeature.findOne({ key: 'fuel_price' }).lean();
    const config = feature?.config || {};
    const match = (config.districts || []).find(
      (d) =>
        d.district?.toLowerCase() === q.toLowerCase()
        || d.slug?.toLowerCase() === q.toLowerCase()
    );
    if (match) districtName = match.district;

    const data = await fetchLiveFuel(config, districtName);
    res.json({
      success: true,
      data: {
        ...data,
        district: districtName,
        slug: match?.slug || fuelDistrictSlug(districtName),
      },
    });
  } catch (error) {
    res.status(502).json({
      success: false,
      message: error.message || 'Could not fetch district fuel price',
    });
  }
};

export const getFeatureByKey = async (req, res, next) => {
  try {
    const feature = await SiteFeature.findOne({ key: req.params.key }).lean();
    if (!feature) {
      return res.status(404).json({ success: false, message: 'Feature not found' });
    }

    const now = new Date();
    const items = await FeatureItem.find({
      featureKey: feature.key,
      isActive: true,
      $and: [
        {
          $or: [
            { startDate: { $exists: false } },
            { startDate: null },
            { startDate: { $lte: now } },
          ],
        },
        {
          $or: [
            { endDate: { $exists: false } },
            { endDate: null },
            { endDate: { $gte: now } },
          ],
        },
      ],
    })
      .sort({ priority: -1 })
      .lean();

    let liveWeather = null;
    let liveGold = null;
    let liveFuel = null;

    if (feature.key === 'weather') {
      try {
        liveWeather = await fetchLiveWeather({
          ...(feature.config || {}),
          district: feature.config?.defaultDistrict || 'Chennai',
        });
      } catch {
        liveWeather = null;
      }
    }

    if (feature.key === 'gold_price') {
      try {
        liveGold = await fetchLiveGoldPrice(feature.config || {});
      } catch {
        liveGold = null;
      }
    }

    if (feature.key === 'fuel_price') {
      try {
        liveFuel = await fetchLiveFuel(
          feature.config || {},
          feature.config?.defaultDistrict || 'Chennai'
        );
      } catch {
        liveFuel = null;
      }
    }

    let mergedConfig = feature.config;
    if (liveWeather) mergedConfig = { ...mergedConfig, ...liveWeather };
    if (liveGold) mergedConfig = { ...mergedConfig, ...liveGold };
    if (liveFuel) {
      mergedConfig = {
        ...mergedConfig,
        petrol: liveFuel.petrol,
        diesel: liveFuel.diesel,
        city: liveFuel.city,
      };
    }

    res.json({
      success: true,
      data: {
        ...feature,
        items,
        liveWeather,
        liveGold,
        liveFuel,
        config: mergedConfig,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getAllFeatures = async (req, res, next) => {
  try {
    const features = await SiteFeature.find().sort({ row: 1, order: 1 });
    res.json({ success: true, data: features });
  } catch (error) {
    next(error);
  }
};

export const createFeature = async (req, res, next) => {
  try {
    const feature = await SiteFeature.create(req.body);
    res.status(201).json({ success: true, data: feature });
  } catch (error) {
    next(error);
  }
};

export const updateFeature = async (req, res, next) => {
  try {
    const feature = await SiteFeature.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!feature) {
      return res.status(404).json({ success: false, message: 'Feature not found' });
    }
    res.json({ success: true, data: feature });
  } catch (error) {
    next(error);
  }
};

export const deleteFeature = async (req, res, next) => {
  try {
    const feature = await SiteFeature.findByIdAndDelete(req.params.id);
    if (!feature) {
      return res.status(404).json({ success: false, message: 'Feature not found' });
    }
    await FeatureItem.deleteMany({ featureKey: feature.key });
    res.json({ success: true, message: 'Feature deleted' });
  } catch (error) {
    next(error);
  }
};

/** Upsert registry defaults (safe to re-run) */
export const syncDefaults = async (req, res, next) => {
  try {
    let created = 0;
    let updated = 0;
    for (const def of DEFAULT_FEATURES) {
      const existing = await SiteFeature.findOne({ key: def.key });
      if (existing) {
        await SiteFeature.updateOne(
          { key: def.key },
          {
            $set: {
              name: def.name,
              nameTamil: def.nameTamil,
              description: def.description,
              category: def.category,
              icon: def.icon,
              order: def.order,
              row: def.row,
              colSpan: def.colSpan,
            },
          }
        );
        updated += 1;
      } else {
        await SiteFeature.create(def);
        created += 1;
      }
    }
    res.json({ success: true, data: { created, updated, total: DEFAULT_FEATURES.length } });
  } catch (error) {
    next(error);
  }
};
