/**
 * Tamil Nadu traffic places: every district HQ plus major city / town areas.
 */
import { TAMIL_NADU_DISTRICTS } from './tamilNaduDistricts.js';

export const DISTRICT_TA = {
  Ariyalur: 'அரியலூர்',
  Chengalpattu: 'செங்கல்பட்டு',
  Chennai: 'சென்னை',
  Coimbatore: 'கோயம்புத்தூர்',
  Cuddalore: 'கடலூர்',
  Dharmapuri: 'தர்மபுரி',
  Dindigul: 'திண்டுக்கல்',
  Erode: 'ஈரோடு',
  Kallakurichi: 'கள்ளக்குறிச்சி',
  Kancheepuram: 'காஞ்சிபுரம்',
  Karur: 'கரூர்',
  Krishnagiri: 'கிருஷ்ணகிரி',
  Madurai: 'மதுரை',
  Mayiladuthurai: 'மயிலாடுதுறை',
  Nagapattinam: 'நாகப்பட்டினம்',
  Kanniyakumari: 'கன்னியாகுமரி',
  Namakkal: 'நாமக்கல்',
  Nilgiris: 'நீலகிரி',
  Perambalur: 'பெரம்பலூர்',
  Pudukkottai: 'புதுக்கோட்டை',
  Ramanathapuram: 'இராமநாதபுரம்',
  Ranipet: 'இராணிப்பேட்டை',
  Salem: 'சேலம்',
  Sivaganga: 'சிவகங்கை',
  Tenkasi: 'தென்காசி',
  Thanjavur: 'தஞ்சாவூர்',
  Theni: 'தேனி',
  Thoothukudi: 'தூத்துக்குடி',
  Tiruchirappalli: 'திருச்சிராப்பள்ளி',
  Tirunelveli: 'திருநெல்வேலி',
  Tirupathur: 'திருப்பத்தூர்',
  Tiruppur: 'திருப்பூர்',
  Tiruvallur: 'திருவள்ளூர்',
  Tiruvannamalai: 'திருவண்ணாமலை',
  Tiruvarur: 'திருவாரூர்',
  Vellore: 'வேலூர்',
  Viluppuram: 'விழுப்புரம்',
  Virudhunagar: 'விருதுநகர்',
};

export const REGION_BY_DISTRICT = {
  Chennai: 'Chennai metro',
  Chengalpattu: 'Chennai metro',
  Kancheepuram: 'Chennai metro',
  Tiruvallur: 'Chennai metro',
  Vellore: 'North',
  Ranipet: 'North',
  Tirupathur: 'North',
  Tiruvannamalai: 'North',
  Krishnagiri: 'North',
  Dharmapuri: 'North',
  Coimbatore: 'West',
  Tiruppur: 'West',
  Erode: 'West',
  Nilgiris: 'West',
  Salem: 'West',
  Namakkal: 'West',
  Karur: 'West',
  Tiruchirappalli: 'Central',
  Perambalur: 'Central',
  Ariyalur: 'Central',
  Pudukkottai: 'Central',
  Thanjavur: 'Delta',
  Tiruvarur: 'Delta',
  Nagapattinam: 'Delta',
  Mayiladuthurai: 'Delta',
  Cuddalore: 'Delta',
  Viluppuram: 'Delta',
  Kallakurichi: 'Delta',
  Madurai: 'South',
  Dindigul: 'South',
  Theni: 'South',
  Sivaganga: 'South',
  Ramanathapuram: 'South',
  Virudhunagar: 'South',
  Tirunelveli: 'South',
  Tenkasi: 'South',
  Thoothukudi: 'South',
  Kanniyakumari: 'South',
};

export const URBAN_WEIGHT = {
  Chennai: 1,
  Coimbatore: 0.78,
  Madurai: 0.72,
  Tiruchirappalli: 0.68,
  Salem: 0.65,
  Tiruppur: 0.64,
  Erode: 0.55,
  Tirunelveli: 0.55,
  Vellore: 0.55,
  Thoothukudi: 0.5,
  Thanjavur: 0.48,
  Chengalpattu: 0.7,
  Kancheepuram: 0.58,
  Tiruvallur: 0.62,
  Kanniyakumari: 0.45,
  Nilgiris: 0.42,
  Krishnagiri: 0.5,
  Dindigul: 0.42,
  Namakkal: 0.4,
  Cuddalore: 0.4,
  Virudhunagar: 0.4,
};

