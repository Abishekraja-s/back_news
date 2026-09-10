for (const id of [20, 22, 1, 2, 3]) {
  const u = `https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=${id}`;
  const t = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0' } }).then((r) => r.text());
  const title = [...t.matchAll(/<item[\s\S]*?<title>([\s\S]*?)<\/title>/gi)][0]?.[1]
    ?.replace(/<!\[CDATA\[|\]\]>/g, '')
    .trim();
  const isDevanagari = /[\u0900-\u097F]/.test(title || '');
  console.log('Regid', id, isDevanagari ? 'HINDI' : 'EN?', title?.slice(0, 90));
}
