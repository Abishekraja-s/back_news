import dotenv from 'dotenv';
import mongoose from 'mongoose';
import startMemoryMongo from './memoryMongo.js';
import {
  DEFAULT_CATEGORIES,
  TAMIL_NADU_DISTRICTS,
  ROLES,
  ARTICLE_STATUS,
  COMMENT_STATUS,
  AD_POSITIONS,
} from '../config/constants.js';
import User from '../models/User.js';
import Category from '../models/Category.js';
import Author from '../models/Author.js';
import Article from '../models/Article.js';
import BreakingNews from '../models/BreakingNews.js';
import Setting from '../models/Setting.js';
import Advertisement from '../models/Advertisement.js';
import Comment from '../models/Comment.js';
import Newsletter from '../models/Newsletter.js';
import Tag from '../models/Tag.js';
import slugify from 'slugify';

dotenv.config();

const sampleImages = Array.from({ length: 40 }, (_, i) =>
  `https://picsum.photos/seed/great-india-news-${i + 1}/800/450`
);

const authorImages = [
  'https://picsum.photos/seed/author-rajesh/200/200',
  'https://picsum.photos/seed/author-priya/200/200',
  'https://picsum.photos/seed/author-arjun/200/200',
  'https://picsum.photos/seed/author-lakshmi/200/200',
  'https://picsum.photos/seed/author-karthik/200/200',
];

const tamilHeadlines = [
  'சென்னையில் பல்வேறு பகுதிகளில் கனமழை — பள்ளிகளுக்கு விடுமுறை அறிவிப்பு',
  'தமிழ்நாடு அரசு புதிய கல்வி திட்டம் அறிமுகம் — மாணவர்களுக்கு நல்ல செய்தி',
  'இந்திய கிரிக்கெட் அணி புதிய சாதனை — உலக கோப்பையில் அற்புத வெற்றி',
  'சென்னை IT வளாகத்தில் புதிய முதலீடு — 5000 புதிய வேலைவாய்ப்புகள்',
  'மதுரை மீனாட்சி அம்மன் கோயில் திருவிழா — லட்சக்கணக்கில் பக்தர்கள்',
  'கோயம்புத்தூரில் தொழில்துறை வளர்ச்சி — புதிய தொழிற்சாலைகள் திறப்பு',
  'தமிழக அரசியலில் புதிய திருப்பம் — கூட்டணி கலந்தாலோசனை',
  'சென்னை மெட்ரோ புதிய பாதை — பயணிகளுக்கு வசதி அதிகரிப்பு',
  'திருச்சி அருகே புதிய தொழில்நுட்ப பூங்கா — IT நிறுவனங்கள் ஆர்வம்',
  'சேலம் மாவட்டத்தில் விவசாயிகளுக்கு நீர் வழங்கல் திட்டம்',
  'உலக அளவில் AI தொழில்நுட்ப வளர்ச்சி — இந்தியா முன்னணியில்',
  'தமிழ் சினிமா புதிய படம் வெளியீடு — பாக்ஸ் ஆபீஸில் рекорд',
  'சென்னை விமான நிலையத்தில் புதிய விமான சேவைகள்',
  'தமிழ்நாடு விளையாட்டு வீரர்கள் த nacional பதக்கம் வென்றனர்',
  'கanyakumari கடற்கரையில் சுற்றுலா வளர்ச்சி திட்டம்',
  'புதியதாக தேர்ந்தெடுக்கப்பட்ட முதலமைச்சர் முதல் பேச்சு',
  'ராமநாதபுரam மாவட்டத்தில் புதிய மருத்துவமனை திறப்பு',
  'திருப்பூர் garment industry-க்கு புதிய export policy',
  'ஈரோடு turmeric market-ல் விலை உயர்வு',
  'தஞ்சாவூர் delta region-ல் புதிய irrigation scheme',
  'Chennai Super Kings புதிய season-க்கு practice தொடக்கம்',
  'Rajinikanth புதிய film announcement — fans celebration',
  'Tamil Nadu school exam results — 95% pass rate',
  'Coimbatore smart city project — new milestones',
  'India GDP growth — Tamil Nadu leads southern states',
  'US election impact on India trade relations',
  'Global climate summit — India commitments',
  'ISRO new satellite launch successful',
  'Gold price today in Chennai — slight increase',
  'Petrol diesel price in Tamil Nadu unchanged',
  'NEET exam preparation tips for Tamil Nadu students',
  'Government job notification — 2000 vacancies',
  'Temple festival in Thiruvannamalai — lakhs of devotees',
  'New highway project connecting Chennai to Bangalore',
  'Water scarcity in southern districts — relief measures',
  'Power cut schedule updated for Chennai areas',
  'New bus routes announced for Chennai MTC',
  'Tamil Nadu budget session begins tomorrow',
  'Farmers protest at Delhi borders — Tamil Nadu support',
  'New mobile manufacturing unit in Sriperumbudur',
];