/** Major city / town areas across Tamil Nadu (not only Chennai). */
export const TAMIL_NADU_CITY_AREAS = [
  // Chennai city
  { name: 'T. Nagar', nameTamil: 'தே. நகர்', slug: 't-nagar', city: 'Chennai', region: 'Chennai city', latitude: 13.0418, longitude: 80.2337, urban: 1 },
  { name: 'Anna Nagar', nameTamil: 'அண்ணா நகர்', slug: 'anna-nagar', city: 'Chennai', region: 'Chennai city', latitude: 13.085, longitude: 80.2101, urban: 1 },
  { name: 'Adyar', nameTamil: 'அடையாறு', slug: 'adyar', city: 'Chennai', region: 'Chennai city', latitude: 13.0067, longitude: 80.257, urban: 1 },
  { name: 'Velachery', nameTamil: 'வேளச்சேரி', slug: 'velachery', city: 'Chennai', region: 'Chennai city', latitude: 12.9816, longitude: 80.2209, urban: 1 },
  { name: 'OMR / Sholinganallur', nameTamil: 'ஓ.எம்.ஆர்', slug: 'omr', city: 'Chennai', region: 'Chennai city', latitude: 12.901, longitude: 80.2279, urban: 1 },
  { name: 'Tambaram', nameTamil: 'தாம்பரம்', slug: 'tambaram', city: 'Chennai', region: 'Chennai city', latitude: 12.9249, longitude: 80.1, urban: 0.95 },
  { name: 'Porur', nameTamil: 'போரூர்', slug: 'porur', city: 'Chennai', region: 'Chennai city', latitude: 13.0378, longitude: 80.1565, urban: 0.95 },
  { name: 'Koyambedu', nameTamil: 'கோயம்பேடு', slug: 'koyambedu', city: 'Chennai', region: 'Chennai city', latitude: 13.0694, longitude: 80.1948, urban: 1 },
  { name: 'Guindy', nameTamil: 'கிண்டி', slug: 'guindy', city: 'Chennai', region: 'Chennai city', latitude: 13.0067, longitude: 80.2206, urban: 1 },
  { name: 'Ambattur', nameTamil: 'அம்பத்தூர்', slug: 'ambattur', city: 'Chennai', region: 'Chennai city', latitude: 13.1143, longitude: 80.1548, urban: 0.92 },
  { name: 'GST / Chromepet', nameTamil: 'ஜி.எஸ்.டி சாலை', slug: 'gst-chromepet', city: 'Chennai', region: 'Chennai city', latitude: 12.9516, longitude: 80.1462, urban: 0.92 },
  { name: 'ECR', nameTamil: 'ஈ.சி.ஆர்', slug: 'ecr', city: 'Chennai', region: 'Chennai city', latitude: 12.9165, longitude: 80.2488, urban: 0.85 },
  { name: 'Chennai Central', nameTamil: 'சென்னை சென்ட்ரல்', slug: 'chennai-central', city: 'Chennai', region: 'Chennai city', latitude: 13.0822, longitude: 80.2755, urban: 1 },
  { name: 'Perambur', nameTamil: 'பெரம்பூர்', slug: 'perambur', city: 'Chennai', region: 'Chennai city', latitude: 13.121, longitude: 80.2326, urban: 0.9 },
  { name: 'Mylapore', nameTamil: 'மயிலாப்பூர்', slug: 'mylapore', city: 'Chennai', region: 'Chennai city', latitude: 13.0339, longitude: 80.269, urban: 0.95 },
  { name: 'Nungambakkam', nameTamil: 'நுங்கம்பாக்கம்', slug: 'nungambakkam', city: 'Chennai', region: 'Chennai city', latitude: 13.0569, longitude: 80.2425, urban: 0.95 },
  { name: 'Vadapalani', nameTamil: 'வடபழனி', slug: 'vadapalani', city: 'Chennai', region: 'Chennai city', latitude: 13.0505, longitude: 80.212, urban: 0.92 },
  { name: 'K.K. Nagar', nameTamil: 'கே.கே. நகர்', slug: 'kk-nagar-chennai', city: 'Chennai', region: 'Chennai city', latitude: 13.041, longitude: 80.208, urban: 0.9 },
  { name: 'Saidapet', nameTamil: 'சைதாப்பேட்டை', slug: 'saidapet', city: 'Chennai', region: 'Chennai city', latitude: 13.0213, longitude: 80.223, urban: 0.95 },
  { name: 'Egmore', nameTamil: 'எழும்பூர்', slug: 'egmore', city: 'Chennai', region: 'Chennai city', latitude: 13.0732, longitude: 80.2608, urban: 0.92 },
  { name: 'Kodambakkam', nameTamil: 'கோடம்பாக்கம்', slug: 'kodambakkam', city: 'Chennai', region: 'Chennai city', latitude: 13.0521, longitude: 80.221, urban: 0.9 },
  { name: 'Avadi', nameTamil: 'ஆவடி', slug: 'avadi', city: 'Chennai', region: 'Chennai city', latitude: 13.1067, longitude: 80.097, urban: 0.88 },
  { name: 'Poonamallee', nameTamil: 'பூந்தமல்லி', slug: 'poonamallee', city: 'Chennai', region: 'Chennai city', latitude: 13.047, longitude: 80.11, urban: 0.85 },
  { name: 'Thiruvottiyur', nameTamil: 'திருவொற்றியூர்', slug: 'thiruvottiyur', city: 'Chennai', region: 'Chennai city', latitude: 13.164, longitude: 80.3008, urban: 0.85 },
  { name: 'Madhavaram', nameTamil: 'மாதவரம்', slug: 'madhavaram', city: 'Chennai', region: 'Chennai city', latitude: 13.148, longitude: 80.231, urban: 0.85 },
  { name: 'Pallavaram', nameTamil: 'பல்லாவரம்', slug: 'pallavaram', city: 'Chennai', region: 'Chennai city', latitude: 12.9675, longitude: 80.1491, urban: 0.9 },
  { name: 'Medavakkam', nameTamil: 'மேடவாக்கம்', slug: 'medavakkam', city: 'Chennai', region: 'Chennai city', latitude: 12.9206, longitude: 80.191, urban: 0.88 },
  { name: 'Perungudi', nameTamil: 'பெருங்குடி', slug: 'perungudi', city: 'Chennai', region: 'Chennai city', latitude: 12.965, longitude: 80.246, urban: 0.92 },
  { name: 'Thiruvanmiyur', nameTamil: 'திருவான்மியூர்', slug: 'thiruvanmiyur', city: 'Chennai', region: 'Chennai city', latitude: 12.983, longitude: 80.259, urban: 0.88 },
  { name: 'Alandur', nameTamil: 'ஆலந்தூர்', slug: 'alandur', city: 'Chennai', region: 'Chennai city', latitude: 13.004, longitude: 80.201, urban: 0.9 },
  { name: 'Sriperumbudur', nameTamil: 'ஸ்ரீபெரும்புதூர்', slug: 'sriperumbudur', city: 'Kancheepuram', region: 'Chennai metro', latitude: 12.9676, longitude: 79.947, urban: 0.7 },
  { name: 'Kelambakkam', nameTamil: 'கேளம்பாக்கம்', slug: 'kelambakkam', city: 'Chengalpattu', region: 'Chennai metro', latitude: 12.787, longitude: 80.221, urban: 0.72 },
  { name: 'Guduvanchery', nameTamil: 'குடுவஞ்சேரி', slug: 'guduvanchery', city: 'Chengalpattu', region: 'Chennai metro', latitude: 12.845, longitude: 80.06, urban: 0.7 },
  { name: 'Red Hills', nameTamil: 'செங்குன்றம்', slug: 'red-hills', city: 'Tiruvallur', region: 'Chennai metro', latitude: 13.194, longitude: 80.184, urban: 0.7 },

  // Coimbatore / west
  { name: 'Gandhipuram', nameTamil: 'காந்திபுரம்', slug: 'gandhipuram', city: 'Coimbatore', region: 'Coimbatore city', latitude: 11.0183, longitude: 76.9665, urban: 0.85 },
  { name: 'R.S. Puram', nameTamil: 'ஆர்.எஸ். புரம்', slug: 'rs-puram', city: 'Coimbatore', region: 'Coimbatore city', latitude: 11.0105, longitude: 76.951, urban: 0.82 },
  { name: 'Peelamedu', nameTamil: 'பீளமேடு', slug: 'peelamedu', city: 'Coimbatore', region: 'Coimbatore city', latitude: 11.031, longitude: 77.002, urban: 0.82 },
  { name: 'Singanallur', nameTamil: 'சிங்காநல்லூர்', slug: 'singanallur', city: 'Coimbatore', region: 'Coimbatore city', latitude: 11.001, longitude: 77.029, urban: 0.8 },
  { name: 'Saravanampatti', nameTamil: 'சரவணம்பட்டி', slug: 'saravanampatti', city: 'Coimbatore', region: 'Coimbatore city', latitude: 11.079, longitude: 77.001, urban: 0.78 },
  { name: 'Ukkadam', nameTamil: 'உக்கடம்', slug: 'ukkadam', city: 'Coimbatore', region: 'Coimbatore city', latitude: 10.992, longitude: 76.961, urban: 0.8 },
  { name: 'Pollachi', nameTamil: 'பொள்ளாச்சி', slug: 'pollachi', city: 'Coimbatore', region: 'West', latitude: 10.658, longitude: 77.008, urban: 0.5 },
  { name: 'Tiruppur Bus Stand', nameTamil: 'திருப்பூர் பேருந்து நிலையம்', slug: 'tiruppur-bus-stand', city: 'Tiruppur', region: 'West', latitude: 11.1085, longitude: 77.3411, urban: 0.7 },
  { name: 'Avinashi Road', nameTamil: 'அவிநாசி சாலை', slug: 'avinashi-road', city: 'Tiruppur', region: 'West', latitude: 11.148, longitude: 77.268, urban: 0.62 },
  { name: 'Erode Bus Stand', nameTamil: 'ஈரோடு பேருந்து நிலையம்', slug: 'erode-bus-stand', city: 'Erode', region: 'West', latitude: 11.341, longitude: 77.7172, urban: 0.6 },
  { name: 'Ooty', nameTamil: 'ஊட்டி', slug: 'ooty', city: 'Nilgiris', region: 'West', latitude: 11.4102, longitude: 76.6999, urban: 0.5 },
  { name: 'Coonoor', nameTamil: 'குன்னூர்', slug: 'coonoor', city: 'Nilgiris', region: 'West', latitude: 11.353, longitude: 76.796, urban: 0.42 },
  { name: 'Salem New Bus Stand', nameTamil: 'சேலம் புதிய பேருந்து நிலையம்', slug: 'salem-bus-stand', city: 'Salem', region: 'West', latitude: 11.653, longitude: 78.16, urban: 0.7 },
  { name: 'Hosur', nameTamil: 'ஓசூர்', slug: 'hosur', city: 'Krishnagiri', region: 'North', latitude: 12.7409, longitude: 77.8253, urban: 0.72 },

  // Central / delta
  { name: 'Srirangam', nameTamil: 'ஸ்ரீரங்கம்', slug: 'srirangam', city: 'Tiruchirappalli', region: 'Central', latitude: 10.861, longitude: 78.69, urban: 0.65 },
  { name: 'Thillai Nagar', nameTamil: 'தில்லை நகர்', slug: 'thillai-nagar', city: 'Tiruchirappalli', region: 'Central', latitude: 10.815, longitude: 78.685, urban: 0.68 },
  { name: 'Trichy Central Bus Stand', nameTamil: 'திருச்சி மையப் பேருந்து நிலையம்', slug: 'trichy-bus-stand', city: 'Tiruchirappalli', region: 'Central', latitude: 10.798, longitude: 78.682, urban: 0.7 },
  { name: 'Kumbakonam', nameTamil: 'கும்பகோணம்', slug: 'kumbakonam', city: 'Thanjavur', region: 'Delta', latitude: 10.9602, longitude: 79.3845, urban: 0.5 },
  { name: 'Thanjavur East Gate', nameTamil: 'தஞ்சாவூர் கீழ வாசல்', slug: 'thanjavur-east-gate', city: 'Thanjavur', region: 'Delta', latitude: 10.787, longitude: 79.138, urban: 0.5 },
  { name: 'Neyveli', nameTamil: 'நெய்வேலி', slug: 'neyveli', city: 'Cuddalore', region: 'Delta', latitude: 11.608, longitude: 79.499, urban: 0.45 },
  { name: 'Velankanni', nameTamil: 'வேளாங்கண்ணி', slug: 'velankanni', city: 'Nagapattinam', region: 'Delta', latitude: 10.681, longitude: 79.849, urban: 0.4 },
  { name: 'Katpadi', nameTamil: 'கட்பாடி', slug: 'katpadi', city: 'Vellore', region: 'North', latitude: 12.969, longitude: 79.137, urban: 0.58 },

  // South
  { name: 'Mattuthavani', nameTamil: 'மத்துத்தவணி', slug: 'mattuthavani', city: 'Madurai', region: 'Madurai city', latitude: 9.947, longitude: 78.164, urban: 0.75 },
  { name: 'Goripalayam', nameTamil: 'கோரிபாளையம்', slug: 'goripalayam', city: 'Madurai', region: 'Madurai city', latitude: 9.931, longitude: 78.127, urban: 0.75 },
  { name: 'Arapalayam', nameTamil: 'ஆரப்பாளையம்', slug: 'arapalayam', city: 'Madurai', region: 'Madurai city', latitude: 9.934, longitude: 78.11, urban: 0.72 },
  { name: 'Periyar Bus Stand', nameTamil: 'பெரியார் பேருந்து நிலையம்', slug: 'madurai-periyar', city: 'Madurai', region: 'Madurai city', latitude: 9.919, longitude: 78.114, urban: 0.75 },
  { name: 'Palayamkottai', nameTamil: 'பாளையங்கோட்டை', slug: 'palayamkottai', city: 'Tirunelveli', region: 'South', latitude: 8.713, longitude: 77.756, urban: 0.55 },
  { name: 'Tirunelveli Junction', nameTamil: 'திருநெல்வேலி சந்திப்பு', slug: 'tirunelveli-junction', city: 'Tirunelveli', region: 'South', latitude: 8.7278, longitude: 77.7081, urban: 0.55 },
  { name: 'Thoothukudi Harbour', nameTamil: 'தூத்துக்குடி துறைமுகம்', slug: 'thoothukudi-harbour', city: 'Thoothukudi', region: 'South', latitude: 8.764, longitude: 78.134, urban: 0.55 },
  { name: 'Nagercoil', nameTamil: 'நாகர்கோவில்', slug: 'nagercoil', city: 'Kanniyakumari', region: 'South', latitude: 8.178, longitude: 77.434, urban: 0.58 },
  { name: 'Kanyakumari', nameTamil: 'கன்னியாகுமரி', slug: 'kanyakumari-town', city: 'Kanniyakumari', region: 'South', latitude: 8.0883, longitude: 77.5385, urban: 0.48 },
  { name: 'Rameswaram', nameTamil: 'ராமேஸ்வரம்', slug: 'rameswaram', city: 'Ramanathapuram', region: 'South', latitude: 9.288, longitude: 79.313, urban: 0.4 },
  { name: 'Karaikudi', nameTamil: 'காரைக்குடி', slug: 'karaikudi', city: 'Sivaganga', region: 'South', latitude: 10.066, longitude: 78.773, urban: 0.45 },
  { name: 'Sivakasi', nameTamil: 'சிவகாசி', slug: 'sivakasi', city: 'Virudhunagar', region: 'South', latitude: 9.453, longitude: 77.802, urban: 0.48 },
  { name: 'Rajapalayam', nameTamil: 'ராஜபாளையம்', slug: 'rajapalayam', city: 'Virudhunagar', region: 'South', latitude: 9.452, longitude: 77.553, urban: 0.42 },
  { name: 'Palani', nameTamil: 'பழனி', slug: 'palani', city: 'Dindigul', region: 'South', latitude: 10.45, longitude: 77.521, urban: 0.42 },
  { name: 'Theni Town', nameTamil: 'தேனி', slug: 'theni-town', city: 'Theni', region: 'South', latitude: 10.0104, longitude: 77.4768, urban: 0.4 },
];

