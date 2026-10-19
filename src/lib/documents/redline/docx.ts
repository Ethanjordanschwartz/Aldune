// Word output for document review. When the user uploaded a .docx, the redline is applied to THEIR file — logos,
// fonts, headers, numbering, and layout are untouched — as real tracked changes (w:ins / w:del) with a Word comment on
// each change giving the reason and the authority. Other inputs (.doc, PDF, text) get a clean new .docx with the same
// tracked changes. The "clean" mode applies every change (the ready-to-sign revised document).
import JSZip from 'jszip';
import { applyPlan, type RedlineItem, type ReviewPlan, type EditNote } from './engine';
import { reviewParagraphs } from './rules';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const AUTHOR = 'Aldune';
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const unesc = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&amp;/g, '&');

interface Para { start: number; end: number; xml: string; text: string }
/** Top-level paragraphs of word/document.xml, in order (paragraphs nested in text boxes stay inside their parent). */
export function scanParagraphs(doc: string): Para[] {
  const out: Para[] = []; const re = /<w:p(?=[\s>/])[^>]*?(\/?)>|<\/w:p>/g; let m: RegExpExecArray | null; let depth = 0, start = -1;
  while ((m = re.exec(doc))) {
    if (m[0] === '</w:p>') { depth--; if (depth === 0 && start >= 0) { const xml = doc.slice(start, m.index + 6); out.push({ start, end: m.index + 6, xml, text: paraText(xml) }); start = -1; } continue; }
    if (m[1] === '/') { if (depth === 0) out.push({ start: m.index, end: m.index + m[0].length, xml: m[0], text: '' }); continue; }
    if (depth === 0) start = m.index; depth++;
  }
  return out;
}
function paraText(xml: string): string {
  let t = ''; const re = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:br\b[^>]*\/>|<w:noBreakHyphen\/>/g; let m;
  // skip deleted text already in the file
  const live = xml.replace(/<w:del\b[\s\S]*?<\/w:del>/g, '');
  while ((m = re.exec(live))) t += m[1] !== undefined ? unesc(m[1]) : m[0] === '<w:tab/>' ? '\t' : m[0].startsWith('<w:br') ? ' ' : '-';
  return t;
}
const pPrOf = (xml: string) => xml.match(/<w:pPr>[\s\S]*?<\/w:pPr>|<w:pPr\/>/)?.[0] || '';
const firstRPr = (xml: string) => { const r = xml.match(/<w:r(?:\s[^>]*)?>([\s\S]*?)<\/w:r>/); return r?.[1].match(/<w:rPr>[\s\S]*?<\/w:rPr>/)?.[0] || ''; };
const openTag = (xml: string) => xml.match(/^<w:p(?=[\s>])[^>]*>/)?.[0] || '<w:p>';
const keepObjects = (xml: string) => (xml.match(/<w:r(?:\s[^>]*)?>(?:(?!<\/w:r>)[\s\S])*?<w:(?:drawing|pict|object)\b[\s\S]*?<\/w:r>/g) || []).join('');

