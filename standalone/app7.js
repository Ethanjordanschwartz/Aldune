/* Aldune standalone — part 7: Solutions Center, back-pay planner, PAGA cure path, remediation templates, built-in document review, law library, focus trap */
(() => {
'use strict';
const X = window.PCX; const { PC, S, $, esc, money, approx, fdate, toast, head, VIEWS, openDrawer } = X;
const T = PC.templates; const today = () => new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
const iso = () => new Date().toISOString().slice(0, 10);
const party = () => ({ ...S.party, employerName: S.party.employerName || (S.input ? S.input.employerName : (S.profile && S.profile.company) || '[Employer]') });
const lawChip = id => { const t = PC.lawById(id); return t ? `<span class="lawchip" data-act="law-open" data-id="${esc(id)}" title="${esc(t.citations.join('; '))}">§ ${esc(t.title)}</span>` : ''; };
const headcount = () => Number((S.profile && S.profile.employees) || (S.input ? S.input.employees.length : 0));

// ======================================================= document generator for remediation templates
// interest in letters always matches the selected rate (7% cure / 10% prejudgment) — plan cached per rate and audit
let planCache = { k: '', rows: new Map() };
function planRow(id) { const rate = S.bp?.rate ?? 0.1; const k = `${rate}|${S.result?.engine.meta.inputHash}`; if (planCache.k !== k) { const plan = PC.backPay(S.input, S.result, { interestRate: rate, includeLiquidated: false, through: S.result.engine.meta.assumptions.auditDate }); planCache = { k, rows: new Map(plan.rows.map(r => [r.employeeId, r])) }; } return planCache.rows.get(id); }
function letterData(id) {
  const fs = (S.findingsBy.get(id) || []).filter(f => f.confidence !== 'low' && !f.premiumIndicated && f.amount > 0 && ['wages', 'premium', 'reimbursement'].includes(f.amountKind) && !['dismissed', 'remediated'].includes(S.status[f.id]));
  const by = new Map(); fs.forEach(f => { const g = by.get(f.category) || { a: 0, n: 0, cite: f.authorities[0] || '' }; g.a += f.amount; g.n++; by.set(f.category, g); });
  const lines = [...by.entries()].map(([c, g]) => ({ label: `${PC.CATEGORY_LABELS[c]} (${g.n})`, amount: Math.round(g.a * 100) / 100, basis: g.cite }));
  const wages = fs.filter(f => f.amountKind !== 'reimbursement').reduce((t, f) => t + f.amount, 0), reimb = fs.filter(f => f.amountKind === 'reimbursement').reduce((t, f) => t + f.amount, 0);
  return { employeeName: S.empIndex.get(id).name, employeeAddress: S.empIndex.get(id).address, date: today(), lines, interest: planRow(id)?.interest ?? (S.sumIndex.get(id)?.exposure.interest || 0), wagesTotal: Math.round(wages * 100) / 100, reimbursementTotal: Math.round(reimb * 100) / 100 };
}
function owedIds() { return S.result.engine.employees.filter(e => e.exposure.wagesAndPremiums + e.exposure.reimbursement > 0).sort((a, b) => b.exposure.total - a.exposure.total).map(e => e.employee.id); }
X.genDoc = (key, opts = {}) => {
  const p = party(); const ids = opts.ids || (S.dg && S.dg.sel && S.dg.sel.size ? [...S.dg.sel] : owedIds());
  switch (key) {
    case 'wage_letter': return ids.map(id => { const d = letterData(id); return d.lines.length ? T.wagePaymentLetter({ ...p, ...d, interestRate: S.bp?.rate ?? 0.1 }) : null; }).filter(Boolean);
    case 'wage_letter_es': return ids.map(id => { const d = letterData(id); return d.lines.length ? T.wagePaymentLetterEs({ ...p, ...d, interestRate: S.bp?.rate ?? 0.1 }) : null; }).filter(Boolean);
    case 'paga_cure': { const nd = S.readiness?.noticeDate || S.profile?.noticeDate || ''; const plan = PC.backPay(S.input, S.result, { interestRate: 0.07, includeLiquidated: true, through: new Date().toISOString().slice(0, 10) });
      const fx = [...(X.fpOf ? X.fpOf() : []).map(f => ({ label: f.title, fix: f.fix, cite: f.cite })), ...PC.capabilities(S.input, S.result).filter(c => c.status === 'no').map(c => ({ label: c.label, fix: c.fix, cite: c.cite }))];
      return [PC.docs3.cureProposalFull({ signerName: S.party?.signerName, signerTitle: S.party?.signerTitle, employerAddress: S.party?.employerAddress, payBy: S.cure?.paymentDate, employer: p.employer || S.input.employerName, noticeDate: nd, noticeRef: S.cure?.lwda || '', small: headcount() < 100, counsel: S.priv?.counsel?.name ? `${S.priv.counsel.name}${S.priv.counsel.firm ? `, ${S.priv.counsel.firm}` : ''}` : '', plan, cats: S.result.categories.map(c => ({ label: c.label, category: c.category, base: c.base, findings: c.findings, employees: c.employees })), fixes: fx.filter((x, k, arr) => arr.findIndex(y => y.label === x.label) === k).slice(0, 12) })]; }
    case 'eec': return [T.earlyEvaluationStatement({ ...p, caseCaption: S.cure?.caption || '', caseNumber: S.cure?.number || '', cure: PC.playbooks(S.input, S.result).filter(x => x.owed > 0).map(x => `${x.label}: ${x.immediate[0]} (${money(x.owed)})`), disputed: [] })];
    case 'corrected_ws': { const ws = S.result.engine.findings.filter(f => f.category === 'wage_statement'); const emps = [...new Set(ws.map(f => f.employeeId))].slice(0, 300);
      const owedIn = (id, a, b) => (S.findingsBy.get(id) || []).filter(f => ['wages', 'premium'].includes(f.amountKind) && f.confidence !== 'low' && !f.premiumIndicated && (f.date || f.periodEnd || '') >= a && (f.date || f.periodEnd || '') <= b).reduce((t, f) => t + f.amount, 0);
      return emps.map(id => { const fs = ws.filter(f => f.employeeId === id).sort((a, b) => (a.periodStart || '').localeCompare(b.periodStart || '')); const pay = S.input.payroll.filter(x => x.employeeId === id);
        const periods = fs.map(f => { const pr = pay.find(x => x.periodStart === f.periodStart && x.periodEnd === f.periodEnd) || {}; const miss = String(f.evidence?.missingItems || '').split(/\n|; /).map(x => x.trim()).filter(Boolean); return { start: f.periodStart || '', end: f.periodEnd || '', missing: miss, derivative: !miss.length, regHours: pr.regHours, regRate: pr.regRate ?? '—', otHours: pr.otHours, otRate: pr.otRate ?? '—', dtHours: pr.dtHours, gross: pr.grossPay ?? '—', added: Math.round(owedIn(id, f.periodStart || '', f.periodEnd || '') * 100) / 100 }; });
        return PC.docs3.correctedWageStatementsFull({ signerName: S.party?.signerName, signerTitle: S.party?.signerTitle, employeeAddress: S.empIndex.get(id)?.address, employer: p.employer || S.input.employerName, employerAddress: S.party?.employerAddress, employeeName: S.empIndex.get(id)?.name || id, employeeId: id, date: today(), contact: S.party?.contact, periods }); }); }
    case 'reclass': return S.result.engine.employees.filter(e => e.misclassified).map(e => T.reclassificationNotice({ ...p, employeeName: e.employee.name, employeeAddress: e.employee.address, date: today(), effective: '', newRate: e.employee.annualSalary ? `$${(e.employee.annualSalary / 2080).toFixed(2)} per hour (your current salary ÷ 2,080 hours)` : '', reason: 'the position’s pay and duties against California’s exemption tests' }));
    case 'waiting_time': return S.result.engine.findings.filter(f => f.category === 'final_pay' && f.amount > 0).map(f => { const e = S.empIndex.get(f.employeeId) || {}; return T.waitingTimeLetter({ ...p, employeeAddress: e.address, employeeName: e.name || f.employeeId, date: today(), separation: String(f.evidence.terminationDate), wages: 0, penalty: f.amount, days: Math.min(30, Number(f.evidence.daysLate) || 0), dailyWage: Number(f.evidence.dailyWage) || 0 }); });
    case 'meal_rest_policy': return [T.mealRestPolicy(p)];
    case 'expense_policy': return [T.expensePolicy(p)];
    case 'timekeeping_policy': return [T.timekeepingPolicy(p)];
    case 'training_memo': return [T.supervisorTrainingMemo({ ...p, date: today(), patterns: (S.patterns?.anomalies || []).slice(0, 5).map(a => `${a.headline}. ${a.investigate}`) })];
    case 'payroll_memo': { const fs = S.result ? S.result.engine.findings.filter(f => f.amount > 0 && f.confidence !== 'low') : []; const cats = [...new Set(fs.map(f => f.category))];
      const locs = S.input ? [...new Set(S.input.employees.map(e => e.location).filter(Boolean))].slice(0, 40).map(l => { try { const r = PC.minWageFor(today(), { location: l }); return { name: l, rate: r.rate, source: r.source || 'State minimum wage' }; } catch { return null; } }).filter(Boolean) : [];
      return [T.payrollConfigMemo({ ...p, date: today(), items: [], categories: cats, locations: locs })]; }
    case 'meal_waiver': return [T.mealWaiver(p)];
    case 'attestation_policy': return [T.attestationPolicy(p)];
  }
  return [];
};
const NEED_DATA = new Set(['wage_letter', 'wage_letter_es', 'paga_cure', 'eec', 'corrected_ws', 'reclass', 'waiting_time', 'training_memo']);
async function genDocx(key, label) {
  if (NEED_DATA.has(key) && !S.result) { toast('Run an audit first.'); return; }
  const m = X.genDoc(key); if (!m.length) { toast('Nothing to generate for this audit.'); return; }
  await X.saveDocx(m, `aldune-${key}-${iso()}.docx`); X.log('report.generated', { report: label || key, documents: m.length });
}

// ======================================================= Solutions Center
VIEWS.solutions = el => {
  const pbs = PC.playbooks(S.input, S.result); const bp = PC.backPay(S.input, S.result, { interestRate: 0.1, includeLiquidated: false, through: S.result.engine.meta.assumptions.auditDate, excludeFindingIds: Object.entries(S.ws?.status || {}).filter(([, v]) => ['dismissed', 'remediated'].includes(v.s)).map(([k]) => k) });
  const notice = S.profile?.noticeDate; const small = headcount() < 100;
  const due = notice ? new Date(new Date(notice + 'T00:00:00').getTime() + 33 * 864e5) : null; const left = due ? Math.ceil((due - Date.now()) / 864e5) : null;
  el.innerHTML = head('Solutions Center', 'Every problem the audit found, turned into a plan: what to pay, what to fix, what to send, and the law behind each step. Generate the documents directly from your data.') + `
    <div class="kpis"><div class="kpi risk"><div class="v">${approx(bp.totals.total)}</div><div class="k">Back pay owed now to ${bp.totals.employees} workers (wages, premiums, reimbursement, 10% interest)</div></div><div class="kpi"><div class="v">${pbs.length}</div><div class="k">Problem areas with a playbook</div></div><div class="kpi"><div class="v">${(S.ws?.tasks || []).filter(t => t.status !== 'Done').length}</div><div class="k">Open remediation tasks</div></div><div class="kpi"><div class="v">${Object.values(S.ws?.status || {}).filter(v => v.s === 'remediated').length}</div><div class="k">Findings marked remediated</div></div></div>
    <div class="row" style="margin:14px 0"><button class="btn primary" data-act="go" data-to="backpay">Open the back-pay planner</button><button class="btn" data-act="sol-tasks">Create tasks for every playbook</button><button class="btn" data-act="sol-all-docs">Download policy and training kit</button></div>
    <div class="sol" style="border-left:5px solid var(--marker)"><h3>Received a PAGA notice?</h3>
      <div class="cols"><div><b>Your path</b><p class="small">${notice ? `Notice date ${fdate(notice)}. ` : ''}${small ? `With fewer than 100 employees, you can submit a <b>confidential proposal to cure</b> to the LWDA within 33 days. The LWDA may hold a conference within 14 days, and the cure must be completed within 45 days of the conference.` : 'With 100 or more employees, you can request a <b>stay and an early evaluation conference</b> when served with a PAGA complaint, stating which violations you will cure and which you dispute.'}</p>${left !== null ? `<div class="countdown" style="color:${left < 7 ? 'var(--flag)' : 'var(--ink)'}">${left > 0 ? `${left} days` : 'Deadline passed'}</div><p class="small muted">to submit a cure proposal (33 days from ${fdate(notice)})</p>` : '<p class="small muted">Add the notice date on the PAGA exposure page to start the countdown.</p>'}</div>
      <div><b>What a cure requires</b><ul class="small"><li>Three years of unpaid wages before the notice</li><li>7% interest</li><li>Statutory liquidated damages where applicable</li><li>Reasonable attorney’s fees and costs</li><li>Corrected practices; wage statements corrected for three years</li></ul></div>
      <div><b>Generate</b><div class="row"><button class="btn primary" data-act="sol-doc" data-k="${small ? 'paga_cure' : 'eec'}">${small ? 'Cure proposal (Word)' : 'Early evaluation statement (Word)'}</button><button class="btn" data-act="go" data-to="backpay">Back pay at 7%</button><button class="btn" data-act="sol-doc" data-k="corrected_ws">Corrected wage statement notices</button></div><p class="small">${lawChip('paga-cure')} ${lawChip('paga-2024')}</p></div></div></div>
    ${pbs.map(p => `<div class="sol"><div class="row" style="justify-content:space-between;align-items:baseline"><h3>${esc(p.label)}</h3><span class="small">${p.findings.toLocaleString()} records · ${p.workers} workers${p.owed ? ` · <b>${money(p.owed)}</b> owed before interest` : ''}</span></div>
      <p class="small" style="margin-top:6px">${esc(p.why)}</p><p>${p.law.map(lawChip).join('')}</p>
      <div class="cols"><div><b>Pay now</b><ul class="small">${p.immediate.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div><div><b>Fix the cause</b><ul class="small">${p.fix.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div><div><b>Prevent recurrence</b><ul class="small">${p.prevent.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div></div>
      <div class="row" style="margin-top:10px">${p.documents.map(d => `<button class="btn" data-act="sol-doc" data-k="${d.key}">${esc(d.label)}</button>`).join('')}<button class="btn primary" data-act="sol-task" data-c="${p.category}">Create tasks</button><button class="btn" data-act="sol-findings" data-c="${p.category}">See findings</button></div></div>`).join('') || '<div class="muted-box">No problem areas found.</div>'}
    <p class="small muted">Drafts for counsel. Paying wages owed should not be conditioned on a release (Lab. Code § 206.5). In a pending class action, coordinate any individual settlements with counsel (Chindarah v. Pick Up Stix).</p>`;
};

// ======================================================= Back-pay planner
S.bp = { rate: 0.1, liq: false, through: '' };
const bpPlan = () => PC.backPay(S.input, S.result, { interestRate: S.bp.rate, includeLiquidated: S.bp.liq, through: S.bp.through || S.result.engine.meta.assumptions.auditDate, excludeFindingIds: Object.entries(S.ws?.status || {}).filter(([, v]) => ['dismissed', 'remediated'].includes(v.s)).map(([k]) => k) });
VIEWS.backpay = el => {
  const plan = bpPlan(); const t = plan.totals;
  el.innerHTML = head('Back-pay planner', 'What each worker is owed, ready to pay through payroll. Dismissed and already-remediated findings are excluded. Penalties are claims, not wages, and are not included.') + `
    <div class="panel"><div class="grid g3"><label class="field">Interest<select id="bp-rate"><option value="0.1" ${S.bp.rate === 0.1 ? 'selected' : ''}>10% — prejudgment interest (Lab. Code § 218.6)</option><option value="0.07" ${S.bp.rate === 0.07 ? 'selected' : ''}>7% — PAGA cure (Lab. Code § 2699)</option><option value="0" ${S.bp.rate === 0 ? 'selected' : ''}>No interest</option></select></label>
      <label class="field">Interest through<input type="date" id="bp-through" value="${esc(S.bp.through || S.result.engine.meta.assumptions.auditDate)}"></label>
      <label class="check" style="margin-top:22px"><input type="checkbox" id="bp-liq" ${S.bp.liq ? 'checked' : ''}> Include liquidated damages on minimum-wage shortfalls (§ 1194.2)</label></div></div>
    <div class="kpis" style="margin-top:14px"><div class="kpi risk"><div class="v">${money(t.total)}</div><div class="k">${t.employees} workers</div></div><div class="kpi"><div class="v">${money(t.wages + t.premiums)}</div><div class="k">W-2 wages and premiums (withholding applies)</div></div><div class="kpi"><div class="v">${money(t.reimbursement)}</div><div class="k">Non-taxable reimbursement</div></div><div class="kpi"><div class="v">${money(t.interest + t.liquidated)}</div><div class="k">Interest${t.liquidated ? ' and liquidated damages' : ''}</div></div></div>
    <div class="row" style="margin:14px 0"><button class="btn primary" data-act="bp-csv">Payroll file (CSV)</button><button class="btn" data-act="bp-xlsx">Back-pay workbook (Excel)</button><button class="btn" data-act="sol-doc" data-k="wage_letter">Letters — English</button><button class="btn" data-act="sol-doc" data-k="wage_letter_es">Letters — Spanish</button><button class="btn" data-act="bp-paid">Mark all as paid</button></div>
    <div class="tablewrap"><table><thead><tr><th>Worker</th><th>Status</th><th class="n">Wages</th><th class="n">Premiums</th><th class="n">Reimbursement</th><th class="n">${t.liquidated ? 'Liquidated' : ''}</th><th class="n">Interest</th><th class="n">Total</th><th></th></tr></thead><tbody>${plan.rows.slice(0, 400).map(r => `<tr><td><b>${esc(r.name)}</b><div class="cite">${esc(r.employeeId)} · ${esc(r.location || '')} · ${r.findings} findings</div></td><td class="small">${r.terminated ? '<span class="chip warn">Former</span>' : 'Current'}</td><td class="n">${money(r.wages, true)}</td><td class="n">${money(r.premiums, true)}</td><td class="n">${money(r.reimbursement, true)}</td><td class="n">${r.liquidated ? money(r.liquidated, true) : ''}</td><td class="n">${money(r.interest, true)}</td><td class="n"><b>${money(r.total, true)}</b></td><td><button class="btn" data-act="bp-one" data-id="${esc(r.employeeId)}">Letter</button> <button class="btn" data-act="bp-paid-one" data-id="${esc(r.employeeId)}">Paid</button></td></tr>`).join('')}</tbody></table></div>
    <div class="panel" style="margin-top:14px"><b>Legal basis</b><ul class="small">${plan.basis.map(b => `<li>${esc(b)}</li>`).join('')}</ul><p class="small">Former employees: send payment to the last known address; unclaimed wages go to the Labor Commissioner. Interest is reported on Form 1099-INT; consult your tax advisor about liquidated damages.</p><p>${lawChip('settlements')}${lawChip('fees-interest')}${lawChip('paga-cure')}</p></div>`;
  $('#bp-rate').addEventListener('change', e => { S.bp.rate = Number(e.target.value); X.render(); });
  $('#bp-through').addEventListener('change', e => { S.bp.through = e.target.value; X.render(); });
  $('#bp-liq').addEventListener('change', e => { S.bp.liq = e.target.checked; X.render(); });
};
function markPaid(ids) {
  const owedKinds = ['wages', 'premium', 'reimbursement', 'liquidated']; let n = 0;
  for (const id of ids) for (const f of (S.findingsBy.get(id) || [])) {
    if (f.confidence === 'low' || f.premiumIndicated || f.amount <= 0 || !owedKinds.includes(f.amountKind)) continue;
    const prev = S.ws.status[f.id]?.s || 'open'; if (prev === 'remediated' || prev === 'dismissed') continue;
    S.ws.status[f.id] = { s: 'remediated', reason: `Paid through back-pay plan ${iso()}`, at: new Date().toISOString() }; (S.ws.history[f.id] = S.ws.history[f.id] || []).push({ from: prev, s: 'remediated', reason: `Paid ${iso()}`, at: new Date().toISOString() }); S.status[f.id] = 'remediated'; n++;
  }
  if (S.scenario) S.scenario.excludeFindingIds = Object.entries(S.ws.status).filter(([, v]) => ['dismissed', 'disputed', 'remediated'].includes(v.s)).map(([k]) => k);
  X.saveWs(); X.log('finding.status', { id: `${n} findings`, from: 'open', to: 'remediated', reason: 'Back pay paid' });
  toast(`${n} findings marked remediated`); X.render();
}

// ======================================================= Letters and packets: add the new templates
const NEW_TPL = [['wage_letter_es', 'Wage payment letters — Spanish', 'Spanish version of the unconditional wage letter with calculation exhibit.'], ['paga_cure', 'PAGA cure proposal (fewer than 100 employees)', 'Confidential proposal to the LWDA within 33 days: violations, corrective actions, payments, 7% interest, timeline.'], ['eec', 'Early evaluation conference statement (100+ employees)', 'Outline of violations to cure, allegations disputed, cure plan, and reasonable steps.'], ['corrected_ws', 'Corrected wage statement notices', 'Cover notices for corrected statements (§ 226; three-year cure).'], ['reclass', 'Reclassification notices', 'For workers who may be misclassified as exempt.'], ['waiting_time', 'Final wages / waiting-time letters', 'Payments to former employees under §§ 201–203.'], ['meal_rest_policy', 'Meal and rest period policy', 'Brinker/Augustus/Donohue-compliant policy with acknowledgment.'], ['expense_policy', 'Expense reimbursement policy', '§ 2802 including phones and mileage.'], ['timekeeping_policy', 'Timekeeping and off-the-clock policy', 'Pay to the minute; no off-the-clock work.'], ['training_memo', 'Supervisor training memo', 'Built from the Detective’s patterns; supports reasonable steps.'], ['payroll_memo', 'Payroll configuration memo', 'Regular rate, automatic premiums, § 226 items, local minimum wages.']];
const origDocs = VIEWS.documents;
VIEWS.documents = el => {
  origDocs(el);
  const host = el.querySelector('.panel'); if (!host) return;
  host.insertAdjacentHTML('beforeend', `<p class="small muted" style="margin:10px 0 6px">Remediation templates</p>${NEW_TPL.map(([k, n, d]) => `<div style="padding:8px;border:1px solid var(--line);border-radius:6px;margin-bottom:6px;display:flex;justify-content:space-between;gap:10px;align-items:center"><span><b>${n}</b><br><span class="small muted">${d}</span></span><button class="btn" data-act="sol-doc" data-k="${k}">Word</button></div>`).join('')}`);
  el.querySelectorAll('[data-act="dg-es"]').forEach(b => { b.textContent = 'Spanish letters (Word)'; b.dataset.act = 'sol-doc'; b.dataset.k = 'wage_letter_es'; });
};

// ======================================================= built-in document review (no AI service needed)
function builtinReview(d) {
  const set = PC.CHECKS[d.type === 'other' ? 'handbook' : d.type]; const text = d.text; const sentences = text.split(/(?<=[.;:])\s+/);
  const quoteFor = re => { const s = sentences.find(x => re.test(x)); return s ? s.trim().split(/\s+/).slice(0, 25).join(' ') : ''; };
  const issues = []; const strengths = [];
  for (const [re, label, why] of set.items) {
    const found = re.test(text); const risk = /\(risk\)|\(check/i.test(label);
    if (risk && found) issues.push({ severity: 'high', topic: label.replace(/\s*\((risk|check[^)]*)\)/i, ''), problem: why, quote: quoteFor(re), fix: 'Remove or revise this language; confirm with counsel.' });
    else if (!risk && !found) issues.push({ severity: /PAGA|EFAA|Armendariz|206\.5|12964|six|twelve|Revocable/i.test(label) ? 'high' : 'medium', topic: label, problem: `Not found in the document. ${why}`, quote: '', fix: 'Add a clause addressing this requirement, or confirm it appears in different words.' });
    else if (!risk && found) strengths.push(label);
  }
  return { summary: `Built-in review of this ${PC.DOC_LABELS[d.type] || 'document'} against ${set.items.length} California requirements: ${issues.filter(i => i.severity === 'high').length} high-priority and ${issues.filter(i => i.severity !== 'high').length} other items to address. Keyword checks can miss differently worded clauses — confirm each with counsel.`, issues, strengths, builtin: true };
}
const origReview = X.reviewDoc;
X.reviewDoc = async i => { if (X.aiMode() === 'builtin') { S.docs[i].review = builtinReview(S.docs[i]); X.log('document.ai_review', { name: S.docs[i].name }); X.render(); return; } return origReview(i); };
const origReviewView = VIEWS.review;
VIEWS.review = el => { origReviewView(el); if (X.aiMode() === 'builtin') el.querySelectorAll('[data-act="rv-ai"]').forEach(b => { b.textContent = 'Run built-in review'; }); };

// ======================================================= law library (categories, statute index, rules, solutions)
S.lawTab = S.lawTab || 'topics'; S.lawCat = S.lawCat || '';
VIEWS.law = el => {
  const cats = PC.LAW_CATEGORIES || [...new Set(PC.LAW.map(t => t.category))];
  const ruleFor = id => Object.values(PC.RULES).find(r => r.id === id);
  el.innerHTML = head('California wage-and-hour law library', `${PC.LAW.length} topics with statutes, cases, effective dates, and verification dates — the closed knowledge base the assistant answers from, and the authority behind every Aldune rule and solution. Legal information, not legal advice.`) + `
    <div class="row" style="margin-bottom:12px"><div class="seg">${[['topics', 'Topics'], ['index', 'Statute and case index'], ['rules', 'Rules ↔ law']].map(([k, l]) => `<button data-act="law-tab" data-t="${k}" aria-pressed="${S.lawTab === k}">${l}</button>`).join('')}</div><label class="field" style="flex:1;max-width:420px"><span class="sr">Search</span><input id="law-q" placeholder="Search: second meal, Los Angeles minimum wage, PAGA cure, vacation payout"></label></div>
    <div id="law-body"></div>`;
  const body = $('#law-body');
  const topicHtml = t => `<details class="law" id="law-${esc(t.id)}" ${S.lawOpen === t.id ? 'open' : ''}><summary>${esc(t.title)} <span class="cite">${esc(t.category || '')}</span>${t.status ? ' <span class="chip warn">note</span>' : ''}</summary><p>${esc(t.summary)}</p><ul class="small">${t.points.map(p => `<li>${esc(p)}</li>`).join('')}</ul>${t.status ? `<p class="note small">${esc(t.status)}</p>` : ''}<p class="cite">${t.citations.map(esc).join(' · ')}</p><p class="small muted">Verified ${esc(t.verified)}${t.engineRule ? ` · applied by rule <b>${esc(ruleFor(t.engineRule)?.name || t.engineRule)}</b> (${esc(ruleFor(t.engineRule)?.version || '')})` : ''}${S.result && t.remedies ? ' · <button class="btn" data-act="go" data-to="solutions">Related solutions</button>' : ''}</p></details>`;
  const draw = q => {
    if (S.lawTab === 'index') { const idx = new Map(); PC.LAW.forEach(t => t.citations.forEach(c => { const l = idx.get(c) || []; l.push(t); idx.set(c, l); })); const rows = [...idx.entries()].filter(([c]) => !q || c.toLowerCase().includes(q.toLowerCase())).sort((a, b) => a[0].localeCompare(b[0])); body.innerHTML = `<div class="tablewrap"><table><thead><tr><th>Authority</th><th>Topics</th></tr></thead><tbody>${rows.map(([c, ts]) => `<tr><td class="small">${esc(c)}</td><td>${ts.map(t => lawChip(t.id)).join('')}</td></tr>`).join('')}</tbody></table></div>`; return; }
    if (S.lawTab === 'rules') { body.innerHTML = `<div class="tablewrap"><table><thead><tr><th>Aldune rule</th><th>Version · effective</th><th>Authorities</th><th>Law library</th></tr></thead><tbody>${Object.values(PC.RULES).map(r => `<tr><td><b>${esc(r.name)}</b><div class="cite">${esc(r.calculation)}</div></td><td class="small">${esc(r.version)} · ${esc(r.effectiveDate)}</td><td class="cite">${r.authorities.map(esc).join('<br>')}</td><td>${PC.LAW.filter(t => t.engineRule === r.id).map(t => lawChip(t.id)).join('')}</td></tr>`).join('')}</tbody></table></div>`; return; }
    const list = q ? PC.searchLaw(q, 15).map(h => h.topic) : PC.LAW.filter(t => !S.lawCat || t.category === S.lawCat);
    body.innerHTML = `<div class="lawgrid"><nav class="lawnav" aria-label="Law categories"><button data-act="law-cat" data-c="" aria-pressed="${!S.lawCat}">All topics (${PC.LAW.length})</button>${cats.map(c => `<button data-act="law-cat" data-c="${esc(c)}" aria-pressed="${S.lawCat === c}">${esc(c)} (${PC.LAW.filter(t => t.category === c).length})</button>`).join('')}</nav><div>${list.map(topicHtml).join('') || '<p class="muted">No matching topic in the knowledge base.</p>'}</div></div>`;
  };
  draw(''); $('#law-q').addEventListener('input', e => draw(e.target.value.trim()));
  if (S.lawOpen) setTimeout(() => { const d = document.getElementById(`law-${S.lawOpen}`); if (d) d.scrollIntoView({ behavior: 'smooth' }); }, 50);
};

// ======================================================= PAGA notice analyzer (in Review documents)
const origRev2 = VIEWS.review;
VIEWS.review = el => {
  origRev2(el);
  const notices = S.docs.map((d, i) => ({ d, i })).filter(x => x.d.type === 'paga_notice');
  if (!notices.length) return;
  el.insertAdjacentHTML('afterbegin', notices.map(({ d, i }) => { const n = PC.analyzeNotice(d.text, S.result); const small = headcount() < 100; const left = n.deadlines ? Math.ceil((new Date(n.deadlines.cure + 'T00:00:00') - Date.now()) / 864e5) : null;
    return `<div class="sol" style="border-left:5px solid var(--flag)"><div class="row" style="justify-content:space-between"><h3>PAGA notice analysis — ${esc(d.name)}</h3>${left !== null ? `<span class="countdown" style="color:${left < 7 ? 'var(--flag)' : 'var(--ink)'}">${left > 0 ? `${left} days to cure` : 'Cure window passed'}</span>` : ''}</div>
      <p class="small">${n.claimant ? `Aggrieved employee: <b>${esc(n.claimant)}</b> · ` : ''}${n.noticeDate ? `Notice dated ${fdate(n.noticeDate)} · cure/proposal deadline <b>${fdate(n.deadlines.cure)}</b> · earliest lawsuit <b>${fdate(n.deadlines.suit)}</b>` : 'Notice date not found — enter it on the PAGA exposure page.'} · ${PC.pagaRegimeFor(n.noticeDate || undefined) === 'post2024' ? 'Amended PAGA (2024) applies' : 'Prior PAGA applies'}</p>
      <p class="small muted">${esc(n.specificity)}</p>
      <div class="tablewrap"><table><thead><tr><th>Labor Code</th><th>Allegation</th><th>Curable</th><th class="n">Issues in your data</th><th class="n">Amount</th><th>Assessment</th></tr></thead><tbody>${n.allegations.map(a => `<tr><td><b>§ ${esc(a.section)}</b></td><td>${esc(a.title)} <span class="lawchip" data-act="law-open" data-id="${esc(a.topic)}">law</span></td><td>${a.curable ? '<span class="chip ok">Yes</span>' : '<span class="chip">Limited</span>'}</td><td class="n">${a.tested ? a.findings.toLocaleString() : '—'}</td><td class="n">${a.tested && S.result ? money(a.amount) : '—'}</td><td class="small">${esc(a.assessment)}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">No Labor Code sections identified.</td></tr>'}</tbody></table></div>
      <div class="row" style="margin-top:10px">${n.noticeDate ? `<button class="btn" data-act="notice-date" data-date="${n.noticeDate}">Use this notice date</button>` : ''}<button class="btn primary" data-act="sol-doc" data-k="${small ? 'paga_cure' : 'eec'}">${small ? 'Draft cure proposal' : 'Draft early evaluation statement'}</button><button class="btn" data-act="go" data-to="backpay">Back pay at 7%</button><button class="btn" data-act="go" data-to="paga">PAGA exposure</button>${S.result ? '' : '<button class="btn" data-act="go" data-to="import">Load payroll data to test each allegation</button>'}</div></div>`; }).join(''));
};

// ======================================================= settlement allocation calculator (in Settlement valuation)
S.alloc = S.alloc || { gross: 500000, feesPct: 33.33, costs: 20000, admin: 15000, serviceAwards: 10000, pagaAmount: 50000, excludeArbitration: false };
const origSettle = VIEWS.settlement;
VIEWS.settlement = el => {
  origSettle(el); const a = S.alloc; const reg = S.scenario?.pagaRegime || 'post2024';
  const r = PC.allocateSettlement(S.input, S.result, { ...a, regime: reg }); const sm = r.summary;
  const f = (k, l, step = 1000) => `<label class="field">${l}<input type="number" step="${step}" data-al="${k}" value="${a[k]}"></label>`;
  el.insertAdjacentHTML('beforeend', `<div class="panel" style="margin-top:16px"><h3 style="margin-top:0">Settlement allocation</h3><p class="small muted">Split a proposed gross settlement and see what each class member receives — the numbers counsel, the mediator, and the court will look at.</p>
    <div class="grid g3">${f('gross', 'Gross settlement ($)', 10000)}${f('feesPct', 'Attorney’s fees (% of gross)', 0.01)}${f('costs', 'Litigation costs ($)')}${f('admin', 'Administration ($)')}${f('serviceAwards', 'Service awards ($)')}${f('pagaAmount', 'PAGA allocation ($)')}</div>
    <label class="check" style="margin-top:8px"><input type="checkbox" id="al-arb" ${a.excludeArbitration ? 'checked' : ''}> Exclude workers with arbitration agreements from the class</label>
    <table style="margin-top:12px"><tbody><tr><td>Attorney’s fees</td><td class="n">${money(sm.fees)}</td></tr><tr><td>Costs, administration, service awards</td><td class="n">${money(sm.costs + sm.admin + sm.serviceAwards)}</td></tr><tr><td>PAGA: LWDA (${100 - sm.employeeSharePct}%) / employees (${sm.employeeSharePct}%)</td><td class="n">${money(sm.lwda)} / ${money(sm.pagaEmployees)}</td></tr><tr><td><b>Net class fund</b></td><td class="n"><b>${money(sm.netClass)}</b></td></tr><tr><td>Participating members · average payment</td><td class="n">${sm.members} · ${money(sm.avg, true)}</td></tr></tbody></table>
    <div class="tablewrap" style="margin-top:10px;max-height:320px;overflow-y:auto"><table><thead><tr><th>Worker</th><th class="n">Workweeks</th><th class="n">Class share</th><th class="n">PAGA pay periods</th><th class="n">PAGA share</th><th class="n">Total</th></tr></thead><tbody>${r.rows.slice(0, 300).map(x => `<tr><td>${esc(x.name)}<div class="cite">${esc(x.employeeId)}</div></td><td class="n">${x.workweeks}</td><td class="n">${money(x.classShare, true)}</td><td class="n">${x.pagaPeriods}</td><td class="n">${money(x.pagaShare, true)}</td><td class="n"><b>${money(x.total, true)}</b></td></tr>`).join('')}</tbody></table></div>
    <ul class="small" style="margin-top:8px">${r.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>
    <div class="row"><button class="btn primary" data-act="al-csv">Allocation schedule (CSV)</button><button class="btn" data-act="go" data-to="documents">Settlement packets</button></div></div>`);
  el.querySelectorAll('[data-al]').forEach(i => i.addEventListener('change', e => { a[e.target.dataset.al] = Math.max(0, Number(e.target.value) || 0); X.render(); }));
  const arb = $('#al-arb'); if (arb) arb.addEventListener('change', e => { a.excludeArbitration = e.target.checked; X.render(); });
};

// ======================================================= accessibility: focus trap in drawers
document.addEventListener('keydown', e => {
  if (e.key !== 'Tab') return;
  const open = [...document.querySelectorAll('.drawer.open')].pop(); if (!open) return;
  const f = [...open.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])')].filter(x => x.offsetParent !== null);
  if (!f.length) return; const first = f[0], last = f[f.length - 1];
  if (!open.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
  else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});

// ======================================================= events
document.addEventListener('click', async e => {
  const a = e.target.closest('[data-act]'); if (!a) return; const d = a.dataset;
  try {
    switch (d.act) {
      case 'sol-doc': await genDocx(d.k, NEW_TPL.find(x => x[0] === d.k)?.[1]); break;
      case 'as-action': { const ac = PC.ACTIONS[d.k]; if (!ac) break; const panel = $('#as-panel'); if (panel) { panel.classList.remove('open'); panel.setAttribute('aria-hidden', 'true'); }
        if (ac.needsAudit && !S.result) { toast('Load your data first — this tool works on your audit.'); X.setView('import'); break; }
        if (ac.kind === 'view') { X.setView(ac.target); break; }
        if (ac.kind === 'tpl') { S.dg.tpl = ac.target; S.dg.preview = ''; X.setView('documents'); toast('Fill in the case details, select workers, then preview or download.'); break; }
        await genDocx(ac.target, ac.label); break; }
      case 'sol-all-docs': { const m = ['meal_rest_policy', 'expense_policy', 'timekeeping_policy', 'attestation_policy', 'meal_waiver', 'training_memo', 'payroll_memo'].flatMap(k => X.genDoc(k)); await X.saveDocx(m, `aldune-policy-kit-${iso()}.docx`); X.log('report.generated', { report: 'Policy and training kit' }); break; }
      case 'sol-task': { const p = PC.playbooks(S.input, S.result).find(x => x.category === d.c); const have = new Set(S.ws.tasks.map(t => t.title)); p.tasks.filter(t => !have.has(`${p.label}: ${t}`)).forEach((t, i) => S.ws.tasks.unshift({ title: `${p.label}: ${t}`, category: p.category, rec: [...p.immediate, ...p.fix][i] || '', status: 'Open', priority: i === 0 ? 'High' : 'Medium', due: new Date(Date.now() + (i + 1) * 14 * 864e5).toISOString().slice(0, 10), createdAt: new Date().toISOString() })); X.saveWs(); toast('Tasks added to the Remediation center'); X.log('task.created', { title: `${p.label} playbook tasks` }); break; }
      case 'sol-tasks': { for (const p of PC.playbooks(S.input, S.result)) { const have = new Set(S.ws.tasks.map(t => t.title)); p.tasks.filter(t => !have.has(`${p.label}: ${t}`)).forEach((t, i) => S.ws.tasks.unshift({ title: `${p.label}: ${t}`, category: p.category, rec: [...p.immediate, ...p.fix][i] || '', status: 'Open', priority: i === 0 ? 'High' : 'Medium', due: new Date(Date.now() + (i + 1) * 14 * 864e5).toISOString().slice(0, 10), createdAt: new Date().toISOString() })); } X.saveWs(); toast('Tasks created for every playbook'); X.setView('remediation'); break; }
      case 'sol-findings': Object.assign(S.fq, { cat: d.c, emp: '', dim: '', page: 1 }); X.setView('findings'); break;
      case 'notice-date': S.profile = { ...(S.profile || {}), noticeDate: d.date }; if (S.scenario) S.scenario.pagaRegime = PC.pagaRegimeFor(d.date); X.persist(); toast(`Notice date set to ${fdate(d.date)}`); X.render(); break;
      case 'al-csv': { const r = PC.allocateSettlement(S.input, S.result, { ...S.alloc, regime: S.scenario?.pagaRegime || 'post2024' }); await X.save(`aldune-settlement-allocation-${iso()}.csv`, ['employee_id,name,workweeks,class_share,paga_pay_periods,paga_share,total', ...r.rows.map(x => [x.employeeId, `"${x.name.replace(/"/g, '""')}"`, x.workweeks, x.classShare.toFixed(2), x.pagaPeriods, x.pagaShare.toFixed(2), x.total.toFixed(2)].join(','))].join('\n')); break; }
      case 'law-open': S.lawOpen = d.id; S.lawTab = 'topics'; S.lawCat = ''; X.setView('law'); break;
      case 'law-tab': S.lawTab = d.t; X.render(); break;
      case 'law-cat': S.lawCat = d.c; S.lawOpen = null; X.render(); break;
      case 'bp-csv': { const plan = bpPlan(); const q = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }; await X.save(`aldune-backpay-payroll-${iso()}.csv`, ['employee_id,employee_name,earnings_code,description,amount,tax_treatment', ...plan.lines.map(l => [l.employeeId, l.name, l.code, l.description, l.amount.toFixed(2), l.taxTreatment].map(q).join(','))].join('\n')); X.log('report.generated', { report: 'Back-pay payroll file' }); break; }
      case 'bp-xlsx': { const plan = bpPlan(); const XL = PC.XLSX; const wb = XL.utils.book_new(); XL.utils.book_append_sheet(wb, XL.utils.json_to_sheet(plan.rows.map(r => ({ employee_id: r.employeeId, name: r.name, location: r.location, former: r.terminated, wages: r.wages, premiums: r.premiums, reimbursement: r.reimbursement, liquidated: r.liquidated, interest: r.interest, total: r.total }))), 'By worker'); XL.utils.book_append_sheet(wb, XL.utils.json_to_sheet(plan.lines), 'Payroll lines'); XL.utils.book_append_sheet(wb, XL.utils.json_to_sheet(plan.basis.map(b => ({ legal_basis: b }))), 'Basis'); await X.save(`aldune-backpay-${iso()}.xlsx`, new Blob([XL.write(wb, { bookType: 'xlsx', type: 'array' })])); break; }
      case 'bp-one': { const m = X.genDoc('wage_letter', { ids: [d.id] }); if (m.length) await X.saveDocx(m, `wage-letter-${d.id}.docx`); break; }
      case 'bp-paid': if (confirm('Mark every finding in this plan as remediated (paid)? You can change any finding’s status later.')) markPaid(bpPlan().rows.map(r => r.employeeId)); break;
      case 'bp-paid-one': markPaid([d.id]); break;
    }
  } catch (err) { toast(err && err.message ? err.message : 'Something went wrong.'); }
});
})();
