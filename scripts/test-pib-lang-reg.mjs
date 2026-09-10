for (const lang of [1, 2]) {
  for (const reg of [1, 2, 3, 20, 22]) {
    const u = `https://pib.gov.in/RssMain.aspx?ModId=6&Lang=${lang}&Regid=${reg}`;
    const t = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0' } }).then((r) => r.text());
    const title = [...t.matchAll(/<item[\s\S]*?<title>([\s\S]*?)<\/title>/gi)][0]?.[1]
      ?.replace(/<!\[CDATA\[|\]\]>/g, '')
      .trim();
    if (!title) continue;
    const script = /[\u0900-\u097F]/.test(title) ? 'hi' : 'latin';
    console.log(`Lang=${lang} Regid=${reg}`, script, title.slice(0, 80));
  }
}