let rev = 1000; const nid = () => String(rev++);
const stamp = (date: string) => `w:id="${nid()}" w:author="${AUTHOR}" w:date="${date}"`;
function runs(text: string, rPr: string, kind: 'keep' | 'del' | 'ins'): string {
  const tag = kind === 'del' ? 'w:delText' : 'w:t';
  return text.split('\t').map((part, i) => `${i ? `<w:r>${rPr}<w:tab/></w:r>` : ''}${part ? `<w:r>${rPr}<${tag} xml:space="preserve">${esc(part)}</${tag}></w:r>` : ''}`).join('');
}
const wrap = (kind: 'del' | 'ins', inner: string, date: string) => inner ? `<w:${kind} ${stamp(date)}>${inner}</w:${kind}>` : '';
/** Existing runs → deleted runs (w:t → w:delText). */
function deleteRuns(xml: string, date: string): string {
  const body = xml.replace(/^<w:p(?=[\s>])[^>]*>/, '').replace(/<\/w:p>$/, '').replace(/<w:pPr>[\s\S]*?<\/w:pPr>|<w:pPr\/>/, '');
  return body.replace(/<w:r(?:\s[^>]*)?>(?:(?!<\/w:r>)[\s\S])*?<\/w:r>/g, r => /<w:(drawing|pict|object)\b/.test(r) ? r : `<w:del ${stamp(date)}>${r.replace(/<w:t(\s[^>]*)?>/g, '<w:delText$1>').replace(/<\/w:t>/g, '</w:delText>')}</w:del>`);
}
/** Add paragraph properties in schema order: keepNext right after pStyle; spacing before ind/jc/rPr. */
function addPPr(pPr: string, opts: { keepNext?: boolean; spaceBefore?: boolean }): string {
  let p = pPr && pPr !== '<w:pPr/>' ? pPr : '<w:pPr></w:pPr>';
  if (opts.keepNext && !/<w:keepNext\b/.test(p)) p = /<w:pStyle\b[^>]*\/>/.test(p) ? p.replace(/(<w:pStyle\b[^>]*\/>)/, '$1<w:keepNext/>') : p.replace('<w:pPr>', '<w:pPr><w:keepNext/>');
  if (opts.spaceBefore && !/<w:spacing\b/.test(p)) { const m = p.match(/<w:(ind|contextualSpacing|mirrorIndents|suppressOverlap|jc|textDirection|textAlignment|textboxTightWrap|outlineLvl|divId|cnfStyle|rPr|sectPr|pPrChange)\b/); p = m ? p.replace(m[0], `<w:spacing w:before="120"/>${m[0]}`) : p.replace('</w:pPr>', '<w:spacing w:before="120"/></w:pPr>'); }
  return p === '<w:pPr></w:pPr>' ? '' : p;
}
function withMark(pPr: string, mark: 'del' | 'ins' | null, date: string, extra = ''): string {
  const m = mark ? `<w:${mark} ${stamp(date)}/>` : '';
  let p = pPr.replace(/<w:numPr>[\s\S]*?<\/w:numPr>/, '').replace(/<w:sectPr\b[\s\S]*?<\/w:sectPr>/, '');
  if (!p || p === '<w:pPr/>') return m || extra ? `<w:pPr>${extra}${m ? `<w:rPr>${m}</w:rPr>` : ''}</w:pPr>` : '';
  if (!m) return extra ? p.replace('<w:pPr>', `<w:pPr>${extra}`) : p;
  return /<w:rPr>/.test(p) ? p.replace(/<w:rPr>/, `<w:rPr>${m}`) : p.replace('</w:pPr>', `<w:rPr>${m}</w:rPr></w:pPr>`);
}
const cStart = (id: number) => `<w:commentRangeStart w:id="${id}"/>`;
const cEnd = (id: number) => `<w:commentRangeEnd w:id="${id}"/><w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:commentReference w:id="${id}"/></w:r>`;
const plainRPr = (rPr: string, bold: boolean) => { let r = rPr.replace(/<w:b\/>|<w:b w:val="[^"]*"\/>|<w:bCs\/>|<w:u [^>]*\/>|<w:i\/>/g, ''); if (bold) r = r ? r.replace('<w:rPr>', '<w:rPr><w:b/>') : '<w:rPr><w:b/></w:rPr>'; return r === '<w:rPr></w:rPr>' ? '' : r; };

export interface DocxResult { bytes: Uint8Array; plan: ReviewPlan; changes: number }

/** Apply a review plan to word/document.xml. */
function patchDocument(doc: string, paras: Para[], items: RedlineItem[], mode: 'redline' | 'clean', notes: EditNote[]): string {
  const date = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const replaceXml = new Map<number, string>(); const after = new Map<number, string[]>(); const before0: string[] = [];
  let lastPara = -1; let cid = 0;
  for (const it of items) {
    const ps = it.paras || [];
    const anchorIdx = ps.length ? ps[ps.length - 1] : lastPara;
    const comment = it.note && mode === 'redline' ? (notes.push(it.note), cid++) : -1;
    if (it.kind === 'keep') { lastPara = anchorIdx; continue; }
    if (it.kind === 'insert') {
      const a = paras[Math.max(0, lastPara)] || paras[0]; const rPr = plainRPr(firstRPr(a?.xml || ''), !!it.heading);
      const content = mode === 'redline' ? wrap('ins', runs(it.text!, rPr, 'ins'), date) : runs(it.text!, rPr, 'keep');
      const pPr = withMark(addPPr(pPrOf(a?.xml || '').replace(/<w:numPr>[\s\S]*?<\/w:numPr>/, ''), { keepNext: !!it.heading, spaceBefore: true }), mode === 'redline' ? 'ins' : null, date);
      const xml = `<w:p>${pPr}${comment >= 0 ? cStart(comment) : ''}${content}${comment >= 0 ? cEnd(comment) : ''}</w:p>`;
      if (lastPara < 0) before0.push(xml); else { const l = after.get(lastPara) || []; l.push(xml); after.set(lastPara, l); }
      continue;
    }
    lastPara = anchorIdx;
    if (it.kind === 'delete') {
      ps.forEach((pi, k) => { const p = paras[pi];
        if (mode === 'clean') { replaceXml.set(pi, keepObjects(p.xml) ? `${openTag(p.xml)}${pPrOf(p.xml)}${keepObjects(p.xml)}</w:p>` : ''); return; }
        replaceXml.set(pi, `${openTag(p.xml)}${withMark(pPrOf(p.xml), 'del', date)}${k === 0 && comment >= 0 ? cStart(comment) : ''}${deleteRuns(p.xml, date)}${k === ps.length - 1 && comment >= 0 ? cEnd(comment) : ''}</w:p>`); });
      continue;
    }
    // replace: delete every original run; new text goes in the LAST paragraph of the block (earlier paragraph marks are deleted so the block merges)
    const lastP = paras[ps[ps.length - 1]]; const rPr = firstRPr(paras[ps[0]].xml);
    if (mode === 'clean') {
      ps.forEach((pi, k) => replaceXml.set(pi, k < ps.length - 1 ? (keepObjects(paras[pi].xml) ? `<w:p>${keepObjects(paras[pi].xml)}</w:p>` : '') : `${openTag(lastP.xml)}${pPrOf(lastP.xml)}${keepObjects(lastP.xml)}${runs(it.text!, rPr, 'keep')}</w:p>`));
      continue;
    }
    if (ps.length === 1) {
      const p = paras[ps[0]];
      const segs = it.segments.map(s => s.type === 'keep' ? runs(s.text, rPr, 'keep') : wrap(s.type, runs(s.text, rPr, s.type), date)).join('');
      replaceXml.set(ps[0], `${openTag(p.xml)}${pPrOf(p.xml)}${comment >= 0 ? cStart(comment) : ''}${keepObjects(p.xml)}${segs}${comment >= 0 ? cEnd(comment) : ''}</w:p>`);
    } else ps.forEach((pi, k) => { const p = paras[pi]; const last = k === ps.length - 1;
      replaceXml.set(pi, `${openTag(p.xml)}${last ? pPrOf(p.xml) : withMark(pPrOf(p.xml), 'del', date)}${k === 0 && comment >= 0 ? cStart(comment) : ''}${deleteRuns(p.xml, date)}${last ? wrap('ins', runs(it.text!, rPr, 'ins'), date) + (comment >= 0 ? cEnd(comment) : '') : ''}</w:p>`); });
  }
  let out = ''; let pos = 0;
  paras.forEach((p, i) => { out += doc.slice(pos, p.start); if (i === 0) out += before0.join(''); out += replaceXml.has(i) ? replaceXml.get(i)! : p.xml; out += (after.get(i) || []).join(''); pos = p.end; });
  return out + doc.slice(pos);
}

function commentsXml(notes: EditNote[]): string {
  const date = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const p = (t: string, rPr = '') => `<w:p><w:r>${rPr}<w:t xml:space="preserve">${esc(t)}</w:t></w:r></w:p>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:comments xmlns:w="${W}">${notes.map((n, i) => `<w:comment w:id="${i}" w:author="${AUTHOR}" w:date="${date}" w:initials="SP">${p(`${n.level === 'required' ? 'Required' : 'Recommended'}: ${n.title}`, '<w:rPr><w:b/></w:rPr>')}${p(n.why)}${p(`Authority: ${n.cite}`, '<w:rPr><w:i/></w:rPr>')}</w:comment>`).join('')}</w:comments>`;
}

/** Revise a .docx in place. */
export async function reviseDocx(input: ArrayBuffer | Uint8Array, mode: 'redline' | 'clean', opts: { today?: string; employer?: string; plan?: ReviewPlan } = {}): Promise<DocxResult> {
  const zip = await JSZip.loadAsync(input);
  const docFile = zip.file('word/document.xml'); if (!docFile) throw new Error('This file isn’t a readable Word (.docx) document.');
  const doc = await docFile.async('string'); const paras = scanParagraphs(doc);
  const plan = opts.plan || reviewParagraphs(paras.map(p => p.text), { today: opts.today, employer: opts.employer });
  const items = applyPlan(plan); const notes: EditNote[] = [];
  zip.file('word/document.xml', patchDocument(doc, paras, items, mode, notes));
  if (mode === 'redline' && notes.length) {
    if (zip.file('word/comments.xml')) { // keep the author's own comments; ours are added after them
      const prev = await zip.file('word/comments.xml')!.async('string'); const maxId = Math.max(-1, ...[...prev.matchAll(/w:id="(\d+)"/g)].map(m => +m[1])); const off = maxId + 1;
      let docXml = await zip.file('word/document.xml')!.async('string');
      docXml = docXml.replace(/<w:comment(RangeStart|RangeEnd|Reference) w:id="(\d+)"\/>/g, (_m, k, d) => `<w:comment${k} w:id="${+d + off}"/>`); zip.file('word/document.xml', docXml);
      const ours = commentsXml(notes).replace(/<w:comment w:id="(\d+)"/g, (_m, d) => `<w:comment w:id="${+d + off}"`).replace(/^[\s\S]*?<w:comments[^>]*>/, '').replace('</w:comments>', '');
      zip.file('word/comments.xml', prev.replace('</w:comments>', `${ours}</w:comments>`));
    } else {
      zip.file('word/comments.xml', commentsXml(notes));
      const ct = await zip.file('[Content_Types].xml')!.async('string');
      if (!/comments\.xml/.test(ct)) zip.file('[Content_Types].xml', ct.replace('</Types>', '<Override PartName="/word/comments.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/></Types>'));
      const relPath = 'word/_rels/document.xml.rels'; const rels = zip.file(relPath) ? await zip.file(relPath)!.async('string') : '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
      if (!/relationships\/comments"/.test(rels)) zip.file(relPath, rels.replace('</Relationships>', '<Relationship Id="rIdAlduneComments" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="comments.xml"/></Relationships>'));
    }
  }
  const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  return { bytes, plan, changes: plan.edits.length };
}

/** A plain .docx holding the given paragraphs (used when the upload was a .doc, PDF, or text file). */
export async function plainDocx(paras: string[], title?: string): Promise<Uint8Array> {
  const zip = new JSZip();
  const rPr = '<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="24"/></w:rPr>';
  const body = paras.map(t => `<w:p><w:pPr><w:spacing w:after="120"/></w:pPr>${runs(t, rPr, 'keep')}</w:p>`).join('');
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>');
  zip.file('docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${esc(title || 'Document')}</dc:title><dc:creator>Aldune</dc:creator></cp:coreProperties>`);
  zip.file('word/_rels/document.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>');
  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="${W}"><w:body>${body}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`);
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

/** Redline or clean revision of any uploaded document: in place for .docx, a new .docx otherwise. */
export async function reviseDocument(input: { name: string; text: string; bytes?: ArrayBuffer | Uint8Array }, mode: 'redline' | 'clean', opts: { today?: string; employer?: string } = {}): Promise<DocxResult> {
  if (input.bytes && /\.(docx|docm)$/i.test(input.name)) return reviseDocx(input.bytes, mode, opts);
  const paras = input.text.split(/\n/);
  return reviseDocx(await plainDocx(paras, input.name.replace(/\.[a-z0-9]+$/i, '')), mode, opts);
}
