const feeds = [
  ['Lang1', 'https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3'],
  ['Lang2', 'https://pib.gov.in/RssMain.aspx?ModId=6&Lang=2&Regid=3'],
];

for (const [label, url] of feeds) {
  const r = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept-Language': 'en-IN,en;q=0.9',
    },
  });
  const t = await r.text();
  const titles = [...t.matchAll(/<item[\s\S]*?<title>([\s\S]*?)<\/title>/gi)]
    .slice(0, 2)
    .map((m) => m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim());
  console.log(label, titles);
}
