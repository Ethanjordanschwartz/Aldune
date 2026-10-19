/* Aldune — part 35: documents you can batch, and documents in the customer's own format.
   • Generate documents: tick several templates and download them together (one .zip)
   • Your own templates: upload your settlement agreement, payment letter, release, or notice (.docx). Aldune finds the
     placeholders ({{Employee Name}}, [Company], «Total Amount», "Employee ID: ____"), fills them with each worker's
     data and the audit's numbers, and keeps your wording and formatting. Templates are saved in this browser. */
(() => {
'use strict';
const X = window.PCX; const { PC, S, esc, money, toast } = X; const CT = PC.CUSTOM_TPL;
const VIEWS = X.VIEWS;
const KEY = () => `custom-templates:${(S.account && S.account.email) || 'local'}`;
S.ctpl = S.ctpl || { list: null, extra: {}, multi: new Set(), payDate: '' };
const iso = () => new Date().toISOString().slice(0, 10);
const longDate = d => { if (!d) return ''; const x = new Date(String(d).length <= 10 ? d + 'T12:00:00' : d); return isNaN(x) ? String(d) : x.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }); };
const fileSafe = s => String(s || 'document').replace(/\.docx$/i, '').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'document';
const EMP_FIELDS = new Set(['employee_name', 'employee_first_name', 'employee_last_name', 'employee_id', 'employee_address', 'job_title', 'hire_date', 'separation_date', 'location', 'total_amount', 'total_amount_words', 'wages_amount', 'premiums_amount', 'reimbursement_amount', 'interest_amount', 'penalties_amount', 'payment_amount', 'findings_summary', 'findings_list', 'violations_count']);

async function load() {
  if (S.ctpl.list) return S.ctpl.list;
  let v = null; try { v = await X.kvGet(KEY()); } catch { v = null; }
  S.ctpl.list = Array.isArray(v) ? v : []; return S.ctpl.list;
}
async function store() { try { await X.kvSet(KEY(), S.ctpl.list); } catch (e) { console.warn('IndexedDB unavailable:', e && e.name); toast('Templates work for this session, but this browser would not save them.'); } }