export const trafficDistrictPlaces = () =>
  TAMIL_NADU_DISTRICTS.map((d) => ({
    kind: 'district',
    name: d.district,
    nameTamil: DISTRICT_TA[d.district] || d.district,
    slug: d.slug,
    city: d.district,
    region: REGION_BY_DISTRICT[d.district] || 'Tamil Nadu',
    latitude: d.latitude,
    longitude: d.longitude,
    urban: URBAN_WEIGHT[d.district] ?? 0.32,
  }));

export const trafficCityPlaces = () =>
  TAMIL_NADU_CITY_AREAS.map((a) => ({
    kind: 'area',
    name: a.name,
    nameTamil: a.nameTamil,
    slug: a.slug,
    city: a.city,
    region: a.region,
    latitude: a.latitude,
    longitude: a.longitude,
    urban: a.urban ?? 0.6,
  }));

export const fullTrafficCatalog = (extra = []) => {
  const districts = trafficDistrictPlaces();
  const cityAreas = trafficCityPlaces();
  const map = new Map();
  [...districts, ...cityAreas, ...extra].forEach((row) => {
    if (!row?.slug && !row?.name) return;
    const slug = String(row.slug || row.name)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-');
    if (!map.has(slug)) {
      map.set(slug, { ...row, slug, kind: row.kind || 'area' });
    }
  });
  return Array.from(map.values());
};

export default fullTrafficCatalog;
