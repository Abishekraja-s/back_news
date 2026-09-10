/**
 * Tamil Nadu district headquarters coordinates for Open-Meteo.
 * Slugs are URL-safe lowercase keys.
 */
export const TAMIL_NADU_DISTRICTS = [
  { district: 'Ariyalur', slug: 'ariyalur', latitude: 11.1401, longitude: 79.0786 },
  { district: 'Chengalpattu', slug: 'chengalpattu', latitude: 12.6819, longitude: 79.9888 },
  { district: 'Chennai', slug: 'chennai', latitude: 13.0827, longitude: 80.2707 },
  { district: 'Coimbatore', slug: 'coimbatore', latitude: 11.0168, longitude: 76.9558 },
  { district: 'Cuddalore', slug: 'cuddalore', latitude: 11.7447, longitude: 79.768 },
  { district: 'Dharmapuri', slug: 'dharmapuri', latitude: 12.1211, longitude: 78.1582 },
  { district: 'Dindigul', slug: 'dindigul', latitude: 10.3624, longitude: 77.9695 },
  { district: 'Erode', slug: 'erode', latitude: 11.341, longitude: 77.7172 },
  { district: 'Kallakurichi', slug: 'kallakurichi', latitude: 11.738, longitude: 78.9629 },
  { district: 'Kancheepuram', slug: 'kancheepuram', latitude: 12.8342, longitude: 79.7036 },
  { district: 'Karur', slug: 'karur', latitude: 10.9601, longitude: 78.0766 },
  { district: 'Krishnagiri', slug: 'krishnagiri', latitude: 12.5186, longitude: 78.2137 },
  { district: 'Madurai', slug: 'madurai', latitude: 9.9252, longitude: 78.1198 },
  { district: 'Mayiladuthurai', slug: 'mayiladuthurai', latitude: 11.101, longitude: 79.655 },
  { district: 'Nagapattinam', slug: 'nagapattinam', latitude: 10.7672, longitude: 79.8449 },
  { district: 'Kanniyakumari', slug: 'kanniyakumari', latitude: 8.0883, longitude: 77.5385 },
  { district: 'Namakkal', slug: 'namakkal', latitude: 11.2189, longitude: 78.1672 },
  { district: 'Nilgiris', slug: 'nilgiris', latitude: 11.4106, longitude: 76.7034 },
  { district: 'Perambalur', slug: 'perambalur', latitude: 11.234, longitude: 78.88 },
  { district: 'Pudukkottai', slug: 'pudukkottai', latitude: 10.3833, longitude: 78.8 },
  { district: 'Ramanathapuram', slug: 'ramanathapuram', latitude: 9.3639, longitude: 78.8395 },
  { district: 'Ranipet', slug: 'ranipet', latitude: 12.9279, longitude: 79.138 },
  { district: 'Salem', slug: 'salem', latitude: 11.6643, longitude: 78.146 },
  { district: 'Sivaganga', slug: 'sivaganga', latitude: 9.8433, longitude: 78.4809 },
  { district: 'Tenkasi', slug: 'tenkasi', latitude: 8.9558, longitude: 77.3153 },
  { district: 'Thanjavur', slug: 'thanjavur', latitude: 10.7869, longitude: 79.1378 },
  { district: 'Theni', slug: 'theni', latitude: 10.0104, longitude: 77.4768 },
  { district: 'Thoothukudi', slug: 'thoothukudi', latitude: 8.7642, longitude: 78.1348 },
  { district: 'Tiruchirappalli', slug: 'tiruchirappalli', latitude: 10.7905, longitude: 78.7047 },
  { district: 'Tirunelveli', slug: 'tirunelveli', latitude: 8.7139, longitude: 77.7567 },
  { district: 'Tirupathur', slug: 'tirupathur', latitude: 12.498, longitude: 78.5608 },
  { district: 'Tiruppur', slug: 'tiruppur', latitude: 11.1085, longitude: 77.3411 },
  { district: 'Tiruvallur', slug: 'tiruvallur', latitude: 13.1449, longitude: 79.9089 },
  { district: 'Tiruvannamalai', slug: 'tiruvannamalai', latitude: 12.2253, longitude: 79.0747 },
  { district: 'Tiruvarur', slug: 'tiruvarur', latitude: 10.7765, longitude: 79.6368 },
  { district: 'Vellore', slug: 'vellore', latitude: 12.9165, longitude: 79.1325 },
  { district: 'Viluppuram', slug: 'viluppuram', latitude: 11.9401, longitude: 79.4861 },
  { district: 'Virudhunagar', slug: 'virudhunagar', latitude: 9.568, longitude: 77.9624 },
];

const slugIndex = new Map(
  TAMIL_NADU_DISTRICTS.map((d) => [d.slug, d])
);
const nameIndex = new Map(
  TAMIL_NADU_DISTRICTS.map((d) => [d.district.toLowerCase(), d])
);

export const districtSlug = (name) => {
  const key = String(name || '').trim().toLowerCase();
  return nameIndex.get(key)?.slug || key.replace(/\s+/g, '-');
};

export const findDistrict = (query) => {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return null;
  if (slugIndex.has(q)) return slugIndex.get(q);
  if (nameIndex.has(q)) return nameIndex.get(q);
  return TAMIL_NADU_DISTRICTS.find((d) => d.district.toLowerCase() === q) || null;
};

/** Merge admin config districts with built-in coordinates */
export const resolveDistrictList = (config = {}) => {
  const fromConfig = Array.isArray(config.districts) ? config.districts : [];
  if (!fromConfig.length) return TAMIL_NADU_DISTRICTS;

  return fromConfig.map((entry) => {
    const name = entry.district || entry.name || entry.city;
    const builtIn = findDistrict(name);
    return {
      district: name,
      slug: entry.slug || builtIn?.slug || districtSlug(name),
      latitude: Number(entry.latitude) || builtIn?.latitude,
      longitude: Number(entry.longitude) || builtIn?.longitude,
    };
  }).filter((d) => d.district && Number.isFinite(d.latitude) && Number.isFinite(d.longitude));
};

export default TAMIL_NADU_DISTRICTS;
