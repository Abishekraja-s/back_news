import Article from '../models/Article.js';
import Category from '../models/Category.js';
import { ARTICLE_STATUS } from '../config/constants.js';

const getClientBaseUrl = () => {
  const url = process.env.CLIENT_URL || 'http://localhost:5173';
  return url.split(',')[0].trim();
};

export const getSitemap = async (req, res, next) => {
  try {
    const baseUrl = getClientBaseUrl();
    const articles = await Article.find({
      status: ARTICLE_STATUS.PUBLISHED,
      publishedAt: { $lte: new Date() },
    })
      .select('slug updatedAt publishedAt')
      .sort({ publishedAt: -1 })
      .lean();

    const categories = await Category.find({ status: 'active', isDistrict: false }).select('slug updatedAt').lean();
    const districts = await Category.find({ status: 'active', isDistrict: true }).select('slug updatedAt').lean();

    const staticPages = [
      '', 'about', 'contact', 'privacy-policy', 'terms', 'editorial-policy',
      'correction-policy', 'copyright', 'grievance',
      'india', 'world', 'politics', 'business', 'sports', 'cinema',
      'technology', 'education', 'jobs', 'spiritual', 'special', 'tamil-nadu',
    ];

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    staticPages.forEach((page) => {
      xml += `  <url><loc>${baseUrl}/${page}</loc><changefreq>daily</changefreq><priority>0.8</priority></url>\n`;
    });

    categories.forEach((cat) => {
      xml += `  <url><loc>${baseUrl}/${cat.slug}</loc><lastmod>${cat.updatedAt.toISOString()}</lastmod><changefreq>hourly</changefreq><priority>0.9</priority></url>\n`;
    });

    districts.forEach((d) => {
      xml += `  <url><loc>${baseUrl}/tamil-nadu/${d.slug}</loc><lastmod>${d.updatedAt.toISOString()}</lastmod><changefreq>hourly</changefreq><priority>0.8</priority></url>\n`;
    });

    articles.forEach((article) => {
      xml += `  <url><loc>${baseUrl}/news/${article.slug}</loc><lastmod>${article.updatedAt.toISOString()}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>\n`;
    });

    xml += '</urlset>';

    res.header('Content-Type', 'application/xml');
    res.send(xml);
  } catch (error) {
    next(error);
  }
};

export const getNewsSitemap = async (req, res, next) => {
  try {
    const baseUrl = getClientBaseUrl();
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

    const articles = await Article.find({
      status: ARTICLE_STATUS.PUBLISHED,
      publishedAt: { $gte: twoDaysAgo, $lte: new Date() },
    })
      .select('title slug publishedAt')
      .sort({ publishedAt: -1 })
      .lean();

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n';
    xml += '        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n';

    articles.forEach((article) => {
      xml += '  <url>\n';
      xml += `    <loc>${baseUrl}/news/${article.slug}</loc>\n`;
      xml += '    <news:news>\n';
      xml += '      <news:publication>\n';
      xml += '        <news:name>The Great India News</news:name>\n';
      xml += '        <news:language>ta</news:language>\n';
      xml += '      </news:publication>\n';
      xml += `      <news:publication_date>${article.publishedAt.toISOString()}</news:publication_date>\n`;
      xml += `      <news:title>${article.title.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</news:title>\n`;
      xml += '    </news:news>\n';
      xml += '  </url>\n';
    });

    xml += '</urlset>';

    res.header('Content-Type', 'application/xml');
    res.send(xml);
  } catch (error) {
    next(error);
  }
};

export const getRobots = async (req, res, next) => {
  try {
    const { getOrCreateConfig, mergeConfig, buildRobotsText } = await import('./aeoController.js');
    const aeoDoc = await getOrCreateConfig();
    const aeo = mergeConfig(aeoDoc.config);
    const baseUrl = (aeo.canonicalBaseUrl || getClientBaseUrl()).replace(/\/$/, '');
    res.header('Content-Type', 'text/plain');
    res.send(buildRobotsText(aeo, baseUrl));
  } catch (error) {
    next(error);
  }
};
