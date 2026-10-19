/* Aldune — part 41: Litigation, rebuilt around one idea — every paper you upload changes the answer, immediately.
   • One drop zone: many files at once (click, Ctrl/⌘-select, or drag a whole batch), progress per file, remove any file,
     and pull in case papers already uploaded on the Import page
   • The moment files are read, a full Case analysis renders at the top (and the page scrolls to it):
     headline numbers · documents and what each contains · deadlines the papers trigger (Lab. Code § 2699.3 and the
     limitations statutes) · every allegation vs. the records with the law behind it · named-plaintiff standing from the
     records (§ 2699(c)(1)) · PAGA from actual pay periods (defense and plaintiff measures, caps, split) · leverage for the
     side you represent · record gaps · settlement and arbitration papers
   • Case analysis memo (Word), labeled privileged when the audit is run at the direction of counsel */
(() => {
'use strict';
const X = window.PCX; const { PC, S, esc, money, toast, busy, idle, VIEWS } = X;
const iso = () => new Date().toISOString().slice(0, 10);
const fmt = d => d ? new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '—';
const L = () => (S.lit ||= { side: 'defense', docs: [], facts: null, inputs: null, gross: 0, ctx: {} });
const MODEL_CLAIMS = ['meal', 'rest', 'unpaid_wages', 'overtime', 'wage_statement', 'waiting_time', 'expenses', 'paga'];
const ACCEPT = '.pdf,.docx,.doc,.txt,.rtf,.md,.eml,.htm,.html';

document.head.insertAdjacentHTML('beforeend', `<style id="al-lit">
.lit-drop{display:block!important;margin:6px 0 0;border:2px dashed var(--line2);border-radius:14px;padding:22px;text-align:center;background:var(--surface);transition:border-color .15s,background .15s;cursor:pointer}
.lit-drop:hover,.lit-drop.on{border-color:var(--clay);background:var(--clay-tint)}
.lit-drop b{display:block;font-size:16px;color:var(--head-ink);margin-bottom:4px}
.lit-doc{display:flex;gap:10px;align-items:center;padding:7px 0;border-bottom:1px solid var(--line)}
.lit-doc:last-child{border-bottom:0}.lit-doc .nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13.5px}
.lit-x{border:0;background:transparent;color:var(--ink3);cursor:pointer;font-size:16px;line-height:1;padding:2px 6px;border-radius:6px}.lit-x:hover{background:var(--sunk);color:var(--ink)}
#lit-analysis{border-top:4px solid var(--clay)!important;scroll-margin-top:76px}
#lit-analysis .lk{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:12px 0 4px}
#lit-analysis .lk>div{background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:12px 14px}
#lit-analysis .lk .v{font:700 22px/1.15 var(--head,inherit);color:var(--head-ink)}#lit-analysis .lk .k{font-size:12px;color:var(--ink2);margin-top:4px}
#lit-analysis h4{margin:18px 0 6px;font-size:14px;letter-spacing:.02em;color:var(--head-ink)}
#lit-analysis .q{font-style:italic;color:var(--ink2)}
#lit-analysis details.law summary{cursor:pointer;color:var(--clay-ink);font-size:12.5px}
.st-passed{background:var(--sunk)!important;color:var(--ink3)!important}.st-soon{background:#FBE3D6!important;color:#9A3412!important}.st-upcoming{background:var(--clay-tint)!important;color:var(--clay-ink)!important}.st-info{background:var(--sunk)!important;color:var(--ink2)!important}
.r-supported{background:#FBE3D6!important;color:#9A3412!important}.r-not_shown{background:#E4F1E6!important;color:#24613A!important}.r-potential_only,.r-potential{background:#FFF1D6!important;color:#8A5A00!important}.r-not_testable,.r-no_audit,.r-outside{background:var(--sunk)!important;color:var(--ink2)!important}.r-suffered{background:#FBE3D6!important;color:#9A3412!important}
@media (max-width:900px){#lit-analysis .lk{grid-template-columns:repeat(2,minmax(0,1fr))}}
</style>`);

// ---------------------------------------------------------------- reading files
async function readFiles(files) {
  const L0 = L(); let added = 0, failed = 0; const list = [...files].filter(f => f && f.name && !/^\./.test(f.name));
  for (let k = 0; k < list.length; k++) {
    const file = list[k]; busy(`Reading case papers (${k + 1} of ${list.length})`, file.name);
    try {
      const text = (await PC.extractDocument(file.name, await file.arrayBuffer())) || '';
      if (L0.docs.some(d => d.name === file.name && d.text.length === text.length)) continue;
      const kind = PC.classifyCaseDocument(text); const type = PC.classifyDocument(text);
      L0.docs.push({ name: file.name, text, type, kind, chars: text.length, added: iso() }); added++;
      if (!(S.docs || []).some(x => x.name === file.name)) (S.docs ||= []).push({ name: file.name, text, type });
    } catch (e) { failed++; toast(`${file.name}: ${e.message || 'could not be read'}`); }
  }
  idle(); refresh(); X.persist && X.persist(); X.render();
  if (added) { toast(`Analyzed ${added} document${added === 1 ? '' : 's'}${failed ? ` · ${failed} could not be read` : ''}`); setTimeout(() => document.getElementById('lit-analysis')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60); }
}
// recompute facts and the model inputs from every paper on file
function refresh() {
  const L0 = L(); if (!L0.docs.length) { L0.facts = null; L0.analysis = null; return; }
  const base = PC.extractCaseFacts(L0.docs.map(d => ({ name: d.name, text: d.text })));
  const A = PC.analyzeCase({ docs: L0.docs.map(d => ({ name: d.name, text: d.text })), facts: base, side: L0.side || 'defense', input: S.input || null, result: S.result || null, today: iso() });
  const keep = L0.facts && L0.factsEdited ? L0.facts : null; L0.facts = { ...A.facts, ...(keep ? Object.fromEntries(Object.entries(keep).filter(([k, v]) => ['caption', 'caseNumber', 'court', 'defendant', 'pagaNoticeDate', 'filedDate'].includes(k) && v)) : {}) };
  L0.analysis = A; L0.analyzedAt = new Date().toISOString();
  if (L0.inputs) { const c = A.facts.claims.filter(k => MODEL_CLAIMS.includes(k)); if (c.length) L0.inputs.claims = c; L0.inputs.classYears = A.facts.claims.includes('ucl') ? 4 : 3; }
}
X.litRefresh = refresh;

// ---------------------------------------------------------------- the analysis section
const RES = { supported: 'Supported by the records', potential_only: 'Potential only', not_shown: 'Not shown in the records', not_testable: 'Not testable from records', no_audit: 'No records loaded' };
const STAND = { suffered: 'Suffered', potential: 'Potential', outside: 'Outside PAGA year', not_shown: 'Not shown', not_testable: 'Not testable' };
function analysisHtml(A) {
  const D = A.side === 'defense'; const h = A.headline; const nd = h.nextDeadline;
  const kpi = (v, k) => `<div><div class="v">${v}</div><div class="k">${k}</div></div>`;
  const pagaV = A.paga ? `${money(A.paga.cap15)}–${money(A.paga.plaintiffMeasure)}` : '—';
  return `<section class="panel" id="lit-analysis" style="margin-bottom:14px">
    <div class="row" style="justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap"><div><div class="small" style="letter-spacing:.12em;text-transform:uppercase;color:var(--clay-ink);font-weight:600">Case analysis</div>
      <h3 style="margin:2px 0 0">${esc(A.facts.caption || (A.facts.plaintiffs[0] ? `${A.facts.plaintiffs[0]} v. ${A.facts.defendant || 'Employer'}` : 'Your case papers'))}</h3>
      <div class="small muted">${A.docs.length} document${A.docs.length === 1 ? '' : 's'}${A.facts.caseNumber ? ` · Case No. ${esc(A.facts.caseNumber)}` : ''}${A.facts.court ? ` · ${esc(A.facts.court)}` : ''} · ${D ? 'defense view' : 'plaintiff view'}${S.result ? ' · measured against your audit' : ' · no audit loaded'}</div></div>
      <div class="row"><button class="btn primary" data-act="lit-memo">Case analysis memo (Word)</button></div></div>
    <div class="lk">${kpi(S.result ? money(h.supported) : '—', S.result ? `Shown by the records for the claims at issue · ${h.supportedWorkers} worker${h.supportedWorkers === 1 ? '' : 's'}` : 'Load records to measure the claims')}
      ${kpi(pagaV, A.paga ? 'PAGA from actual pay periods (15% cap → plaintiff measure)' : 'PAGA needs a notice date and records')}
      ${kpi(nd ? fmt(nd.date) : '—', nd ? esc(nd.label) : 'No upcoming deadline from these papers')}
      ${kpi(A.standing.length ? (h.standingGaps ? `${h.standingGaps} gap${h.standingGaps === 1 ? '' : 's'}` : 'No gaps') : '—', A.standing.length ? 'Named-plaintiff standing (§ 2699(c)(1))' : 'No named plaintiff found')}</div>

    <h4>Documents</h4><div class="tablewrap"><table><thead><tr><th>Document</th><th>Type</th><th>Dated</th><th>What it contains</th></tr></thead><tbody>${A.docs.map(d => `<tr><td class="small">${esc(d.name)}</td><td><span class="chip">${esc(d.label)}</span></td><td class="small" style="white-space:nowrap">${fmt(d.date)}</td><td class="small">${d.found.map(esc).join(' · ') || '—'}</td></tr>`).join('')}</tbody></table></div>
    ${A.facts.causes?.length ? `<p class="small" style="margin:8px 0 0"><b>Causes of action:</b> ${A.facts.causes.map(c => `${c.n}. ${esc(c.title)}`).join(' · ')}</p>` : ''}

    ${A.deadlines.length ? `<h4>Deadlines and periods these papers set</h4><div class="tablewrap"><table><tbody>${A.deadlines.map(d => `<tr><td style="white-space:nowrap"><b>${fmt(d.date)}</b><div><span class="chip st-${d.status}">${{ passed: 'passed', soon: 'within 14 days', upcoming: 'upcoming', info: 'period' }[d.status]}</span></div></td><td><b>${esc(d.label)}</b><div class="small">${esc(d.detail)}</div></td><td class="cite">${esc(d.authority)}</td></tr>`).join('')}</tbody></table></div>` : ''}

    <h4>Allegations vs. the records</h4><div class="tablewrap"><table><thead><tr><th>Claim</th><th>What the papers say</th><th>Records</th><th>${D ? 'For the defense' : 'For employees'}</th></tr></thead><tbody>
    ${A.allegations.map(a => `<tr><td style="min-width:150px"><b>${esc(a.label)}</b><div class="small muted">${a.alleged ? 'Alleged' : 'Not alleged'}</div><details class="law"><summary>The law</summary><div class="small" style="margin-top:4px"><b>${esc(a.statutes)}.</b> ${esc(a.elements)}</div><div class="small"><b>Limitations:</b> ${esc(a.limitations)}</div><div class="small"><b>Remedy:</b> ${esc(a.remedy)}</div>${a.authorities.length ? `<ul class="cite" style="margin:4px 0 0;padding-left:16px">${a.authorities.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}</details></td>
      <td class="small">${a.quote ? `<span class="q">“${esc(a.quote)}”</span><div class="cite">${esc(a.source)}</div>` : '<span class="muted">—</span>'}</td>
      <td class="small" style="min-width:190px"><span class="chip r-${a.records.status}">${RES[a.records.status]}</span><div style="margin-top:4px">${esc(a.read)}</div>${a.records.examples.length ? `<details><summary class="small" style="cursor:pointer">Examples</summary><ul style="margin:4px 0 0;padding-left:16px">${a.records.examples.map(x => `<li>${esc(x)}</li>`).join('')}</ul></details>` : ''}</td>
      <td class="small">${esc(a.next)}</td></tr>`).join('')}</tbody></table></div>

    ${A.standing.length ? `<h4>Named-plaintiff standing</h4><p class="small muted" style="margin:0 0 6px">For notices on or after June 19, 2024, the plaintiff must have personally suffered each violation alleged within the PAGA year (Lab. Code § 2699(c)(1)).</p><div class="tablewrap"><table><tbody>${A.standing.map(s => `<tr><td style="min-width:160px"><b>${esc(s.plaintiff)}</b><div class="small muted">${s.matched ? `Matched: ${esc(s.matched)}` : 'Not matched'} · ${esc(s.employed)}</div></td><td>${s.perClaim.map(c => `<div class="small" style="margin:2px 0"><span class="chip r-${c.result}">${STAND[c.result]}</span> <b>${esc(PC.CLAIM_LAW[c.claim].label)}</b> — ${esc(c.detail)}</div>`).join('')}</td></tr>`).join('')}</tbody></table></div>` : ''}

    ${A.paga ? `<h4>PAGA penalties from actual pay periods</h4><div class="tablewrap"><table><tbody>
      <tr><td>Aggrieved employees in the PAGA year</td><td class="n">${A.paga.aggrieved.toLocaleString()}</td></tr>
      <tr><td>Pay periods with a violation × $100 <span class="muted small">(defense measure)</span></td><td class="n">${A.paga.periodsWithViolation.toLocaleString()} → <b>${money(A.paga.defenseMeasure)}</b></td></tr>
      <tr><td>All pay periods those employees worked × $100 <span class="muted small">(plaintiff measure)</span></td><td class="n">${A.paga.periodsWorked.toLocaleString()} → <b>${money(A.paga.plaintiffMeasure)}</b></td></tr>
      <tr><td>Capped at 15% (reasonable steps before notice) · 30% (within 60 days after)</td><td class="n">${money(A.paga.cap15)} · ${money(A.paga.cap30)}</td></tr>
      <tr><td>Split of the plaintiff measure: LWDA 65% / employees 35%</td><td class="n">${money(A.paga.lwda)} / ${money(A.paga.employees)}</td></tr></tbody></table></div>
      <details style="margin-top:6px"><summary class="small" style="cursor:pointer"><b>How this is calculated</b></summary><ul class="small">${A.paga.method.map(m => `<li>${esc(m)}</li>`).join('')}</ul></details>` : ''}

    ${A.projection ? `<h4>Projection beyond the records <span class="chip">illustrative</span></h4><div class="tablewrap"><table><tbody><tr><td>Measured in the records (${A.projection.measuredWeeks.toLocaleString()} employee-workweeks)</td><td class="n">${money(A.projection.measured)}</td></tr><tr><td>Projected for the whole class period (+${A.projection.extraWeeks.toLocaleString()} workweeks)</td><td class="n"><b>${money(A.projection.projected)}</b></td></tr><tr><td>95% range</td><td class="n">${money(A.projection.low)} – ${money(A.projection.high)}</td></tr></tbody></table></div><details style="margin-top:6px"><summary class="small" style="cursor:pointer"><b>Basis and limits</b></summary><ul class="small">${A.projection.basis.map(m => `<li>${esc(m)}</li>`).join('')}</ul></details>` : ''}
    ${A.leverage.length ? `<h4>${D ? 'Defense leverage' : 'Plaintiff leverage'}</h4><ul class="small" style="margin:0;padding-left:18px">${A.leverage.map(l => `<li style="margin:3px 0">${esc(l.text)} <span class="cite">${esc(l.cite)}</span></li>`).join('')}</ul>` : ''}
    ${A.coverage.length ? `<h4>Record coverage</h4><ul class="small" style="margin:0;padding-left:18px">${A.coverage.map(c => `<li style="margin:3px 0">${esc(c)}</li>`).join('')}</ul>` : ''}
    ${A.records.length ? `<h4>Records to gather</h4><ul class="small" style="margin:0;padding-left:18px">${A.records.map(c => `<li style="margin:3px 0">${esc(c)}</li>`).join('')}</ul>` : ''}
    ${A.settlementIssues.length ? `<h4>Settlement agreements</h4><div class="tablewrap"><table><tbody>${A.settlementIssues.map(x => `<tr><td><span class="chip ${x.severity === 'high' ? 'flag' : x.severity === 'medium' ? 'warn' : 'ok'}">${x.severity === 'low' ? 'OK' : esc(x.severity)}</span></td><td class="small"><b>${esc(x.issue)}</b> <span class="muted">(${esc(x.doc)})</span><div>${esc(x.why)}</div><div class="cite">${esc(x.cite)}</div></td></tr>`).join('')}</tbody></table></div>` : ''}
    ${A.arbitration.length ? `<h4>Arbitration agreements</h4><div class="tablewrap"><table><tbody>${A.arbitration.map(x => `<tr><td><span class="chip ${x.severity === 'high' ? 'flag' : x.severity === 'medium' ? 'warn' : ''}">${esc(x.severity)}</span></td><td class="small"><b>${esc(x.label)}</b> <span class="muted">(${esc(x.doc)})</span><div>${esc(x.detail)}</div><div class="cite">${esc(x.cite)}</div></td></tr>`).join('')}</tbody></table></div>` : ''}
    <p class="cite" style="margin:12px 0 0">${A.notes.map(esc).join(' ')}</p></section>`;
}

// ---------------------------------------------------------------- page
const base = VIEWS.litigation;
VIEWS.litigation = el => {
  const L0 = L();
  if (L0.docs.length && (!L0.analysis || L0.analysisSide !== L0.side || L0.analysisRun !== (S.result?.engine?.meta?.inputHash || null))) { try { refresh(); } catch (e) { console.warn(e); } L0.analysisSide = L0.side; L0.analysisRun = S.result?.engine?.meta?.inputHash || null; }
  base(el);
  // the older summary panels are folded into the analysis
  el.querySelectorAll('.panel').forEach(p => { const h = p.querySelector('h3'); if (h && /^(What your case documents do here|Allegations vs\. your records|Issues in settlement documents)$/.test(h.textContent.trim())) p.remove(); });
  // 1. Case documents → one drop zone
  const p1 = [...el.querySelectorAll('.panel')].find(p => /^1\. Case documents/.test(p.querySelector('h3')?.textContent || ''));
  const avail = (S.docs || []).filter(d => d.text && !L0.docs.some(x => x.name === d.name) && PC.classifyCaseDocument(d.text) !== 'other');
  if (p1) p1.innerHTML = `<h3 style="margin-top:0">1. Case papers</h3>
    <label class="lit-drop" id="lit-drop"><b>Drop case papers here, or click to choose</b><span class="small muted">Select as many as you like at once — complaint, PAGA notice, LWDA letters, answer, mediation briefs, settlement and arbitration agreements. PDF, Word, or text.</span><input type="file" id="lit-files" multiple accept="${ACCEPT}" style="display:none"></label>
    ${avail.length ? `<button class="btn" style="margin-top:8px" data-act="lit-from-import">Add ${avail.length} case paper${avail.length === 1 ? '' : 's'} already uploaded on Import</button>` : ''}
    ${L0.docs.length ? `<div style="margin-top:10px">${L0.docs.map((d, k) => `<div class="lit-doc"><span class="nm" title="${esc(d.name)}">${esc(d.name)}</span><span class="chip">${esc(PC.CASE_DOC_LABEL[d.kind || PC.classifyCaseDocument(d.text)])}</span>${(d.chars ?? d.text.length) < 200 ? '<span class="chip warn" title="Very little text was found — a scan may need a clearer copy">little text</span>' : ''}<button class="lit-x" data-act="lit-rm" data-k="${k}" aria-label="Remove ${esc(d.name)}">×</button></div>`).join('')}</div><div class="row" style="margin-top:8px"><button class="btn" data-act="lit-clear">Remove all</button></div>` : ''}
    <p class="cite" style="margin:8px 0 0">Read in your browser; nothing is sent anywhere.</p>`;
  // analysis or the explainer at the top
  const head = el.querySelector('.seg')?.closest('.row');
  const top = L0.analysis ? analysisHtml(L0.analysis) : `<div class="panel" style="margin-bottom:14px"><h3 style="margin-top:0">What uploading case papers does</h3><div class="grid g2" style="gap:10px">${[
    ['Reads them', 'Parties, case number, court, filing and notice dates, causes of action, the class definition, and the sentence alleging each claim.'],
    ['Sets your deadlines', 'Cure (33 days), the 30% reasonable-steps window (60 days), earliest suit (65 days), early evaluation conference, PAGA and class periods — each with its statute.'],
    ['Tests every allegation', S.result ? 'Against your audit: supported, potential, or not shown — with the dollars, the workers, and the law for each claim.' : 'Against your records once an audit is loaded; until then, the law and the records you need.'],
    ['Checks standing and PAGA', 'Whether the named plaintiff personally suffered each alleged violation in the PAGA year, and PAGA penalties from actual pay periods.']].map(([t, d]) => `<div><b>${t}</b><div class="small">${d}</div></div>`).join('')}</div></div>`;
  if (head) head.insertAdjacentHTML('afterend', top); else el.querySelector('h1')?.insertAdjacentHTML('afterend', top);
  // wire the drop zone
  const z = el.querySelector('#lit-drop'); const inp = el.querySelector('#lit-files');
  if (inp) inp.addEventListener('change', e => { const fl = [...e.target.files]; e.target.value = ''; if (fl.length) readFiles(fl); });
  if (z) { ['dragenter', 'dragover'].forEach(ev => z.addEventListener(ev, e => { e.preventDefault(); z.classList.add('on'); })); ['dragleave', 'drop'].forEach(ev => z.addEventListener(ev, e => { e.preventDefault(); z.classList.remove('on'); })); z.addEventListener('drop', e => { const fl = [...(e.dataTransfer?.files || [])]; if (fl.length) readFiles(fl); }); }
  // edits to the case facts mark them as the user's
  el.querySelectorAll('[data-lf]').forEach(n => n.addEventListener('change', () => { L0.factsEdited = true; }));
};

document.addEventListener('click', async e => {
  const a = e.target.closest('[data-act]'); if (!a) return; const d = a.dataset; const L0 = L();
  try {
    if (d.act === 'lit-rm') { L0.docs.splice(+d.k, 1); refresh(); X.persist && X.persist(); X.render(); }
    if (d.act === 'lit-clear') { L0.docs = []; L0.facts = null; L0.analysis = null; L0.factsEdited = false; X.persist && X.persist(); X.render(); }
    if (d.act === 'lit-from-import') { const add = (S.docs || []).filter(x => x.text && !L0.docs.some(y => y.name === x.name) && PC.classifyCaseDocument(x.text) !== 'other'); for (const x of add) L0.docs.push({ name: x.name, text: x.text, type: x.type, kind: PC.classifyCaseDocument(x.text), chars: x.text.length, added: iso() }); refresh(); X.persist && X.persist(); X.render(); toast(`Analyzed ${add.length} document${add.length === 1 ? '' : 's'}`); setTimeout(() => document.getElementById('lit-analysis')?.scrollIntoView({ behavior: 'smooth' }), 60); }
    if (d.act === 'lit-side') { L0.analysis = null; }
    if (d.act === 'lit-memo') { if (!L0.analysis) refresh(); const emp = L0.facts?.defendant || S.input?.employerName || S.profile?.company || ''; await X.saveDocx([PC.caseAnalysisMemo(L0.analysis, { employer: emp, date: iso(), privileged: S.priv?.mode === 'privileged' })], `case-analysis-${L0.side}-${iso()}.docx`); X.log && X.log('report.generated', { report: 'Litigation: case analysis memo' }); }
  } catch (err) { toast(err.message || 'Something went wrong.'); }
}, true);
X.litAnalysisHtml = analysisHtml;
})();
