const u = 'https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=1';
const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0' } });
const xml = await r.text();
const count = (xml.match(/<item>/gi) || []).length;
console.log('Regid=1 items:', count);
const titles = [...xml.matchAll(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/gi)].slice(1, 4);
titles.forEach((m, i) => {
  const t = m[1].replace(/<[^>]+>/g, '').trim();
  console.log(i + 1, /[\u0900-\u097F]/.test(t) ? 'HINDI' : 'EN?', t.slice(0, 100));
});