const articleContent = (title) => `
<p><strong>${title}</strong></p>
<p>இந்த செய்தி தொடர்பான முழு விவரங்கள் இ此处 வழங்கப்படுகின்றன. அதிகாரிகள் தங்கள் அதிகாரப்பூர்வ அறிவிப்பை வெளியிட்டுள்ளனர். இந்த நிகழ்வு தமிழ்நாடு மற்றும் இந்தியா முழுவதும் கவனத்தை ஈர்த்துள்ளது.</p>
<h2>முக்கிய அம்சங்கள்</h2>
<p>ந experts கூறுவதாவது, இது ஒரு முக்கியமான முன்னேற்றமாகும். பொதுமக்கள் மற்றும் தொழில்முனைவோர் இந்த முடிவை வரவேற்கின்றனர். மாநில அரசு மேலும் விவரங்களை விரைவில் வெளியிடும் என எதிர்பார்க்கப்படுகிறது.</p>
<blockquote>"இது மக்களுக்கு நல்ல செய்தி" — அதிகாரி</blockquote>
<h3>அடுத்த கட்ட நடவடிக்கைகள்</h3>
<p>அரசு அடுத்த வாரம் கூடுதல் அறிவிப்புகளை வெளியிடும். பாதிக்கப்பட்ட பகுதிகளில் ந relief measures எடுக்கப்படும். மேலும் தகவல்களுக்கு எங்களை தொடர்ந்து follow செய்யுங்கள்.</p>
<ul>
  <li>அதிகாரிகள் விரைவில் ஆய்வு மேற்கொள்ள உள்ளனர்</li>
  <li>பொதுமக்கள் விழிப்புணர்வுடன் இருக்க அறிவுறுத்தப்படுகிறார்கள்</li>
  <li>helpline numbers activated for public queries</li>
</ul>
`;

