/**
 * Seed 50 approved Matrimony profiles with AI portrait images + full details.
 * Usage: node utils/seedMatrimony.js
 * Optional: node utils/seedMatrimony.js --reset   (delete seeded demo profiles first)
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import crypto from 'crypto';
import MatrimonyProfile from '../models/MatrimonyProfile.js';
import MatrimonyCategory from '../models/MatrimonyCategory.js';
import MatrimonyConfig from '../models/MatrimonyConfig.js';
import { MATRIMONY_PROFILE_STATUS } from '../config/constants.js';

dotenv.config();

const COUNT = 50;
const PREFIX = 'GIN-M-DEMO';

const FEMALE_FIRST = [
  'Ananya', 'Priya', 'Divya', 'Keerthana', 'Lakshmi', 'Meera', 'Nithya', 'Pavithra',
  'Shalini', 'Sneha', 'Deepika', 'Harini', 'Ishwarya', 'Janani', 'Kavya', 'Lavanya',
  'Madhumitha', 'Nandhini', 'Oviya', 'Ramya', 'Saranya', 'Thenmozhi', 'Vidhya', 'Yazhini',
  'Aishwarya',
];
const MALE_FIRST = [
  'Arun', 'Karthik', 'Vignesh', 'Suresh', 'Prakash', 'Rajesh', 'Ganesh', 'Hari',
  'Dinesh', 'Manoj', 'Naveen', 'Pradeep', 'Ramesh', 'Sathish', 'Vijay', 'Ajith',
  'Balaji', 'Chandru', 'Deepak', 'Gokul', 'Kishore', 'Lokesh', 'Mahesh', 'Praveen', 'Santhosh',
];
const LAST = [
  'Kumar', 'Rajan', 'Subramanian', 'Iyer', 'Nair', 'Reddy', 'Pillai', 'Krishnan',
  'Murugan', 'Selvam', 'Natarajan', 'Venkatesan', 'Ganesan', 'Sundaram', 'Raman',
];
const CITIES = [
  'Chennai', 'Coimbatore', 'Madurai', 'Trichy', 'Salem', 'Tirunelveli', 'Erode',
  'Vellore', 'Thanjavur', 'Nagercoil', 'Hosur', 'Pondicherry',
];
const CASTES = ['Iyer', 'Iyengar', 'Mudaliar', 'Pillai', 'Nadar', 'Gounder', 'Chettiar', 'Thevar', 'Vanniyar', 'Nair'];
const RASI = ['Mesham', 'Rishabam', 'Mithunam', 'Katakam', 'Simmam', 'Kanni', 'Thulam', 'Vrischikam', 'Dhanusu', 'Makaram', 'Kumbam', 'Meenam'];
const NAKSHATRA = [
  'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashirsha', 'Ardra', 'Punarvasu',
  'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni', 'Hasta', 'Chitra',
];
const EDUCATION = [
  'B.E. Computer Science', 'B.Tech IT', 'MBA', 'M.Sc Chemistry', 'B.Com', 'CA',
  'MBBS', 'B.Sc Nursing', 'M.E. Mechanical', 'B.A. English', 'M.Tech', 'BDS',
  'B.E. ECE', 'M.Com', 'BBA',
];
const PROFESSIONS = [
  'Software Engineer', 'Doctor', 'Teacher', 'Bank Officer', 'Chartered Accountant',
  'Business Analyst', 'Nurse', 'Civil Engineer', 'HR Manager', 'Pharmacist',
  'Data Analyst', 'Advocate', 'Government Employee', 'Entrepreneur', 'Architect',
];
const COMPANIES = [
  'TCS', 'Infosys', 'Cognizant', 'Wipro', 'Zoho', 'Amazon', 'Google', 'HCL',
  'Apollo Hospitals', 'SBI', 'Private Practice', 'Self Employed',
];
const HEIGHTS_F = [`5'0"`, `5'1"`, `5'2"`, `5'3"`, `5'4"`, `5'5"`, `5'6"`, `5'7"`];
const HEIGHTS_M = [`5'5"`, `5'6"`, `5'7"`, `5'8"`, `5'9"`, `5'10"`, `5'11"`, `6'0"`];
const COMPLEXION = ['Fair', 'Wheatish', 'Medium', 'Dark'];
const BODY = ['Slim', 'Athletic', 'Average'];
const FOOD = ['Vegetarian', 'Eggetarian', 'Non-Vegetarian'];
const HOBBIES = [
  'Reading, Music', 'Travel, Photography', 'Cooking, Yoga', 'Cricket, Movies',
  'Classical dance, Painting', 'Cycling, Blogging', 'Temple visits, Gardening',
];

const pick = (arr, i) => arr[i % arr.length];
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

/** AI portrait via Pollinations (stable per seed) */
const aiPortrait = (seed, gender, age) => {
  const who = gender === 'male' ? 'Indian man' : 'Indian woman';
  const prompt = encodeURIComponent(
    `professional headshot portrait photo of a ${who} age ${age}, natural lighting, realistic, high quality studio photo`
  );
  return `https://image.pollinations.ai/prompt/${prompt}?width=512&height=512&seed=${seed}&nologo=true&enhance=true`;
};

