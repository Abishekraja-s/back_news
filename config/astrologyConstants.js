/** Canonical 12 Rasi — public slugs are SEO-friendly Tamil romanization */

export const ASTROLOGY_RASIS = [
  {
    slug: 'mesham',
    tamil: 'மேஷம்',
    english: 'Aries',
    aliases: ['aries', 'mesha', 'mesham', 'mesh'],
  },
  {
    slug: 'rishabam',
    tamil: 'ரிஷபம்',
    english: 'Taurus',
    aliases: ['taurus', 'rishaba', 'rishabam', 'vrishabha', 'vrishabh'],
  },
  {
    slug: 'mithunam',
    tamil: 'மிதுனம்',
    english: 'Gemini',
    aliases: ['gemini', 'mithuna', 'mithunam'],
  },
  {
    slug: 'kadagam',
    tamil: 'கடகம்',
    english: 'Cancer',
    aliases: ['cancer', 'kataka', 'kadagam', 'karkata', 'karka'],
  },
  {
    slug: 'simmam',
    tamil: 'சிம்மம்',
    english: 'Leo',
    aliases: ['leo', 'simha', 'simmam', 'singh'],
  },
  {
    slug: 'kanni',
    tamil: 'கன்னி',
    english: 'Virgo',
    aliases: ['virgo', 'kanya', 'kanni'],
  },
  {
    slug: 'thulam',
    tamil: 'துலாம்',
    english: 'Libra',
    aliases: ['libra', 'tula', 'thulam', 'tulam'],
  },
  {
    slug: 'viruchigam',
    tamil: 'விருச்சிகம்',
    english: 'Scorpio',
    aliases: ['scorpio', 'vrischika', 'viruchigam', 'vrishchik'],
  },
  {
    slug: 'dhanusu',
    tamil: 'தனுசு',
    english: 'Sagittarius',
    aliases: ['sagittarius', 'dhanu', 'dhanusu', 'dhanus'],
  },
  {
    slug: 'magaram',
    tamil: 'மகரம்',
    english: 'Capricorn',
    aliases: ['capricorn', 'makara', 'magaram', 'makar'],
  },
  {
    slug: 'kumbam',
    tamil: 'கும்பம்',
    english: 'Aquarius',
    aliases: ['aquarius', 'kumbha', 'kumbam'],
  },
  {
    slug: 'meenam',
    tamil: 'மீனம்',
    english: 'Pisces',
    aliases: ['pisces', 'meena', 'meenam'],
  },
];

/** 27 Nakshatras (Birth Stars) — modular for provider mapping */
export const ASTROLOGY_NAKSHATRAS = [
  { slug: 'aswini', tamil: 'அஸ்வினி', english: 'Ashwini' },
  { slug: 'bharani', tamil: 'பரணி', english: 'Bharani' },
  { slug: 'krithigai', tamil: 'கிருத்திகை', english: 'Krittika' },
  { slug: 'rohini', tamil: 'ரோகிணி', english: 'Rohini' },
  { slug: 'mrigasirisham', tamil: 'மிருகசீரிடம்', english: 'Mrigashira' },
  { slug: 'thiruvathirai', tamil: 'திருவாதிரை', english: 'Ardra' },
  { slug: 'punarpoosam', tamil: 'புனர்பூசம்', english: 'Punarvasu' },
  { slug: 'poosam', tamil: 'பூசம்', english: 'Pushya' },
  { slug: 'ayilyam', tamil: 'ஆயில்யம்', english: 'Ashlesha' },
  { slug: 'magam', tamil: 'மகம்', english: 'Magha' },
  { slug: 'pooram', tamil: 'பூரம்', english: 'Purva Phalguni' },
  { slug: 'uthiram', tamil: 'உத்திரம்', english: 'Uttara Phalguni' },
  { slug: 'hastham', tamil: 'ஹஸ்தம்', english: 'Hasta' },
  { slug: 'chithirai', tamil: 'சித்திரை', english: 'Chitra' },
  { slug: 'swathi', tamil: 'சுவாதி', english: 'Swati' },
  { slug: 'visakam', tamil: 'விசாகம்', english: 'Vishakha' },
  { slug: 'anusham', tamil: 'அனுஷம்', english: 'Anuradha' },
  { slug: 'kettai', tamil: 'கேட்டை', english: 'Jyeshtha' },
  { slug: 'moolam', tamil: 'மூலம்', english: 'Mula' },
  { slug: 'pooradam', tamil: 'பூராடம்', english: 'Purva Ashadha' },
  { slug: 'uthradam', tamil: 'உத்ராடம்', english: 'Uttara Ashadha' },
  { slug: 'thiruvonam', tamil: 'திருவோணம்', english: 'Shravana' },
  { slug: 'avittam', tamil: 'அவிட்டம்', english: 'Dhanishta' },
  { slug: 'sadayam', tamil: 'சதயம்', english: 'Shatabhisha' },
  { slug: 'poorattathi', tamil: 'பூரட்டாதி', english: 'Purva Bhadrapada' },
  { slug: 'uthrattathi', tamil: 'உத்திரட்டாதி', english: 'Uttara Bhadrapada' },
  { slug: 'revathi', tamil: 'ரேவதி', english: 'Revati' },
];

export const ASTROLOGY_PROVIDERS = [
  { value: 'free', label: 'Free Daily Horoscope (no API key)' },
  { value: 'astrologyapi', label: 'AstrologyAPI.com' },
  { value: 'custom', label: 'Custom / Generic HTTP API' },
];

export const FREE_HOROSCOPE_BASE_URL = 'https://ohmanda.com/api/horoscope';

export const DEFAULT_TIMEZONE = 'Asia/Kolkata';
export const DEFAULT_SYNC_TIME = '00:05';

export const findRasiByAlias = (value = '') => {
  const key = String(value).trim().toLowerCase().replace(/[\s_-]+/g, '');
  if (!key) return null;
  return (
    ASTROLOGY_RASIS.find(
      (r) =>
        r.slug === key
        || r.english.toLowerCase() === key
        || r.aliases.some((a) => a.replace(/[\s_-]+/g, '') === key)
    ) || null
  );
};
