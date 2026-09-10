const prids = ['2304473', '2304465', '2304482'];
const urls = [
  'https://pib.gov.in/PressReleasePage.aspx?PRID=2304473',
  'https://pib.gov.in/PressReleasePage.aspx?PRID=2304473&lang=1',
  'https://pib.gov.in/PressReleasePage.aspx?PRID=2304473&reg=1&lang=1',
  'https://pib.gov.in/PressReleasePage.aspx?PRID=2304465',
  'https://pib.gov.in/PressReleasePage.aspx?PRID=2304465&lang=1',
];

const titleFrom = (html) => {
  const m =
    html.match(/<h2[^>]*class=["'][^"']*title[^"']*["'][^>]*>([\s\S]*?)<\/h2>/i) ||
    html.match(/<span[^>]*id=["']lblTitle["'][^>]*>([\s\S]*?)<\/span>/i) ||
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<title>([\s\S]*?)<\/title>/i);
  return m?.[1]?.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
};

for (const url of urls) {
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'en-IN,en;q=0.9' } });
  const html = await r.text();
  const t = titleFrom(html);
  const script = /[\u0900-\u097F]/.test(t || '') ? 'hi' : /[A-Za-z]/.test(t || '') ? 'en' : '?';
  console.log(script, url.split('?')[1], '→', t?.slice(0, 100));
}
