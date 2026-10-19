// Fill a customer's own Word template (settlement agreement, payment letter, release, notice…) with audit data.
// The template keeps its own wording, formatting, letterhead, and signature blocks; only the placeholders change.
//
// Placeholders recognized (case- and spacing-insensitive):
//   {{Employee Name}}  {Employee Name}  [Employee Name]  «Employee Name»  <<Employee Name>>
//   Employee Name: ________   (a label followed by a blank line of underscores)
// Word often splits a placeholder across several runs ("{{Emp" + "loyee}}"); filling works on the paragraph's joined
// text and writes the result back into the runs, so split placeholders are filled too.
import JSZip from 'jszip';

export type FieldKey =
  | 'employee_name' | 'employee_first_name' | 'employee_last_name' | 'employee_id' | 'employee_address' | 'job_title' | 'hire_date' | 'separation_date' | 'location'
  | 'employer_name' | 'employer_address' | 'signer_name' | 'signer_title' | 'contact' | 'date'
  | 'total_amount' | 'total_amount_words' | 'wages_amount' | 'premiums_amount' | 'reimbursement_amount' | 'interest_amount' | 'penalties_amount' | 'payment_amount'
  | 'period_start' | 'period_end' | 'findings_summary' | 'findings_list' | 'violations_count' | 'case_caption' | 'case_number' | 'court' | 'payment_date';

export const FIELD_LABELS: Record<FieldKey, string> = {
  employee_name: 'Employee name', employee_first_name: 'Employee first name', employee_last_name: 'Employee last name', employee_id: 'Employee ID', employee_address: 'Employee address',
  job_title: 'Job title', hire_date: 'Hire date', separation_date: 'Separation date', location: 'Work location',
  employer_name: 'Employer legal name', employer_address: 'Employer address', signer_name: 'Signer name', signer_title: 'Signer title', contact: 'Contact for questions', date: 'Today’s date',
  total_amount: 'Total amount', total_amount_words: 'Total amount in words', wages_amount: 'Wages and premiums', premiums_amount: 'Meal and rest premiums', reimbursement_amount: 'Expense reimbursement',
  interest_amount: 'Interest', penalties_amount: 'Penalties', payment_amount: 'Payment amount', period_start: 'Period start', period_end: 'Period end',
  findings_summary: 'Summary of findings', findings_list: 'List of findings with amounts', violations_count: 'Number of findings', case_caption: 'Case caption', case_number: 'Case number', court: 'Court', payment_date: 'Payment date'
};

