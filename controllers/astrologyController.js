import DailyHoroscope from '../models/DailyHoroscope.js';
import AstrologyPanchang from '../models/AstrologyPanchang.js';
import AstrologySyncLog from '../models/AstrologySyncLog.js';
import {
  getOrCreateAstrologyConfig,
  toPublicConfig,
  applyConfigUpdates,
  testAstrologyConnection,
  syncAstrologyNow,
  getDashboardStats,
  dateInTimezone,
  formatDisplayDate,
  getNextSyncDate,
  ASTROLOGY_RASIS,
  ASTROLOGY_NAKSHATRAS,
} from '../services/astrologyService.js';
import { DEFAULT_TIMEZONE } from '../config/astrologyConstants.js';
import { findRasiByAlias } from '../config/astrologyConstants.js';
import { rescheduleAstrologySyncJob } from '../jobs/astrologySyncJob.js';

export const getAdminDashboard = async (req, res, next) => {
  try {
    const data = await getDashboardStats();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getAdminConfig = async (req, res, next) => {
  try {
    const config = await getOrCreateAstrologyConfig();
    res.json({
      success: true,
      data: toPublicConfig(config),
      providers: [
        { value: 'free', label: 'Free Daily Horoscope (no API key)' },
        { value: 'astrologyapi', label: 'AstrologyAPI.com' },
        { value: 'custom', label: 'Custom / Generic HTTP API' },
      ],
      rasis: ASTROLOGY_RASIS,
      nakshatras: ASTROLOGY_NAKSHATRAS,
    });
  } catch (error) {
    next(error);
  }
};

export const updateAdminConfig = async (req, res, next) => {
  try {
    const config = await getOrCreateAstrologyConfig();
    applyConfigUpdates(config, req.body || {});
    config.nextScheduledSyncAt = getNextSyncDate(
      config.syncTime,
      config.timezone || DEFAULT_TIMEZONE
    );
    await config.save();
    try {
      await rescheduleAstrologySyncJob();
    } catch {
      /* non-fatal */
    }
    res.json({
      success: true,
      message: 'Astrology settings saved',
      data: toPublicConfig(config),
    });
  } catch (error) {
    next(error);
  }
};

export const testConnection = async (req, res, next) => {
  try {
    const result = await testAstrologyConnection();
    res.status(result.success ? 200 : 400).json({ success: result.success, message: result.message });
  } catch (error) {
    next(error);
  }
};

export const syncNow = async (req, res, next) => {
  try {
    const result = await syncAstrologyNow('manual');
    res.status(result.success ? 200 : 400).json({
      success: result.success,
      message: result.message,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getSyncLogs = async (req, res, next) => {
  try {
    const limit = Math.min(100, Number(req.query.limit) || 30);
    const page = Math.max(1, Number(req.query.page) || 1);
    const filter = {};
    if (req.query.status && req.query.status !== 'all') filter.status = req.query.status;

    const [items, total] = await Promise.all([
      AstrologySyncLog.find(filter).sort({ syncStartedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      AstrologySyncLog.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: items,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
    });
  } catch (error) {
    next(error);
  }
};

export const getSyncLogById = async (req, res, next) => {
  try {
    const log = await AstrologySyncLog.findById(req.params.id).lean();
    if (!log) return res.status(404).json({ success: false, message: 'Sync log not found' });
    res.json({ success: true, data: log });
  } catch (error) {
    next(error);
  }
};

export const getAdminHoroscopes = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.date) filter.date = req.query.date;
    if (req.query.rasi) filter.rasi = req.query.rasi;
    if (req.query.status) filter.status = req.query.status;

    const limit = Math.min(100, Number(req.query.limit) || 50);
    const page = Math.max(1, Number(req.query.page) || 1);

    const [items, total] = await Promise.all([
      DailyHoroscope.find(filter)
        .sort({ date: -1, rasi: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      DailyHoroscope.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: items,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminHoroscopeById = async (req, res, next) => {
  try {
    const item = await DailyHoroscope.findById(req.params.id).lean();
    if (!item) return res.status(404).json({ success: false, message: 'Horoscope not found' });
    res.json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
};

export const updateAdminHoroscope = async (req, res, next) => {
  try {
    const item = await DailyHoroscope.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Horoscope not found' });

    const fields = [
      'prediction', 'predictionTamil', 'career', 'careerTamil', 'business', 'businessTamil',
      'finance', 'financeTamil', 'love', 'loveTamil', 'family', 'familyTamil',
      'health', 'healthTamil', 'education', 'educationTamil',
      'luckyNumber', 'luckyColor', 'luckyColorTamil', 'luckyTime',
      'advice', 'adviceTamil', 'compatibility', 'compatibilityTamil', 'status',
      'nakshatra', 'nakshatraTamil', 'nakshatraEnglish',
    ];
    for (const f of fields) {
      if (req.body[f] !== undefined) item[f] = req.body[f];
    }
    await item.save();
    res.json({ success: true, message: 'Updated', data: item });
  } catch (error) {
    next(error);
  }
};

export const getAdminPanchang = async (req, res, next) => {
  try {
    const config = await getOrCreateAstrologyConfig();
    const date = req.query.date || dateInTimezone(config.timezone || DEFAULT_TIMEZONE);
    const item = await AstrologyPanchang.findOne({ date }).lean();
    const recent = await AstrologyPanchang.find().sort({ date: -1 }).limit(14).lean();
    res.json({
      success: true,
      data: item,
      recent,
      date,
      displayDate: formatDisplayDate(date, config.timezone || DEFAULT_TIMEZONE),
    });
  } catch (error) {
    next(error);
  }
};

/** Public — no auth */
export const getPublicToday = async (req, res, next) => {
  try {
    const config = await getOrCreateAstrologyConfig();
    const tz = config.timezone || DEFAULT_TIMEZONE;
    let date = req.query.date || dateInTimezone(tz);

    let items = await DailyHoroscope.find({ date, status: 'active' }).lean();
    if (!items.length) {
      const latest = await DailyHoroscope.findOne({ status: 'active' }).sort({ date: -1 }).lean();
      if (latest) {
        date = latest.date;
        items = await DailyHoroscope.find({ date, status: 'active' }).lean();
      }
    }

    const byRasi = Object.fromEntries(items.map((i) => [i.rasi, i]));
    const rasis = ASTROLOGY_RASIS.map((r) => {
      const row = byRasi[r.slug];
      const previewTa = row?.predictionTamil ? String(row.predictionTamil).slice(0, 140) : '';
      const previewEn = row?.prediction ? String(row.prediction).slice(0, 140) : '';
      return {
        slug: r.slug,
        rasiTamil: r.tamil,
        rasiEnglish: r.english,
        preview: previewTa || previewEn,
        previewTamil: previewTa,
        previewEnglish: previewEn,
        hasData: Boolean(row),
      };
    });

    const panchang = await AstrologyPanchang.findOne({ date, status: 'active' }).lean();

    res.json({
      success: true,
      data: {
        date,
        displayDate: formatDisplayDate(date, tz),
        timezone: tz,
        rasis,
        panchang: panchang
          ? {
              tithi: panchang.tithi,
              nakshatra: panchang.nakshatra,
              nakshatraTamil: panchang.nakshatraTamil,
              nakshatraEnglish: panchang.nakshatraEnglish,
              yoga: panchang.yoga,
              karana: panchang.karana,
              sunrise: panchang.sunrise,
              sunset: panchang.sunset,
              moonrise: panchang.moonrise,
              moonset: panchang.moonset,
              rahuKalam: panchang.rahuKalam,
              yamagandam: panchang.yamagandam,
              kuligai: panchang.kuligai,
              abhijitMuhurtham: panchang.abhijitMuhurtham,
              tamilMonth: panchang.tamilMonth,
              tamilYear: panchang.tamilYear,
              locationLabel: panchang.locationLabel,
            }
          : null,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getPublicRasi = async (req, res, next) => {
  try {
    const meta = findRasiByAlias(req.params.slug);
    if (!meta) {
      return res.status(404).json({ success: false, message: 'Rasi not found' });
    }

    const config = await getOrCreateAstrologyConfig();
    const tz = config.timezone || DEFAULT_TIMEZONE;
    let date = req.query.date || dateInTimezone(tz);

    let item = await DailyHoroscope.findOne({ date, rasi: meta.slug, status: 'active' }).lean();
    if (!item) {
      item = await DailyHoroscope.findOne({ rasi: meta.slug, status: 'active' }).sort({ date: -1 }).lean();
      if (item) date = item.date;
    }

    res.json({
      success: true,
      data: {
        date,
        displayDate: formatDisplayDate(date, tz),
        slug: meta.slug,
        rasiTamil: meta.tamil,
        rasiEnglish: meta.english,
        horoscope: item
          ? {
              prediction: item.prediction,
              predictionTamil: item.predictionTamil,
              career: item.career,
              careerTamil: item.careerTamil,
              business: item.business,
              businessTamil: item.businessTamil,
              finance: item.finance,
              financeTamil: item.financeTamil,
              love: item.love,
              loveTamil: item.loveTamil,
              family: item.family,
              familyTamil: item.familyTamil,
              health: item.health,
              healthTamil: item.healthTamil,
              education: item.education,
              educationTamil: item.educationTamil,
              luckyNumber: item.luckyNumber,
              luckyColor: item.luckyColor,
              luckyColorTamil: item.luckyColorTamil,
              luckyTime: item.luckyTime,
              advice: item.advice,
              adviceTamil: item.adviceTamil,
              compatibility: item.compatibility,
              compatibilityTamil: item.compatibilityTamil,
              nakshatraTamil: item.nakshatraTamil,
              nakshatraEnglish: item.nakshatraEnglish,
              updatedAt: item.updatedAt,
            }
          : null,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getPublicRasiList = async (_req, res, next) => {
  try {
    res.json({
      success: true,
      data: ASTROLOGY_RASIS.map((r) => ({
        slug: r.slug,
        rasiTamil: r.tamil,
        rasiEnglish: r.english,
      })),
    });
  } catch (error) {
    next(error);
  }
};
