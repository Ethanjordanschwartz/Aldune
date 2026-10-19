// Browser-side text extraction with no network access: PDF via bundled pdf.js (main-thread worker), DOCX via the bundled zip reader.
import * as XLSX from 'xlsx';
import { maskSensitive } from '../ingest/documents';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.js';
import * as pdfWorker from 'pdfjs-dist/legacy/build/pdf.worker.js';

(globalThis as unknown as { pdfjsWorker: unknown }).pdfjsWorker = pdfWorker; // lets pdf.js run its worker in the main thread (no worker URL, works under strict CSP)

const decodeXml = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&amp;/g, '&');
/** Extract paragraphs and table text from a .docx (word/document.xml plus headers/footers/footnotes). */
export function docxText(buf: ArrayBuffer): string {
  const zip = XLSX.CFB.read(new Uint8Array(buf), { type: 'array' });
  const parts = zip.FullPaths.filter((p: string) => /word\/(document|header\d*|footer\d*|footnotes|endnotes)\.xml$/i.test(p)).sort((a: string, b: string) => (/document/.test(a) ? -1 : /document/.test(b) ? 1 : 0));
  if (!parts.length) throw new Error('This file isn’t a readable Word (.docx) document.');
  const out: string[] = [];
  for (const p of parts) {
    const entry = XLSX.CFB.find(zip, p); if (!entry || !entry.content) continue;
    const xml = new TextDecoder().decode(entry.content as Uint8Array);
    const text = xml.replace(/<w:instrText[^>]*>[\s\S]*?<\/w:instrText>/g, '').replace(/<(wp:posOffset|wp14:pctWidth|wp14:pctHeight|wp:align)>[\s\S]*?<\/\1>/g, '').replace(/<w:tab\/>/g, '\t')
      // table cells: paragraphs inside a cell join with a space; cells are tab-separated; each table row is one line
      .replace(/<w:tc\b[\s\S]*?<\/w:tc>/g, cell => cell.replace(/<w:br[^>]*\/>/g, ' ').replace(/<w:tab\/>|\t/g, ' ').replace(/<\/w:p>(?![\s\S]*<\/w:tc>$)/g, ' ').replace(/<\/w:p>/g, '').replace(/<\/w:tc>$/, '\u0001'))
      .replace(/<\/w:tr>/g, '\n').replace(/<w:br[^>]*\/>/g, '\n').replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, '').replace(/\u0001\s*(?=\n|$)/g, '').replace(/\u0001/g, '\t');
    out.push(decodeXml(text));
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
/** Best-effort text from a legacy Word 97–2003 .doc: reads the WordDocument stream and keeps readable text runs (8-bit or UTF-16). */
/**
 * Word 97–2003 (.doc): read the real text through the document's piece table (FIB → CLX → PlcPcd), so embedded
 * pictures, fonts, and Photoshop/XMP metadata never leak into the text. Falls back to a filtered string scan only
 * for damaged files without a readable piece table.
 */
export function legacyDocText(buf: ArrayBuffer): string {
  const cfb = XLSX.CFB.read(new Uint8Array(buf), { type: 'array' });
  const stream = (re: RegExp) => { const i = cfb.FullPaths.findIndex((p: string) => re.test(p)); if (i < 0) return null; const raw = cfb.FileIndex[i].content as unknown; return raw instanceof Uint8Array ? raw : Uint8Array.from(raw as number[]); };
  const wd = stream(/\/WordDocument$/i); if (!wd) throw new Error('This file isn’t a Word .doc document.');
  try { const t = pieceTableText(wd, stream(/\/1Table$/i), stream(/\/0Table$/i)); if (t && t.replace(/\s/g, '').length >= 10) return t; } catch { /* fall through */ }
  const runs = (s: string) => (s.match(/[\x20-\x7E -ɏ‘-”–—\r\n\t]{4,}/g) || []).filter(r => /[A-Za-z]{3}/.test(r) && /\s/.test(r) && (r.match(/[A-Za-z]/g) || []).length / r.length > 0.6);
  const latin = runs(new TextDecoder('latin1').decode(wd)); const utf16 = runs(new TextDecoder('utf-16le').decode(wd.byteLength % 2 ? wd.slice(0, -1) : wd));
  const score = (r: string[]) => r.join('').replace(/[^A-Za-z]/g, '').length;
  const best = (score(utf16) > score(latin) ? utf16 : latin).map(r => r.replace(/^\s*bjbj\S*\s*/i, '')).filter(r => r.trim().length > 2);
  return best.join('\n').replace(/\r/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
function pieceTableText(wd: Uint8Array, t1: Uint8Array | null, t0: Uint8Array | null): string {
  const dv = new DataView(wd.buffer, wd.byteOffset, wd.byteLength);
  if (dv.getUint16(0, true) !== 0xA5EC) throw new Error('not a Word binary document');
  const flags = dv.getUint16(0x0A, true); if (flags & 0x0100) throw new Error('This .doc is password-protected. Remove the password in Word and upload again.');
  const table = (flags & 0x0200) ? t1 : t0; if (!table) throw new Error('missing table stream');
  // FibBase (32) · csw + FibRgW97 · cslw + FibRgLw97 · cbRgFcLcb + FibRgFcLcbBlob
  let o = 32; const csw = dv.getUint16(o, true); o += 2 + csw * 2; const cslw = dv.getUint16(o, true); const rgLw = o + 2; o += 2 + cslw * 4; o += 2;
  const ccpText = dv.getInt32(rgLw + 3 * 4, true), ccpFtn = dv.getInt32(rgLw + 4 * 4, true), ccpHdd = dv.getInt32(rgLw + 5 * 4, true);
  const fcClx = dv.getUint32(o + 33 * 8, true), lcbClx = dv.getUint32(o + 33 * 8 + 4, true);
  const tv = new DataView(table.buffer, table.byteOffset, table.byteLength);
  let p = fcClx; const endClx = fcClx + lcbClx;
  while (p < endClx && table[p] === 0x01) p += 3 + tv.getUint16(p + 1, true); // skip Prc (formatting)
  if (table[p] !== 0x02) throw new Error('no piece table');
  const lcb = tv.getUint32(p + 1, true); const plc = p + 5; const n = (lcb - 4) / 12;
  const cps: number[] = []; for (let k = 0; k <= n; k++) cps.push(tv.getInt32(plc + k * 4, true));
  const pcd0 = plc + (n + 1) * 4; const cp1252 = new TextDecoder('windows-1252'); const u16 = new TextDecoder('utf-16le');
  const want = ccpText + Math.max(0, ccpFtn) + Math.max(0, ccpHdd); let text = '';
  for (let k = 0; k < n && cps[k] < want; k++) {
    const fcRaw = tv.getUint32(pcd0 + k * 8 + 2, true); const compressed = (fcRaw & 0x40000000) !== 0; const fc = fcRaw & 0x3FFFFFFF;
    const len = Math.min(cps[k + 1], want) - cps[k]; if (len <= 0) continue;
    text += compressed ? cp1252.decode(wd.subarray(fc / 2, fc / 2 + len)) : u16.decode(wd.subarray(fc, fc + len * 2));
  }
  const main = text.slice(0, ccpText);
  // fields: drop the instruction (\x13 … \x14), keep the result (… \x15); table cells (\x07) → tabs, row ends → new line
  let out = ''; let depth = 0; const inInstr: boolean[] = [];
  for (const ch of main) {
    if (ch === '\x13') { depth++; inInstr[depth] = true; continue; }
    if (ch === '\x14') { if (depth) inInstr[depth] = false; continue; }
    if (ch === '\x15') { if (depth) depth--; continue; }
    if (depth && inInstr[depth]) continue;
    out += ch;
  }
  return out.replace(/\x07\x07/g, '\n').replace(/\x07/g, '\t').replace(/[\r\x0B\x0C]/g, '\n').replace(/\x1E/g, '-').replace(/[\x00-\x06\x08\x0E-\x12\x16-\x1D\x1F]/g, '')
    .replace(/\t+\n/g, '\n').replace(/[  ]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
/** Extract text from a PDF with a text layer. Scanned PDFs return little or no text. */
export async function pdfText(buf: ArrayBuffer, maxPages = 200): Promise<{ text: string; pages: number }> {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), isEvalSupported: false, useSystemFonts: true }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= Math.min(doc.numPages, maxPages); i++) {
    const page = await doc.getPage(i); const c = await page.getTextContent();
    // items on one baseline form a line; a wide horizontal gap between items is a column break (tab), as in a table
    let line = '', lastY: number | null = null, lastEnd: number | null = null, pendingSpace = false; const lines: string[] = [];
    for (const it of c.items as { str: string; transform: number[]; width?: number; hasEOL?: boolean }[]) {
      const y = it.transform ? Math.round(it.transform[5]) : null;
      if (lastY !== null && y !== null && Math.abs(y - lastY) > 2) { lines.push(line); line = ''; lastEnd = null; pendingSpace = false; }
      const x = it.transform ? it.transform[4] : null, fh = it.transform ? Math.abs(it.transform[3]) || 10 : 10;
      if (!it.str.trim()) { if (it.str) pendingSpace = true; }
      else {
        if (line && x !== null && lastEnd !== null) { const gap = x - lastEnd; line += gap > Math.max(6, fh * 1.2) ? '\t' : (pendingSpace || gap > fh * 0.15) && !/\s$/.test(line) ? ' ' : ''; }
        else if (pendingSpace && line && !/\s$/.test(line)) line += ' ';
        line += it.str; pendingSpace = false;
        if (x !== null && typeof it.width === 'number') lastEnd = x + it.width; else lastEnd = null;
      }
      if (it.hasEOL) { lines.push(line); line = ''; lastEnd = null; pendingSpace = false; } lastY = y;
    }
    if (line) lines.push(line);
    pages.push(lines.join('\n'));
  }
  await doc.destroy();
  return { text: pages.join('\n\n').replace(/[ \t]+\n/g, '\n').replace(/\t+/g, '\t').trim(), pages: doc.numPages };
}
/** Text from a document, with SSNs and tax IDs masked to the last four digits before anything else sees it. */
export async function extractDocument(name: string, buf: ArrayBuffer): Promise<string> { return maskSensitive(await extractRaw(name, buf)); }
async function extractRaw(name: string, buf: ArrayBuffer): Promise<string> {
  const n = name.toLowerCase();
  if (n.endsWith('.txt') || n.endsWith('.md') || n.endsWith('.csv')) return new TextDecoder().decode(buf);
  if (n.endsWith('.docx') || n.endsWith('.docm') || n.endsWith('.dotx')) return docxText(buf);
  if (n.endsWith('.pdf')) { const r = await pdfText(buf); if (r.text.replace(/\s/g, '').length < 40) throw new Error(`This PDF (${r.pages} pages) has no text layer — it looks scanned. Export it as a text PDF or Word file, or paste the text.`); return r.text; }
  if (n.endsWith('.doc')) { const t = legacyDocText(buf); if (t.replace(/\s/g, '').length < 40) throw new Error('This older .doc file couldn’t be read. In Word, choose File → Save As → .docx, then upload again.'); return t; }
  if (n.endsWith('.rtf')) return new TextDecoder().decode(buf).replace(/\\[a-z]+-?\d* ?|[{}]/g, '').trim();
  throw new Error('Upload a PDF, Word (.docx), or text file.');
}

/** Render PDF pages to PNG blobs (browser only) so scanned documents can be read by AI vision. */
export async function pdfPageImages(buf: ArrayBuffer, maxPages = 3, scale = 1.6): Promise<Blob[]> {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), isEvalSupported: false }).promise; const out: Blob[] = [];
  for (let i = 1; i <= Math.min(doc.numPages, maxPages); i++) {
    const page = await doc.getPage(i); const vp = page.getViewport({ scale }); const canvas = document.createElement('canvas'); canvas.width = vp.width; canvas.height = vp.height;
    await page.render({ canvasContext: canvas.getContext('2d')!, viewport: vp }).promise;
    out.push(await new Promise<Blob>(res => canvas.toBlob(b => res(b!), 'image/png')));
  }
  await doc.destroy(); return out;
}
