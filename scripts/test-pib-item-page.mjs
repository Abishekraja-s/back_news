import { parseRssItems } from '../services/governmentFetchService.js';

const r = await fetch('https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3', {
  headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://www.pib.gov.in/' },
});
const items = parseRssItems(await r.text()).slice(0, 2);
for (const item of items) {
  console.log('title:', item.title.slice(0, 60));
  console.log('url:', item.officialUrl);
  if (item.officialUrl) {
    const page = await fetch(item.officialUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'en-IN,en;q=0.9' },
    });
    const html = await page.text();
    const enLink = html.match(/href=["']([^"']*erelease[^"']*)["']/i)?.[1]
      || html.match(/href=["']([^"']*PressRelease[^"']*)["']/i)?.[1];
    const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, '').trim();
    console.log('page h1:', h1?.slice(0, 80));
    console.log('en link:', enLink);
  }
  console.log('---');
}
