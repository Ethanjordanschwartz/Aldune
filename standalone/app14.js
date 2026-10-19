/* Aldune standalone — part 14: Litigation workspace (case documents → facts → damages model → negotiation → drafts) and POS & timekeeping */
(() => {
'use strict';
const X = window.PCX; const { PC, S, $, esc, money, toast, busy, idle, VIEWS } = X;
const iso = () => new Date().toISOString().slice(0, 10); const today = () => new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
S.lit = S.lit || { side: 'defense', docs: [], facts: null, inputs: null, gross: 0, ctx: {} };
const L = () => S.lit;
const CLAIM_LABEL = { meal: 'Meal periods', rest: 'Rest periods', unpaid_wages: 'Off-the-clock / unpaid time', overtime: 'Overtime', wage_statement: 'Wage statements', waiting_time: 'Waiting time', expenses: 'Expenses', paga: 'PAGA' };

// ---------- inputs from the audit when one exists
function fromAudit(base) {
  const i = JSON.parse(JSON.stringify(base)); if (!S.result || !S.input) return i;
  const e = S.input.employees; const sh = S.result.engine.shifts; const f = S.result.engine.findings;
  const rates = e.map(x => x.hourlyRate).filter(Boolean); if (rates.length) i.avgRate = Math.round(rates.reduce((a, b) => a + b, 0) / rates.length * 100) / 100;
  i.classSize = e.length; i.pagaEmployees = e.length; i.formerShare = e.length ? Math.round(e.filter(x => x.terminationDate).length / e.length * 100) / 100 : i.formerShare;
  const weeks = new Set(sh.map(s => `${s.employeeId}|${s.weekStart}`)).size; if (weeks) { i.shiftsPerWeek = Math.round(sh.length / weeks * 10) / 10; i.hoursPerShift = Math.round(sh.reduce((t, s) => t + s.workedMin, 0) / sh.length / 60 * 10) / 10; }
  if (sh.length) { i.rates.meal = Math.round(f.filter(x => x.category === 'meal' && x.confidence !== 'low').length / sh.length * 1000) / 1000; i.rates.rest = Math.round(f.filter(x => x.category === 'rest' && x.confidence !== 'low').length / sh.length * 1000) / 1000; }
  i.rates.wageStatement = f.some(x => x.category === 'wage_statement') ? 1 : 0.5; i.rates.waitingTime = f.some(x => x.category === 'final_pay') ? 1 : 0.5;
  i.auditFilled = true; return i;
}
function ensureInputs() { if (!L().inputs) L().inputs = fromAudit(PC.LIT_DEFAULTS); return L().inputs; }
function applyFacts(f) {
  const i = ensureInputs(); L().facts = f;
  if (f.claims.length) i.claims = Object.keys(CLAIM_LABEL).filter(k => f.claims.includes(k) || (k === 'unpaid_wages' && f.claims.includes('overtime')));
  i.classYears = f.claims.includes('ucl') ? 4 : 3;
  if (!i.auditFilled && f.settledEligible) { i.classSize = f.settledEligible; i.pagaEmployees = f.settledEligible; }
  if (f.settledCount && f.settledEligible) i.settledShare = Math.round(f.settledCount / f.settledEligible * 1000) / 1000;
  if (f.settledPaid) i.settledPaid = f.settledPaid;
}
const model = () => { const v = PC.valueClaims(ensureInputs()); const n = PC.negotiation(v, L().side, L().facts?.settledPaid || 0); return { v, n }; };

// ---------- view
VIEWS.litigation = el => {
  const { v, n } = model(); const i = ensureInputs(); const f = L().facts || { claims: [], plaintiffs: [], sources: [] }; const D = L().side === 'defense';
  const gross = L().gross || Math.round((n.expectedLow + n.expectedHigh) / 2 / 1000) * 1000; const a = PC.allocation(gross, v);
  const num = (k, label, step = 1, sub) => `<label class="field">${label}<input type="number" step="${step}" data-li="${k}" value="${sub ? i.rates[sub] : i[k]}" ${sub ? `data-sub="${sub}"` : ''}></label>`;
  const issues = L().docs.filter(d => /settlement agreement|release of claims/i.test(d.text)).map(d => ({ d, r: PC.reviewIndividualSettlement(d.text) }));
  el.innerHTML = X.head('Litigation', 'Upload case papers, value the case, and draft mediation documents.') + `
    <div class="row" style="margin-bottom:12px"><div class="seg">${['defense', 'plaintiff'].map(s => `<button data-act="lit-side" data-s="${s}" aria-pressed="${L().side === s}">${s === 'defense' ? 'We represent the employer' : 'We represent employees'}</button>`).join('')}</div>${S.result ? '<span class="chip ok">Using your audit data</span>' : '<span class="chip">No audit loaded — using case documents and assumptions</span>'}</div>
    <div class="grid g2">
      <div class="panel"><h3 style="margin-top:0">1. Case documents</h3><p class="small muted">Complaint, PAGA notices, mediation briefs, settlement agreements, arbitration agreements. PDF, Word, or text.</p>
        <label class="btn primary" style="cursor:pointer">Add case documents<input type="file" id="lit-files" multiple accept=".pdf,.docx,.doc,.txt,.rtf" style="display:none"></label>
        ${L().docs.length ? `<table style="margin-top:10px"><tbody>${L().docs.map(d => `<tr><td class="small">${esc(d.name)}</td><td><span class="chip">${esc(PC.DOC_LABELS[d.type] || 'Document')}</span></td></tr>`).join('')}</tbody></table>` : ''}</div>
      <div class="panel"><h3 style="margin-top:0">2. Case facts</h3>${L().facts ? '<p class="small muted">Read from your documents — edit anything.</p>' : '<p class="small muted">Add documents to fill these in automatically.</p>'}
        <div class="grid g2">${[['caption', 'Caption'], ['caseNumber', 'Case number'], ['court', 'Court'], ['defendant', 'Employer'], ['pagaNoticeDate', 'PAGA notice date'], ['filedDate', 'Filed']].map(([k, l]) => `<label class="field">${l}<input data-lf="${k}" value="${esc(f[k] || '')}"></label>`).join('')}</div>
        <label class="field">Plaintiffs<input data-lf="plaintiffs" value="${esc((f.plaintiffs || []).join(', '))}"></label>
        <p class="small" style="margin:8px 0 4px">Claims alleged</p><div class="row">${Object.entries(CLAIM_LABEL).map(([k, l]) => `<label class="check"><input type="checkbox" data-lc="${k}" ${i.claims.includes(k) ? 'checked' : ''}> ${l}</label>`).join('')}</div>
        ${f.settledCount ? `<p class="small" style="margin-top:8px"><b>Individual settlements:</b> ${f.settledCount} of ${f.settledEligible} signed${f.settledPaid ? `, ${money(f.settledPaid)} paid` : ''}.</p>` : ''}</div></div>
    <div class="panel" style="margin-top:14px"><div class="row" style="justify-content:space-between"><h3 style="margin:0">3. Damages model</h3><span class="small muted">${i.auditFilled ? 'Filled from your audit; adjust as needed.' : 'Assumptions — adjust to your records.'}</span></div>
      <div class="grid g3" style="grid-template-columns:repeat(6,minmax(0,1fr));margin-top:8px">${num('classSize', 'Class size')}${num('avgRate', 'Avg. hourly rate', 0.01)}${num('shiftsPerWeek', 'Shifts / week', 0.1)}${num('hoursPerShift', 'Hours / shift', 0.1)}${num('workweeksPerYear', 'Weeks / year')}${num('classYears', 'Class years')}
        ${num('meal', 'Meal violation rate', 0.01, 'meal')}${num('rest', 'Rest violation rate', 0.01, 'rest')}${num('offClockMinutes', 'Unpaid min / shift', 0.5, 'offClockMinutes')}${num('overtimeHoursPerWeek', 'Unpaid OT h / week', 0.1, 'overtimeHoursPerWeek')}${num('pagaEmployees', 'PAGA employees')}${num('payPeriodsPerYear', 'Pay periods / year')}
        <label class="field">Arbitration share<input type="number" step="0.05" data-li="arbitrationShare" value="${i.arbitrationShare}"></label><label class="field">Settled share<input type="number" step="0.01" data-li="settledShare" value="${i.settledShare}"></label><label class="field">P(certification)<input type="number" step="0.05" data-li="pCert" value="${i.pCert}"></label>
        <label class="field">PAGA cap<select data-li="pagaCap"><option value="1" ${i.pagaCap === 1 ? 'selected' : ''}>None</option><option value="0.3" ${i.pagaCap === 0.3 ? 'selected' : ''}>30%</option><option value="0.15" ${i.pagaCap === 0.15 ? 'selected' : ''}>15%</option></select></label></div>
      <div class="tablewrap" style="margin-top:12px"><table><thead><tr><th>Claim</th><th>Formula</th><th class="n">Theoretical max</th><th class="n">Realistic</th><th class="n">Risk-adjusted</th><th>P(liability)</th></tr></thead><tbody>${v.claims.map(c => `<tr><td><b>${esc(c.label)}</b><div class="cite">${esc(c.basis)}</div></td><td class="cite">${esc(c.formula)}</td><td class="n">${money(c.max)}</td><td class="n">${money(c.realistic)}</td><td class="n">${money(c.riskAdjusted)}</td><td><input type="number" step="0.05" min="0" max="1" style="width:70px" data-lp="${c.claim}" value="${i.pLiability[c.claim] ?? 0.3}"></td></tr>`).join('')}<tr><td>Interest (10%)</td><td class="cite">Lab. Code § 218.6</td><td></td><td class="n">${money(v.totals.interest)}</td><td></td><td></td></tr><tr><td><b>Total</b></td><td></td><td class="n"><b>${money(v.totals.max)}</b></td><td class="n"><b>${money(v.totals.realistic)}</b></td><td class="n"><b>${money(v.totals.riskAdjusted)}</b></td><td></td></tr></tbody></table></div></div>
    <div class="grid g2" style="margin-top:14px">
      <div class="panel"><h3 style="margin-top:0">4. Negotiation range</h3><div class="kpis" style="grid-template-columns:repeat(2,1fr)"><div class="kpi"><div class="v">${money(n.plaintiffOpening)}</div><div class="k">Plaintiff opening (realistic exposure)</div></div><div class="kpi"><div class="v">${money(n.defenseOpening)}</div><div class="k">Defense opening</div></div><div class="kpi risk"><div class="v">${money(n.expectedLow)}–${money(n.expectedHigh)}</div><div class="k">Expected settlement range</div></div><div class="kpi"><div class="v">${money(n.target)}</div><div class="k">Your target · walk-away ${money(n.walkaway)}</div></div></div>
        <details style="margin-top:8px"><summary class="small"><b>How this is calculated</b></summary><ul class="small">${n.method.map(m => `<li>${esc(m)}</li>`).join('')}</ul></details></div>
      <div class="panel"><h3 style="margin-top:0">5. Settlement allocation</h3><label class="field">Proposed gross settlement<input type="number" step="1000" id="lit-gross" value="${gross}"></label>
        <table style="margin-top:8px"><tbody>${[['Attorney’s fees (⅓)', a.fees], ['Costs', a.costs], ['Administration', a.admin], ['Service awards', a.serviceAwards], [`PAGA (LWDA ${money(a.pagaLwda)} / employees ${money(a.pagaEmployees)})`, a.paga], ['Net to class', a.net]].map(([k, val]) => `<tr><td class="small">${k}</td><td class="n">${money(val)}</td></tr>`).join('')}<tr><td class="small">Per workweek · wages share</td><td class="n">${money(a.perWorkweek, true)} · ${Math.round(a.wageShare * 100)}%</td></tr></tbody></table></div></div>
    <div class="panel" style="margin-top:14px"><h3 style="margin-top:0">6. Draft documents</h3><div class="row">
      <button class="btn primary" data-act="lit-doc" data-k="brief">Mediation brief (${D ? 'defense' : 'plaintiff'})</button>
      ${D ? '<button class="btn" data-act="lit-doc" data-k="response">PAGA notice response</button>' : '<button class="btn" data-act="lit-doc" data-k="demand">Demand letter</button><button class="btn" data-act="lit-doc" data-k="notice">PAGA notice</button>'}
      <button class="btn" data-act="lit-doc" data-k="term">Settlement term sheet</button><button class="btn" data-act="lit-xlsx">Damages workbook (Excel)</button>${D ? '<button class="btn" data-act="go" data-to="documents">Individual settlement packets</button>' : ''}</div>
      <div class="grid g2" style="margin-top:8px"><label class="field">Firm<input data-lx="firm" value="${esc(L().ctx.firm || '')}"></label><label class="field">Attorney<input data-lx="attorney" value="${esc(L().ctx.attorney || '')}"></label></div></div>
    ${issues.length ? `<div class="panel" style="margin-top:14px"><h3 style="margin-top:0">Issues in settlement documents</h3>${issues.map(({ d, r }) => `<p class="small"><b>${esc(d.name)}</b></p><table><tbody>${r.map(x => `<tr><td><span class="chip ${x.severity === 'high' ? 'flag' : x.severity === 'medium' ? 'warn' : 'ok'}">${x.severity === 'low' ? 'OK' : x.severity}</span></td><td><b>${esc(x.issue)}</b><div class="small">${esc(x.why)}</div><div class="cite">${esc(x.cite)}</div></td></tr>`).join('')}</tbody></table>`).join('')}</div>` : ''}
    <p class="cite" style="margin-top:10px">Valuation and drafts are decision support for counsel, not legal advice. Expected ranges reflect common California practice and published approvals; outcomes vary by court, facts, and counsel.</p>`;
  $('#lit-files').addEventListener('change', async e => { const fl = [...e.target.files]; e.target.value = ''; for (const file of fl) { busy('Reading', file.name); try { const text = await PC.extractDocument(file.name, await file.arrayBuffer()); const type = PC.classifyDocument(text); L().docs.push({ name: file.name, text, type }); if (!S.docs.some(x => x.name === file.name)) S.docs.push({ name: file.name, text, type }); } catch (x) { toast(x.message); } finally { idle(); } } applyFacts(PC.extractCaseFacts(L().docs.map(d => ({ name: d.name, text: d.text })))); toast('Case facts updated from your documents'); X.render(); });
  el.querySelectorAll('[data-li]').forEach(n2 => n2.addEventListener('change', e => { const k = e.target.dataset.li, sub = e.target.dataset.sub, val = Number(e.target.value); if (sub) i.rates[sub] = val; else i[k] = val; X.render(); }));
  el.querySelectorAll('[data-lp]').forEach(n2 => n2.addEventListener('change', e => { i.pLiability[e.target.dataset.lp] = Math.max(0, Math.min(1, Number(e.target.value))); X.render(); }));
  el.querySelectorAll('[data-lc]').forEach(n2 => n2.addEventListener('change', e => { const k = e.target.dataset.lc; i.claims = e.target.checked ? [...new Set([...i.claims, k])] : i.claims.filter(x => x !== k); X.render(); }));
  el.querySelectorAll('[data-lf]').forEach(n2 => n2.addEventListener('change', e => { L().facts = L().facts || { claims: [], plaintiffs: [], sources: [], arbitration: false }; const k = e.target.dataset.lf; L().facts[k] = k === 'plaintiffs' ? e.target.value.split(/\s*,\s*/).filter(Boolean) : e.target.value; }));
  el.querySelectorAll('[data-lx]').forEach(n2 => n2.addEventListener('change', e => { L().ctx[e.target.dataset.lx] = e.target.value; }));
  $('#lit-gross').addEventListener('change', e => { L().gross = Number(e.target.value) || 0; X.render(); });
};

// ---------- POS & timekeeping
S.posSys = S.posSys || 'custom';
VIEWS.pos = el => {
  const sys = PC.POS_SYSTEMS.find(p => p.id === S.posSys) || PC.POS_SYSTEMS[0]; const recs = S.input ? PC.posRecommendations(S.input, S.result) : [];
  el.innerHTML = X.head('POS & timekeeping', 'Set up your time system for California break, overtime, and record rules.') + `
    <div class="panel"><label class="field" style="max-width:420px">Your time system<select id="pos-sys">${PC.POS_SYSTEMS.map(p => `<option value="${p.id}" ${p.id === sys.id ? 'selected' : ''}>${esc(p.name)} — ${p.kind}</option>`).join('')}</select></label>
      <div class="row" style="margin-top:10px"><button class="btn primary" data-act="pos-memo">Configuration request (Word)</button><button class="btn" data-act="go" data-to="attest">Set up shift attestations</button></div></div>
    ${S.input ? `<h2>What your records show</h2>${recs.length ? `<table><tbody>${recs.map(r => `<tr><td><span class="chip ${r.priority === 'high' ? 'flag' : 'warn'}">${r.priority}</span></td><td><b>${esc(r.title)}</b><div class="small">${esc(r.evidence)}</div><div class="small"><b>Do this:</b> ${esc(r.action)}</div></td><td class="cite">${esc(r.cite)}</td></tr>`).join('')}</tbody></table>` : '<p class="small">No timekeeping problems detected in your records.</p>'}` : '<p class="small muted">Add time records on the Import page to get recommendations from your own data.</p>'}
    ${sys.verified.length ? `<h2>${esc(sys.name)} — documented capabilities</h2><ul class="small">${sys.verified.map(v => `<li>${esc(v)}</li>`).join('')}</ul><p class="cite">Source: ${esc(sys.source)}</p>` : ''}
    <h2>Ask ${esc(sys.name)}</h2><ul class="small">${sys.check.map(c => `<li>${esc(c)}</li>`).join('')}</ul>
    <h2>California settings checklist</h2><div class="tablewrap"><table><tbody>${PC.CA_POS_REQUIREMENTS.map(q => `<tr><td><b>${esc(q.setting)}</b><div class="small">${esc(q.why)}</div></td><td class="cite">${esc(q.cite)}</td></tr>`).join('')}</tbody></table></div>`;
  $('#pos-sys').addEventListener('change', e => { S.posSys = e.target.value; X.render(); });
};

// ---------- events
document.addEventListener('click', async e => {
  const a = e.target.closest('[data-act]'); if (!a) return; const d = a.dataset;
  try {
    if (d.act === 'lit-side') { L().side = d.s; X.render(); }
    if (d.act === 'lit-doc') {
      const { v, n } = model(); const f = L().facts || { claims: ensureInputs().claims, plaintiffs: [], sources: [], arbitration: false }; const emp = f.defendant || S.input?.employerName || S.profile?.company || 'Defendant'; const ctx = { ...L().ctx, date: today(), employer: emp };
      let m;
      if (d.k === 'brief') { const cov = S.input ? PC.coverage(S.input, S.result, S.assumptions?.industry).items.filter(x => x.status !== 'tested').slice(0, 3).map(x => `${x.area}: ${x.why}`) : []; const audit = S.result ? [`Aldune audit of ${S.result.engine.employees.length} workers and ${S.result.engine.shifts.length.toLocaleString()} shifts (${S.result.engine.meta.windowStart} – ${S.result.engine.meta.windowEnd}).`] : []; const si = L().docs.filter(x => /settlement agreement|release of claims/i.test(x.text)).flatMap(x => PC.reviewIndividualSettlement(x.text)).filter(x => x.severity !== 'low'); m = PC.lit.mediationBrief(L().side, f, v, n, { ...ctx, auditSummary: audit, coverage: cov, settlementIssues: si, documents: L().docs.map(x => `${x.name} (${PC.DOC_LABELS[x.type] || 'document'})`) }); }
      if (d.k === 'demand') m = PC.lit.demandLetter(f, v, n, { ...ctx, claimant: (f.plaintiffs || [])[0] || 'the aggrieved employee' });
      if (d.k === 'notice') m = PC.lit.pagaNotice(f, {}, { ...ctx, claimant: (f.plaintiffs || [])[0] || 'the aggrieved employee' });
      if (d.k === 'response') { const notice = L().docs.find(x => x.type === 'paga_notice'); const items = notice ? PC.analyzeNotice(notice.text, S.result).allegations : (f.claims || []).map(c => ({ section: c, title: CLAIM_LABEL[c] || c, curable: ['meal', 'rest', 'wage_statement', 'expenses', 'overtime'].includes(c), assessment: '' })); m = PC.lit.pagaResponse(f, items, { ...ctx, small: ensureInputs().classSize < 100 }); }
      if (d.k === 'term') m = PC.lit.termSheet(f, PC.allocation(L().gross || Math.round((n.expectedLow + n.expectedHigh) / 2 / 1000) * 1000, v), { ...ctx, workweeks: v.workweeks });
      await X.saveDocx([m], `${{ brief: `mediation-brief-${L().side}`, demand: 'demand-letter', notice: 'paga-notice', response: 'paga-notice-response', term: 'settlement-term-sheet' }[d.k]}-${iso()}.docx`); X.log && X.log('report.generated', { report: `Litigation: ${d.k}` });
    }
    if (d.act === 'lit-xlsx') { const { v, n } = model(); const XL = PC.XLSX; const wb = XL.utils.book_new(); XL.utils.book_append_sheet(wb, XL.utils.json_to_sheet(v.claims.map(c => ({ claim: c.label, authority: c.basis, formula: c.formula, theoretical_max: c.max, realistic: c.realistic, risk_adjusted: c.riskAdjusted, probability_of_liability: ensureInputs().pLiability[c.claim] }))), 'Claims'); XL.utils.book_append_sheet(wb, XL.utils.json_to_sheet(Object.entries({ ...ensureInputs(), rates: undefined, pLiability: undefined, claims: ensureInputs().claims.join(', '), ...Object.fromEntries(Object.entries(ensureInputs().rates).map(([k, val]) => [`rate_${k}`, val])) }).filter(([, val]) => val !== undefined).map(([k, val]) => ({ input: k, value: val }))), 'Inputs'); XL.utils.book_append_sheet(wb, XL.utils.json_to_sheet([{ plaintiff_opening: n.plaintiffOpening, defense_opening: n.defenseOpening, expected_low: n.expectedLow, expected_high: n.expectedHigh, workweeks: v.workweeks }]), 'Negotiation'); await X.save(`damages-model-${iso()}.xlsx`, new Blob([XL.write(wb, { bookType: 'xlsx', type: 'array' })])); }
    if (d.act === 'pos-memo') { const sys = PC.POS_SYSTEMS.find(p => p.id === S.posSys) || PC.POS_SYSTEMS[0]; await X.saveDocx([PC.posConfigMemo(S.input?.employerName || S.profile?.company || '[Employer]', sys, S.input ? PC.posRecommendations(S.input, S.result) : [], today())], `timekeeping-configuration-${sys.id}-${iso()}.docx`); }
  } catch (err) { toast(err.message || 'Something went wrong.'); }
});
// pages registered by this module may be the deep-link target: render once they exist
X.render();
})();