const seed = async () => {
  try {
    let connected = false;
    const alreadyConnected = mongoose.connection.readyState === 1;

    if (alreadyConnected) {
      connected = true;
    } else if (process.env.MONGODB_URI?.startsWith('mongodb+srv://')) {
      await mongoose.connect(process.env.MONGODB_URI);
      connected = true;
      console.log('Connected to MongoDB Atlas');
    } else {
      try {
        await mongoose.connect(process.env.MONGODB_URI);
        connected = true;
        console.log('Connected to MongoDB');
      } catch {
        console.log('Local MongoDB unavailable, starting in-memory database...');
        await startMemoryMongo();
        await mongoose.connect(process.env.MONGODB_URI);
        connected = true;
        console.log('Connected to in-memory MongoDB');
      }
    }

    if (!connected) throw new Error('Could not connect to database');
    console.log('Clearing existing data...');

    await Promise.all([
      User.deleteMany(),
      Category.deleteMany(),
      Author.deleteMany(),
      Article.deleteMany(),
      BreakingNews.deleteMany(),
      Setting.deleteMany(),
      Advertisement.deleteMany(),
      Comment.deleteMany(),
      Newsletter.deleteMany(),
      Tag.deleteMany(),
    ]);

    // ── Users ──
    console.log('Creating users...');
    const admin = await User.create({
      name: 'Super Admin',
      email: 'admin@thegreatindianews.com',
      password: 'admin123',
      role: ROLES.SUPER_ADMIN,
    });

    await User.create([
      { name: 'Editor User', email: 'editor@thegreatindianews.com', password: 'editor123', role: ROLES.EDITOR },
      { name: 'Reporter One', email: 'reporter@thegreatindianews.com', password: 'reporter123', role: ROLES.REPORTER },
      { name: 'Ad Manager', email: 'ads@thegreatindianews.com', password: 'ads123', role: ROLES.AD_MANAGER },
    ]);

    // ── Categories ──
    console.log('Creating categories...');
    const categories = {};
    for (const cat of DEFAULT_CATEGORIES) {
      categories[cat.slug] = await Category.create({ ...cat, status: 'active' });
    }

    // ── Districts ──
    console.log('Creating districts...');
    const districts = {};
    for (let i = 0; i < TAMIL_NADU_DISTRICTS.length; i++) {
      const d = TAMIL_NADU_DISTRICTS[i];
      if (categories[d.slug]) {
        districts[d.slug] = await Category.findByIdAndUpdate(
          categories[d.slug]._id,
          { isDistrict: true, parent: categories.district._id },
          { new: true }
        );
      } else {
        districts[d.slug] = await Category.create({
          ...d,
          isDistrict: true,
          parent: categories.district._id,
          order: i + 1,
          status: 'active',
        });
      }
    }

    // ── Authors ──
    console.log('Creating authors...');
    const authors = await Author.create([
      {
        name: 'ராஜேஷ் குமார்',
        slug: 'rajesh-kumar',
        designation: 'Senior Reporter',
        bio: '10+ years experience in Tamil journalism covering politics and current affairs.',
        profileImage: authorImages[0],
        socialLinks: { twitter: 'https://twitter.com/rajesh', facebook: 'https://facebook.com/rajesh' },
      },
      {
        name: 'பriya சுந்தர்',
        slug: 'priya-sundar',
        designation: 'Correspondent',
        bio: 'Chennai-based correspondent specializing in local news and community stories.',
        profileImage: authorImages[1],
      },
      {
        name: 'அrjun மேனன்',
        slug: 'arjun-menon',
        designation: 'Sports Editor',
        bio: 'Sports journalist covering cricket, football and Olympic events.',
        profileImage: authorImages[2],
      },
      {
        name: 'லakshmi ராணி',
        slug: 'lakshmi-rani',
        designation: 'Feature Writer',
        bio: 'Covers cinema, culture and lifestyle stories from Tamil Nadu.',
        profileImage: authorImages[3],
      },
      {
        name: 'கarthik செல்வam',
        slug: 'karthik-selvam',
        designation: 'Business Reporter',
        bio: 'Reports on economy, startups and business developments.',
        profileImage: authorImages[4],
      },
    ]);

    // ── Tags ──
    console.log('Creating tags...');
    const tagNames = ['சென்னை', 'தமிழ்நாடு', 'அரசியல்', 'விளையாட்டு', 'சினிமா', 'வணிகம்', 'கல்வி', 'breaking'];
    for (const name of tagNames) {
      await Tag.create({ name, slug: slugify(name, { lower: true, strict: false }) || name, count: 5 });
    }

    // ── Articles ──
    console.log('Creating articles...');
    const categorySlugs = Object.keys(categories).filter((s) => s !== 'district');
    const districtSlugs = Object.keys(districts);
    const createdArticles = [];

    for (let i = 0; i < tamilHeadlines.length; i++) {
      const title = tamilHeadlines[i];
      const baseSlug = slugify(title, { lower: true, strict: false }).slice(0, 60) || `article-${i + 1}`;
      const catSlug = categorySlugs[i % categorySlugs.length];

      const article = await Article.create({
        title,
        slug: `${baseSlug}-${i + 1}`,
        excerpt: `${title} — முழு விவரங்களுக்கு படிக்கவும்.`,
        content: articleContent(title),
        featuredImage: sampleImages[i % sampleImages.length],
        imageAlt: title,
        imageCaption: 'Representative image | The Great India News',
        category: categories[catSlug]._id,
        district: i < districtSlugs.length ? districts[districtSlugs[i]]._id : districts.chennai._id,
        author: authors[i % authors.length]._id,
        tags: ['செய்தி', 'தமிழ்நாடு', catSlug],
        status: ARTICLE_STATUS.PUBLISHED,
        publishedAt: new Date(Date.now() - i * 3600000),
        seoTitle: title,
        metaDescription: `${title} — The Great India News`,
        ogTitle: title,
        ogDescription: `${title} — Latest Tamil News`,
        views: Math.floor(Math.random() * 8000) + 200,
        isFeatured: i < 5,
        isBreaking: i === 0,
        isMustWatch: i < 6,
        audioReader: i < 10 ? 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' : '',
        youtubeVideoLink: i < 10 ? 'https://www.youtube.com/watch?v=21X5lGlDOfg' : '',
        createdBy: admin._id,
      });
      createdArticles.push(article);
    }

    // Live article with updates
    await Article.create({
      title: 'LIVE: சென்னையில் கனமழை — நேரடி புதுப்பிப்புகள்',
      slug: 'live-chennai-heavy-rain-updates',
      excerpt: 'சென்னையில் கனமழை தொடர்பான நேரடி செய்தி புதுப்பிப்புகள்',
      content: articleContent('LIVE: Chennai Heavy Rain'),
      featuredImage: sampleImages[0],
      category: categories.chennai._id,
      district: districts.chennai._id,
      author: authors[0]._id,
      tags: ['live', 'சென்னை', 'மழை'],
      status: ARTICLE_STATUS.PUBLISHED,
      publishedAt: new Date(),
      isLive: true,
      isFeatured: true,
      isBreaking: true,
      views: 12000,
      liveUpdates: [
        { time: '11:30 AM', updateText: 'சென்னையில் பல பகுதிகளில் கனமழை — சாலைகளில் தண்ணீர் தேங்கியுள்ளது' },
        { time: '11:45 AM', updateText: 'GCC அதிகாரிகள் புதிய அறிவிப்பு — low-lying areas-ல் வெள்ள எச்சரிக்கை' },
        { time: '12:05 PM', updateText: 'மேலும் தகவல்கள் வெளியாகியுள்ளன — பள்ளிகளுக்கு விடுமுறை அறிவிப்பு' },
        { time: '12:30 PM', updateText: 'மetro rail services running normally — CM office monitoring situation' },
      ],
      createdBy: admin._id,
    });

    // Draft, pending, scheduled articles
    await Article.create([
      {
        title: 'வரை черновик: புதிய தொ.transport policy விவரங்கள்',
        slug: 'draft-transport-policy',
        excerpt: 'Draft article about transport policy',
        content: '<p>Draft content — not yet published.</p>',
        category: categories.politics._id,
        author: authors[1]._id,
        status: ARTICLE_STATUS.DRAFT,
        createdBy: admin._id,
      },
      {
        title: 'review-க்காக: புதிய health scheme announcement',
        slug: 'pending-health-scheme',
        excerpt: 'Pending review article',
        content: articleContent('Health Scheme'),
        featuredImage: sampleImages[2],
        category: categories.india._id,
        author: authors[2]._id,
        status: ARTICLE_STATUS.PENDING,
        createdBy: admin._id,
      },
      {
        title: 'நாளை வெளியாகும்: புதிய budget highlights',
        slug: 'scheduled-budget-highlights',
        excerpt: 'Scheduled for tomorrow',
        content: articleContent('Budget Highlights'),
        featuredImage: sampleImages[3],
        category: categories.business._id,
        author: authors[4]._id,
        status: ARTICLE_STATUS.SCHEDULED,
        scheduledAt: new Date(Date.now() + 86400000),
        createdBy: admin._id,
      },
    ]);

    // ── Breaking News ──
    console.log('Creating breaking news...');
    await BreakingNews.create([
      {
        text: '🔴 சென்னையில் பல்வேறு பகுதிகளில் கனமழை — பள்ளிகளுக்கு விடுமுறை அறிவிப்பு',
        link: '/news/live-chennai-heavy-rain-updates',
        priority: 10,
        isActive: true,
        createdBy: admin._id,
      },
      {
        text: 'தமிழ்நாடு அரசு புதிய கல்வி திட்டம் அறிமுகம் — மாணவர்களுக்கு நல்ல செய்தி',
        priority: 8,
        isActive: true,
        createdBy: admin._id,
      },
      {
        text: 'Gold price today: Chennai-ல் தங்கம் விலை சிறிது உயர்வு',
        priority: 5,
        isActive: true,
        createdBy: admin._id,
      },
      {
        text: 'Expired breaking news item (should be hidden)',
        priority: 1,
        isActive: true,
        endTime: new Date(Date.now() - 86400000),
        createdBy: admin._id,
      },
    ]);

    // ── Advertisements ──
    console.log('Creating advertisements...');
    const adImage = 'https://picsum.photos/seed/great-india-ad/728/90';
    for (const position of AD_POSITIONS) {
      await Advertisement.create({
        title: `Sample Ad — ${position}`,
        position,
        type: 'image',
        image: adImage,
        link: 'https://thegreatindianews.com',
        isActive: true,
        priority: 1,
      });
    }

    // ── Comments ──
    console.log('Creating comments...');
    if (createdArticles.length >= 3) {
      await Comment.create([
        {
          name: 'ராமu',
          email: 'ramu@example.com',
          content: 'மிகவும் பயனுள்ள செய்தி. நன்றி!',
          article: createdArticles[0]._id,
          status: COMMENT_STATUS.APPROVED,
        },
        {
          name: 'Priya',
          email: 'priya@example.com',
          content: 'Good reporting. Keep it up!',
          article: createdArticles[0]._id,
          status: COMMENT_STATUS.APPROVED,
        },
        {
          name: 'Anonymous',
          email: 'spam@example.com',
          content: 'Pending moderation comment',
          article: createdArticles[1]._id,
          status: COMMENT_STATUS.PENDING,
        },
      ]);
    }

    // ── Newsletter ──
    console.log('Creating newsletter subscribers...');
    const subscribers = ['subscriber1@example.com', 'subscriber2@example.com', 'news@example.com'];
    for (const email of subscribers) {
      await Newsletter.findOneAndUpdate({ email }, { email, status: 'active' }, { upsert: true });
    }

    // ── Settings ──
    console.log('Creating settings...');
    const settings = {
      siteName: 'The Great India News',
      siteNameTamil: 'தி கிரேட் இந்தியா நியூஸ்',
      contactEmail: 'contact@thegreatindianews.com',
      contactPhone: '+91 9876543210',
      address: 'Chennai, Tamil Nadu, India',
      footerText: '© 2026 The Great India News. All rights reserved.',
      defaultSeoTitle: 'The Great India News - Latest Tamil News',
      defaultMetaDescription: 'Latest Tamil news from Tamil Nadu, India and World.',
      socialFacebook: 'https://facebook.com/thegreatindianews',
      socialTwitter: 'https://twitter.com/thegreatindianews',
      socialYoutube: 'https://youtube.com/thegreatindianews',
      commentsEnabled: true,
    };

    for (const [key, value] of Object.entries(settings)) {
      await Setting.create({ key, value, group: 'general' });
    }

    // ── Summary ──
    const counts = {
      users: await User.countDocuments(),
      categories: await Category.countDocuments(),
      authors: await Author.countDocuments(),
      articles: await Article.countDocuments(),
      breakingNews: await BreakingNews.countDocuments(),
      ads: await Advertisement.countDocuments(),
      comments: await Comment.countDocuments(),
      subscribers: await Newsletter.countDocuments(),
    };

    console.log('\n✅ Database seeded successfully!\n');
    console.log('Records created:');
    Object.entries(counts).forEach(([k, v]) => console.log(`  ${k}: ${v}`));

    console.log('\n── Login Credentials ──');
    console.log('Super Admin : admin@thegreatindianews.com / admin123');
    console.log('Editor      : editor@thegreatindianews.com / editor123');
    console.log('Reporter    : reporter@thegreatindianews.com / reporter123');
    console.log('Ad Manager  : ads@thegreatindianews.com / ads123');

    return counts;
  } catch (error) {
    console.error('\n❌ Seed failed:', error.message);
    if (error.message.includes('ECONNREFUSED')) {
      console.error('\nMongoDB is not running. The seed will try in-memory MongoDB automatically.');
    }
    throw error;
  }
};

export default seed;

// Run directly via: npm run seed
const isDirectRun = process.argv[1]?.includes('seed.js');
if (isDirectRun) {
  seed()
    .then(async () => {
      if (process.env.SEED_SKIP_DISCONNECT !== '1') {
        await mongoose.disconnect();
      }
      process.exit(0);
    })
    .catch(async () => {
      process.exit(1);
    });
}