const buildDob = (age) => {
  const year = new Date().getFullYear() - age;
  const month = rand(0, 11);
  const day = rand(1, 28);
  return new Date(year, month, day);
};

const ensureCategories = async () => {
  const defaults = [
    { name: 'Bride', nameTamil: 'மணமகள்', slug: 'bride', order: 1 },
    { name: 'Groom', nameTamil: 'மணமகன்', slug: 'groom', order: 2 },
    { name: 'Professional', nameTamil: 'தொழில்முறை', slug: 'professional', order: 3 },
  ];
  const out = [];
  for (const d of defaults) {
    let cat = await MatrimonyCategory.findOne({ slug: d.slug });
    if (!cat) cat = await MatrimonyCategory.create({ ...d, isActive: true });
    out.push(cat);
  }
  return out;
};

const buildProfile = (i, categories) => {
  const gender = i % 2 === 0 ? 'female' : 'male';
  const first = gender === 'female' ? pick(FEMALE_FIRST, i) : pick(MALE_FIRST, i);
  const last = pick(LAST, i + 3);
  const fullName = `${first} ${last}`;
  const age = rand(24, 36);
  const city = pick(CITIES, i);
  const religion = 'Hindu';
  const caste = pick(CASTES, i);
  const education = pick(EDUCATION, i);
  const profession = pick(PROFESSIONS, i + 1);
  const profileId = `${PREFIX}-${String(i + 1).padStart(3, '0')}`;
  const seed = 9000 + i;
  const category = gender === 'female' ? categories[0] : categories[1];
  const featured = i % 7 === 0;
  const verified = i % 3 === 0;

  const hash = crypto
    .createHash('sha256')
    .update(`${fullName}|${gender}|${age}|demo-${i}`)
    .digest('hex');

  return {
    profileId,
    fullName,
    profilePhoto: aiPortrait(seed, gender, age),
    photos: [aiPortrait(seed + 100, gender, age)],
    gender,
    dateOfBirth: buildDob(age),
    age,
    birthTime: `${String(rand(5, 11)).padStart(2, '0')}:${String(rand(0, 59)).padStart(2, '0')} AM`,
    birthPlace: pick(CITIES, i + 2),
    nativePlace: pick(CITIES, i + 5),
    currentLocation: city,
    maritalStatus: i % 11 === 0 ? 'divorced' : 'never_married',
    motherTongue: 'Tamil',
    religion,
    caste,
    subCaste: '',
    rasi: pick(RASI, i),
    nakshatra: pick(NAKSHATRA, i),
    lagnam: pick(RASI, i + 4),
    gothram: pick(['Bharadwaja', 'Kashyapa', 'Atri', 'Vasishta', 'Agastya'], i),
    birthStar: pick(NAKSHATRA, i + 2),
    dosham: i % 5 === 0 ? 'Chevvai dosham — mild' : 'No dosham',
    height: gender === 'female' ? pick(HEIGHTS_F, i) : pick(HEIGHTS_M, i),
    weight: `${rand(48, 78)} kg`,
    bodyType: pick(BODY, i),
    complexion: pick(COMPLEXION, i),
    physicalStatus: 'normal',
    bloodGroup: pick(['A+', 'B+', 'O+', 'AB+', 'A-', 'B-', 'O-'], i),
    education,
    college: pick(['Anna University', 'Madras University', 'PSG College', 'NIT Trichy', 'SRM', 'VIT'], i),
    profession,
    company: pick(COMPANIES, i),
    jobLocation: city,
    annualIncome: pick(['₹4–6 LPA', '₹6–8 LPA', '₹8–12 LPA', '₹12–18 LPA', '₹18–25 LPA'], i),
    workExperience: `${rand(2, 12)} years`,
    fatherName: `${pick(MALE_FIRST, i + 8)} ${last}`,
    fatherOccupation: pick(['Business', 'Retired Teacher', 'Farmer', 'Government Employee', 'Engineer'], i),
    motherName: `${pick(FEMALE_FIRST, i + 4)} ${last}`,
    motherOccupation: pick(['Homemaker', 'Teacher', 'Tailor', 'Nurse'], i),
    brotherName: i % 2 === 0 ? `${pick(MALE_FIRST, i + 1)} ${last}` : '',
    brotherMaritalStatus: i % 2 === 0 ? pick(['Married', 'Unmarried'], i) : '',
    sisterName: i % 3 === 0 ? `${pick(FEMALE_FIRST, i + 2)} ${last}` : '',
    sisterMaritalStatus: i % 3 === 0 ? pick(['Married', 'Unmarried'], i) : '',
    numberOfBrothers: i % 2 === 0 ? 1 : 0,
    numberOfSisters: i % 3 === 0 ? 1 : 0,
    familyType: pick(['Joint', 'Nuclear'], i),
    familyStatus: pick(['Middle class', 'Upper middle class'], i),
    familyLocation: pick(CITIES, i + 1),
    address: `${rand(10, 99)}, ${pick(['Gandhi Street', 'Nehru Nagar', 'Anna Nagar', 'KK Nagar'], i)}`,
    city,
    district: city,
    state: 'Tamil Nadu',
    country: 'India',
    mobile: `9${String(800000000 + i).slice(0, 9)}`,
    alternateMobile: '',
    email: `${first.toLowerCase()}.${last.toLowerCase()}${i}@example.com`,
    preferredContactMethod: 'mobile',
    prefAgeMin: gender === 'female' ? age - 2 : age - 5,
    prefAgeMax: gender === 'female' ? age + 6 : age + 2,
    prefHeightMin: gender === 'female' ? `5'5"` : `5'0"`,
    prefHeightMax: gender === 'female' ? `6'0"` : `5'8"`,
    prefReligion: 'Hindu',
    prefCaste: '',
    prefEducation: 'Graduate',
    prefProfession: '',
    prefLocation: 'Tamil Nadu / Anywhere in India',
    prefMaritalStatus: 'never_married',
    otherExpectations: 'Looking for a well-educated, respectful partner with similar family values.',
    aboutMe: `I am ${fullName}, a ${age}-year-old ${profession.toLowerCase()} based in ${city}. I value family, honesty and a balanced lifestyle. Interested in meeting a like-minded life partner.`,
    hobbies: pick(HOBBIES, i),
    interests: 'Travel, family gatherings, spiritual activities',
    foodHabits: pick(FOOD, i),
    smoking: 'no',
    drinking: i % 8 === 0 ? 'occasionally' : 'no',
    languagesKnown: 'Tamil, English',
    category: category._id,
    categoryName: category.name,
    status: MATRIMONY_PROFILE_STATUS.APPROVED,
    isActive: true,
    isVerified: verified,
    isFeatured: featured,
    isVisible: true,
    approvedAt: new Date(),
    verifiedAt: verified ? new Date() : undefined,
    featuredAt: featured ? new Date() : undefined,
    adminNotes: 'Demo seed profile',
    submissionHash: hash,
    history: [
      { action: 'created', note: 'Seeded demo profile', at: new Date() },
      { action: 'approved', note: 'Auto-approved seed', at: new Date() },
    ],
  };
};

