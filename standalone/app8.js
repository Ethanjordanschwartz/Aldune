/* Aldune standalone — part 8: Import page. Each section takes hundreds of files (PDF, Word, Excel, CSV, ZIP, images),
   shows clear status, reads scans with AI vision when available, and offers a clear next step — analyze with whatever you have. */
(() => {
'use strict';
const X = window.PCX; const { PC, S, $, esc, money, toast, busy, idle, VIEWS } = X;
const MAX_FILES = 3000, MAX_FILE = 40 * 1024 * 1024;
S.bulk = S.bulk || { items: [], docs: [], running: false };
const tick = () => new Promise(r => setTimeout(r, 0));
const SLOTS = [
  { ds: 'employees', short: 'Employee lists, rosters, W-2s', title: 'Employee census', unit: 'workers', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><circle cx="17.5" cy="9" r="2.5"/><path d="M16 14.6c2.6.2 4.6 1.9 5.3 4.9"/></svg>', what: 'Employee lists (Excel/CSV), rosters (PDF/Word), W-2s', help: 'IDs, names, job, location, supervisor, exempt status, rates, pay frequency, hire/termination dates, arbitration (Y/N)' },
  { ds: 'time', short: 'Timesheets, time cards, punch exports', title: 'Time punches', unit: 'shifts', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9.5 2.5h5"/></svg>', what: 'Timesheets and time cards (PDF/Word/images), time exports (Excel/CSV)', help: 'One row per shift: employee, date, clock in, meal out, meal in, clock out' },
  { ds: 'payroll', short: 'Pay stubs, payroll registers', title: 'Payroll register', unit: 'pay periods', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9.5v5M18 9.5v5"/></svg>', what: 'Pay stubs (PDF/Word/images), payroll registers (Excel/CSV)', help: 'One row per employee per pay period: hours, rates, premiums, bonuses, pay date' }
];
const DOC_DEFAULT = { employees: 'roster', time: 'timesheet', payroll: 'paystub' };
const KIND_LABEL = { packet: 'Records packet (many employees)', paystub: 'Pay stub', timesheet: 'Timesheet', w2: 'W-2', roster: 'Employee roster', policy: 'Policy / agreement / notice', employees: 'Census spreadsheet', time: 'Time spreadsheet', payroll: 'Payroll spreadsheet' };
const KIND_SLOT = { packet: 'employees', paystub: 'payroll', timesheet: 'time', w2: 'employees', roster: 'employees', employees: 'employees', time: 'time', payroll: 'payroll' };

// ---------- table helpers
function mergeTable(ds, add) {
  const cur = S.imp.files[ds];
  if (!cur) { S.imp.files[ds] = add; return; }
  const headers = [...new Set([...cur.headers, ...add.headers])];
  const mapping = { ...cur.mapping }; for (const [k, v] of Object.entries(add.mapping)) if (mapping[k] === undefined) mapping[k] = v;
  const suggestions = headers.map(h => cur.suggestions.find(s => s.column === h) || add.suggestions.find(s => s.column === h) || { column: h, field: null, confidence: 0 });
  S.imp.files[ds] = { ...cur, headers, rows: cur.rows.concat(add.rows), mapping, suggestions, name: `${(cur.files || 1) + (add.files || 1)} files`, files: (cur.files || 1) + (add.files || 1) };
}
X.mergeTable = mergeTable;
const identityTable = (rows, name, files) => { const headers = [...new Set(rows.flatMap(r => Object.keys(r)))].filter(h => h !== '__doc'); return { headers, rows, mapping: Object.fromEntries(headers.map(h => [h, h])), suggestions: headers.map(h => ({ column: h, field: h, confidence: 1 })), name, files }; };
function detectDataset(parsed) {
  let best = null, bestScore = 0;
  for (const ds of ['employees', 'time', 'payroll']) { const sg = PC.suggestMapping(ds, parsed.headers); const mapped = sg.filter(s => s.field).length; const missing = PC.missingRequired(ds, Object.fromEntries(sg.map(s => [s.column, s.field]))).length; const score = mapped - missing * 3 + (ds === 'time' && sg.some(s => s.field === 'clock_in') ? 3 : 0) + (ds === 'payroll' && sg.some(s => s.field === 'period_start') ? 3 : 0); if (score > bestScore) { best = ds; bestScore = score; } }
  return bestScore >= 2 ? best : null;
}
async function expand(files) {
  const out = [];
  for (const f of files) {
    if (/\.zip$/i.test(f.name)) {
      try { const z = PC.XLSX.CFB.read(new Uint8Array(await f.arrayBuffer()), { type: 'array' });
        z.FileIndex.forEach((e, i) => { const path = z.FullPaths[i]; if (e.type !== 2 || !e.content || /(^|\/)(__MACOSX|\.)/.test(path) || /[\x00-\x1f]/.test(path)) return; const name = path.split('/').pop(); const c = e.content; out.push({ name, path, size: c.length, type: '', arrayBuffer: async () => c.buffer.slice(c.byteOffset, c.byteOffset + c.byteLength), text: async () => new TextDecoder().decode(c), blob: () => new Blob([c]) }); });
      } catch { out.push({ name: f.name, size: f.size, bad: 'This ZIP couldn’t be opened.' }); }
    } else out.push(f);
  }
  return out;
}

// ---------- reading scans and photos with AI vision (when enhanced AI is available)
const isImage = n => /\.(png|jpe?g|webp|gif|bmp|tiff?)$/i.test(n);
async function visionText(blobs) {
  const prompt = 'Transcribe all text in this payroll or timekeeping document exactly — it may be a scan, a photo, or handwritten. Rules: keep each table row or each day on ONE line, date first, then the times in the order written (e.g. "3/2 7:02a 11:30 12:01 3:35p"); keep headings, names, employee IDs, pay periods, rates, hours, and dollar amounts exactly as written; write a crossed-out value as ~~value~~ followed by the replacement; write anything you cannot read as [illegible] — never guess a digit; do not add, total, summarize, or explain. Output only the transcribed text.';
  const mode = X.aiMode(); X.lastReader = 'ai';
  // with AI available, read with AI; if the AI call fails, fall back to the built-in reader (OCR)
  const viaOcr = async (why) => { if (X.ocrImages) return X.ocrImages(blobs); throw why || new Error('This is a scanned image. Turn on enhanced Aldune AI (Aldune AI page) to read scans, or upload a text PDF or Word file.'); };
  if (mode === 'claude') { try { const r = await S.caps.sample(prompt, { images: blobs }); if (r && r.text && r.text.trim()) return r.text; } catch (e) { console.warn(e); } return viaOcr(); }
  if (mode === 'key' || mode === 'proxy') {
    const parts = await Promise.all(blobs.map(async b => { const buf = new Uint8Array(await b.arrayBuffer()); let bin = ''; for (let i = 0; i < buf.length; i += 32768) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 32768)); return { type: 'image', source: { type: 'base64', media_type: b.type || 'image/png', data: btoa(bin) } }; }));
    try { const r = await X.ai([{ role: 'user', content: [...parts, { type: 'text', text: prompt }] }]); if (r && r.text && r.text.trim()) return r.text; } catch (e) { console.warn(e); } return viaOcr();
  }
  return viaOcr();
}

// ---------- process files (optionally into a specific section)
async function processFiles(fileList, slot) {
  if (S.bulk.running) return; S.bulk.running = true; S.bulk.cancel = false;
  const files = (await expand([...fileList])).filter(f => !/^(thumbs\.db|\.ds_store|desktop\.ini)$/i.test(f.name));
  if (files.length > MAX_FILES) { toast(`Up to ${MAX_FILES.toLocaleString()} files at a time — reading the first ${MAX_FILES.toLocaleString()}.`); files.length = MAX_FILES; }
  const sheets = { employees: [], time: [], payroll: [] };
  busy(slot ? `Adding to ${SLOTS.find(x => x.ds === slot).title}` : 'Reading files', `0 of ${files.length.toLocaleString()}`);
  document.querySelectorAll('#bulk-bar,#bulk-cancel').forEach(n => n.remove());
  $('#overlay .box').insertAdjacentHTML('beforeend', '<div id="bulk-bar" style="height:6px;background:var(--sunk);border-radius:3px;margin-top:10px"><div style="height:6px;width:0;background:var(--ledger);border-radius:3px"></div></div><button class="btn" style="margin-top:10px" id="bulk-cancel">Stop</button>');
  $('#bulk-cancel').addEventListener('click', () => { S.bulk.cancel = true; });
  let done = 0;
  for (const f of files) {
    if (S.bulk.cancel) break;
    const item = { name: f.path || f.name, size: f.size || 0, kind: 'policy', slot: slot || null, status: 'ok', note: '' };
    try {
      if (f.bad) throw new Error(f.bad);
      if (f.size > MAX_FILE) throw new Error('Over 40 MB.');
      if (/\.(csv|xlsx|xls|xlsm|xlsb|ods|fods|tsv)$/i.test(f.name)) {
        const parsed = PC.parseFile(f.name, /\.(xlsx|xls|xlsm|xlsb|ods|fods)$/i.test(f.name) ? await f.arrayBuffer() : await f.text());
        // W-2 registers (one row per employee with box columns): each row becomes a W-2 and a worker
        const w2rows = PC.parseW2Table(parsed.headers, parsed.rows);
        if (w2rows.length >= 2 && (!slot || slot === 'employees' || slot === 'payroll')) { for (const w of w2rows) S.bulk.docs.push({ name: `${f.name} · ${w.name || w.employeeId}`, kind: 'w2', data: w, text: '' }); item.kind = 'w2'; item.slot = 'employees'; item.note = `${w2rows.length.toLocaleString()} W-2s (one per employee)`; S.bulk.items.push(item); done++; continue; }
        const ds = slot || detectDataset(parsed); if (!ds) throw new Error('Columns don’t match an employee census, time punches, or payroll register.');
        sheets[ds].push({ ...parsed, name: f.name }); item.kind = ds; item.slot = ds; item.note = `${parsed.rows.length.toLocaleString()} rows`;
      } else if (/\.(pdf|docx|docm|txt|md|rtf|doc)$/i.test(f.name) || isImage(f.name)) {
        let text, viaAi = false;
        if (isImage(f.name)) { text = PC.maskSensitive(await visionText([f.blob ? f.blob() : f])); viaAi = true; }
        else { try { text = await PC.extractDocument(f.name, await f.arrayBuffer()); } catch (e) { if (/no text layer/i.test(e.message) && /\.pdf$/i.test(f.name)) { text = PC.maskSensitive(await visionText(await PC.pdfPageImages(await f.arrayBuffer(), 3))); viaAi = true; } else throw e; } }
        // one document holding several employees' records (summary + stubs + timesheets per person) — read it as a packet first
        // an answer key, grading sheet, or audit report describes findings — it is not payroll or time data
        if (/\banswer\s*key\b|\bgrading (?:key|sheet)\b|planted (?:errors|violations)/i.test(text.slice(0, 1500))) { item.kind = 'skipped'; item.status = 'skipped'; item.note = 'Answer key or grading sheet — not used as records (it describes expected results, not pay or time data).'; S.bulk.items.push(item); done++; continue; }
        let pk = PC.parseRecordsPacket(text);
        // a multi-employee timesheet or stub batch the classic readers handle better stays with them — unless the packet
        // separates more employees (a single-employee reading of a 50-person packet is never better)
        if (pk && PC.classifyDataDocument(text) === 'timesheet') { const ts = PC.parseTimesheet(text, f.name); const tsEmps = new Set((ts.entries || []).map(x => x.employeeId || x.employee || x.name || '')).size; const pkEmps = new Set(pk.tables.time.map(t => t.employee_id)).size; if (ts.entries.length > pk.tables.time.length && tsEmps >= pkEmps) pk = null; }
        if (pk) {
          S.bulk.docs.push({ name: item.name, kind: 'packet', data: pk.tables, text: '' });
          item.kind = 'packet'; item.slot = 'employees';
          const nStub = pk.tables.payroll.length, nShift = pk.tables.time.length, nFinal = pk.employees.filter(e => e.read.some(r => /final check/i.test(r))).length;
          item.note = `${pk.employees.length} employees · ${nStub} pay stub${nStub === 1 ? '' : 's'} · ${nShift} shifts${nFinal ? ` · ${nFinal} final-pay record${nFinal === 1 ? '' : 's'}` : ''}`;
          item.details = pk.employees.map(e => ({ name: e.name, read: e.read, caveats: e.caveats }));
          if (pk.employer && !S.imp.name) S.imp.name = pk.employer;
          if (pk.workweekStart !== undefined) S.imp.workweekStart = pk.workweekStart;
          S.bulk.items.push(item); done++; continue;
        }
        const detected = PC.classifyDataDocument(text);
        let kind = ['paystub', 'timesheet', 'w2'].includes(detected) ? detected : slot ? DOC_DEFAULT[slot] : (PC.parseRoster(text).length >= 3 ? 'roster' : 'policy');
        if (slot === 'employees' && detected === 'other') kind = 'roster';
        if (kind === 'policy') { S.docs.push({ name: item.name, text, type: PC.classifyDocument(text) }); item.kind = 'policy'; item.note = PC.DOC_LABELS[PC.classifyDocument(text)] || 'Document'; }
        else {
          if (kind === 'w2') { const ws = PC.parseW2s(text, f.name); ws.forEach((w, k) => S.bulk.docs.push({ name: ws.length > 1 ? `${item.name} · ${w.name || w.employeeId || k + 1}` : item.name, kind, data: w, text: ws.length > 1 ? '' : text })); item.kind = kind; item.slot = KIND_SLOT[kind]; describe(item, kind, ws[0]); if (ws.length > 1) item.note = `${ws.length.toLocaleString()} W-2s (one per employee)`; }
          else { const data = kind === 'paystub' ? PC.parsePayStub(text, f.name) : kind === 'timesheet' ? PC.parseTimesheet(text, f.name) : PC.parseRoster(text);
          S.bulk.docs.push({ name: item.name, kind, data, text }); item.kind = kind; item.slot = KIND_SLOT[kind]; describe(item, kind, data); }
        }
        if (viaAi) item.note = `${X.lastReader === 'ocr' ? 'Read from a scan with built-in text recognition — check handwritten values' : 'Read from a scan'} · ${item.note}`;
      } else throw new Error('Unsupported file type. Use PDF, Word, Excel, CSV, ZIP, or an image.');
    } catch (e) { item.status = 'error'; item.note = e.message || 'Couldn’t read this file.'; if (/scanned image|enhanced Aldune AI|Text recognition|No readable text/i.test(item.note)) item.status = 'scan'; }
    S.bulk.items.push(item); done++;
    if (done % 3 === 0 || done === files.length) { $('#ov-msg').textContent = `${done.toLocaleString()} of ${files.length.toLocaleString()} · ${f.name}`; const bar = $('#bulk-bar div'); if (bar) bar.style.width = `${Math.round(done / files.length * 100)}%`; await tick(); }
  }
  for (const ds of ['employees', 'time', 'payroll']) for (const p of sheets[ds]) { const sg = PC.suggestMapping(ds, p.headers); mergeTable(ds, { headers: p.headers, rows: p.rows, mapping: Object.fromEntries(sg.map(s => [s.column, s.field])), suggestions: sg, name: p.name, files: 1 }); }
  rebuildFromDocs(); idle(); S.bulk.running = false;
  if (!S.imp.name && S.profile?.company) S.imp.name = S.profile.company;
  X.log && X.log('data.bulk_upload', { files: done, section: slot || 'auto' });
  toast(`${done.toLocaleString()} file${done === 1 ? '' : 's'} read${S.bulk.cancel ? ' (stopped)' : ''} — see the next step below`); X.render();
}
const prettyDates = t => String(t).replace(/\b(20\d{2})-(\d{2})-(\d{2})\b/g, (_, y, m, d) => new Date(`${y}-${m}-${d}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }));
function describe(item, kind, d) {
  const fd = x => x ? new Date(x + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '?';
  if (kind === 'paystub') { const who = d.name || d.employeeId; item.note = `${who || 'Unknown worker'} · ${fd(d.periodStart)} – ${fd(d.periodEnd)}${d.gross !== undefined ? ` · gross ${money(d.gross, true)}` : ''}${d.missing.length ? ` · stub is missing ${d.missing.length} required item${d.missing.length > 1 ? 's' : ''}` : ' · all required items present'}`; if (!d.periodEnd || !who) { item.status = 'review'; item.note = `We couldn’t find ${!d.periodEnd ? 'the pay period dates' : 'the worker’s name or ID'} on this stub, so it isn’t in the audit yet. Change the type if it isn’t a pay stub, or add the stub as a spreadsheet row.`; } }
  if (kind === 'timesheet') { const who = d.name || d.employeeId; item.note = `${who || 'Unknown worker'} · ${d.entries.length} shift${d.entries.length === 1 ? '' : 's'}${d.entries.some(e => e.meal1Out) ? ' with meal punches' : ' · no meal punches recorded'}${d.entries.some(e => e.flagged) ? ' · some days have an odd number of punches' : ''}`; if (!d.entries.length || !who) { item.status = 'review'; item.note = `We couldn’t find ${!d.entries.length ? 'any dated shifts' : 'the worker’s name or ID'} in this timesheet, so it isn’t in the audit yet.`; } }
  if (kind === 'w2') item.note = `${d.name || '?'} · ${d.year || '?'} · Box 1 ${d.box1 ? money(d.box1, true) : '?'}`;
  if (kind === 'roster') { item.note = `${d.length} workers`; if (!d.length) { item.status = 'review'; item.note = 'No employee rows recognized'; } }
}
function rebuildFromDocs() {
  for (const ds of ['employees', 'time', 'payroll']) { const cur = S.imp.files[ds]; if (!cur) continue; if (cur.fromDocs) delete S.imp.files[ds]; else if (cur.docRows) { cur.rows = cur.rows.filter(r => !r.__doc); delete cur.docRows; } }
  if (!S.bulk.docs.length) { S.bulk.recon = []; return; }
  const t = PC.buildTables(S.bulk.docs.map(d => ({ kind: d.kind, data: d.data })));
  for (const ds of ['employees', 'time', 'payroll']) {
    if (!t[ds].length) continue; const rows = t[ds].map(r => ({ ...r, __doc: 1 }));
    if (!S.imp.files[ds]) S.imp.files[ds] = { ...identityTable(rows, 'documents', 1), fromDocs: true };
    else { mergeTable(ds, identityTable(rows, 'documents', 1)); S.imp.files[ds].docRows = true; }
  }
  const key = w => { const byName = t.employees.find(e => String(e.name).toUpperCase() === String(w.name || '').toUpperCase()); return byName ? byName.employee_id : PC.workerKey(w.employeeId, w.name); };
  S.bulk.recon = PC.w2Reconcile(S.bulk.docs.filter(d => d.kind === 'w2').map(d => d.data), t.payroll, key);
}

// ---------- readiness and analyze-now (works with any one dataset)
function idColumn(ds) { const f = S.imp.files[ds]; return f ? Object.entries(f.mapping).find(([, v]) => v === 'employee_id')?.[0] : null; }
function readiness() {
  const f = S.imp.files; const r = {};
  for (const s of SLOTS) { const t = f[s.ds]; if (!t) { r[s.ds] = { state: 'empty' }; continue; }
    const missing = PC.missingRequired(s.ds, t.mapping); const workers = new Set(t.rows.map(x => x[idColumn(s.ds) || 'employee_id']).filter(Boolean)).size;
    r[s.ds] = { state: missing.length ? 'mapping' : 'ready', rows: t.rows.length, workers, missing, sheet: !t.fromDocs }; }
  const items = S.bulk.items; r.review = items.filter(i => i.status === 'review').length; r.errors = items.filter(i => i.status === 'error').length; r.scans = items.filter(i => i.status === 'scan').length;
  r.any = ['employees', 'time', 'payroll'].some(ds => r[ds].state !== 'empty'); r.canRun = ['employees', 'time', 'payroll'].some(ds => r[ds].state === 'ready');
  return r;
}
async function analyzeNow() {
  const r = readiness(); const f = S.imp.files;
  const needsMap = SLOTS.filter(s => r[s.ds].state === 'mapping');
  if (needsMap.length) { S.imp.step = 1; X.render(); toast(`Match the required columns for ${needsMap.map(s => s.title.toLowerCase()).join(' and ')}: ${needsMap.flatMap(s => r[s.ds].missing).join(', ')}.`); return; }
  if (!r.canRun) { toast('Add files to at least one section first.'); return; }
  const tables = {}; for (const s of SLOTS) if (f[s.ds]) tables[s.ds] = f[s.ds];
  if (!tables.employees) { // build a census from the IDs in time punches and payroll
    const ids = new Map(); for (const ds of ['time', 'payroll']) { const t = f[ds]; if (!t) continue; const col = idColumn(ds); const nameCol = Object.entries(t.mapping).find(([, v]) => v === 'name')?.[0]; t.rows.forEach(x => { const id = x[col]; if (id && !ids.has(id)) ids.set(id, nameCol ? x[nameCol] : id); }); }
    tables.employees = identityTable([...ids.entries()].map(([id, name]) => ({ employee_id: id, name, classification: 'nonexempt' })), 'from IDs', 1);
  }
  const n = PC.normalize(S.imp.name || S.profile?.company || 'Imported employer', tables);
  S.imp.norm = n; S.imp.q2 = PC.assessQuality(n.input, n.issues); S.extraChecks = n.issues;
  S.assumptions = Object.assign({}, PC.DEFAULT_ASSUMPTIONS, S.imp.workweekStart !== undefined ? { workweekStart: S.imp.workweekStart } : {}, { industry: S.imp.industry || 'general', healthcareMealWaivers: !!S.imp.hcWaivers, cbaMealExempt: !!S.imp.cba, h2aEmployer: !!S.imp.h2a });
  S.partial = { time: !!f.time, payroll: !!f.payroll, census: !!f.employees };
  await X.runPipeline(n.input, `Imported ${new Date().toLocaleDateString()}`, 'import');
  const skipped = [!f.time && 'meal, rest, and split-shift checks (no time punches)', !f.payroll && 'pay-rate, overtime-pay, wage-statement, and payday checks (no payroll)', !f.employees && 'classification checks (no census — workers were created from IDs)'].filter(Boolean);
  if (skipped.length) toast(`Analysis complete. Not checked yet: ${skipped.join('; ')}. Add those files anytime and re-run.`);
}
X.analyzeNow = analyzeNow; X.readiness = readiness;

// ---------- Import page (step 1 redesigned; column matching and validation screens kept for spreadsheets)
const origImport = VIEWS.import;
function nextBar() {
  const r = readiness(); const docs = S.docs.length;
  const parts = SLOTS.filter(s => r[s.ds].state !== 'empty').map(s => `${r[s.ds].state === 'ready' ? '✓' : '⚠'} ${r[s.ds].rows.toLocaleString()} ${s.unit}`);
  if (docs) parts.push(`${docs} document${docs > 1 ? 's' : ''}`);
  const checks = [r.time.state !== 'empty' && 'meal and rest periods, overtime, split shifts', r.payroll.state !== 'empty' && 'pay rates, overtime pay, wage statements, paydays', r.time.state !== 'empty' && r.payroll.state !== 'empty' && 'hours worked vs. hours paid', r.employees.state !== 'empty' && 'classification and final pay'].filter(Boolean);
  let msg, btns;
  if (!r.any && !docs) { msg = '<b>Add files above to begin.</b>'; btns = '<button class="btn" data-act="imp-samples">Try sample files</button><button class="btn" data-act="demo">See the demo company</button>'; }
  else if (!r.any && docs) { msg = `<b>${docs} document${docs > 1 ? 's' : ''} ready to review</b> against California law. Add payroll or time files to also run an audit.`; btns = '<button class="btn primary" data-act="go" data-to="review">Review documents →</button>'; }
  else { msg = `<b>Ready:</b> ${parts.join(' · ')}<br><span class="small" title="Aldune will check ${esc(checks.join('; ') || 'what it can')}">${r.review ? `${r.review} file${r.review > 1 ? 's' : ''} need a look.` : 'Ready to analyze.'}${r.scans ? ` ${r.scans} scan${r.scans > 1 ? 's' : ''} need Aldune AI.` : ''}</span>`;
    btns = `<button class="btn primary" style="padding:12px 20px;font-size:16px" data-act="imp-analyze">Analyze now →</button>${SLOTS.some(s => r[s.ds].sheet && r[s.ds].state !== 'empty') ? '<button class="btn" data-act="imp-next">Check column matching</button>' : ''}${docs ? '<button class="btn" data-act="go" data-to="review">Review documents</button>' : ''}`; }
  return `<div id="next-bar" class="panel" style="position:sticky;bottom:calc(10px + env(safe-area-inset-bottom,0px));z-index:5;border:2px solid var(--ledger);box-shadow:0 10px 30px -12px rgba(42,32,25,.45);display:flex;gap:14px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin-top:18px"><div style="flex:1;min-width:260px"><span class="chip ok" style="margin-right:6px">Next step</span>${msg}</div><div class="row">${btns}</div></div>`;
}
X.importNextBar = nextBar;
VIEWS.import = el => {
  if (S.imp.step !== 0) { origImport(el); el.insertAdjacentHTML('beforeend', nextBar()); return; }
  const r = readiness(); const items = S.bulk.items;
  const card = s => { const st = r[s.ds]; const its = items.filter(i => i.slot === s.ds); const rev = its.filter(i => i.status === 'review').length, err = its.filter(i => i.status === 'error' || i.status === 'scan').length;
    const status = st.state === 'empty' ? '<span class="chip">Optional</span>' : st.state === 'ready' ? '<span class="chip ok">✓ Ready</span>' : '<span class="chip warn">Needs column matching</span>';
    return `<div class="drop slotzone" data-slot="${s.ds}" style="border-style:${st.state === 'empty' ? 'solid' : 'solid'};border-width:2px;border-color:${st.state === 'ready' ? 'var(--ledger)' : st.state === 'mapping' ? 'var(--warn)' : 'var(--line)'};background:${st.state === 'ready' ? 'var(--ledger-tint)' : 'var(--surface)'};min-height:170px">
      <div class="row" style="justify-content:space-between;align-items:center"><b style="font-size:17px">${s.icon} ${s.title}</b>${status}</div>
      ${st.state === 'empty' ? `<span class="small muted" title="${esc(s.what)}. ${esc(s.help)}. Hundreds at once, a folder, or a ZIP.">${s.short}</span>` : `<div style="font-family:Fraunces,Georgia,serif;font-size:30px;font-weight:600;line-height:1.1">${st.rows.toLocaleString()} <span style="font-size:16px">${s.unit}</span></div><span class="small">${st.workers ? `${st.workers.toLocaleString()} workers · ` : ''}${its.length ? `${its.length.toLocaleString()} file${its.length > 1 ? 's' : ''}` : esc(S.imp.files[s.ds].name || '')}${rev ? ` · <b style="color:var(--warn)">${rev} need review</b>` : ''}${err ? ` · <b style="color:var(--flag)">${err} not read</b>` : ''}</span>${st.state === 'mapping' ? `<span class="small" style="color:var(--warn)">Match these columns: ${st.missing.join(', ')}</span>` : ''}`}
      <div class="row" style="margin-top:auto"><label class="btn ${st.state === 'empty' ? 'primary' : ''}" style="cursor:pointer">${st.state === 'empty' ? 'Add files' : 'Add more'}<input type="file" data-slotfiles="${s.ds}" multiple accept=".pdf,.docx,.docm,.doc,.txt,.rtf,.csv,.tsv,.xlsx,.xls,.xlsm,.zip,.png,.jpg,.jpeg,.webp,.xlsb,.ods,.fods" style="display:none"></label>${st.state !== 'empty' ? `<button class="btn" data-act="slot-view" data-ds="${s.ds}">View files</button>` : ''}<details class="more-menu"><summary class="btn" aria-label="More options" title="More options">⋯</summary><div class="more-pop"><label class="btn" style="cursor:pointer">Add a whole folder<input type="file" data-slotfolder="${s.ds}" webkitdirectory directory multiple style="display:none"></label>${st.state !== 'empty' ? `<button class="btn" data-act="slot-clear" data-ds="${s.ds}">Clear this section</button>` : ''}</div></details></div></div>`; };
  const stubs = S.bulk.docs.filter(d => d.kind === 'paystub'); const gaps = {}; stubs.forEach(d => d.data.missing.forEach(m => { gaps[m] = (gaps[m] || 0) + 1; }));
  el.innerHTML = X.head('Import data', 'Add files to any section. You don’t need all three.') + `
    <div class="panel"><div class="grid g2"><label class="field">Employer name<input id="im-name" value="${esc(S.imp.name || S.profile?.company || '')}" placeholder="Company legal name"></label><label class="field">Industry rules<select id="im-ind"><option value="general">General (Lab. Code § 510)</option><option value="agriculture" ${S.imp.industry === 'agriculture' ? 'selected' : ''}>Agriculture (Lab. Code §§ 857–864)</option></select></label></div></div>
    <div class="grid g3" style="margin-top:14px">${SLOTS.map(card).join('')}</div>
    <div class="grid g2" style="margin-top:14px">
      <div class="drop slotzone" data-slot="" style="min-height:0;padding:12px"><div class="row" style="justify-content:space-between;align-items:center"><b>Not sure where it goes? Drop everything here</b>${items.length ? `<span class="chip">${items.length.toLocaleString()} read</span>` : ''}</div><div class="row"><label class="btn" style="cursor:pointer">Choose files<input type="file" id="bulk-files" multiple accept=".pdf,.docx,.docm,.doc,.txt,.rtf,.csv,.tsv,.xlsx,.xls,.xlsm,.zip,.png,.jpg,.jpeg,.webp,.xlsb,.ods,.fods" style="display:none"></label>${items.length ? '<button class="btn" data-act="slot-view" data-ds="">View all files</button>' : ''}<details class="more-menu"><summary class="btn" aria-label="More options" title="More options">⋯</summary><div class="more-pop"><label class="btn" style="cursor:pointer">Choose a folder<input type="file" id="bulk-folder" webkitdirectory directory multiple style="display:none"></label>${items.length ? '<button class="btn" data-act="bulk-clear">Clear everything</button>' : ''}</div></details></div></div>
      <div class="drop" style="min-height:0;padding:12px;border-color:${S.docs.length ? 'var(--ledger)' : 'var(--line)'}"><div class="row" style="justify-content:space-between;align-items:center"><b>Policies and notices</b>${S.docs.length ? `<span class="chip ok">✓ ${S.docs.length}</span>` : '<span class="chip">Optional</span>'}</div><div class="row"><label class="btn" style="cursor:pointer">Add documents<input type="file" id="im-docs" multiple accept=".pdf,.docx,.docm,.txt,.md,.rtf,.doc" style="display:none"></label>${S.docs.length ? '<button class="btn primary" data-act="go" data-to="review">Review documents</button>' : ''}</div></div></div>
    ${Object.keys(gaps).length ? `<details class="alert medium" style="margin-top:14px"><summary><b>Pay stubs are missing ${Object.keys(gaps).length} required item${Object.keys(gaps).length > 1 ? 's' : ''}</b> <span class="small">(Lab. Code § 226(a)) — details</span></summary><table style="margin-top:8px"><tbody>${Object.entries(gaps).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<tr><td><b>${esc(k[0].toUpperCase() + k.slice(1))}</b></td><td class="small">missing on ${v.toLocaleString()} of ${stubs.length.toLocaleString()}</td></tr>`).join('')}</tbody></table><div class="small" style="margin-top:6px">Penalty: $50 first pay period, $100 each after, up to $4,000 per employee. Fix: ask your payroll provider to add these items.</div></details>` : ''}
    ${(S.bulk.recon || []).some(x => x.flag) ? `<div class="alert medium"><b>W-2 vs. pay stubs</b><div class="small">${S.bulk.recon.filter(x => x.flag).slice(0, 5).map(x => `${esc(x.name)} ${x.year}: W-2 ${money(x.box1, true)} vs stubs ${money(x.payrollGross, true)}`).join(' · ')}</div></div>` : ''}
    ${S.slotView !== undefined ? fileTable(S.slotView) : ''}
    <p class="cite" style="margin-top:10px" title="Social Security numbers and tax IDs are masked to the last four digits. Scans and photos are read with Aldune AI when it’s on.">🔒 Files are read in your browser — nothing is uploaded.</p>
    ${nextBar()}`;
  $('#im-name').addEventListener('input', e => { S.imp.name = e.target.value; });
  $('#im-ind').addEventListener('change', e => { S.imp.industry = e.target.value; });
  el.querySelectorAll('[data-slotfiles],[data-slotfolder]').forEach(i => i.addEventListener('change', async e => { const fl = [...e.target.files]; const ds = e.target.dataset.slotfiles || e.target.dataset.slotfolder; e.target.value = ''; if (fl.length) await processFiles(fl, ds); }));
  [$('#bulk-files'), $('#bulk-folder')].forEach(i => i.addEventListener('change', async e => { const fl = [...e.target.files]; e.target.value = ''; if (fl.length) await processFiles(fl, null); }));
  $('#im-docs').addEventListener('change', async e => { const fl = [...e.target.files]; e.target.value = ''; for (const file of fl) { busy('Reading', file.name); try { const text = await PC.extractDocument(file.name, await file.arrayBuffer()); S.docs.push({ name: file.name, text, type: PC.classifyDocument(text) }); } catch (x) { toast(x.message); } finally { idle(); } } X.render(); });
  el.querySelectorAll('.slotzone').forEach(z => {
    ['dragenter', 'dragover'].forEach(ev => z.addEventListener(ev, e => { e.preventDefault(); z.style.outline = '3px solid var(--ledger)'; }));
    ['dragleave', 'drop'].forEach(ev => z.addEventListener(ev, e => { e.preventDefault(); z.style.outline = ''; }));
    z.addEventListener('drop', async e => { const fl = [...(e.dataTransfer?.files || [])]; if (fl.length) await processFiles(fl, z.dataset.slot || null); });
  });
  el.querySelectorAll('[data-bk]').forEach(s => s.addEventListener('change', e => {
    const d = S.bulk.docs.find(x => x.name === e.target.dataset.bk); const it = S.bulk.items.find(x => x.name === e.target.dataset.bk); if (!d) return;
    d.kind = e.target.value; d.data = d.kind === 'paystub' ? PC.parsePayStub(d.text, d.name) : d.kind === 'timesheet' ? PC.parseTimesheet(d.text, d.name) : d.kind === 'w2' ? PC.parseW2(d.text, d.name) : PC.parseRoster(d.text);
    it.kind = d.kind; it.slot = KIND_SLOT[d.kind]; it.status = 'ok'; describe(it, d.kind, d.data); rebuildFromDocs(); X.render();
  }));
};
function fileTable(ds) {
  const list = S.bulk.items.filter(i => (ds ? i.slot === ds : true));
  return `<div class="panel" style="margin-top:14px"><div class="row" style="justify-content:space-between"><b>${ds ? SLOTS.find(s => s.ds === ds).title : 'All files'} — ${list.length.toLocaleString()} file${list.length === 1 ? '' : 's'}</b><button class="btn" data-act="slot-view" data-ds="__close">Close</button></div>
    <div class="tablewrap" style="max-height:360px;overflow-y:auto;margin-top:8px"><table><thead><tr><th>File</th><th>Read as</th><th>What Aldune found</th></tr></thead><tbody>${list.slice(-1500).map(i => `<tr><td class="small">${esc(i.name)}</td><td>${i.status === 'error' ? '<span class="chip flag">Couldn’t read</span>' : i.status === 'scan' ? '<span class="chip warn">Scan — needs AI</span>' : ['paystub', 'timesheet', 'w2', 'roster'].includes(i.kind) ? `<select data-bk="${esc(i.name)}" aria-label="Document type">${['paystub', 'timesheet', 'w2', 'roster'].map(k => `<option value="${k}" ${i.kind === k ? 'selected' : ''}>${KIND_LABEL[k]}</option>`).join('')}</select>${i.status === 'review' ? ' <span class="chip warn">Review</span>' : ''}` : `<span class="chip">${esc(KIND_LABEL[i.kind] || i.kind)}</span>`}</td><td class="small">${esc(i.note)}${i.details ? `<details style="margin-top:4px"><summary class="small" style="cursor:pointer;color:var(--ledger)">What was read for each employee</summary><ul class="small" style="margin:6px 0 0 16px;padding:0">${i.details.map(x => `<li style="margin-bottom:4px"><b>${esc(x.name)}</b> — ${esc(prettyDates(x.read.join('; ') || 'summary only'))}${x.caveats.length ? `<br><span class="muted">${esc(x.caveats.join(' '))}</span>` : ''}</li>`).join('')}</ul></details>` : ''}</td></tr>`).join('') || `<tr><td colspan="3" class="muted">${ds && S.imp.files[ds] ? 'Data came from a spreadsheet: ' + esc(S.imp.files[ds].name || '') : 'No files.'}</td></tr>`}</tbody></table></div><p class="cite">If a document was read as the wrong type, change it in the dropdown — it’s re-read instantly.</p></div>`;
}

document.addEventListener('click', async e => {
  const a = e.target.closest('[data-act]'); if (!a) return; const d = a.dataset;
  if (d.act === 'imp-analyze') { await analyzeNow(); }
  if (d.act === 'slot-view') { S.slotView = d.ds === '__close' ? undefined : d.ds; X.render(); }
  if (d.act === 'slot-clear' || d.act === 'imp-clear') { const ds = d.ds; S.bulk.docs = S.bulk.docs.filter(x => KIND_SLOT[x.kind] !== ds); S.bulk.items = S.bulk.items.filter(x => x.slot !== ds); delete S.imp.files[ds]; rebuildFromDocs(); X.render(); }
  if (d.act === 'bulk-clear') { S.bulk = { items: [], docs: [], running: false }; S.imp.files = {}; toast('Cleared'); X.render(); }
});
X.processFiles = processFiles;
// keep the floating assistant button clear of the sticky next-step bar
const r0 = X.render; X.render = () => { r0(); document.body.classList.toggle('has-nextbar', !!document.getElementById('next-bar')); };
document.head.insertAdjacentHTML('beforeend', '<style>.has-nextbar #as-fab{bottom:calc(120px + env(safe-area-inset-bottom,0px)) !important}</style>');
})();
