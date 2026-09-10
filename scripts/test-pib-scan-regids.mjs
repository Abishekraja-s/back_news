for (let reg = 1; reg <= 25; reg++) {
  const u = `https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=${reg}`;
  try {
    const t = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0' } }).then((r) => r.text());
    const titles = [...t.matchAll(/<item[\s\S]*?<title>([\s\S]*?)<\/title>/gi)]
      .slice(0, 1)
      .map((m) => m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim());
    if (!titles.length) continue;
    const title = titles[0];
    const script = /[\u0900-\u097F]/.test(title) ? 'hi' : /[\u0B80-\u0BFF]/.test(title) ? 'ta' : 'en';
    console.log('Regid', reg, script, title.slice(0, 70));
  } catch {
    /* skip */
  }
}
