/** Detect dominant script in government notification text */

const DEVANAGARI = /[\u0900-\u097F]/;
const TAMIL = /[\u0B80-\u0BFF]/;
const GUJARATI = /[\u0A80-\u0AFF]/;
const TELUGU = /[\u0C00-\u0C7F]/;
const KANNADA = /[\u0C80-\u0CFF]/;
const MALAYALAM = /[\u0D00-\u0D7F]/;
const BENGALI = /[\u0980-\u09FF]/;
const LATIN = /[A-Za-z]/;

const INDIC = /[\u0900-\u0DFF]/;

export const scriptCounts = (text = '') => {
  const s = String(text);
  let devanagari = 0;
  let tamil = 0;
  let latin = 0;
  let indic = 0;
  for (const ch of s) {
    if (DEVANAGARI.test(ch)) devanagari += 1;
    else if (TAMIL.test(ch)) tamil += 1;
    else if (INDIC.test(ch)) indic += 1;
    else if (LATIN.test(ch)) latin += 1;
  }
  return { devanagari, tamil, latin, indic };
};

export const isDevanagariText = (text = '') => scriptCounts(text).devanagari > 0;

export const isTamilText = (text = '') => {
  const { tamil, latin } = scriptCounts(text);
  return tamil > latin;
};

/** English if mostly Latin letters and no Indic script */
export const isMostlyEnglish = (text = '') => {
  const t = String(text).trim();
  if (!t) return true;
  const { devanagari, tamil, latin, indic } = scriptCounts(t);
  if (devanagari > 0 || tamil > 0 || indic > 0) return false;
  return latin > 0 || /^[\d\s₹.,:/\-–—'"()]+$/.test(t);
};

export const matchesPreferredLanguage = (item, preferred = 'en') => {
  const hay = `${item?.title || ''} ${item?.summary || ''} ${item?.content || ''}`;
  if (preferred === 'en') return isMostlyEnglish(hay);
  if (preferred === 'ta') return isTamilText(hay) || !isMostlyEnglish(hay);
  return true;
};

export default { isMostlyEnglish, isDevanagariText, matchesPreferredLanguage };