const run = async () => {
  const reset = process.argv.includes('--reset');
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI missing in .env');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  await MatrimonyConfig.findOneAndUpdate(
    { key: 'default' },
    {
      $setOnInsert: {
        key: 'default',
        enabled: true,
        homepageTitle: 'Matrimony Profiles',
        homepageTitleTa: 'திருமண சுயவிவரங்கள்',
        showOnExplore: true,
      },
    },
    { upsert: true }
  );

  if (reset) {
    const del = await MatrimonyProfile.deleteMany({ profileId: new RegExp(`^${PREFIX}-`) });
    console.log(`Removed ${del.deletedCount} existing demo profiles`);
  }

  const categories = await ensureCategories();
  let created = 0;
  let skipped = 0;

  for (let i = 0; i < COUNT; i += 1) {
    const data = buildProfile(i, categories);
    const exists = await MatrimonyProfile.findOne({ profileId: data.profileId });
    if (exists) {
      skipped += 1;
      continue;
    }
    await MatrimonyProfile.create(data);
    created += 1;
    if ((i + 1) % 10 === 0) console.log(`… ${i + 1}/${COUNT}`);
  }

  console.log(`Done. Created ${created}, skipped ${skipped}. Total demo IDs: ${PREFIX}-001 … ${PREFIX}-050`);
  console.log('Open /matrimony and Admin → Matrimony → Approved to view.');
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