// ---------- values for one worker (or for the company when the template has no worker fields)
function companyFields() {
  const party = S.party || {}; const meta = S.result?.engine?.meta || {}; const st = S.dg?.st || {};
  return { employer_name: party.employerName || S.input?.employerName || S.profile?.company || '', employer_address: party.employerAddress || '', signer_name: party.signerName || '', signer_title: party.signerTitle || '', contact: party.contact || '', date: longDate(iso()),
    period_start: longDate(meta.windowStart), period_end: longDate(meta.windowEnd), case_caption: st.caption || '', case_number: st.number || '', court: st.court || '', payment_date: S.ctpl.payDate ? longDate(S.ctpl.payDate) : '' };
}
function workerFields(id) {
  const e = S.empIndex.get(id) || {}; const p = X.payable(id); const sum = S.sumIndex.get(id);
  const fs = (S.findingsBy.get(id) || []).filter(f => f.confidence !== 'low' && f.amount > 0 && !f.premiumIndicated && (S.status[f.id] || 'open') !== 'dismissed');
  const premiums = fs.filter(f => f.amountKind === 'premium').reduce((t, f) => t + f.amount, 0);
  const penalties = sum?.exposure?.penalties ?? fs.filter(f => f.amountKind === 'penalty').reduce((t, f) => t + f.amount, 0);
  const name = e.name || id; const parts = name.trim().split(/\s+/);
  return { employee_name: name, employee_first_name: parts[0] || name, employee_last_name: parts.length > 1 ? parts[parts.length - 1] : '', employee_id: id, employee_address: e.address || '', job_title: e.jobTitle || '', hire_date: longDate(e.hireDate), separation_date: longDate(e.terminationDate), location: e.location || '',
    total_amount: money(p.total), total_amount_words: CT.amountInWords(p.total), payment_amount: money(p.total), wages_amount: money(p.wages), premiums_amount: money(Math.round(premiums * 100) / 100), reimbursement_amount: money(p.reimb), interest_amount: money(p.interest), penalties_amount: money(Math.round((penalties || 0) * 100) / 100),
    findings_summary: p.lines.map(l => l.label).join('; ') || 'No amounts owed were found for this worker.', findings_list: p.lines.map(l => `${l.label}: ${money(l.amount)}`).concat(p.interest ? [`Interest: ${money(p.interest)}`] : [], [`Total: ${money(p.total)}`]).join('\n'), violations_count: String(fs.length) };
}
const isWorkerTemplate = t => t.ph.some(p => p.field && EMP_FIELDS.has(p.field));
function workersFor() {
  if (!S.result) return [];
  if (S.dg?.sel?.size) return [...S.dg.sel];
  return S.result.engine.employees.filter(x => x.exposure.wagesAndPremiums + x.exposure.reimbursement > 0).map(x => x.employee.id);
}
async function fillOne(t, id) {
  const fields = { ...companyFields(), ...(id ? workerFields(id) : {}) };
  return CT.fillTemplate(t.bytes, { fields, byLabel: S.ctpl.extra[t.id] || {} });
}
// returns [{ name, blob }] for one custom template
async function buildCustom(t) {
  const out = [];
  if (isWorkerTemplate(t)) {
    const ids = workersFor(); if (!ids.length) { toast(S.result ? 'No workers selected, and no worker is owed money.' : 'Run an audit first — this template needs worker data.'); return out; }
    for (const id of ids) { const r = await fillOne(t, id); out.push({ name: `${fileSafe(t.name)}-${fileSafe(S.empIndex.get(id)?.name || id)}.docx`, blob: new Blob([r.bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), missing: r.missing }); }
  } else { const r = await fillOne(t, null); out.push({ name: `${fileSafe(t.name)}-${iso()}.docx`, blob: new Blob([r.bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), missing: r.missing }); }
  return out;
}
async function deliver(files, zipName) {
  if (!files.length) return;
  if (files.length === 1) { await X.save(files[0].name, files[0].blob); return; }
  const z = new PC.JSZip(); const used = new Set();
  for (const f of files) { let n = f.name, k = 2; while (used.has(n)) n = f.name.replace(/\.docx$/, `-${k++}.docx`); used.add(n); z.file(n, f.blob); }
  await X.save(zipName, await z.generateAsync({ type: 'blob', compression: 'DEFLATE' }));
}

// ---------- the panels
function chips(t) {
  const known = t.ph.filter(p => p.field), unknown = t.ph.filter(p => !p.field);
  return `<div class="small" style="margin-top:6px">${known.length ? `<span class="muted">Filled automatically:</span> ${known.map(p => `<span class="chip ok" title="${esc(p.raw)}">${esc(CT.FIELD_LABELS[p.field])}</span>`).join(' ')}` : '<span class="muted">No placeholders recognized yet.</span>'}</div>
    ${unknown.length ? `<div class="small" style="margin-top:8px"><span class="muted">Not recognized — type what should go there (same for every copy), or leave it as is:</span><div class="grid g2" style="margin-top:6px">${unknown.map(p => `<label class="field">${esc(p.raw)}<input data-ct-extra="${esc(t.id)}" data-label="${esc(p.label)}" value="${esc((S.ctpl.extra[t.id] || {})[p.label] || '')}"></label>`).join('')}</div></div>` : ''}`;
}
function customPanel() {
  const list = S.ctpl.list || [];
  return `<div class="panel" id="ct-panel" style="margin-bottom:14px"><div class="row" style="justify-content:space-between;align-items:flex-start;gap:12px"><div style="flex:1;min-width:240px"><h3 style="margin:0">Your own templates</h3>
    <p class="small muted" style="margin:4px 0 0">Upload your settlement agreement, payment letter, release, or notice as a Word file. Mark the spots to fill with placeholders like <code>{{Employee Name}}</code>, <code>[Company]</code>, <code>«Total Amount»</code>, <code>{{Findings List}}</code>, or a label and a blank (<code>Employee ID: ______</code>). Aldune fills them with each worker’s data and this audit’s numbers and keeps your wording and formatting.</p></div>
    <label class="btn primary" style="cursor:pointer;white-space:nowrap">Upload template (.docx)<input type="file" id="ct-file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" multiple hidden></label></div>
    ${list.length ? list.map(t => `<div style="border:1px solid var(--line);border-radius:10px;padding:12px;margin-top:12px"><div class="row" style="justify-content:space-between;align-items:center;gap:8px"><div><b>${esc(t.name)}</b> <span class="small muted">· ${isWorkerTemplate(t) ? `one copy per worker (${S.result ? `${workersFor().length} ${S.dg?.sel?.size ? 'selected' : 'owed money'}` : 'run an audit first'})` : 'one document'}</span></div>
      <div class="row" style="gap:6px"><button class="btn primary" data-act="ct-fill" data-id="${esc(t.id)}">Fill and download</button><button class="btn" data-act="ct-del" data-id="${esc(t.id)}" aria-label="Remove ${esc(t.name)}">Remove</button></div></div>${chips(t)}</div>`).join('')
    : '<p class="small muted" style="margin:12px 0 0">No templates yet. Field names Aldune knows: employee name, first and last name, ID, address, job title, hire and separation dates, location, employer name and address, signer name and title, contact, date, payment date, total amount (and in words), wages, premiums, reimbursement, interest, penalties, period start and end, findings summary, findings list, case caption, case number, and court.</p>'}
    ${list.some(isWorkerTemplate) ? `<label class="field" style="max-width:260px;margin-top:12px">Payment date (for {{Payment Date}})<input type="date" id="ct-paydate" value="${esc(S.ctpl.payDate || '')}"></label><p class="small muted" style="margin:4px 0 0">Workers come from the selection under “Workers” below; with none selected, every worker owed money gets a copy.</p>` : ''}</div>`;
}
function multiPanel() {
  const T = X.DG_TPL || []; const list = S.ctpl.list || []; const m = S.ctpl.multi;
  const item = (k, name, desc) => `<label class="check" style="padding:7px 9px;border:1px solid ${m.has(k) ? 'var(--ink)' : 'var(--line)'};border-radius:8px;margin:0"><input type="checkbox" data-ct-multi="${esc(k)}" ${m.has(k) ? 'checked' : ''}><span><b>${esc(name)}</b>${desc ? `<br><span class="small muted">${esc(desc)}</span>` : ''}</span></label>`;
  return `<details class="panel" id="ct-multi" style="margin-bottom:14px" ${m.size || S.ctpl.multiOpen ? 'open' : ''}><summary style="cursor:pointer"><b>Download several at once</b> <span class="small muted">— tick the documents you want; they download together as one .zip.</span></summary>
    <div class="grid g2" style="margin-top:10px;gap:8px">${T.map(([k, n, d]) => item(`tpl:${k}`, n, d)).join('')}${list.map(t => item(`ct:${t.id}`, `${t.name} (your template)`, isWorkerTemplate(t) ? 'One copy per worker' : 'One document')).join('')}</div>
    <div class="row" style="margin-top:12px;gap:8px"><button class="btn primary" data-act="ct-multi-go" ${m.size ? '' : 'disabled'}>Download selected (${m.size})</button><button class="btn" data-act="ct-multi-all">Select all</button><button class="btn" data-act="ct-multi-none">Clear</button></div>
    <p class="small muted" style="margin:6px 0 0">Letters and packets use the workers selected below (or everyone owed money). The settlement packet needs its lawsuit fields filled in first.</p></details>`;
}

const base = VIEWS.documents;
VIEWS.documents = el => {
  base(el);
  if (!S.ctpl.list) { load().then(() => { if (S.view === 'documents') X.render(); }); }
  const split = el.querySelector('.split'); if (!split) return;
  split.insertAdjacentHTML('beforebegin', multiPanel() + customPanel());
  el.querySelector('#ct-file')?.addEventListener('change', async e => {
    const files = [...e.target.files]; e.target.value = ''; let added = 0;
    for (const f of files) {
      if (!/\.docx$/i.test(f.name)) { toast(`${f.name}: upload a Word .docx file (save older .doc files as .docx first).`); continue; }
      try { const bytes = await f.arrayBuffer(); const ph = await CT.detectPlaceholders(bytes); S.ctpl.list.push({ id: `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, name: f.name.replace(/\.docx$/i, ''), bytes, ph, added: new Date().toISOString() }); added++; if (!ph.length) toast(`${f.name}: no placeholders found — add {{Employee Name}}-style markers where data should go.`); }
      catch { toast(`${f.name} could not be read as a Word file.`); }
    }
    if (added) { await store(); toast(`${added} template${added === 1 ? '' : 's'} added.`); X.log && X.log('template.custom_added', { count: added }); X.render(); }
  });
  el.querySelectorAll('[data-ct-extra]').forEach(i => i.addEventListener('input', e => { const id = e.target.dataset.ctExtra; (S.ctpl.extra[id] ||= {})[e.target.dataset.label] = e.target.value; }));
  el.querySelector('#ct-paydate')?.addEventListener('change', e => { S.ctpl.payDate = e.target.value; });
  el.querySelectorAll('[data-ct-multi]').forEach(c => c.addEventListener('change', e => { const k = e.target.dataset.ctMulti; e.target.checked ? S.ctpl.multi.add(k) : S.ctpl.multi.delete(k); S.ctpl.multiOpen = true; X.render(); }));
  el.querySelector('#ct-multi')?.addEventListener('toggle', e => { S.ctpl.multiOpen = e.target.open; });
};

async function multiGo() {
  const keys = [...S.ctpl.multi]; const files = []; const skipped = [];
  X.busy && X.busy('Building documents');
  try {
    for (const k of keys) {
      if (k.startsWith('tpl:')) {
        const tpl = k.slice(4); const meta = (X.DG_TPL || []).find(t => t[0] === tpl); const needsData = !['meal_waiver', 'attestation_policy'].includes(tpl);
        if (needsData && !S.result) { skipped.push(`${meta ? meta[1] : tpl} (needs an audit)`); continue; }
        if (!X.dgValidateFor(tpl)) { skipped.push(meta ? meta[1] : tpl); continue; }
        let models = X.dgBuild(tpl); if (!models || !models.length) { skipped.push(`${meta ? meta[1] : tpl} (nothing to generate)`); continue; }
        if (window.PCX_HOOKS && window.PCX_HOOKS.decorateDocs) models = window.PCX_HOOKS.decorateDocs(models, `${tpl}.docx`) || models;
        files.push({ name: `${tpl}-${iso()}.docx`, blob: await PC.toDocxBlob(models) });
      } else if (k.startsWith('ct:')) {
        const t = (S.ctpl.list || []).find(x => x.id === k.slice(3)); if (!t) continue;
        const out = await buildCustom(t); if (!out.length) skipped.push(t.name); files.push(...out);
      }
    }
  } finally { X.idle && X.idle(); }
  if (!files.length) { toast(skipped.length ? `Nothing generated. Needs attention: ${skipped.join(', ')}.` : 'Nothing to generate.'); return; }
  await deliver(files, `documents-${iso()}.zip`);
  toast(`${files.length} document${files.length === 1 ? '' : 's'} downloaded${skipped.length ? `. Skipped: ${skipped.join(', ')}` : ''}.`);
  X.log && X.log('documents.batch', { count: files.length });
}
X.ctMultiGo = multiGo;

document.addEventListener('click', async e => {
  const a = e.target.closest('[data-act]'); if (!a) return; const act = a.dataset.act;
  if (act === 'ct-fill') { const t = (S.ctpl.list || []).find(x => x.id === a.dataset.id); if (!t) return; X.busy && X.busy('Filling your template'); let out = []; try { out = await buildCustom(t); } finally { X.idle && X.idle(); } if (!out.length) return; await deliver(out, `${fileSafe(t.name)}-${iso()}.zip`); const miss = [...new Set(out.flatMap(f => f.missing || []))]; toast(`${out.length} document${out.length === 1 ? '' : 's'} filled from “${t.name}”.${miss.length ? ` Left as written: ${miss.slice(0, 4).join(', ')}${miss.length > 4 ? '…' : ''}.` : ''}`); X.log && X.log('template.custom_filled', { count: out.length }); }
  if (act === 'ct-del') { S.ctpl.list = (S.ctpl.list || []).filter(x => x.id !== a.dataset.id); S.ctpl.multi.delete(`ct:${a.dataset.id}`); await store(); X.render(); }
  if (act === 'ct-multi-go') multiGo();
  if (act === 'ct-multi-all') { (X.DG_TPL || []).forEach(t => S.ctpl.multi.add(`tpl:${t[0]}`)); (S.ctpl.list || []).forEach(t => S.ctpl.multi.add(`ct:${t.id}`)); S.ctpl.multiOpen = true; X.render(); }
  if (act === 'ct-multi-none') { S.ctpl.multi.clear(); X.render(); }
});
})();
