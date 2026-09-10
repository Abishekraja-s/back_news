const feeds = [
  ['Mod6 R1', 'https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=1'],
  ['Mod6 R3', 'https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3'],
  ['Mod8 R1', 'https://pib.gov.in/RssMain.aspx?ModId=8&Lang=1&Regid=1'],
  ['Mod8 R3', 'https://pib.gov.in/RssMain.aspx?ModId=8&Lang=1&Regid=3'],
  ['ViewRss reg1', 'https://www.pib.gov.in/ViewRss.aspx?lang=1&reg=1'],
];

const script = (t) => {
  if (/[\u0900-\u097F]/.test(t)) return 'hi';
  if (/[\u0B80-\u0BFF]/.test(t)) return 'ta';
  if (/[A-Za-z]/.test(t)) return 'en';
  return '?';
};

for (const [label, url] of feeds) {
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'en-IN,en;q=0.9' } });
  const xml = await r.text();
  const items = [...xml.matchAll(/<item[\s\S]*?<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/gi)].slice(0, 3);
  console.log('\n===', label, 'items', (xml.match(/<item>/gi) || []).length, '===');
  items.forEach((m, i) => {
    const t = m[1].replace(/<[^>]+>/g, '').trim();
    console.log(i + 1, script(t), t.slice(0, 90));
  });
}