// words people use in their templates → the field they mean (checked in order; first match wins)
const SYNONYMS: [RegExp, FieldKey][] = [
  [/^(?:employee|worker|claimant|releasor|recipient|plaintiff|associate|team member|payee)?\s*first\s*name$/, 'employee_first_name'],
  [/^(?:employee|worker|claimant|releasor|recipient|plaintiff|associate|team member|payee)?\s*(?:last|sur)\s*name$/, 'employee_last_name'],
  [/^(?:employee|worker|claimant|releasor|recipient|associate|team member|payee)\s*(?:id|number|no\.?|#)$|^(?:emp|ee)\s*(?:id|#|no)$/, 'employee_id'],
  [/^(?:employee|worker|claimant|releasor|recipient|associate|payee)'?s?\s*(?:mailing\s*|home\s*)?address$|^mailing address$|^home address$/, 'employee_address'],
  [/^(?:employee|worker|claimant|releasor|recipient|associate|team member|payee)'?s?\s*(?:full\s*|legal\s*)?name$|^(?:employee|worker|claimant|releasor|recipient|associate|team member|payee|name|full name|dear)$/, 'employee_name'],
  [/^(?:job\s*)?title$|^position$|^job$|^role$/, 'job_title'],
  [/^(?:hire|start)\s*date$|^date\s*of\s*hire$/, 'hire_date'],
  [/^(?:separation|termination|last\s*day|end)\s*(?:date|of employment)?$|^date\s*of\s*(?:separation|termination)$/, 'separation_date'],
  [/^(?:work\s*)?location$|^worksite$|^store$|^site$/, 'location'],
  [/^(?:company|employer|business|client)'?s?\s*address$/, 'employer_address'],
  [/^(?:company|employer|business|client|firm)(?:'?s)?(?:\s*legal)?(?:\s*name)?$|^(?:releasee|defendant)$/, 'employer_name'],
  [/^(?:signer|signatory|authorized\s*(?:representative|signatory)|hr\s*representative|representative)(?:'?s)?\s*name$|^(?:signer|signatory|authorized representative)$/, 'signer_name'],
  [/^(?:signer|signatory|representative)(?:'?s)?\s*title$/, 'signer_title'],
  [/^contact(?:\s*(?:person|info(?:rmation)?|name))?$|^questions?\s*contact$/, 'contact'],
  [/^(?:payment|check|pay)\s*date$|^date\s*of\s*payment$/, 'payment_date'],
  [/^(?:today'?s?\s*)?date$|^letter\s*date$|^effective\s*date$/, 'date'],
  [/(?:total|gross)\s*(?:amount|payment|settlement|sum)?\s*(?:in\s*)?words$|^amount\s*in\s*words$|^written\s*amount$/, 'total_amount_words'],
  [/^(?:settlement|payment|check)\s*amount$|^amount\s*(?:paid|of payment)$/, 'payment_amount'],
  [/^(?:total|gross|settlement)\s*(?:amount|sum|payment)?(?:\s*owed|\s*due)?$|^amount(?:\s*owed|\s*due)?$|^total\s*owed$|^back\s*pay(?:\s*amount)?$/, 'total_amount'],
  [/^(?:unpaid\s*)?wages?(?:\s*(?:amount|owed|and premiums))?$/, 'wages_amount'],
  [/^(?:meal|rest|meal and rest|break)?\s*premiums?(?:\s*amount)?$/, 'premiums_amount'],
  [/^(?:expense\s*)?reimbursements?(?:\s*amount)?$|^expenses$/, 'reimbursement_amount'],
  [/^interest(?:\s*amount)?$/, 'interest_amount'],
  [/^penalt(?:y|ies)(?:\s*amount)?$/, 'penalties_amount'],
  [/^(?:period|covered period|claim period)\s*(?:start|begin(?:ning)?|from)$|^start\s*of\s*period$/, 'period_start'],
  [/^(?:period|covered period|claim period)\s*(?:end|ending|to|through)$|^end\s*of\s*period$/, 'period_end'],
  [/^(?:findings|violations|claims|issues)\s*(?:table|list|detail(?:s)?|schedule|exhibit)$|^calculation\s*(?:table|exhibit)$/, 'findings_list'],
  [/^(?:summary\s*of\s*)?(?:findings|violations|claims|issues)(?:\s*summary)?$|^released\s*claims$/, 'findings_summary'],
  [/^(?:number\s*of\s*)?(?:findings|violations)\s*(?:count|number)?$/, 'violations_count'],
  [/^(?:case\s*)?caption$|^case\s*name$/, 'case_caption'],
  [/^case\s*(?:number|no\.?|#)$/, 'case_number'],
  [/^court(?:\s*name)?$/, 'court']
];
const canon = (s: string) => s.toLowerCase().replace(/[’`]/g, "'").replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ').trim();
export function mapField(label: string): FieldKey | null {
  const c = canon(label); if (!c) return null;
  for (const [re, k] of SYNONYMS) if (re.test(c)) return k;
  return null;
}

export type Placeholder = { raw: string; label: string; field: FieldKey | null; kind: 'braces' | 'brackets' | 'guillemets' | 'blank' };
const xmlUnesc = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const xmlEsc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// placeholder patterns on a paragraph's joined text
const PATTERNS: { re: RegExp; kind: Placeholder['kind'] }[] = [
  { re: /\{\{\s*([^{}]{1,60}?)\s*\}\}/g, kind: 'braces' },
  { re: /(?<!\{)\{\s*([A-Za-z][^{}]{0,58}?)\s*\}(?!\})/g, kind: 'braces' },
  { re: /«\s*([^«»]{1,60}?)\s*»|<<\s*([^<>]{1,60}?)\s*>>/g, kind: 'guillemets' },
  { re: /\[\s*([A-Za-z][A-Za-z0-9 '’&/.,#-]{0,58}?)\s*\]/g, kind: 'brackets' },
  { re: /([A-Za-z][A-Za-z '’/&#.-]{1,40}?)\s*:?\s*(_{4,})/g, kind: 'blank' }
];
function scan(text: string): { start: number; end: number; ph: Placeholder }[] {
  const out: { start: number; end: number; ph: Placeholder }[] = [];
  for (const { re, kind } of PATTERNS) {
    re.lastIndex = 0; let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const label = (m[1] || m[2] || '').trim(); const field = mapField(label);
      // square brackets are common in ordinary legal text ("[sic]", "[a]"); keep them only when they name a field or look like one
      if (kind === 'brackets' && !field && !/^(?:[A-Z][A-Za-z'’]*\s*){1,5}$/.test(label) && !/^[A-Z0-9 '’&/.,#-]{3,}$/.test(label)) continue;
      // a blank keeps its label; only the underscores are replaced
      let label2 = label, field2 = field;
      if (kind === 'blank') { const w = m[1].trim().split(/\s+/); label2 = ''; field2 = null; for (let k = Math.min(5, w.length); k >= 1; k--) { const c = w.slice(-k).join(' '); const f = mapField(c); if (f) { label2 = c; field2 = f; break; } } }
      if (kind === 'blank' && !field2) continue;
      const start = kind === 'blank' ? m.index + m[0].length - m[2].length : m.index; const end = m.index + m[0].length;
      if (out.some(o => start < o.end && end > o.start)) continue;
      out.push({ start, end, ph: { raw: kind === 'blank' ? m[2] : m[0], label: label2, field: field2, kind } });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

const PART_RE = /^word\/(?:document|header\d*|footer\d*|footnotes|endnotes)\.xml$/;
type TNode = { start: number; end: number; textStart: number; text: string };
function paragraphs(xml: string): { start: number; end: number }[] {
  const out: { start: number; end: number }[] = []; const re = /<w:p[ >][\s\S]*?<\/w:p>/g; let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out.push({ start: m.index, end: m.index + m[0].length });
  return out;
}
function textNodes(p: string): TNode[] {
  const out: TNode[] = []; const re = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:t(?:\s[^>]*)?\/>/g; let m: RegExpExecArray | null;
  while ((m = re.exec(p))) { const inner = m[1] ?? ''; out.push({ start: m.index, end: m.index + m[0].length, textStart: m.index + m[0].indexOf('>') + 1, text: xmlUnesc(inner) }); }
  return out;
}

/** List the placeholders in a .docx template, with the field each one was matched to (null = not recognized). */
export async function detectPlaceholders(bytes: ArrayBuffer | Uint8Array): Promise<Placeholder[]> {
  const zip = await JSZip.loadAsync(bytes); const seen = new Map<string, Placeholder>();
  for (const name of Object.keys(zip.files).filter(n => PART_RE.test(n))) {
    const xml = await zip.file(name)!.async('string');
    for (const p of paragraphs(xml)) { const text = textNodes(xml.slice(p.start, p.end)).map(t => t.text).join(''); for (const h of scan(text)) { const k = `${h.ph.kind}|${canon(h.ph.label)}`; if (!seen.has(k)) seen.set(k, h.ph); } }
  }
  return [...seen.values()];
}

/** Values for one document: by field, plus any typed by the user for labels that weren't recognized (keyed by the label as written). */
export type FillValues = { fields: Partial<Record<FieldKey, string>>; byLabel?: Record<string, string> };

function fillParagraph(p: string, values: FillValues, missing: Set<string>): string {
  const nodes = textNodes(p); if (!nodes.length) return p;
  const text = nodes.map(t => t.text).join(''); const hits = scan(text); if (!hits.length) return p;
  let out = ''; let pos = 0; let changed = false;
  for (const h of hits) {
    const v = (h.ph.field && values.fields[h.ph.field] !== undefined && values.fields[h.ph.field] !== '' ? values.fields[h.ph.field] : undefined) ?? values.byLabel?.[h.ph.label] ?? values.byLabel?.[canon(h.ph.label)];
    if (v === undefined) { missing.add(h.ph.label); continue; }
    out += text.slice(pos, h.start) + v; pos = h.end; changed = true;
  }
  if (!changed) return p;
  const newText = out + text.slice(pos);
  // write the whole paragraph text into the first text node (keeps its run formatting); empty the rest. Line breaks become <w:br/>.
  const first = nodes[0]; const lines = newText.split('\n');
  const firstXml = lines.map((l, i) => `${i ? '</w:t><w:br/><w:t xml:space="preserve">' : ''}${xmlEsc(l)}`).join('');
  let res = p.slice(0, first.start) + `<w:t xml:space="preserve">${firstXml}</w:t>`;
  let cursor = first.end;
  for (const n of nodes.slice(1)) { res += p.slice(cursor, n.start) + '<w:t xml:space="preserve"></w:t>'; cursor = n.end; }
  return res + p.slice(cursor);
}

/** Fill a .docx template. Returns the new file and the placeholder labels left unfilled. */
export async function fillTemplate(bytes: ArrayBuffer | Uint8Array, values: FillValues): Promise<{ bytes: Uint8Array; missing: string[] }> {
  const zip = await JSZip.loadAsync(bytes); const missing = new Set<string>();
  for (const name of Object.keys(zip.files).filter(n => PART_RE.test(n))) {
    const xml = await zip.file(name)!.async('string'); let res = ''; let cursor = 0;
    for (const p of paragraphs(xml)) { res += xml.slice(cursor, p.start) + fillParagraph(xml.slice(p.start, p.end), values, missing); cursor = p.end; }
    zip.file(name, res + xml.slice(cursor));
  }
  const out = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  return { bytes: out, missing: [...missing] };
}

// ---------- amounts in words (for "the sum of ___ dollars")
const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
function under1000(n: number): string { const h = Math.floor(n / 100), r = n % 100; const t = r < 20 ? ONES[r] : TENS[Math.floor(r / 10)] + (r % 10 ? '-' + ONES[r % 10] : ''); return [h ? ONES[h] + ' hundred' : '', t].filter(Boolean).join(' '); }
export function amountInWords(amount: number): string {
  const cents = Math.round(amount * 100) % 100; let n = Math.floor(Math.round(amount * 100) / 100); if (n === 0) return `zero dollars and ${String(cents).padStart(2, '0')}/100`;
  const parts: string[] = []; for (const [v, w] of [[1e9, 'billion'], [1e6, 'million'], [1e3, 'thousand']] as [number, string][]) { if (n >= v) { parts.push(`${under1000(Math.floor(n / v))} ${w}`); n %= v; } }
  if (n) parts.push(under1000(n));
  const s = parts.join(' '); return `${s.charAt(0).toUpperCase() + s.slice(1)} dollars and ${String(cents).padStart(2, '0')}/100`;
}
