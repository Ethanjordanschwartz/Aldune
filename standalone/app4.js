/* Aldune standalone — part 4: documents, document review, attestation, steps, ask, settings, law, wiring */
(() => {
'use strict';
const X = window.PCX; const { PC, S, $, esc, money, approx, fdate, pct, toast, busy, idle, head, ai, aiJSON, GUARD, VIEWS, openDrawer, closeDrawer } = X;
const T = PC.templates; const DRAFT = 'DRAFT — prepared with software. Have California employment counsel review before use.';
const today = () => new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

// ---------------- data-driven document lines
function payable(id) {
  const fs = (S.findingsBy.get(id) || []).filter(f => f.confidence !== 'low' && !f.premiumIndicated && f.amount > 0 && ['wages', 'premium', 'reimbursement'].includes(f.amountKind) && (S.status[f.id] || 'open') !== 'dismissed');
  const by = new Map(); fs.forEach(f => { const g = by.get(f.category) || { a: 0, n: 0, cite: f.authorities[0] || '', kind: f.amountKind }; g.a += f.amount; g.n++; by.set(f.category, g); });
  const lines = [...by.entries()].map(([c, g]) => ({ label: `${PC.CATEGORY_LABELS[c]} (${g.n} item${g.n === 1 ? '' : 's'})`, amount: Math.round(g.a * 100) / 100, basis: g.cite }));
  const wages = fs.filter(f => f.amountKind !== 'reimbursement').reduce((t, f) => t + f.amount, 0), reimb = fs.filter(f => f.amountKind === 'reimbursement').reduce((t, f) => t + f.amount, 0);
  const interest = S.sumIndex.get(id)?.exposure.interest || 0;
  return { lines, wages: Math.round(wages * 100) / 100, reimb: Math.round(reimb * 100) / 100, interest, total: Math.round((wages + reimb + interest) * 100) / 100 };
}
function letterFor(id) { const p = payable(id); if (p.total <= 0) return null; return T.wagePaymentLetter({ ...S.party, interestRate: S.bp?.rate ?? 0.1, employeeName: S.empIndex.get(id).name, employeeAddress: S.empIndex.get(id).address, date: today(), lines: p.lines, interest: p.interest, wagesTotal: p.wages, reimbursementTotal: p.reimb }); }
X.letterFor = letterFor; X.payable = payable;
function packetFor(id, st) {
  const e = S.empIndex.get(id); const fs = S.findingsBy.get(id) || []; const recs = S.recordsBy.get(id) || [];
  const weeks = new Set(recs.map(r => { const d = new Date(r.date + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - d.getUTCDay()); return d.toISOString().slice(0, 10); })).size;
  const flagged = new Set(fs.filter(f => (f.category === 'meal' || f.category === 'rest') && f.date).map(f => f.date)).size;
  const months = new Set(recs.map(r => r.date.slice(0, 7))).size;
  const lines = [];
  if (st.rw) lines.push({ label: 'Workweeks worked in the covered period', units: weeks, rate: st.rw, amount: weeks * st.rw });
  if (st.rs) lines.push({ label: 'Shifts with disputed meal or rest period records', units: flagged, rate: st.rs, amount: flagged * st.rs });
  if (st.rp && e.usesPersonalPhone) lines.push({ label: 'Months of disputed personal phone use', units: months, rate: st.rp, amount: months * st.rp });
  if (st.flat) lines.push({ label: 'Additional settlement amount', amount: st.flat });
  if (!lines.length) return [];
  const p = payable(id);
  return T.settlementPacket({ ...S.party, employeeName: e.name, date: today(), caseCaption: st.caption, court: st.court, caseNumber: st.number, plaintiffs: st.plaintiffs, plaintiffCounsel: st.counsel, classPeriodStart: st.start, claimsSummary: st.claims, complaintLocation: st.where, lines, wagePct: st.wagePct, considerDays: st.days, paymentDays: 10, undisputedPaid: st.undisputed && p.total > 0 ? { amount: p.total, date: '[date paid]' } : null, spanishAvailable: true });
}
const P = t => ({ t: 'p', runs: [t] }); const H = t => ({ t: 'heading', text: t });
function detectiveMemo() {
  const a = S.patterns.anomalies;
  return { title: 'Investigation memo', draftBanner: DRAFT, blocks: [{ t: 'title', text: 'Wage-and-Hour Pattern Investigation Memo' }, P(`${S.input.employerName} · Records ${S.result.engine.meta.windowStart} to ${S.result.engine.meta.windowEnd} · Prepared ${today()}`),
    P(`Company-wide, ${pct(S.patterns.baselines.meal)} of shifts show meal-period issues and ${pct(S.patterns.baselines.rest)} show rest-period issues. The patterns below are statistically significant concentrations (two-proportion z-test, z ≥ 3, at least 1.5× the company rate, at least five workers).`),
    ...a.flatMap((x, i) => [H(`${i + 1}. ${x.dimension}: ${x.value} (${x.lift.toFixed(1)}×)`), P(`Anomaly: ${pct(x.rate)} of ${x.shifts} shifts have ${x.metricLabel}, versus ${pct(x.baseline)} company-wide; about ${x.excessEvents} excess problem shifts across ${x.employees} workers (≈${approx(x.excessExposure)} in premiums).`), P(`Possible explanation: ${x.explanation}`), P(`Investigate: ${x.investigate}`)]),
    P('Patterns show correlation, not cause. Confirm through schedules, interviews, and policy review before taking action.')] };
}
function settlementMemo() {
  const { neu, pl, v, members } = X.settleModel(); const si = S.settleIn;
  return { title: 'Settlement valuation memo', draftBanner: 'PRIVILEGED AND CONFIDENTIAL — PREPARED AT THE DIRECTION OF COUNSEL (if applicable). ' + DRAFT, blocks: [{ t: 'title', text: 'Settlement Valuation Memo' }, P(`${S.input.employerName} · ${today()}`),
    { t: 'table', head: ['Measure', 'Amount'], rows: [['Scenario model (current assumptions)', money(neu.total)], ['  Wages, premiums, reimbursement', money(neu.wages)], ['  Statutory penalties', money(neu.penalties)], ['  PAGA penalties', money(neu.paga)], ['Plaintiff-side model (likely demand anchor)', money(pl.total)], ['Risk-adjusted value (target)', money(v.target)], ['Economic walkaway', money(v.walkaway)], ['Suggested opening', money(v.opening)]] },
    H('Assumptions'), { t: 'bullets', items: [...neu.notes.map(n => [n]), [`Liability ${si.liabilityPct}%, certification ${si.certificationPct}%, PAGA success ${si.pagaSuccessPct}%, plaintiff fees ${si.plaintiffFeePct}%.`], [`Defense costs: ${money(si.defenseCostToTrial)} through trial; ${money(si.defenseCostToMediation)} through mediation. ${members} potential class members.`]] },
    H('Calculation'), { t: 'bullets', items: v.explanation.map(t => [t]) }, P('This is a model built from the audit findings and the assumptions above. It is not a prediction of any court, jury, or mediator outcome.')] };
}
function ddReport() {
  const r = X.ddModel(); const h = r.headline;
  return { title: 'Employment liability report', draftBanner: DRAFT, blocks: [{ t: 'title', text: `California Employment Liability Report — ${S.ddIn.targetName || S.input.employerName}` }, P(`Prepared ${today()} from time and payroll records ${S.result.engine.meta.windowStart} to ${S.result.engine.meta.windowEnd} (${S.input.employees.length} workers).`),
    { t: 'table', head: ['Measure', 'Amount'], rows: [['Likely wage-and-hour exposure incl. PAGA', `${money(h.likelyLow)} – ${money(h.likelyHigh)}`], ['Maximum theoretical exposure', money(h.maximum)], ['PAGA (neutral model)', money(h.paga)], ['Estimated remediation cost', money(h.remediation)], ['Indemnity / escrow discussion range', `${money(r.adjustment.low)} – ${money(r.adjustment.high)}`]] },
    H('Material issues'), { t: 'table', head: ['Issue', 'Modeled amount'], rows: r.materialIssues.map(m => [m.label, money(m.amount)]) },
    H('High-risk locations'), { t: 'table', head: ['Location', 'Exposure', 'Share'], rows: r.highRiskLocations.map(l => [l.name, money(l.exposure), `${Math.round(l.share * 100)}%`]) },
    H('High-risk populations'), { t: 'bullets', items: r.highRiskPopulations.map(p => [`${p.label} (${p.employees}): ${p.detail}`]) },
    H('Insurance and deal protection'), { t: 'bullets', items: r.insurance.map(t => [t]) }, H('Diligence requests'), { t: 'bullets', items: r.requests.map(t => [t]) },
    P('Model outputs, not legal conclusions or an investment recommendation. Deal counsel should set final terms.')] };
}
function execReport() {
  const r = S.result; const e = r.exposure;
  return { title: 'Audit report', draftBanner: DRAFT, blocks: [{ t: 'title', text: 'Preliminary Labor Compliance Audit Report' }, P(`${S.input.employerName} · ${r.engine.meta.windowStart} to ${r.engine.meta.windowEnd} · ${S.input.employees.length} workers · ${r.engine.shifts.length} shifts · data quality ${r.quality.score}%`),
    ...(S.aiCache.exec ? [H('Executive summary'), P(S.aiCache.exec)] : []),
    H('Risk and exposure'), P(`Risk score ${r.risk.score}/100 (${r.risk.level}). Estimated potential exposure in the records reviewed ${approx(e.low)}–${approx(e.high)}; extended to limitations periods ${approx(e.lookbackLow)}–${approx(e.lookbackHigh)}; PAGA one-year range ${approx(r.paga.annualLow)}–${approx(r.paga.annualHigh)}.`),
    { t: 'table', head: ['Category', 'Records', 'Workers', 'Base', 'Lookback'], rows: r.categories.map(c => [c.label, String(c.findings), String(c.employees), money(c.base), money(c.lookbackBase)]) },
    H('Patterns'), { t: 'bullets', items: S.patterns.anomalies.slice(0, 6).map(a => [`${a.headline}. ${a.investigate}`]) },
    H('Methodology and assumptions'), { t: 'bullets', items: e.assumptions.map(t => [t]) }, { t: 'table', head: ['Rule', 'Version'], rows: Object.values(PC.RULES).map(x => [x.name, x.version]) },
    P('This report is generated from data supplied by the user and is a preliminary compliance-risk assessment. It is not legal advice or a legal opinion and does not determine whether a violation occurred.')] };
}
Object.assign(X, { detectiveMemo, settlementMemo, ddReport, execReport });

// ---------------- Generate documents
S.dg = { tpl: 'wage_letter', sel: new Set(), st: { caption: '', court: '', number: '', plaintiffs: '', counsel: '', start: '', claims: 'unpaid wages and overtime, meal and rest period premiums, wage-statement and waiting-time penalties, unreimbursed business expenses, and related penalties and interest', where: 'from Human Resources or the court clerk', rw: 5, rs: 10, rp: 5, flat: 0, wagePct: 33, days: 14, undisputed: true }, preview: '' };
const TPL = [
  ['wage_letter', 'Wage payment letters', 'Pay amounts the audit identified, unconditionally, with a calculation exhibit. No release (Lab. Code §§ 206, 206.5).', true],
  ['settlement', 'Individual settlement packets', 'For a pending class or representative action: notice letter, agreement for disputed claims (PAGA carve-out, § 12964.5, W-2/1099 split), and a data-driven payment schedule.', true],
  ['exec_report', 'Audit report', 'Risk, exposure, categories, patterns, methodology, and limitations.', false],
  ['detective', 'Investigation memo', 'The Detective’s patterns with explanations and investigation steps.', false],
  ['settle_memo', 'Settlement valuation memo', 'Scenario, risk-adjusted value, walkaway, and assumptions.', false],
  ['dd', 'Employment liability report (M&A)', 'Diligence report for a buyer or investor.', false],
  ['audit_record', 'Reasonable steps audit record', 'Documents this audit and corrective actions for the PAGA caps.', false],
  ['meal_waiver', 'Meal period waiver (bilingual)', '6-hour and 12-hour limits; states rest breaks can’t be waived.', false],
  ['attestation_policy', 'Break attestation policy (bilingual)', 'End-of-shift attestation with anti-retaliation and automatic premiums.', false]
];
function buildModels() {
  const g = S.dg; const party = { ...S.party, employerName: S.party.employerName || (S.input ? S.input.employerName : '[Employer]') };
  switch (g.tpl) {
    case 'wage_letter': return [...g.sel].map(letterFor).filter(Boolean);
    case 'settlement': return [...g.sel].flatMap(id => packetFor(id, g.st));
    case 'exec_report': return [execReport()];
    case 'detective': return [detectiveMemo()];
    case 'settle_memo': return [settlementMemo()];
    case 'dd': return [ddReport()];
    case 'audit_record': return [T.auditRecord({ ...party, auditDate: S.result.engine.meta.assumptions.auditDate, window: `${S.result.engine.meta.windowStart} to ${S.result.engine.meta.windowEnd}`, workers: S.input.employees.length, conductedBy: S.steps.conductedBy || (party.signerName ? `${party.signerName}${party.signerTitle ? `, ${party.signerTitle}` : ''}, with Aldune` : 'Aldune automated audit, reviewed by the employer'), policies: [Object.entries(S.policy).map(([k, v]) => `${k}: ${v}`).join('; '), (S.docs || []).filter(d => ['handbook', 'waiver', 'other'].includes(d.type)).map(d => `${d.name} (reviewed in Aldune)`).join('; ')].filter(Boolean).join('; ') || 'No written policies were uploaded for review with this audit', training: S.steps.training ? `Supervisor training ${S.steps.training}` : 'No supervisor training date is recorded yet', backPay: `${S.result.engine.employees.filter(e => e.exposure.wagesAndPremiums > 0).length} workers identified as owed amounts. Payment dates: ____________.`, findings: S.result.categories.map(c => ({ area: c.label, count: c.findings, workers: c.employees, amount: money(c.base), action: STEPS[c.category] || '', status: S.steps.done[c.category] ? 'Completed' : 'Open' })) })];
    case 'meal_waiver': return [T.mealWaiver(party)];
    case 'attestation_policy': return [T.attestationPolicy(party)];
  }
  return [];
}
VIEWS.documents = el => {
  const g = S.dg; const meta = TPL.find(t => t[0] === g.tpl); const needsData = !['meal_waiver', 'attestation_policy'].includes(g.tpl);
  const emps = S.result ? S.result.engine.employees.slice().sort((a, b) => b.exposure.total - a.exposure.total).slice(0, 300) : [];
  const inp = (k, label, ph = '') => `<label class="field">${label}<input data-st="${k}" value="${esc(g.st[k])}" placeholder="${esc(ph)}"></label>`;
  el.innerHTML = head('Generate documents', 'Letters, packets, memos, and reports built from this audit’s data. Preview here, download as Word. Every template is a draft for counsel.') + `
    <div class="split"><div>
      <div class="panel">${TPL.map(([k, n, d]) => `<label class="check" style="padding:8px;border:1px solid ${g.tpl === k ? 'var(--ledger)' : 'var(--line)'};border-radius:6px;margin-bottom:6px;background:${g.tpl === k ? 'var(--ledger-tint)' : 'transparent'}"><input type="radio" name="tpl" value="${k}" ${g.tpl === k ? 'checked' : ''}><span><b>${n}</b><br><span class="small muted">${d}</span></span></label>`).join('')}</div>
      <div class="panel" style="margin-top:12px"><h3 style="margin-top:0">Employer details</h3><div class="grid g2">${[['employerName', 'Legal name'], ['employerAddress', 'Address'], ['signerName', 'Signer name'], ['signerTitle', 'Signer title'], ['contact', 'Contact for questions']].map(([k, l]) => `<label class="field">${l}<input data-party="${k}" value="${esc(S.party[k] || '')}"></label>`).join('')}</div></div>
      ${g.tpl === 'settlement' ? `<div class="panel" style="margin-top:12px"><h3 style="margin-top:0">Lawsuit and offer</h3><p class="note small">Courts can limit or set aside misleading or coercive communications with putative class members (Gulf Oil v. Bernard; Chindarah v. Pick Up Stix). Have counsel approve, keep it accurate, and check for court orders before sending.</p><div class="grid g2">${inp('caption', 'Case caption', 'Garcia v. Company, Inc.')}${inp('court', 'Court')}${inp('number', 'Case number')}${inp('plaintiffs', 'Named plaintiffs')}${inp('counsel', 'Plaintiffs’ counsel (name, address, phone)')}${inp('start', 'Covered period starts', 'October 7, 2022')}${inp('where', 'Where to get the complaint')}<label class="field">$ per workweek<input type="number" data-stn="rw" value="${g.st.rw}"></label><label class="field">$ per flagged shift<input type="number" data-stn="rs" value="${g.st.rs}"></label><label class="field">$ per month of phone use<input type="number" data-stn="rp" value="${g.st.rp}"></label><label class="field">% allocated to wages (W-2)<input type="number" data-stn="wagePct" value="${g.st.wagePct}"></label><label class="field">Days to consider<input type="number" data-stn="days" value="${g.st.days}"></label></div><label class="field" style="margin-top:8px">Claims alleged<textarea data-st="claims" style="min-height:60px">${esc(g.st.claims)}</textarea></label></div>` : ''}
      ${meta[3] ? (S.result ? `<div class="panel" style="margin-top:12px"><h3 style="margin-top:0">Workers (${g.sel.size} selected)</h3><div class="row"><button class="btn" data-act="dg-all">Select all with amounts</button><button class="btn" data-act="dg-none">Clear</button></div><div class="tablewrap" style="max-height:300px;overflow-y:auto;margin-top:8px"><table><tbody>${emps.map(w => `<tr><td style="width:30px"><input type="checkbox" data-sel="${esc(w.employee.id)}" ${g.sel.has(w.employee.id) ? 'checked' : ''} aria-label="Select ${esc(w.employee.name)}"></td><td>${esc(w.employee.name)}<div class="cite">${esc(w.employee.id)} · ${esc(w.employee.location || '')}</div></td><td class="n">${money(payable(w.employee.id).total, true)}</td></tr>`).join('')}</tbody></table></div></div>` : '<p class="note">Load data first to generate worker documents.</p>') : ''}
      <div class="row" style="margin-top:12px"><button class="btn primary" data-act="dg-docx" ${needsData && !S.result ? 'disabled' : ''}>Download Word file</button><button class="btn" data-act="dg-preview" ${needsData && !S.result ? 'disabled' : ''}>Preview</button>${g.tpl === 'wage_letter' ? '<button class="btn" data-act="dg-es">Spanish letters (Word)</button>' : ''}</div>
    </div>
    <div>${g.preview ? `<div class="doc-preview">${g.preview}</div>` : '<div class="muted-box">Choose a document and select Preview.</div>'}<div id="es-out"></div></div></div>`;
  el.querySelectorAll('input[name=tpl]').forEach(r => r.addEventListener('change', e => { g.tpl = e.target.value; g.preview = ''; X.render(); }));
  el.querySelectorAll('[data-party]').forEach(i => i.addEventListener('input', e => { S.party[e.target.dataset.party] = e.target.value; if (e.target.dataset.party === 'employerName') delete S.party._autoName; delete S.party._demo; X.persist(); }));
  el.querySelectorAll('[data-st]').forEach(i => i.addEventListener('input', e => { g.st[e.target.dataset.st] = e.target.value; }));
  el.querySelectorAll('[data-stn]').forEach(i => i.addEventListener('change', e => { g.st[e.target.dataset.stn] = Math.max(0, Number(e.target.value) || 0); }));
  el.querySelectorAll('[data-sel]').forEach(c => c.addEventListener('change', e => { e.target.checked ? g.sel.add(e.target.dataset.sel) : g.sel.delete(e.target.dataset.sel); }));
};
function validateDg() { const g = S.dg; const meta = TPL.find(t => t[0] === g.tpl); if (meta[3] && !g.sel.size && S.result) { const owed = S.result.engine.employees.filter(e => e.exposure.wagesAndPremiums + e.exposure.reimbursement > 0).map(e => e.employee.id); if (owed.length) { g.sel = new Set(owed); toast(`No workers selected — generating for all ${owed.length} workers who are owed money.`); } } if (meta[3] && !g.sel.size) { toast('Select at least one worker.'); return false; } if (g.tpl === 'settlement' && !(g.st.caption && g.st.court && g.st.number && g.st.plaintiffs && g.st.counsel && g.st.start)) { toast('Complete the lawsuit details.'); return false; } return true; }
// several templates at once (Documents → "Download selected"): build each with the current settings and worker selection
X.DG_TPL = TPL; X.dgValidate = () => validateDg();
X.dgBuild = tpl => { const prev = S.dg.tpl; S.dg.tpl = tpl; try { return buildModels(); } finally { S.dg.tpl = prev; } };
X.dgValidateFor = tpl => { const prev = S.dg.tpl; S.dg.tpl = tpl; try { return validateDg(); } finally { S.dg.tpl = prev; } };
X.dgPreview = () => { if (!validateDg()) return; const m = buildModels(); if (!m.length) { toast('Nothing to generate for these workers with these settings.'); return; } S.dg.preview = PC.toHtml(m.slice(0, 12)); X.render(); };
X.dgDocx = async () => { if (!validateDg()) return; const m = buildModels(); if (!m.length) { toast('Nothing to generate.'); return; } await X.saveDocx(m, `${S.dg.tpl}-${new Date().toISOString().slice(0, 10)}.docx`); };
X.dgSpanish = async () => {
  const id = [...S.dg.sel][0]; const m = id && letterFor(id); if (!m) { toast('Select a worker with amounts owed.'); return; }
  const tmp = document.createElement('div'); tmp.innerHTML = PC.toHtml([m]); const out = $('#es-out'); out.innerHTML = '<div class="ai-out">Translating…</div>';
  try { await ai(`Translate this employer letter into clear, neutral Latin American Spanish for California hourly workers. Keep names, amounts, and statute numbers exactly. Output only the translation.\n<data>${tmp.innerText}</data>`, { onText: ({ text }) => { out.innerHTML = `<div class="ai-out">${esc(text)}</div>`; } }); }
  catch (e) { out.innerHTML = `<p class="small">${esc(e.message)}</p>`; }
};

// ---------------- Review documents (document intelligence)
const CHECKS = {
  arbitration: { label: 'Arbitration agreement', items: [
    [/representative|private attorneys general|paga/i, 'Addresses PAGA claims', 'A wholesale waiver of representative PAGA claims is unenforceable (Iskanian, 2014; Viking River, 2022). Individual PAGA claims may be compelled to arbitration, and the plaintiff keeps standing for the rest (Adolph v. Uber, 2023). Make sure an invalid waiver is severable.'],
    [/sexual harassment|sexual assault|ending forced arbitration|4445|EFAA/i, 'Carves out sexual harassment/assault (EFAA)', 'The Ending Forced Arbitration of Sexual Assault and Sexual Harassment Act (2022) lets employees choose court for those disputes.'],
    [/neutral|discovery|written (decision|award)|all (remedies|relief)|employer (shall|will) (pay|bear)/i, 'Armendariz protections', 'California requires a neutral arbitrator, adequate discovery, a written decision, all statutory remedies, and employer payment of costs unique to arbitration (Armendariz, 2000).'],
    [/1281\.9[78]|fees.{0,40}(30|thirty) days/i, 'Arbitration fee deadlines', 'Employers must pay arbitration fees within 30 days of the due date or risk waiving arbitration (Code Civ. Proc. §§ 1281.97–1281.98).'],
    [/labor commissioner|berman|administrative (charge|complaint)|agency/i, 'Preserves agency rights', 'Agreements may not bar Labor Commissioner claims or agency charges.'],
    [/class action/i, 'Class action waiver', 'Class waivers in employment arbitration agreements are generally enforceable (Epic Systems, 2018).']] },
  separation: { label: 'Severance or separation agreement', items: [
    [/12964\.5|nothing in this agreement prevents you from discussing/i, 'Gov. Code § 12964.5 disclosure language', 'Separation agreements that restrict disclosure must state that nothing prevents discussing or disclosing information about unlawful acts in the workplace; non-disparagement clauses need the carve-out.'],
    [/age discrimination in employment|ADEA|older workers benefit|twenty-one|21 days/i, 'ADEA / OWBPA (age 40+)', 'Releasing federal age claims requires written advice to consult an attorney, 21 days to consider (45 for group programs), and 7 days to revoke.'],
    [/1542/i, 'Civil Code § 1542 waiver', 'Needed to release unknown claims.'],
    [/workers'? compensation|unemployment|cannot be waived|not waivable|as a matter of law/i, 'Excludes non-waivable claims', 'Unpaid wages due (Lab. Code § 206.5), workers’ compensation, unemployment, and agency charge rights can’t be released by private agreement. FLSA releases generally require court or DOL approval.'],
    [/not (file|bring).{0,60}(agency|government)|governmental agency/i, 'Covenant not to file with agencies (risk)', 'Promises not to file with or cooperate with government agencies are unenforceable and can taint the agreement.'],
    [/rehire|re-employ/i, 'No-rehire clause (check)', 'Settlements of employment disputes generally can’t bar re-employment (Code Civ. Proc. § 1002.5).']] },
  settlement: { label: 'Wage settlement / Pick-Up Stix packet', items: [
    [/206\.5|undisputed wages/i, 'Separates undisputed wages (§ 206.5)', 'Wages concededly due must be paid without requiring a release.'],
    [/private attorneys general|paga/i, 'Addresses PAGA', 'Individuals can’t release the State’s representative PAGA claims; an explicit carve-out avoids overreach.'],
    [/12964\.5|nothing in this agreement prevents/i, '§ 12964.5 language', 'Required where the agreement restricts disclosure.'],
    [/attorney|counsel/i, 'Right to counsel; plaintiffs’ counsel contact', 'Accurate, non-coercive communication with putative class members, including plaintiffs’ counsel contact, supports enforceability (Chindarah v. Pick Up Stix).'],
    [/retaliat/i, 'Non-retaliation', 'Assure employees their choice won’t affect employment (Lab. Code § 98.6).'],
    [/w-2|1099|withhold/i, 'Tax treatment', 'Amounts for wage claims are generally wages; allocating everything to a 1099 penalty is risky.']] },
  waiver: { label: 'Meal or rest waiver', items: [
    [/six|6 hours/i, 'First-meal waiver limited to 6-hour days', 'Lab. Code § 512(a).'],
    [/twelve|12 hours/i, 'Second-meal waiver limited to 12-hour days', 'Only if the first meal wasn’t waived.'],
    [/revoke|revocable|revocation/i, 'Revocable', 'Waivers must be revocable.'],
    [/rest (break|period).{0,40}(waive|renunci)|renunciar.{0,40}descanso|descanso.{0,60}renunci/i, 'Purports to waive rest breaks (risk)', 'Rest breaks cannot be waived. Remove any language suggesting otherwise, including translations.']] },
  handbook: { label: 'Handbook / policies', items: [
    [/meal/i, 'Meal period policy', 'Lab. Code § 512; premium at the regular rate of compensation.'], [/rest (break|period)/i, 'Rest period policy', 'Wage Order § 12; off duty, not on call.'],
    [/sick/i, 'Paid sick leave', 'Lab. Code §§ 245–249: 40 hours/5 days; cap ≥ 80 hours/10 days.'], [/reimburs/i, 'Expense reimbursement', 'Lab. Code § 2802, including mileage and personal phones.'],
    [/off[\s-]*the[\s-]*clock/i, 'Prohibits off-the-clock work', 'Record and pay all time.'], [/lactation/i, 'Lactation accommodation', 'Lab. Code § 1034 written policy.'],
    [/workplace violence/i, 'Workplace violence prevention plan', 'Lab. Code § 6401.9.'], [/overtime.{0,80}(approv|authoriz)/i, 'Overtime approval rule (check wording)', 'Unapproved overtime must still be paid; discipline is the remedy, not nonpayment.']] }
};
Object.assign(CHECKS, { paga_notice: PC.CHECKS.paga_notice, mediation_brief: PC.CHECKS.mediation_brief, complaint: PC.CHECKS.complaint });
function classify(text) { return PC.classifyDocument(text); }
function classifyOld(text) { const t = text.toLowerCase(); if (/arbitrat/.test(t)) return 'arbitration'; if (/pick up stix|class action|lawsuit.{0,200}settle|settlement agreement and release/.test(t)) return 'settlement'; if (/severance|separation|termination of employment/.test(t)) return 'separation'; if (/waive.{0,40}meal|meal period.{0,40}waiv|renuncia/.test(t)) return 'waiver'; return 'handbook'; }
function quickCheck(doc) { return CHECKS[doc.type].items.map(([re, label, why]) => ({ label, why, found: re.test(doc.text) })); }
const loadScript = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Couldn’t load the file reader. Paste the text instead.')); document.head.appendChild(s); });
async function extract(file) {
  if (file.size > 40 * 1024 * 1024) throw new Error(`${file.name} is over 40 MB.`);
  return PC.maskSensitive(await PC.extractDocument(file.name, await file.arrayBuffer()));
}
VIEWS.review = el => {
  el.innerHTML = head('Review documents', 'Upload handbooks, meal waivers, arbitration agreements, severance agreements, or settlement packets. Aldune checks them against California requirements; Aldune gives a clause-by-clause review.') + `
    <div class="split"><div class="panel"><div class="drop"><b>Upload a document</b><span class="small muted">PDF, Word (.docx), or text — handbooks, waivers, arbitration and severance agreements, settlement packets, PAGA notices, demand letters. Read in this page.</span><input type="file" id="rv-file" accept=".pdf,.docx,.docm,.dotx,.txt,.md,.rtf,.doc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" multiple></div>
      <label class="field" style="margin-top:12px">Or paste text<textarea id="rv-text" placeholder="Paste policy or agreement text"></textarea></label><div class="row" style="margin-top:8px"><button class="btn" data-act="rv-paste">Add pasted text</button></div></div>
      <div class="panel"><h3 style="margin-top:0">What gets checked</h3><ul class="small">${Object.values(CHECKS).map(c => `<li><b>${c.label}:</b> ${c.items.map(i => i[1]).join('; ')}</li>`).join('')}</ul></div></div>
    ${S.docs.map((d, i) => { const q = quickCheck(d); return `<div class="panel" style="margin-top:16px"><div class="row" style="justify-content:space-between"><h3 style="margin:0">${esc(d.name)} <span class="chip">${CHECKS[d.type].label}</span></h3><div class="row"><select data-dtype="${i}" aria-label="Document type">${Object.entries(CHECKS).map(([k, c]) => `<option value="${k}" ${d.type === k ? 'selected' : ''}>${c.label}</option>`).join('')}</select><button class="btn" data-act="rv-del" data-i="${i}">Remove</button></div></div>
      <p class="small muted">${d.text.length.toLocaleString()} characters</p>
      <table><tbody>${q.map(x => `<tr><td style="width:90px"><span class="chip ${/\(risk\)|\(check/i.test(x.label) ? (x.found ? 'flag' : 'ok') : x.found ? 'ok' : 'warn'}">${/\(risk\)|\(check/i.test(x.label) ? (x.found ? 'Found' : 'Not found') : x.found ? 'Found' : 'Missing?'}</span></td><td><b>${esc(x.label)}</b><div class="cite">${esc(x.why)}</div></td></tr>`).join('')}</tbody></table>
      <p class="small muted">Quick check uses keywords and can miss differently worded clauses. Treat “Missing?” as “confirm.”</p>
      <div id="rv-ai-${i}">${d.review ? reviewHtml(d.review) : `<button class="btn primary" data-act="rv-ai" data-i="${i}">Review this document</button>`}</div></div>`; }).join('')}`;
  $('#rv-file').addEventListener('change', async e => {
    for (const f of e.target.files) { busy('Reading', f.name); try { const text = await extract(f); S.docs.push({ name: f.name, text, type: classify(text) }); } catch (x) { toast(x.message); } finally { idle(); } }
    X.render();
  });
  el.querySelectorAll('[data-dtype]').forEach(s => s.addEventListener('change', e => { S.docs[+e.target.dataset.dtype].type = e.target.value; S.docs[+e.target.dataset.dtype].review = null; X.render(); }));
};
function reviewHtml(r) {
  return `<h3>Aldune review<span class="badge-ai">AI</span></h3><p>${esc(r.summary || '')}</p><table><tbody>${(r.issues || []).map(x => `<tr><td style="width:80px"><span class="chip ${x.severity === 'high' ? 'flag' : x.severity === 'medium' ? 'warn' : ''}">${esc(x.severity)}</span></td><td><b>${esc(x.topic)}</b><div class="small">${esc(x.problem)}</div>${x.quote ? `<div class="cite">“${esc(x.quote)}”</div>` : ''}${x.fix ? `<div class="note small">${esc(x.fix)}</div>` : ''}</td></tr>`).join('')}</tbody></table>${(r.strengths || []).length ? `<p class="small"><b>Strengths:</b> ${r.strengths.map(esc).join('; ')}</p>` : ''}<p class="small muted">AI review is a first pass for counsel, not a legal opinion.</p>`;
}
X.reviewDoc = async i => {
  const d = S.docs[i]; const out = $(`#rv-ai-${i}`); out.innerHTML = '<div class="ai-out">Reviewing…</div>';
  const checklist = CHECKS[d.type].items.map(x => `- ${x[1]}: ${x[2]}`).join('\n');
  try {
    const r = await aiJSON(`Review this California employment document (${CHECKS[d.type].label}) for legal risk. Use this checklist and any other clearly applicable California or federal requirements you are confident about; do not invent authorities.\n${checklist}\nAlso flag any statement that is affirmatively unlawful or unenforceable, and any mismatch between English and translated text. Return JSON only: {"summary": string (2-3 sentences), "issues": [{"severity":"high"|"medium"|"low","topic":string,"problem":string,"quote":string (exact short quote from the document, max 25 words, or ""),"fix":string (suggested replacement language or action)}], "strengths": [string]}. ${GUARD}\n<data>${d.text.slice(0, 60000)}</data>`, { modelTier: 'complex' });
    d.review = r; out.innerHTML = reviewHtml(r);
  } catch (e) { out.innerHTML = `<p class="small">${esc(e.message || 'Review didn’t finish.')}</p>`; }
};

// ---------------- Shift attestation (kiosk + log)
S.att = S.att || []; S.kiosk = { lang: 'en', meal: null, rest: null, off: null, mins: 0, emp: '' };
const KT = { en: { t: 'End-of-shift check-out', meal: 'Did you get a full, uninterrupted 30-minute meal break that started before the end of your 5th hour of work?', rest: 'Did you get every 10-minute rest break, completely off duty?', off: 'Did you do any work today that isn’t on your time record?', mins: 'About how many minutes?', y: 'Yes', n: 'No', go: 'Submit', note: 'Answer honestly. You will never be disciplined for reporting a missed break or unrecorded work.' }, es: { t: 'Registro al terminar el turno', meal: '¿Recibió un periodo de comida completo de 30 minutos, sin interrupciones, que empezó antes del final de su quinta hora de trabajo?', rest: '¿Recibió todos sus descansos de 10 minutos, sin trabajar?', off: '¿Hizo algún trabajo hoy que no aparece en su registro de horas?', mins: '¿Cuántos minutos, aproximadamente?', y: 'Sí', n: 'No', go: 'Enviar', note: 'Conteste con honestidad. Nunca habrá castigo por reportar un descanso perdido o trabajo no registrado.' } };
VIEWS.attest = el => {
  const k = S.kiosk, t = KT[k.lang]; const ready = k.meal !== null && k.rest !== null && k.off !== null && k.emp.trim();
  const q = (key, label) => `<fieldset style="border:0;padding:0;margin:0 0 14px"><legend style="font-weight:600;margin-bottom:8px">${label}</legend><div class="row">${[true, false].map(b => `<button class="btn" style="flex:1;padding:14px;font-size:17px;${k[key] === b ? (b ? 'background:var(--ledger);color:#fff' : 'background:var(--flag);color:#fff') : ''}" data-act="k-ans" data-k="${key}" data-v="${b}" aria-pressed="${k[key] === b}">${b ? t.y : t.n}</button>`).join('')}</div></fieldset>`;
  const premiums = S.att.reduce((s, a) => s + (a.meal ? 0 : 1) + (a.rest ? 0 : 1), 0);
  el.innerHTML = head('Shift attestation', 'Rest breaks usually aren’t recorded, so most employers can’t prove they were provided. Run this check-out screen on a tablet at the timeclock. Every “no” becomes a premium on the next payroll and a dated record for your reasonable-steps showing.', ((S.att || []).length ? '<button class="btn" data-act="att-csv">Export for payroll and import</button>' : '<button class="btn" disabled title="No check-outs recorded yet">Export (no check-outs yet)</button>')) + `
    <div class="split"><div class="panel" style="max-width:560px">
      <div class="row" style="justify-content:space-between"><h3 style="margin:0">${t.t}</h3><div class="seg">${['en', 'es'].map(l => `<button data-act="k-lang" data-l="${l}" aria-pressed="${k.lang === l}">${l === 'en' ? 'English' : 'Español'}</button>`).join('')}</div></div>
      <label class="field" style="margin:12px 0">Employee ID<input id="k-emp" value="${esc(k.emp)}" placeholder="Employee ID"></label>
      ${q('meal', t.meal)}${q('rest', t.rest)}${q('off', t.off)}${k.off ? `<label class="field">${t.mins}<input type="number" id="k-mins" min="1" max="600" value="${k.mins || ''}"></label>` : ''}
      <p class="small muted">${t.note}</p><button class="btn primary" style="width:100%;padding:14px;font-size:17px" data-act="k-submit" ${ready ? '' : 'disabled'}>${t.go}</button></div>
      <div><div class="kpis" style="grid-template-columns:1fr 1fr"><div class="kpi"><div class="v">${S.att.length}</div><div class="k">Attestations this session</div></div><div class="kpi"><div class="v">${premiums}</div><div class="k">Premium hours due</div></div></div>
      <div class="tablewrap" style="margin-top:12px;max-height:340px;overflow-y:auto"><table><thead><tr><th>Employee</th><th>Date</th><th>Meal</th><th>Rest</th><th>Off clock</th></tr></thead><tbody>${S.att.slice().reverse().map(a => `<tr><td>${esc(a.emp)}</td><td>${a.date}</td><td>${a.meal ? '✓' : '<b style="color:var(--flag)">No</b>'}</td><td>${a.rest ? '✓' : '<b style="color:var(--flag)">No</b>'}</td><td>${a.off ? a.mins + ' min' : '—'}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">No attestations yet.</td></tr>'}</tbody></table></div>
      <p class="small muted" style="margin-top:10px">Export adds attest_meal, attest_rest, and attest_off_clock_min columns that the import maps automatically. Keep answers private from supervisors, pay every “no,” and never pressure workers — courts discount attestation systems that look coercive.</p></div></div>`;
  $('#k-emp').addEventListener('input', e => { k.emp = e.target.value; });
  const m = $('#k-mins'); if (m) m.addEventListener('input', e => { k.mins = Number(e.target.value) || 0; });
};

// ---------------- Reasonable steps
const STEPS = { meal: 'Timeclock warns at 4½ hours and requires a meal punch by the end of the 5th hour; premiums paid automatically from punches.', rest: 'End-of-shift attestation; premium for every reported missed or interrupted break.', regular_rate: 'Payroll includes differentials, nondiscretionary bonuses, and commissions in overtime and premium rates (Alvarado method for flat bonuses).', reconciliation: 'Punched hours reconciled to paid hours each period; time edits require employee acknowledgment.', min_wage: 'Rates updated for state and local minimum wages on effective dates.', wage_statement: 'Pay stub template shows every § 226(a) item and sick leave balance.', final_pay: 'Final-pay checklist: discharge same day; quit without notice within 72 hours.', pay_timing: 'Paydays within 7 days of period close; payday notice posted (§ 207).', expenses: 'Mileage and phone reimbursement policy adopted; back reimbursement paid.', classification: 'Affected workers reclassified; overtime and premiums paid back.', timekeeping: 'Rounding discontinued; actual punch times paid.' };
VIEWS.steps = el => {
  const st = S.steps; const cats = S.result.categories.filter(c => c.findings > 0);
  el.innerHTML = head('Reasonable steps record', 'Under the 2024 PAGA reforms, penalties can be capped at 15% for an employer that took all reasonable steps before a notice — periodic payroll audits and action on the results, lawful written policies, supervisor training, and corrective action with supervisors. Track each one here.', '<button class="btn primary" data-act="dl-record">Download audit record</button>') + `
    <div class="split"><div class="panel"><h3 style="margin-top:0">Corrective actions</h3>${cats.map(c => `<label class="check" style="margin:10px 0"><input type="checkbox" data-step="${c.category}" ${st.done[c.category] ? 'checked' : ''}><span><b>${esc(c.label)}</b> (${c.findings.toLocaleString()} records). ${esc(STEPS[c.category] || 'Investigate and correct.')}</span></label>`).join('')}</div>
    <div class="panel"><h3 style="margin-top:0">The four recognized steps</h3><ol class="steps-list small"><li><span class="chip ok">Done</span> Payroll audit of ${S.input.employees.length} workers, ${fdate(S.result.engine.meta.windowStart)} – ${fdate(S.result.engine.meta.windowEnd)}.</li><li><span class="chip ${cats.every(c => st.done[c.category]) ? 'ok' : 'warn'}">${cats.filter(c => st.done[c.category]).length}/${cats.length}</span> Action in response to the audit.</li><li>Lawful written policies: review them on <button class="btn" data-act="go" data-to="review">Review documents</button>.</li><li><label class="check"><input type="checkbox" id="sp-sup" ${st.supervisorAction ? 'checked' : ''}> Supervisors trained and corrective action taken</label><label class="field" style="margin-top:6px">Training date<input type="date" id="sp-tr" value="${esc(st.training)}"></label></li></ol>
      <label class="field">Audit conducted by<input id="sp-by" value="${esc(st.conductedBy)}" placeholder="Name, role"></label><p class="note small">Consider running audits at the direction of counsel. Relying on the record to show reasonable steps may waive privilege over it.</p></div></div>`;
  el.querySelectorAll('[data-step]').forEach(c => c.addEventListener('change', e => { st.done[e.target.dataset.step] = e.target.checked; X.persist(); X.render(); }));
  $('#sp-sup').addEventListener('change', e => { st.supervisorAction = e.target.checked; X.persist(); }); $('#sp-tr').addEventListener('change', e => { st.training = e.target.value; X.persist(); }); $('#sp-by').addEventListener('input', e => { st.conductedBy = e.target.value; X.persist(); });
};

// ---------------- Ask the audit (tool-using)
VIEWS.ask = el => {
  const sugg = ['What are our three biggest risks?', 'Which supervisors have the most meal-period issues?', 'How much exposure relates to rest periods?', 'What happens to exposure if we exclude workers with arbitration agreements?', 'Which workers have the most findings at Oxnard?', 'Which employees are likely to sue us?'];
  el.innerHTML = head('Ask the audit', 'Questions in plain English. Aldune answers by running queries and models against this audit’s data — it doesn’t guess.') + `
    <div class="panel"><div class="chat" id="chat">${S.chat.length ? S.chat.map(m => `<div class="${m.role === 'user' ? 'u' : 'a'}">${esc(m.content)}</div>`).join('') : `<div class="row">${sugg.map(s => `<button class="pill" data-act="ask" data-q="${esc(s)}">${esc(s)}</button>`).join('')}</div>`}</div>
      <form id="ask-f" class="row" style="margin-top:14px"><label class="sr" for="ask-q">Question</label><input id="ask-q" style="flex:1;border:1px solid var(--line);border-radius:4px;padding:9px" maxlength="500" placeholder="Ask about findings, workers, locations, patterns, or scenarios"><button class="btn primary">Ask</button></form>
      </div>`;
  $('#ask-f').addEventListener('submit', e => { e.preventDefault(); X.ask($('#ask-q').value); });
};
X.ask = async question => {
  if (!question || !question.trim()) return; S.chat.push({ role: 'user', content: question }); X.render(); const box = $('#chat'); const ans = document.createElement('div'); ans.className = 'a'; ans.textContent = 'Querying the audit…'; box.appendChild(ans);
  const emp = id => S.empIndex.get(id) || {};
  const tools = [
    { name: 'get_summary', description: 'Audit totals: risk score, exposure ranges, categories, PAGA, locations.', inputSchema: { type: 'object', properties: {} }, execute: () => ({ employer: S.input.employerName, risk: S.result.risk, exposure: S.result.exposure, paga: { low: S.result.paga.annualLow, high: S.result.paga.annualHigh }, categories: S.result.categories.map(c => ({ category: c.category, label: c.label, findings: c.findings, workers: c.employees, base: Math.round(c.base) })), locations: X.byLocation().map(l => ({ ...l, exposure: Math.round(l.exposure) })) }) },
    { name: 'get_patterns', description: 'Statistically significant concentrations (PAGA Detective).', inputSchema: { type: 'object', properties: {} }, execute: () => S.patterns.anomalies.map(a => ({ pattern: a.headline, rate: a.rate, baseline: a.baseline, workers: a.employees, excessShifts: a.excessEvents, explanation: a.explanation })) },
    { name: 'search_findings', description: 'Count and list findings filtered by category, location, supervisor, or employee id.', inputSchema: { type: 'object', properties: { category: { type: 'string' }, location: { type: 'string' }, supervisor: { type: 'string' }, employee: { type: 'string' } } }, execute: i => { const l = S.result.engine.findings.filter(f => (!i.category || f.category === i.category) && (!i.location || emp(f.employeeId).location === i.location) && (!i.supervisor || emp(f.employeeId).supervisor === i.supervisor) && (!i.employee || f.employeeId === i.employee)); return { total: l.length, estimated: Math.round(l.filter(f => f.confidence !== 'low' && !f.premiumIndicated).reduce((t, f) => t + f.amount, 0)), sample: l.slice(0, 15).map(f => ({ id: f.id, worker: emp(f.employeeId).name, date: f.date || f.periodStart, title: f.title, amount: f.amount })) }; } },
    { name: 'group_counts', description: 'Count counted findings grouped by location, supervisor, department, or job title, optionally for one category.', inputSchema: { type: 'object', properties: { by: { type: 'string', enum: ['location', 'supervisor', 'department', 'jobTitle'] }, category: { type: 'string' } }, required: ['by'] }, execute: i => { const m = {}; S.result.engine.findings.forEach(f => { if (f.confidence === 'low' || f.premiumIndicated || (i.category && f.category !== i.category)) return; const k = emp(f.employeeId)[i.by] || 'Unassigned'; m[k] = m[k] || { findings: 0, amount: 0 }; m[k].findings++; m[k].amount += f.amount; }); return Object.entries(m).map(([k, v]) => ({ group: k, findings: v.findings, amount: Math.round(v.amount) })).sort((a, b) => b.findings - a.findings); } },
    { name: 'top_workers', description: 'Workers ranked by exposure or finding count, optionally at one location.', inputSchema: { type: 'object', properties: { by: { type: 'string', enum: ['exposure', 'findings'] }, location: { type: 'string' } } }, execute: i => S.result.engine.employees.filter(e => !i.location || e.employee.location === i.location).sort((a, b) => i.by === 'findings' ? b.findingCount - a.findingCount : b.exposure.total - a.exposure.total).slice(0, 12).map(e => ({ id: e.employee.id, name: e.employee.name, location: e.employee.location, findings: e.findingCount, exposure: Math.round(e.exposure.total) })) },
    { name: 'run_scenario', description: 'Recalculate modeled exposure with changed assumptions.', inputSchema: { type: 'object', properties: { excludeArbitration: { type: 'boolean' }, validityPct: { type: 'number' }, lookbackMonths: { type: 'number' }, pagaCap: { type: 'string', enum: ['none', 'pre', 'post'] }, pagaMode: { type: 'string', enum: ['single', 'stacked'] } } }, execute: i => { const r = PC.runScenario(S.input, S.result, { ...S.scenario, ...i }); return { total: r.total, wages: r.wages, penalties: r.penalties, paga: r.paga, notes: r.notes }; } }
  ];
  try {
    const turns = S.chat.slice(-8).map(m => ({ role: m.role, content: m.content }));
    turns[turns.length - 1] = { role: 'user', content: `${GUARD}\nAnswer in under 160 words using the tools; cite finding or employee IDs where useful.\nQuestion: ${question}` };
    const r = await ai(turns, { tools, onText: ({ text }) => { ans.textContent = text; } });
    S.chat.push({ role: 'assistant', content: r.text });
  } catch (e) { S.chat.push({ role: 'assistant', content: e.message || 'That question didn’t complete.' }); }
  X.render();
};

// ---------------- Methodology and settings
VIEWS.method = el => {
  const a = S.assumptions || PC.DEFAULT_ASSUMPTIONS; const m = S.result && S.result.engine.meta;
  el.innerHTML = head('Methodology and settings', 'How results are calculated, and the assumptions you can change. Changing a setting re-runs the audit.') + `
    <div class="split"><div class="panel"><h3 style="margin-top:0">Assumptions</h3><div class="grid g2">
      <label class="field">Industry rules<select data-as="industry"><option value="general" ${a.industry === 'general' ? 'selected' : ''}>General (§ 510)</option><option value="agriculture" ${a.industry === 'agriculture' ? 'selected' : ''}>Agriculture (§§ 857–864)</option></select></label>
      <label class="field">State minimum wage override<input type="number" step="0.01" data-asn="stateMinWage" value="${a.stateMinWage || ''}" placeholder="${PC.stateMinWageOn(new Date().toISOString().slice(0, 10))} (2026)"></label>
      <label class="field">Workweek starts<select data-asn="workweekStart">${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d, i) => `<option value="${i}" ${a.workweekStart === i ? 'selected' : ''}>${d}</option>`).join('')}</select></label>
      <label class="field">Default hourly rate when missing<input type="number" data-asn="defaultHourlyRate" value="${a.defaultHourlyRate}"></label>
      <label class="field">Personal phone estimate ($/month)<input type="number" data-asn="phoneMonthly" value="${a.phoneMonthly}"></label>
      <label class="field">PAGA penalty per pay period<input type="number" data-asn="pagaPenalty" value="${a.pagaPenalty}"></label>
      <label class="check"><input type="checkbox" data-asb="derivative226" ${a.derivative226 ? 'checked' : ''}> Derivative wage-statement claims (Naranjo)</label>
      <label class="check"><input type="checkbox" data-asb="derivative203" ${a.derivative203 ? 'checked' : ''}> Waiting-time penalties when wages unpaid at separation</label>
      <label class="check"><input type="checkbox" data-asb="pagaWeeklyHalf" ${a.pagaWeeklyHalf ? 'checked' : ''}> Halve PAGA penalties for weekly pay periods</label>
    </div><p class="small muted">Exempt salary floor ${money(PC.exemptSalaryFloor(new Date().toISOString().slice(0, 10), a.stateMinWage))}/year (2 × state minimum wage × 2,080).</p></div>
    <div class="panel"><h3 style="margin-top:0">Run record</h3>${m ? `<table><tbody><tr><td>Input fingerprint</td><td>${m.inputHash}</td></tr><tr><td>Records window</td><td>${m.windowStart} to ${m.windowEnd}</td></tr><tr><td>Software</td><td>${m.softwareVersion}</td></tr><tr><td>Run at</td><td>${new Date(m.ranAt).toLocaleString()}</td></tr></tbody></table><h3>Exposure methodology</h3><ul class="small">${S.result.exposure.assumptions.map(t => `<li>${esc(t)}</li>`).join('')}<li>Risk score sums breadth (30), frequency (25), severity (15), exposure intensity (20), and recurrence (10).</li><li>AI explains and summarizes; it never computes amounts.</li></ul>` : '<p class="muted">Run an audit to see its record.</p>'}</div></div>
    <h2>Rules applied</h2><div class="grid g2">${Object.values(PC.RULES).map(r => `<div class="panel"><b>${esc(r.name)}</b><div class="cite">${r.version} · effective ${r.effectiveDate} · lookback ${r.solYears} yr</div><p class="small" style="margin-top:6px">${esc(r.description)}</p><p class="small"><b>Calculation:</b> ${esc(r.calculation)}</p><p class="cite">${r.authorities.map(esc).join(' · ')}</p></div>`).join('')}</div>`;
  const set = (sel, fn) => el.querySelectorAll(sel).forEach(i => i.addEventListener('change', async e => { S.assumptions = Object.assign({}, a, fn(e.target)); if (S.input) await X.rerun(); else X.render(); }));
  set('[data-as]', t => ({ [t.dataset.as]: t.value })); set('[data-asn]', t => ({ [t.dataset.asn]: t.value === '' ? undefined : Number(t.value) })); set('[data-asb]', t => ({ [t.dataset.asb]: t.checked }));
};

// ---------------- Law reference
const LAW = [
  ['Meal periods — Lab. Code § 512; Wage Orders § 11', '30-minute duty-free meal starting by the end of the 5th hour; second by the end of the 10th. Waivers: first meal if the day is 6 hours or less; second if 12 or less and the first wasn’t waived. Employers must provide, not police, meals (Brinker, 2012), but records showing missed, late, or short meals raise a rebuttable presumption, and meals may not be rounded (Donohue, 2021).'],
  ['Rest periods — Wage Orders § 12', '10 net minutes per 4 hours or major fraction (none under 3½ hours), off duty and not on call (Augustus, 2016). Rest breaks cannot be waived.'],
  ['Premiums — Lab. Code § 226.7', 'One hour at the regular rate of compensation per workday for meal and another for rest (Ferra, 2021). Premiums are wages for wage statements and final pay (Naranjo, 2022).'],
  ['Overtime and regular rate — Lab. Code § 510', 'Daily 8/12, weekly 40, seventh-day rules; regular rate includes nondiscretionary bonuses, commissions, differentials; flat-sum bonuses use nonovertime hours (Alvarado, 2018). Agriculture: §§ 857–864.'],
  ['Minimum wage — §§ 1182.12, 1194, 1194.2, 1197', '2026 statewide $16.90 (verify); local and industry rates may be higher. Liquidated damages equal unpaid minimum wages.'],
  ['Wage statements — § 226', 'Nine required items plus sick leave balance (§ 246(i)); $50/$100 per period up to $4,000; one-year statute; knowing and intentional plus injury.'],
  ['Final pay — §§ 201–203', 'Discharge: immediately. Quit without notice: 72 hours. Willful failure: up to 30 days’ wages; good-faith dispute defense; three-year statute.'],
  ['Expenses — § 2802', 'Reimburse necessary expenses including mileage and a reasonable share of personal phone use (Cochran, 2014).'],
  ['Classification — § 515; §§ 2775–2787; § 226.8', 'Exempt salary at least 2× minimum wage ($70,304 in 2026) and primarily exempt duties. Contractors must satisfy all ABC prongs (Dynamex; AB 5). Willful misclassification: $5,000–$25,000 per violation.'],
  ['PAGA — §§ 2699, 2699.3 (2024 reforms)', '$100 default per aggrieved employee per pay period; 15%/30% caps for reasonable steps; cure and early evaluation; standing requires personally suffering each violation; 35% to employees. Courts may reduce awards. Representative PAGA waivers are unenforceable (Iskanian); individual claims arbitrable (Viking River); standing retained (Adolph).'],
  ['Arbitration', 'Class waivers enforceable (Epic Systems, 2018); Armendariz minimum protections; EFAA (2022) sexual harassment/assault carve-out; fee-payment deadlines (Code Civ. Proc. §§ 1281.97–.98).'],
  ['Releases and settlements', 'No release required for wages due (§ 206.5); § 12964.5 disclosure language; Civil Code § 1542; no-rehire limits (Code Civ. Proc. § 1002.5); OWBPA for age claims; individual settlements with putative class members allowed if not misleading or coercive (Chindarah v. Pick Up Stix, 2009).'],
  ['Unfair competition — Bus. & Prof. Code § 17200', 'Extends restitution of wages and premiums to four years; penalties not recoverable.']
];
VIEWS.law = el => { el.innerHTML = head('Law reference', 'Rules and authorities Aldune applies. Figures reflect 2026; verify each January.') + LAW.map(([t, b]) => `<details class="law"><summary>${esc(t)}</summary><p>${esc(b)}</p></details>`).join(''); };

// ---------------- wiring
document.addEventListener('click', async e => {
  const nav = e.target.closest('#nav button'); if (nav) { X.setView(nav.dataset.view); return; }
  const fr = e.target.closest('tr[data-finding]'); if (fr) { X.openFinding(fr.dataset.finding); return; }
  const wr = e.target.closest('tr[data-worker]'); if (wr) { X.openWorker(wr.dataset.worker); return; }
  const a = e.target.closest('[data-act]'); if (!a) return; const act = a.dataset.act, d = a.dataset;
  try {
    switch (act) {
      case 'go': closeDrawer(); X.setView(d.to); break;
      case 'demo': await X.loadDemo(); break;
      case 'imp-next': S.imp.step = 1; X.render(); break;
      case 'imp-back': S.imp.step = Math.max(0, S.imp.step - 1); X.render(); break;
      case 'imp-validate': X.impValidate(); break;
      case 'imp-run': await X.impRun(); break;
      case 'imp-samples': X.loadSamples(); break;
      case 'save-snap': await X.saveSnap(); break;
      case 'del-snap': await X.deleteSnapshot(d.id); X.render(); break;
      case 'ai-exec': await X.aiExec(); break;
      case 'ai-det': await X.aiDet(); break;
      case 'ai-finding': await X.aiFinding(d.id); break;
      case 'ai-settle': await X.aiSettle(); break;
      case 'det-findings': Object.assign(S.fq, { dim: d.dim, val: d.val, cat: d.metric === 'rest' ? 'rest' : 'meal', emp: '', page: 1 }); X.setView('findings'); break;
      case 'fq-clear': Object.assign(S.fq, { emp: '', dim: '', val: '' }); X.render(); break;
      case 'fq-prev': S.fq.page--; X.render(); break; case 'fq-next': S.fq.page++; X.render(); break;
      case 'wq-prev': S.wq.page--; X.render(); break; case 'wq-next': S.wq.page++; X.render(); break;
      case 'fd-save': S.status[d.id] = $('#fd-status').value; S.notes = S.notes || {}; S.notes[d.id] = $('#fd-note').value; toast('Review saved'); if (S.view === 'findings') X.render(); break;
      case 'open-worker': X.openWorker(d.id); break;
      case 'worker-findings': closeDrawer(); Object.assign(S.fq, { emp: d.id, dim: '', cat: '', page: 1 }); X.setView('findings'); break;
      case 'worker-letter': { const m = letterFor(d.id); if (!m) toast('No amounts owed for this worker.'); else await X.saveDocx([m], `wage-letter-${d.id}.docx`); break; }
      case 'persp': S.perspective = d.p; S.scenario = { ...PC.DEFAULT_SCENARIO, ...PC.PERSPECTIVES[d.p] }; X.render(); break;
      case 'dl-detective': await X.saveDocx([detectiveMemo()], 'investigation-memo.docx'); break;
      case 'dl-settle-memo': await X.saveDocx([settlementMemo()], 'settlement-valuation-memo.docx'); break;
      case 'dl-dd': await X.saveDocx([ddReport()], 'employment-liability-report.docx'); break;
      case 'dl-record': S.dg.tpl = 'audit_record'; await X.saveDocx(buildModels(), 'reasonable-steps-audit-record.docx'); break;
      case 'dl-findings': { const rows = X.filteredFindings(); const cols = ['id', 'employeeId', 'name', 'location', 'date', 'periodStart', 'periodEnd', 'category', 'title', 'severity', 'confidence', 'amount', 'amountKind', 'premiumIndicated', 'status', 'ruleVersion']; const q = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }; await X.save('findings.csv', [cols.join(','), ...rows.map(f => cols.map(c => q(c === 'name' ? S.empIndex.get(f.employeeId)?.name : c === 'location' ? S.empIndex.get(f.employeeId)?.location : c === 'status' ? (S.status[f.id] || 'open') : f[c])).join(','))].join('\n')); break; }
      case 'dg-all': S.result.engine.employees.forEach(w => { if (payable(w.employee.id).total > 0) S.dg.sel.add(w.employee.id); }); X.render(); break;
      case 'dg-none': S.dg.sel.clear(); X.render(); break;
      case 'dg-preview': X.dgPreview(); break; case 'dg-docx': await X.dgDocx(); break; case 'dg-es': await X.dgSpanish(); break;
      case 'rv-paste': { const t = $('#rv-text').value.trim(); if (!t) { toast('Paste some text first.'); break; } S.docs.push({ name: `Pasted text ${S.docs.length + 1}`, text: t, type: classify(t) }); X.render(); break; }
      case 'rv-del': S.docs.splice(+d.i, 1); X.render(); break;
      case 'rv-ai': await X.reviewDoc(+d.i); break;
      case 'k-lang': S.kiosk.lang = d.l; X.render(); break;
      case 'k-ans': S.kiosk[d.k] = d.v === 'true'; X.render(); break;
      case 'k-submit': { const k = S.kiosk; S.att.push({ emp: k.emp.trim(), date: new Date().toLocaleDateString('en-CA'), meal: k.meal, rest: k.rest, off: k.off, mins: k.off ? k.mins : 0, lang: k.lang }); const prem = (k.meal ? 0 : 1) + (k.rest ? 0 : 1); Object.assign(k, { meal: null, rest: null, off: null, mins: 0, emp: '' }); toast(prem ? `Saved. ${prem} premium hour${prem > 1 ? 's' : ''} due on the next payroll.` : 'Saved. Thank you.'); X.render(); break; }
      case 'att-csv': await X.save('attestations.csv', ['employee_id,date,attest_meal,attest_rest,attest_off_clock_min,premium_hours_due', ...S.att.map(x => `${x.emp},${x.date},${x.meal ? 'Y' : 'N'},${x.rest ? 'Y' : 'N'},${x.mins || 0},${(x.meal ? 0 : 1) + (x.rest ? 0 : 1)}`)].join('\n')); break;
      case 'ask': await X.ask(d.q); break;
    }
  } catch (err) { idle(); toast(err && err.message ? err.message : 'Something went wrong.'); }
});
$('#drawer-close').addEventListener('click', closeDrawer); $('#scrim').addEventListener('click', closeDrawer);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });
$('#theme-btn').addEventListener('click', () => { const r = document.documentElement; const cur = r.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); r.dataset.theme = cur === 'dark' ? 'light' : 'dark'; try { localStorage.setItem('paycure:theme', r.dataset.theme); } catch { /* ignore */ } });
try { const t = localStorage.getItem('paycure:theme'); if (t) document.documentElement.dataset.theme = t; } catch { /* ignore */ }
})();
