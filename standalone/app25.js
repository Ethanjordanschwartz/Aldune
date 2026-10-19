/* Aldune — part 25: honest incomplete audits, perspective (defense/plaintiff), pre-filled Fix queue, simpler privilege, motion homepage */
(() => {
'use strict';
const X = window.PCX; const { PC, S, $, esc, money, toast, VIEWS } = X;
const iso = () => new Date().toISOString().slice(0, 10);

// ---------- citations: always shown where needed (remove the toggle)
document.getElementById('cite-toggle')?.remove(); document.body.classList.remove('plain'); S.cfg.plain = false; try { localStorage.removeItem('paycure:plain'); } catch { /* ignore */ }

// ======================================================= Incomplete audits: never imply compliance that wasn’t tested
const scOf = () => (S.result && S.input ? PC.scorecard(S.input, S.result) : null);
function gapBanner(sc) {
  const noTime = !S.input.timeRecords.length;
  return `<div class="panel" style="border-left:5px solid var(--warn);margin:0 0 14px"><div class="row" style="justify-content:space-between;align-items:center"><h3 style="margin:0">Incomplete audit — ${sc.coverage}% of compliance areas could be tested</h3><button class="btn primary" data-act="go" data-to="import">Add the missing records</button></div>
    <p class="small" style="margin:6px 0">${noTime ? 'Your files contain pay totals but no time records, so meal periods, rest breaks, overtime, and minimum wage <b>could not be checked</b>. The exposure shown covers only what your records allow — it is <b>not</b> a finding that you are compliant.' : 'Some areas could not be checked with the records provided. Results cover only the tested areas.'}</p>
    <table><tbody>${sc.missing.slice(0, 8).map(m => `<tr><td class="small"><b>${esc(m.area)}</b></td><td class="small">Needs ${esc(m.need)}</td></tr>`).join('')}</tbody></table>
    <p class="small muted" style="margin:6px 0 0">Tip: export time punches (with meal punches) and a payroll register from your POS or payroll system — Import reads them in any layout.</p></div>`;
}
const baseExec = VIEWS.exec;
VIEWS.exec = el => {
  baseExec(el); if (!S.result) return; const sc = scOf(); if (!sc) return;
  if (sc.overall === null || !S.input.timeRecords.length) {
    el.querySelector('.kpis')?.insertAdjacentHTML('beforebegin', gapBanner(sc));
    if (!S.input.timeRecords.length) el.querySelectorAll('.kpi').forEach(k => { const lab = k.querySelector('.k')?.textContent || ''; if (/exposure|owed/i.test(lab)) { const v = k.querySelector('.v'); if (v) v.innerHTML = '<span style="font-size:22px">Not assessed</span>'; } });
  }
  el.querySelectorAll('[data-to="scorecard"]').forEach(b => { if (sc.overall === null) b.innerHTML = 'Compliance grade: <b>Incomplete</b> — see what’s missing'; });
  el.querySelectorAll('[data-act="go"][data-to="documents"]').forEach(b => { if (/Fix what/.test(b.textContent)) b.dataset.to = 'fixqueue'; });
};
const baseScore = VIEWS.scorecard;
VIEWS.scorecard = el => { baseScore(el); const sc = scOf(); if (sc && sc.overall === null) el.querySelector('.kpis')?.insertAdjacentHTML('beforebegin', gapBanner(sc)); };
const baseHome = VIEWS.home;
VIEWS.home = el => { baseHome(el); if (!S.result || !S.input) return; const sc = scOf(); if (sc && (sc.overall === null || !S.input.timeRecords.length)) el.querySelector('h1')?.insertAdjacentHTML('afterend', gapBanner(sc)); };

// ======================================================= Perspective: employer (defense) or employees (plaintiff)
S.pov = S.pov || 'defense';
function setPov(v) { S.pov = v; S.lit = S.lit || {}; S.lit.side = v; S.scenarioPerspective = v === 'plaintiff' ? 'plaintiff' : 'defense'; X.persist(); X.render(); toast(v === 'plaintiff' ? 'Viewing as employee counsel — claims, evidence, and damages.' : 'Viewing as the employer — fixes, cure, and defense.'); }
const POV = () => `<div class="seg" style="margin:0 0 12px" role="group" aria-label="Perspective"><button data-act="pov" data-v="defense" aria-pressed="${S.pov !== 'plaintiff'}">Employer / defense</button><button data-act="pov" data-v="plaintiff" aria-pressed="${S.pov === 'plaintiff'}">Employee counsel / plaintiff</button></div>`;
const withPov = name => { const base = VIEWS[name]; VIEWS[name] = el => { base(el); el.querySelector('h1')?.insertAdjacentHTML('afterend', POV()); }; };
['exec', 'import', 'solutions', 'litigation'].forEach(withPov);
// plaintiff case builder (Solutions in plaintiff view)
const baseSol = VIEWS.solutions;
VIEWS.solutions = el => {
  baseSol(el); if (S.pov !== 'plaintiff' || !S.result) return;
  const cats = S.result.categories.filter(c => c.base > 0).sort((a, b) => b.base - a.base);
  const v = PC.valueClaims({ ...(S.lit?.inputs || PC.LIT_DEFAULTS) }); const n = PC.negotiation(v, 'plaintiff');
  el.querySelector('h1')?.parentElement?.querySelectorAll('.sol').forEach(x => { x.style.display = 'none'; });
  el.querySelector('.seg')?.insertAdjacentHTML('afterend', `<div class="panel" style="border-left:5px solid var(--ledger)"><h3 style="margin-top:0">Case builder</h3>
    <p class="small">What the records support, what to request, and what to demand.</p>
    <table><thead><tr><th>Claim supported by the records</th><th class="n">Records</th><th class="n">Workers</th><th class="n">Value</th></tr></thead><tbody>${cats.map(c => `<tr><td class="small"><b>${esc(c.label)}</b></td><td class="n">${c.findings.toLocaleString()}</td><td class="n">${c.employees}</td><td class="n">${money(c.base)}</td></tr>`).join('')}</tbody></table>
    <h3>Records to request now</h3><ul class="small"><li>Wage statements and time and payroll records — 21 days (Lab. Code § 226(b)–(c)); $750 penalty for failure (§ 226(f)).</li><li>Personnel file — 30 days (§ 1198.5); $750 penalty (§ 1198.5(k)).</li><li>Signed instruments, including arbitration agreements (§ 432).</li></ul>
    <h3>Opening demand</h3><p><b>${money(n.plaintiffOpening)}</b> <span class="small muted">— realistic exposure before risk discounts; expected settlement range ${money(n.expectedLow)}–${money(n.expectedHigh)}.</span></p>
    <div class="row"><button class="btn primary" data-act="go" data-to="litigation">Draft PAGA notice and demand letter</button><button class="btn" data-act="go" data-to="calendar">Deadlines</button></div></div>`);
};

// ======================================================= Fix queue: everything the audit found, pre-filled and ordered
S.fixDone = S.fixDone || {};
function queue() {
  if (!S.result) return [];
  const plan = PC.backPay(S.input, S.result, { interestRate: S.readiness?.noticeDate ? 0.07 : 0.1, includeLiquidated: true, through: iso() });
  const fps = X.fpOf ? X.fpOf() : []; const caps = PC.capabilities(S.input, S.result, fps).filter(c => c.status === 'no');
  const ws = S.result.categories.find(c => c.category === 'wage_statement' && c.base > 0);
  const q = [];
  if (plan.totals.total > 0) q.push({ id: 'pay', title: `Pay ${plan.totals.employees.toLocaleString()} workers ${money(plan.totals.total)}`, why: `Unpaid wages ${money(plan.totals.wages)}, premiums ${money(plan.totals.premiums)}, reimbursement ${money(plan.totals.reimbursement)}, interest ${money(plan.totals.interest)} at ${S.readiness?.noticeDate ? '7% (cure rate)' : '10%'}.`, actions: [['fq-payroll', 'Payroll file (CSV) — ready to upload'], ['fq-workbook', 'Back-pay workbook (Excel)'], ['fq-letters', 'Payment letters — English'], ['fq-letters-es', 'Cartas — Español']], cite: 'Lab. Code §§ 218.6, 226.7, 2802' });
  for (const f of fps) q.push({ id: `fp-${f.id}`, title: f.title, why: `${f.evidence} Fix: ${f.fix}`, actions: [['fq-pos', 'Configuration request to your payroll/POS vendor (Word)']], cite: f.cite });
  for (const c of caps) if (!fps.some(f => c.label.toLowerCase().includes(f.id.split('_')[0]))) q.push({ id: `cap-${c.id}`, title: c.label, why: `${c.evidence} Fix: ${c.fix}`, actions: [['fq-pos', 'Configuration request (Word)']], cite: c.cite });
  if (ws) q.push({ id: 'ws', title: `Correct wage statements (${ws.employees} workers)`, why: 'Pay stubs are missing required items; issue corrected statements and fix the template.', actions: [['fq-ws', 'Corrected wage statement notices (Word)']], cite: 'Lab. Code § 226(a)' });
  const hb = (S.docs || []).filter(d => d.type === 'handbook');
  q.push({ id: 'policies', title: hb.length ? 'Fix the handbook' : 'Adopt compliant written policies', why: hb.length ? 'Redline your handbook against California law.' : 'Meal and rest, timekeeping, expense, and sick-leave policies support the “reasonable steps” defense.', actions: [['fq-policies', 'Policy kit (Word)']], cite: 'Lab. Code § 2699(g)' });
  const sc = PC.scorecard(S.input, S.result);
  if (sc.overall === null || !S.input.timeRecords.length) q.unshift({ id: 'records', title: 'Add the missing records', why: `Only ${sc.coverage}% of compliance areas could be tested. Still needed: ${sc.missing.slice(0, 5).map(m => m.need).join('; ')}.`, actions: [['go-import', 'Upload time and payroll records'], ['go-pos', 'Turn on missing tracking in your POS']], cite: 'Lab. Code §§ 226, 1174; IWC Wage Orders § 7' });
  if (S.readiness?.noticeDate) q.unshift({ id: 'cure', title: 'Submit the PAGA cure', why: 'A notice date is on file — prepare the cure from the audit before the deadline.', actions: [['fq-cure', 'Cure proposal (Word) — pre-filled'], ['go-calendar', 'Deadlines']], cite: 'Lab. Code § 2699.3' });
  q.push({ id: 'evidence', title: 'Record your reasonable steps', why: 'Save this audit and your fixes as evidence toward the 15% / 30% PAGA caps.', actions: [['fq-snapshot', 'Save audit to the record'], ['fq-plan', 'Corrective-action plan (Word)']], cite: 'Lab. Code § 2699(g)' });
  return q;
}
VIEWS.fixqueue = el => {
  if (!S.result) { el.innerHTML = X.head('Fix queue', 'Run an audit to build your fix queue.') + '<button class="btn primary" data-act="go" data-to="import">Add files</button>'; return; }
  const q = queue(); const done = q.filter(x => S.fixDone[x.id]).length;
  el.innerHTML = X.head('Fix queue', 'Everything your audit found, in the order to fix it — each step is pre-filled with your data.') + `
    <div class="row" style="margin-bottom:12px;align-items:center"><span class="chip ${done === q.length ? 'ok' : ''}">${done} of ${q.length} done</span><button class="btn primary" data-act="fq-all">Download everything (ready to use)</button></div>
    ${q.map((x, i) => `<div class="panel" style="margin-bottom:10px;${S.fixDone[x.id] ? 'opacity:.6' : ''}"><div class="row" style="justify-content:space-between;align-items:flex-start;gap:12px"><div><div class="small muted">Step ${i + 1}</div><h3 style="margin:2px 0">${esc(x.title)}</h3><p class="small" style="margin:4px 0">${esc(x.why)}</p><div class="cite">${esc(x.cite)}</div></div><label class="check" style="white-space:nowrap"><input type="checkbox" data-fq-done="${x.id}" ${S.fixDone[x.id] ? 'checked' : ''}> Done</label></div>
      <div class="row" style="margin-top:8px">${x.actions.map(([a, l], k) => `<button class="btn ${k === 0 ? 'primary' : ''}" data-act="${a}">${esc(l)}</button>`).join('')}</div></div>`).join('')}`;
  el.querySelectorAll('[data-fq-done]').forEach(c => c.addEventListener('change', e => { S.fixDone[e.target.dataset.fqDone] = e.target.checked; X.persist(); X.render(); }));
};
async function payrollFiles(rate, which) {
  const plan = PC.backPay(S.input, S.result, { interestRate: rate, includeLiquidated: true, through: iso() }); if (!plan.lines.length) { toast('No back pay is owed in this audit.'); return; }
  if (which !== 'xlsx') { const csv = ['employee_id,employee_name,earnings_code,description,amount,tax_treatment', ...plan.lines.map(l => [l.employeeId, `"${String(l.name || '').replace(/"/g, '""')}"`, l.code, `"${String(l.description || '').replace(/"/g, '""')}"`, Number(l.amount).toFixed(2), l.taxTreatment].join(','))].join('\n'); await X.save(`backpay-payroll-${Math.round(rate * 100)}pct-${iso()}.csv`, new Blob([csv], { type: 'text/csv' })); }
  if (which !== 'csv') { const XL = PC.XLSX; const wb = XL.utils.book_new(); XL.utils.book_append_sheet(wb, XL.utils.json_to_sheet(plan.rows.map(r => ({ employee_id: r.employeeId, name: r.name, location: r.location || '', former: r.terminated, wages: r.wages, premiums: r.premiums, reimbursement: r.reimbursement, liquidated: r.liquidated, interest: r.interest, total: r.total }))), 'By worker'); XL.utils.book_append_sheet(wb, XL.utils.json_to_sheet(plan.lines), 'Payroll lines'); XL.utils.book_append_sheet(wb, XL.utils.aoa_to_sheet([['Basis'], [`Interest ${Math.round(rate * 100)}% simple from each due date through ${iso()}`], ['Wages and premiums are W-2 wages; reimbursements are non-taxable; interest reported separately.'], ['Lab. Code §§ 218.6, 226.7, 1194.2, 2802']]), 'Basis'); await X.save(`backpay-workbook-${Math.round(rate * 100)}pct-${iso()}.xlsx`, new Blob([XL.write(wb, { bookType: 'xlsx', type: 'array' })])); }
}
document.addEventListener('click', async e => {
  const a = e.target.closest('[data-act]'); if (!a) return; const d = a.dataset;
  try {
    if (d.act === 'pov') setPov(d.v);
    const rate = S.readiness?.noticeDate ? 0.07 : 0.1;
    if (d.act === 'fq-payroll') await payrollFiles(rate, 'csv');
    if (d.act === 'fq-workbook') await payrollFiles(rate, 'xlsx');
    if (d.act === 'fq-letters' || d.act === 'fq-letters-es') { const k = d.act === 'fq-letters' ? 'wage_letter' : 'wage_letter_es'; await X.saveDocx(X.genDoc(k), `${k.replace('_', '-')}s-${iso()}.docx`); }
    if (d.act === 'fq-pos') await X.saveDocx([PC.posConfigMemo(S.input.employerName, PC.POS_SYSTEMS.find(p => p.id === (S.posSys || 'custom')), PC.posRecommendations(S.input, S.result), iso())], `configuration-request-${iso()}.docx`);
    if (d.act === 'fq-ws') await X.saveDocx(X.genDoc('corrected_ws'), `corrected-wage-statements-${iso()}.docx`);
    if (d.act === 'fq-policies') await X.saveDocx(['meal_rest_policy', 'expense_policy', 'timekeeping_policy', 'attestation_policy'].flatMap(k => X.genDoc(k)), `policy-kit-${iso()}.docx`);
    if (d.act === 'fq-cure') await X.saveDocx(X.genDoc('paga_cure'), `cure-proposal-${iso()}.docx`);
    if (d.act === 'fq-snapshot') { await X.saveSnapshot(PC.snapshot(`Fix-queue record ${iso()}`, S.input, S.result, S.patterns?.anomalies || [])); toast('Saved to your reasonable-steps record.'); }
    if (d.act === 'fq-plan') document.querySelector('[data-act="rd-plan"]') ? document.querySelector('[data-act="rd-plan"]').click() : (X.setView('readiness'), setTimeout(() => document.querySelector('[data-act="rd-plan"]')?.click(), 300));
    if (d.act === 'go-calendar') X.setView('calendar');
    if (d.act === 'go-import') X.setView('import');
    if (d.act === 'go-pos') X.setView('pos');
    if (d.act === 'fq-all') { await payrollFiles(rate, 'both'); await X.saveDocx([...X.genDoc('wage_letter'), ...(S.readiness?.noticeDate ? X.genDoc('paga_cure') : []), ...['meal_rest_policy', 'timekeeping_policy', 'expense_policy'].flatMap(k => X.genDoc(k))], `fix-package-${iso()}.docx`); toast('Your fix package is downloaded: payroll file, workbook, letters, policies.'); }
    if (d.act === 'bp-cure') { S.bp = S.bp || {}; S.bp.rate = 0.07; await payrollFiles(0.07, 'both'); X.setView('backpay'); }
  } catch (err) { toast(err.message); }
});
// “Back pay at 7%” in the Solutions Center now does the work (files at the cure rate), not just navigate
const baseSol2 = VIEWS.solutions;
VIEWS.solutions = el => { baseSol2(el); el.querySelectorAll('[data-act="go"][data-to="backpay"]').forEach(b => { if (/7%/.test(b.textContent)) { b.dataset.act = 'bp-cure'; b.textContent = 'Back pay at 7% — payroll file + workbook'; } }); };

// ======================================================= Privilege: one plain question
const basePriv = VIEWS.privilege;
VIEWS.privilege = el => {
  basePriv(el); document.getElementById('priv-bar')?.remove();
  const seg = el.querySelector('.seg'); if (!seg) return;
  seg.outerHTML = `<div class="panel" style="margin-bottom:12px"><h3 style="margin-top:0">Is your attorney directing this audit?</h3><p class="small">Privilege comes from <b>who directs the work and why</b>, not from the software. When your lawyer engages Aldune to help give you legal advice (the same structure other vendors call “Kovel”), the audit can be protected. A business-only audit generally is not.</p>
    <div class="seg"><button data-act="priv-mode" data-m="privileged" aria-pressed="${S.priv.mode === 'privileged'}">Yes — run it as a privileged audit</button><button data-act="priv-mode" data-m="operational" aria-pressed="${S.priv.mode !== 'privileged'}">No — standard audit</button></div></div>`;
};

// ======================================================= Homepage motion graphics
document.head.insertAdjacentHTML('beforeend', `<style>
@keyframes spFloat{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(30px,-20px) scale(1.08)}}
@keyframes spRise{0%{transform:scaleY(.15)}60%{transform:scaleY(1.04)}100%{transform:scaleY(1)}}
@keyframes spFade{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@keyframes spStream{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@keyframes spPulse{0%,100%{box-shadow:0 0 0 0 rgba(31,107,82,.35)}50%{box-shadow:0 0 0 10px rgba(31,107,82,0)}}
@keyframes spScan{0%{top:0}100%{top:100%}}
.pub-hero{position:relative;overflow:hidden}
.pub-hero .sp-orb{position:absolute;border-radius:50%;filter:blur(40px);opacity:.55;pointer-events:none;animation:spFloat 14s ease-in-out infinite}
.pub-hero .hero-grid>div:first-child>*{animation:spFade .8s ease both}.pub-hero .hero-grid>div:first-child>*:nth-child(2){animation-delay:.08s}.pub-hero .hero-grid>div:first-child>*:nth-child(3){animation-delay:.16s}.pub-hero .hero-grid>div:first-child>*:nth-child(4){animation-delay:.24s}
.preview{animation:spFade .9s .2s ease both}.preview .pv-bars span{transform-origin:bottom;animation:spRise 1.4s cubic-bezier(.2,.8,.2,1) both}.preview .pv-bars span:nth-child(2){animation-delay:.1s}.preview .pv-bars span:nth-child(3){animation-delay:.2s}.preview .pv-bars span:nth-child(4){animation-delay:.3s}.preview .pv-bars span:nth-child(5){animation-delay:.4s}.preview .pv-bars span:nth-child(6){animation-delay:.5s}
.preview .sp-scan{position:absolute;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,rgba(127,224,181,.9),transparent);animation:spScan 3.2s linear infinite}
.sp-stream{overflow:hidden;margin-top:26px;mask-image:linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent)}.sp-stream .track{display:flex;gap:10px;width:max-content;animation:spStream 38s linear infinite}
.sp-chip{display:inline-flex;gap:6px;align-items:center;background:#fff;border:1px solid var(--line);border-radius:999px;padding:6px 12px;font-size:12.5px;color:var(--ink2);white-space:nowrap}.sp-chip i{width:7px;height:7px;border-radius:50%;background:#7FE0B5;display:inline-block}
.pub-hero .btn.primary{animation:spPulse 2.8s 1.2s ease-in-out infinite}
@media (prefers-reduced-motion:reduce){.pub-hero *,.preview *,.sp-stream .track{animation:none!important}}
</style>`);
function animateHome() {
  const hero = document.querySelector('.pub-hero'); if (!hero || hero.dataset.anim) return; hero.dataset.anim = '1';
  hero.insertAdjacentHTML('afterbegin', '<span class="sp-orb" style="width:420px;height:420px;right:-80px;top:-120px;background:radial-gradient(circle,rgba(31,107,82,.45),transparent 70%)"></span><span class="sp-orb" style="width:360px;height:360px;left:-120px;bottom:-140px;background:radial-gradient(circle,rgba(199,125,90,.35),transparent 70%);animation-delay:-6s"></span>');
  const pv = hero.querySelector('.preview'); if (pv) { pv.style.overflow = 'hidden'; pv.insertAdjacentHTML('afterbegin', '<span class="sp-scan"></span>'); }
  const files = ['Toast_TimeEntries.csv', 'ADP_Timecard.pdf', 'W-2_batch_2025.pdf', 'Paychex_Register.xlsx', 'Square_Timecards.csv', 'UKG_Punches.csv', 'Homebase_Export.csv', 'Earnings_Detail.xlsx', 'Handbook_2026.docx', 'PAGA_Notice.pdf'];
  const g = hero.querySelector('.hero-grid'); if (g) g.insertAdjacentHTML('afterend', `<div class="sp-stream" aria-hidden="true"><div class="track">${[...files, ...files].map(f => `<span class="sp-chip"><i></i>${f}</span>`).join('')}</div></div>`);
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const count = (node, to, fmt, ms = 1600) => { const t0 = performance.now(); const step = t => { const k = Math.min(1, (t - t0) / ms); node.textContent = fmt(Math.round(to * (1 - Math.pow(1 - k, 3)))); if (k < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); };
  pv?.querySelectorAll('.pv-chip, div').forEach(n => { if (/^2,000 files read$/.test(n.textContent.trim())) count(n, 2000, v => `${v.toLocaleString()} files read`); if (/^100,182 shifts normalized$/.test(n.textContent.trim())) count(n, 100182, v => `${v.toLocaleString()} shifts normalized`); });
}
const baseRender = X.render; X.render = () => { baseRender(); if (S.view === 'public') setTimeout(animateHome, 0); };
document.getElementById('nav') && !document.querySelector('#nav button[data-view="fixqueue"]') && document.querySelector('#nav button[data-view="solutions"]')?.insertAdjacentHTML('beforebegin', '<button data-view="fixqueue">Fix queue</button>');
X.render();
})();

/* ---------- employee-counsel (plaintiff) view: the dashboard and queue change, not just the label */
(() => {
const X = window.PCX; const { PC, S, esc, money, toast, VIEWS } = X; const iso = () => new Date().toISOString().slice(0, 10);
const RELABEL = [[/^Likely exposure/i, 'Likely recovery'], [/^Maximum theoretical exposure/i, 'Maximum case value (full plaintiff model)'], [/^Owed to workers now/i, 'Wages and premiums to recover'], [/^Workers with at least one finding/i, 'Aggrieved employees']];
const baseExec = VIEWS.exec;
VIEWS.exec = el => {
  baseExec(el); if (S.pov !== 'plaintiff' || !S.result) return;
  // employee-counsel view computes from the plaintiff side — different numbers, not just different labels
  const neu = PC.runScenario(S.input, S.result, { ...PC.DEFAULT_SCENARIO, ...PC.PERSPECTIVES.neutral }).total, pl = PC.runScenario(S.input, S.result, { ...PC.DEFAULT_SCENARIO, ...PC.PERSPECTIVES.plaintiff }).total;
  const rec = PC.backPay(S.input, S.result, { interestRate: 0.1, includeLiquidated: true, through: iso() }).totals.total; const pg = S.result.paga;
  const set = (re, v, label) => el.querySelectorAll('.kpi').forEach(k => { const kk = k.querySelector('.k'); if (kk && re.test(kk.textContent.trim())) { k.querySelector('.v').textContent = v; kk.textContent = label; } });
  set(/^Likely exposure/i, `${X.approx(neu)}–${X.approx(pl)}`, 'Likely recovery (neutral to plaintiff model)');
  set(/^Maximum theoretical exposure/i, `${X.approx(pg.annualLow)}–${X.approx(pg.annualHigh)}`, 'PAGA civil penalties (unstacked to stacked, one year)');
  set(/^Owed to workers now/i, X.approx(rec), 'Wages, premiums, 10% interest, and liquidated damages to recover');
  set(/^Workers with at least one finding/i, el.querySelector('.kpi:nth-child(4) .v')?.textContent || '', 'Aggrieved employees');
  el.querySelectorAll('[data-act="go"]').forEach(b => { if (/Fix what/.test(b.textContent)) { b.textContent = 'Build the case'; b.dataset.to = 'fixqueue'; } });
  const cats = S.result.categories.filter(c => c.base > 0).sort((a, b) => b.base - a.base).slice(0, 4);
  const dated = S.result.engine.findings.map(f => f.date || f.periodEnd || '').filter(Boolean).sort();
  const yearAgo = (() => { const d = new Date(); d.setUTCFullYear(d.getUTCFullYear() - 1); return d.toISOString().slice(0, 10); })();
  const oldestInWindow = dated.find(d => d >= yearAgo);
  el.querySelector('.kpis')?.insertAdjacentHTML('beforebegin', `<div class="panel" style="border-left:5px solid var(--ledger);margin-bottom:14px"><div class="row" style="justify-content:space-between;align-items:center"><h3 style="margin:0">Case view — employee counsel</h3><div class="row"><button class="btn primary" data-act="go" data-to="fixqueue">Build the case</button><button class="btn" data-act="go" data-to="litigation">Draft PAGA notice</button></div></div>
    <table style="margin-top:8px"><tbody>${cats.map(c => `<tr><td class="small"><b>${esc(c.label)}</b></td><td class="n small">${c.employees} employees</td><td class="n"><b>${money(c.base)}</b></td></tr>`).join('')}<tr><td class="small"><b>PAGA civil penalties</b> (annual, unstacked)</td><td></td><td class="n"><b>${money(S.result.paga.annualLow)}</b></td></tr></tbody></table>
    <p class="small" style="margin:8px 0 0">${oldestInWindow ? `PAGA reaches back one year from the notice: the oldest violation still inside that window is <b>${esc(oldestInWindow)}</b> — every week of delay lets older violations expire.` : 'No violations fall inside the one-year PAGA window — focus on wage claims (three-year and four-year periods).'}</p></div>`);
};
const baseQueue = VIEWS.fixqueue;
VIEWS.fixqueue = el => {
  if (S.pov !== 'plaintiff') { baseQueue(el); return; }
  if (!S.result) { el.innerHTML = X.head('Case queue', 'Run an audit to build the case.'); return; }
  const steps = [['Request the records', 'Wage statements and payroll records (21 days), personnel file (30 days), and signed instruments such as arbitration agreements. Failure carries $750 penalties.', [['pq-records', 'Records request letter (Word)']], 'Lab. Code §§ 226(b), 1198.5, 432'],
    ['Send the PAGA notice', 'File online with the LWDA and serve the employer by certified mail; the 65-day period runs before suit. Plead only violations the client personally suffered.', [['go-lit', 'Draft PAGA notice']], 'Lab. Code §§ 2699(c), 2699.3'],
    ['Make the demand', 'Opening demand from the realistic exposure; § 998 risk evaluated on any offer.', [['go-lit', 'Demand letter and valuation']], 'Code Civ. Proc. § 998'],
    ['Track every deadline', 'PAGA one-year look-back, the 65-day wait, cure periods, and wage-claim limitations.', [['go-calendar', 'Deadlines']], 'Code Civ. Proc. §§ 338, 340']];
  el.innerHTML = X.head('Case queue', 'Employee-counsel view — what to do next, built from the records.') + steps.map(([t, w, acts, c], i) => `<div class="panel" style="margin-bottom:10px"><div class="small muted">Step ${i + 1}</div><h3 style="margin:2px 0">${esc(t)}</h3><p class="small" style="margin:4px 0">${esc(w)}</p><div class="cite">${esc(c)}</div><div class="row" style="margin-top:8px">${acts.map(([a, l], k) => `<button class="btn ${k === 0 ? 'primary' : ''}" data-act="${a}">${esc(l)}</button>`).join('')}</div></div>`).join('');
};
document.addEventListener('click', async e => {
  const a = e.target.closest('[data-act]'); if (!a) return;
  try {
    if (a.dataset.act === 'pq-records') await X.saveDocx([PC.docs3.recordsRequest({ employee: S.lit?.facts?.plaintiff || '[[EMPLOYEE NAME]]', employer: S.input?.employerName || '[[EMPLOYER]]', counsel: S.lit?.facts?.counsel || '' })], `records-request-${iso()}.docx`);
    if (a.dataset.act === 'go-lit') X.setView('litigation');
  } catch (err) { toast(err.message); }
});
X.render();
})();
