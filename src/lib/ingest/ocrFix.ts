// Repairs for text that came from optical character recognition (OCR) of scans and photos. Only fixes that are forced by the
// value itself being impossible — a month of 93, minutes of 90, "19:20 AM", a stray "PH" for PM — and the document's own year.
// Plausible-but-wrong readings (5:00 vs 6:00) are never guessed; lines the recognizer was unsure of are marked for review.
export const LOW_CONF = '⟨verify⟩';

// only right after a clock reading ("6:00 AW"), so words are never touched
const AMPM: [RegExp, string][] = [[/(?<=\d[:.]\d{2}\s?)(?:AW|MM|M4|AN|A\.M\.?|aM|Am)\b/g, 'AM'], [/(?<=\d[:.]\d{2}\s?)(?:PH|PN|P\.M\.?|pM|Pm|FM)\b/g, 'PM']];
const fixDigit0 = (c: string) => (c === '9' || c === '8' || c === '6' || c === 'o' || c === 'O' ? '0' : c);

export function repairOcrText(raw: string): string {
  let t = raw.replace(/[‘’`´]/g, "'").replace(/[“”]/g, '"');
  // glyphs OCR puts in place of a leading 0 on a date ("©3/11", "@3/11", "93/11")
  t = t.replace(/(^|[\s|])[©@®°Q§$](\d\/\d{1,2}\/\d{2,4})/g, '$1' + '0$2');
  for (const [re, s] of AMPM) t = t.replace(re, s);
  // the document's year: the most common 4-digit year near 2000–2039
  const years = (t.match(/\b(?:19|20)\d{2}\b/g) || []).filter(y => +y >= 2000 && +y <= 2039); const tally = new Map<string, number>(); years.forEach(y => tally.set(y, (tally.get(y) || 0) + 1));
  const docYear = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  t = t.replace(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g, (m, mo: string, d: string, y: string) => {
    let M = mo, D = d, Y = y;
    if (+M > 12 && M.length === 2) M = fixDigit0(M[0]) + M[1];                // 93/10 → 03/10
    if (+D > 31 && D.length === 2) D = fixDigit0(D[0]) + D[1];
    if (docYear && Y !== docYear && [...Y].filter((c, k) => c !== docYear[k]).length === 1) Y = docYear; // 2626 / 2020 → 2026
    return +M >= 1 && +M <= 12 && +D >= 1 && +D <= 31 ? `${M}/${D}/${Y}` : m;
  });
  // impossible clock readings next to AM/PM: "19:20 AM" → 10:20, "6:90 AM" → 6:00, "11:08 AM" is left alone (possible)
  t = t.replace(/\b(\d{1,2})[:.](\d{2})(\s*)(AM|PM)\b/g, (m, h: string, mm: string, sp: string, ap: string) => {
    let H = h, MM = mm;
    if (+H > 12 && H.length === 2) H = H[0] + fixDigit0(H[1]);
    if (+MM > 59) MM = fixDigit0(MM[0]) + MM[1];
    return +H >= 1 && +H <= 12 && +MM <= 59 ? `${H}:${MM}${sp}${ap}` : m;
  });
  return t;
}

/** Mark lines whose recognition confidence is low so the readers flag them for review instead of trusting them silently. */
export function markLowConfidence(lines: { text: string; confidence: number }[], threshold = 70): string {
  return lines.map(l => (l.confidence < threshold && /\d/.test(l.text) ? `${l.text.replace(/\s+$/, '')} ${LOW_CONF}` : l.text.replace(/\s+$/, ''))).join('\n');
}
