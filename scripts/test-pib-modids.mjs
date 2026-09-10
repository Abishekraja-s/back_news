for (let mod = 1; mod <= 12; mod++) {
  for (const reg of [1, 3]) {
    const u = `https://pib.gov.in/RssMain.aspx?ModId=${mod}&Lang=1&Regid=${reg}`;
    const t = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0' } }).then((r) => r.text());
    const count = (t.match(/<item/gi) || []).length;
    if (!count) continue;
    const title = [...t.matchAll(/<item[\s\S]*?<title>([\s\S]*?)<\/title>/gi)][0]?.[1]
      ?.replace(/<!\[CDATA\[|\]\]>/g, '')
      .trim();
    const script = /[\u0900-\u097F]/.test(title || '') ? 'hi' : 'en';
    console.log(`ModId=${mod} Regid=${reg}`, count, script, title?.slice(0, 60));
  }
}
