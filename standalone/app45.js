/* Aldune — part 45: read scans without the AI — built-in text recognition (OCR) as the fallback.
   When enhanced AI isn't available (or fails), scanned PDFs and photos are read in the browser with Tesseract (loaded on first use
   from jsDelivr; nothing is uploaded). Each page is cleaned first — enlarged when small, turned to grayscale, contrast-stretched,
   and thresholded (Otsu) — which is what lifts accuracy on faded or photographed printouts. The text then goes through the same
   readers (OCR digit fixes, time cards, pay stubs, rosters) as everything else. Handwriting still reads best with the AI on; the
   item says which reader was used. */
(() => {
'use strict';
const X = window.PCX;
const CDN = { lib: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js', worker: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js', core: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1', lang: 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int' };
let libP = null, workerP = null;
const loadLib = () => libP || (libP = new Promise((res, rej) => { if (window.Tesseract) return res(window.Tesseract); const s = document.createElement('script'); s.src = CDN.lib; s.onload = () => window.Tesseract ? res(window.Tesseract) : rej(new Error('Text recognition did not load.')); s.onerror = () => { libP = null; rej(new Error('This is a scan, and the built-in text recognition could not be loaded (no connection to cdn.jsdelivr.net). Turn on enhanced AI (Aldune AI page) to read it, or upload a text PDF, Word, or Excel version.')); }; document.head.appendChild(s); }));
const getWorker = () => workerP || (workerP = loadLib().then(T => T.createWorker('eng', 1, { workerPath: CDN.worker, corePath: CDN.core, langPath: CDN.lang, logger: () => {} })).catch(e => { workerP = null; throw e; }));

/** Prepare a page image for OCR. mode 'gray': grayscale + contrast stretch (best on blurred or JPEG-compressed photos);
 *  mode 'bin': + Otsu threshold (best on speckled, faded printouts). target = long side in pixels after scaling. */
async function prepare(blob, mode = 'gray', target = 2000) {
  try {
    const bmp = await createImageBitmap(blob); const scale = Math.max(1, Math.min(4, target / Math.max(bmp.width, bmp.height)));
    const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale); const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true }); g.imageSmoothingQuality = 'high'; g.drawImage(bmp, 0, 0, w, h);
    const img = g.getImageData(0, 0, w, h); const d = img.data; const hist = new Array(256).fill(0); const gray = new Uint8ClampedArray(w * h);
    let lo = 255, hi = 0; for (let i = 0, k = 0; i < d.length; i += 4, k++) { const v = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000 | 0; gray[k] = v; if (v < lo) lo = v; if (v > hi) hi = v; }
    const span = Math.max(1, hi - lo); for (let k = 0; k < gray.length; k++) { gray[k] = (gray[k] - lo) * 255 / span; hist[gray[k]]++; }
    let thr = 256;
    if (mode === 'bin') { let sum = 0; for (let t = 0; t < 256; t++) sum += t * hist[t]; let sumB = 0, wB = 0, best = 0; const total = gray.length;
      for (let t = 0; t < 256; t++) { wB += hist[t]; if (!wB) continue; const wF = total - wB; if (!wF) break; sumB += t * hist[t]; const mB = sumB / wB, mF = (sum - sumB) / wF; const between = wB * wF * (mB - mF) ** 2; if (between > best) { best = between; thr = t; } } }
    for (let i = 0, k = 0; i < d.length; i += 4, k++) { const v = mode === 'bin' ? (gray[k] > thr ? 255 : 0) : gray[k]; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
    g.putImageData(img, 0, 0); return await new Promise(r => c.toBlob(b => r(b || blob), 'image/png'));
  } catch { return blob; }
}
async function readPage(worker, blob) {
  // try the cleanest variant first; if the recognizer is unsure, try others and keep the most confident reading
  const variants = [['gray', 2000], ['bin', 2000], ['gray', 3000]]; let best = null;
  for (const [mode, target] of variants) {
    const r = await worker.recognize(await prepare(blob, mode, target), {}, { text: true, blocks: true });
    // a line is only as trustworthy as its least certain number (Tesseract is confident about letters and unsure about 5 vs 6)
    const lines = []; const digitConf = [];
    for (const b of r.data.blocks || []) for (const p of b.paragraphs || []) for (const l of p.lines || []) { const nums = (l.words || []).filter(w => /\d/.test(w.text)).map(w => w.confidence || 0); nums.forEach(c => digitConf.push(c)); lines.push({ text: l.text || '', confidence: nums.length ? Math.min(...nums) : (l.confidence || 0) }); }
    const conf = digitConf.length ? digitConf.reduce((a, c) => a + c, 0) / digitConf.length : (r.data.confidence || 0);
    const cand = { conf, lines: lines.length ? lines : (r.data.text || '').split('\n').map(text => ({ text, confidence: r.data.confidence || 0 })) };
    if (!best || cand.conf > best.conf) best = cand;
    if (best.conf >= 90) break;
  }
  return best;
}
/** Text from page images with the built-in reader: best variant per page, impossible values repaired, unsure lines marked. */
X.ocrImages = async (blobs, onProgress) => {
  const worker = await getWorker(); const out = []; let conf = 0;
  for (let k = 0; k < blobs.length; k++) { onProgress && onProgress(k + 1, blobs.length); const best = await readPage(worker, blobs[k]); conf += best.conf; out.push(window.PC.markLowConfidence(best.lines, 80)); }
  const text = window.PC.repairOcrText(out.join('\n\n')); if (!text.replace(/⟨verify⟩/g, '').trim()) throw new Error('No readable text was found on this scan. Try a clearer copy, or turn on enhanced AI.');
  X.lastReader = 'ocr'; X.lastOcrConfidence = Math.round(conf / Math.max(1, blobs.length)); return text;
};
X.ocrPrepare = prepare; X.ocrReadPage = readPage;
X.OCR_CDN = CDN;
})();
