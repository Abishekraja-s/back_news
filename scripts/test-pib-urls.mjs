const urls = [
  'https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3',
  'https://pib.gov.in/RssMain.aspx?ModId=6&Lang=2&Regid=3',
  'https://pib.gov.in/RssMain.aspx?ModId=6&Lang=0&Regid=3',
  'https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=1',
  'https://pib.gov.in/RssMain.aspx?ModId=6&Lang=2&Regid=1',
  'https://www.pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3',
  'https://pib.gov.in/RssMain.aspx?ModId=2&Lang=1&Regid=3',
  'https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3&LangType=1',
];

for (const url of urls) {
  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'application/rss+xml, application/xml, text/xml, */*',
        'Accept-Language': 'en-IN,en;q=0.9',
      },
    });
    const t = await r.text();
    const title = [...t.matchAll(/<item[\s\S]*?<title>([\s\S]*?)<\/title>/gi)][0]?.[1]
      ?.replace(/<!\[CDATA\[|\]\]>/g, '')
      .trim()
      .slice(0, 80);
    console.log(r.status, url.split('?')[1], '→', title || 'NO ITEMS');
  } catch (e) {
    console.log('ERR', url, e.message);
  }
}
