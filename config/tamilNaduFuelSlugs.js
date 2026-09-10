/**
 * Tamil Nadu district → goodreturns.in URL slug overrides.
 * Default slug: lowercase district name with spaces → hyphens.
 */
export const FUEL_SLUG_OVERRIDES = {
  Kancheepuram: 'kanchipuram',
  Thoothukudi: 'tuticorin',
  Virudhunagar: 'virudunagar',
  Tiruppur: 'coimbatore',
  Theni: 'dindigul',
  Tiruchirappalli: 'thanjavur',
  Tiruvarur: 'nagapattinam',
  Nilgiris: 'nilgiris',
  Tirunelveli: 'tirunelveli',
  Thirunelveli: 'tirunelveli',
};

export const DEFAULT_TN_FUEL_DISTRICTS = [
  'Ariyalur', 'Chengalpattu', 'Chennai', 'Coimbatore', 'Cuddalore', 'Dharmapuri', 'Dindigul',
  'Erode', 'Kallakurichi', 'Kancheepuram', 'Karur', 'Krishnagiri', 'Madurai', 'Mayiladuthurai',
  'Nagapattinam', 'Namakkal', 'Nilgiris', 'Perambalur', 'Pudukkottai', 'Ramanathapuram', 'Ranipet',
  'Salem', 'Sivaganga', 'Tenkasi', 'Thanjavur', 'Theni', 'Thoothukudi', 'Tiruchirappalli', 'Tirunelveli',
  'Tirupathur', 'Tiruppur', 'Tiruvallur', 'Tiruvannamalai', 'Tiruvarur', 'Vellore', 'Viluppuram', 'Virudhunagar',
];

export const fuelDistrictSlug = (district) => {
  if (FUEL_SLUG_OVERRIDES[district]) return FUEL_SLUG_OVERRIDES[district];
  return String(district).trim().toLowerCase().replace(/\s+/g, '-');
};

export const districtSlug = (district) => fuelDistrictSlug(district);

export default { FUEL_SLUG_OVERRIDES, fuelDistrictSlug, DEFAULT_TN_FUEL_DISTRICTS };
