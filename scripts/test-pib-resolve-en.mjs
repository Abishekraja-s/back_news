import { parseRssItems } from '../services/governmentFetchService.js';

const r = await fetch('https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3', {
  headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://www.pib.gov.in/' },
});
const item = parseRssItems(await r.text())[0];
console.log('RSS url:', item.officialUrl);

const page = await fetch(item.officialUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
const html = await page.text();
const links = [...html.matchAll(/href=["']([^"']*PressReleasePage\.aspx\?PRID=\d+[^"']*)["']/gi)].map((m) =>
  m[1].replace(/&amp;/g, '&')
);
console.log('press links:', [...new Set(links)]);

for (const link of [...new Set(links)].slice(0, 3)) {
  const full = link.startsWith('http') ? link : `https://pib.gov.in/${link.replace(/^\//, '')}`;
  const pr = await fetch(full, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'en-IN,en;q=0.9' } });
  const h = await pr.text();
  const title =
    h.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
    h.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, ' ').trim();
  console.log(/[\u0900-\u097F]/.test(title || '') ? 'hi' : 'en', full, '→', title?.slice(0, 80));
}
