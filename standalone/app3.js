/* Aldune standalone — part 3: scenario model, settlement valuation, due diligence, monitoring */
(() => {
'use strict';
const X = window.PCX; const { PC, S, $, esc, money, approx, fdate, toast, head, ai, GUARD, VIEWS } = X;

const sc = (over = {}) => PC.runScenario(S.input, S.result, { ...S.scenario, ...over });
X.sc = sc;

// ---------------- Scenario model ("digital twin")
VIEWS.scenarios = el => {
  const s = S.scenario; const base = sc(); const hasArb = S.input.employees.some(e => e.arbitration !== undefined);
  const persp = ['defense', 'neutral', 'plaintiff'].map(p => [p, PC.runScenario(S.input, S.result, { ...PC.DEFAULT_SCENARIO, ...PC.PERSPECTIVES[p] })]);
  const sl = (k, label, min, max, step, fmt) => `<div><label class="field" for="sc-${k}">${label}</label><div class="slider"><input type="range" id="sc-${k}" data-sc="${k}" min="${min}" max="${max}" step="${step}" value="${s[k]}"><b class="right">${fmt(s[k])}</b></div></div>`;
  el.innerHTML = head('Scenario model', 'A live model of this workforce’s exposure. Change an assumption and every figure recalculates from the underlying findings — the questions counsel actually asks.') + `
    <div class="row" style="margin-bottom:14px"><span class="small muted">Start from a perspective:</span><div class="seg" role="group" aria-label="Perspective">${['defense', 'neutral', 'plaintiff'].map(p => `<button data-act="persp" data-p="${p}" aria-pressed="${S.perspective === p}">${p[0].toUpperCase() + p.slice(1)}</button>`).join('')}</div></div>
    <div class="split">
      <div class="panel"><div class="grid g2">
        <label class="check"><input type="checkbox" data-scb="excludeArbitration" ${s.excludeArbitration ? 'checked' : ''}> Remove workers with arbitration agreements from class claims${hasArb ? '' : ' (no arbitration column — set % below)'}</label>
        ${hasArb ? '<span class="small muted">PAGA penalties stay: representative PAGA claims can’t be waived.</span>' : sl('arbitrationPct', 'Share of workforce under arbitration', 0, 100, 5, v => v + '%')}
        ${sl('validityPct', 'Share of flagged records that are true violations', 10, 100, 5, v => v + '%')}
        ${sl('lookbackMonths', 'Wage claim lookback', 12, 48, 6, v => v + ' mo')}
        ${sl('rateFactor', 'Wage-rate sensitivity', 0.7, 1.3, 0.05, v => '×' + Number(v).toFixed(2))}
        ${sl('pagaPenalty', 'PAGA penalty per pay period', 50, 200, 10, v => '$' + v)}
        ${sl('courtReductionPct', 'Court’s discretionary PAGA reduction', 0, 90, 5, v => v + '%')}
        <label class="field">PAGA counting<select data-scs="pagaMode"><option value="single" ${s.pagaMode === 'single' ? 'selected' : ''}>One penalty per employee per pay period</option><option value="stacked" ${s.pagaMode === 'stacked' ? 'selected' : ''}>One per violation type (plaintiff stacking)</option></select></label>
        <label class="field">Reasonable-steps cap<select data-scs="pagaCap"><option value="none" ${s.pagaCap === 'none' ? 'selected' : ''}>None</option><option value="pre" ${s.pagaCap === 'pre' ? 'selected' : ''}>15% — steps taken before notice</option><option value="post" ${s.pagaCap === 'post' ? 'selected' : ''}>30% — steps within 60 days after</option></select></label>
        <label class="check"><input type="checkbox" data-scb="includeDerivative" ${s.includeDerivative ? 'checked' : ''}> Include derivative wage-statement and waiting-time penalties</label>
        <label class="check"><input type="checkbox" data-scb="includePenalties" ${s.includePenalties ? 'checked' : ''}> Include statutory penalties and liquidated damages</label>
      </div></div>
      <div class="panel"><div class="kpi" style="border:0;padding:0"><div class="v" style="font-size:34px">${approx(base.total)}</div><div class="k">Modeled exposure under these assumptions</div></div>
        <table style="margin-top:10px"><tbody><tr><td>Wages, premiums, reimbursement</td><td class="n">${money(base.wages)}</td></tr><tr><td>Statutory penalties</td><td class="n">${money(base.penalties)}</td></tr><tr><td>PAGA penalties</td><td class="n">${money(base.paga)}</td></tr><tr><td><b>Total</b></td><td class="n"><b>${money(base.total)}</b></td></tr></tbody></table>
        <h3>By claim</h3>${X.bars(base.byCategory.filter(c => c.amount > 0).map(c => ({ l: c.label, v: c.amount })))}
        <ul class="small" style="margin-top:10px">${base.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul></div>
    </div>
    <h2>Perspective comparison</h2>
    <div class="tablewrap"><table><thead><tr><th>Model</th><th class="n">Wages and premiums</th><th class="n">Penalties</th><th class="n">PAGA</th><th class="n">Total</th></tr></thead><tbody>${persp.map(([p, r]) => `<tr><td><b>${p[0].toUpperCase() + p.slice(1)}</b></td><td class="n">${money(r.wages)}</td><td class="n">${money(r.penalties)}</td><td class="n">${money(r.paga)}</td><td class="n"><b>${money(r.total)}</b></td></tr>`).join('')}</tbody></table></div>
    <p class="small muted">Defense: arbitration applied, 70% validity, 3-year lookback, no derivative claims, single PAGA count, 50% court reduction. Neutral: 85% validity, 25% reduction. Plaintiff: no arbitration, 4-year UCL lookback, derivative claims, stacked PAGA. All are models from your findings, not predictions.</p>`;
  el.querySelectorAll('[data-sc]').forEach(i => i.addEventListener('change', e => { s[e.target.dataset.sc] = Number(e.target.value); X.render(); }));
  el.querySelectorAll('[data-sc]').forEach(i => i.addEventListener('input', e => { e.target.nextElementSibling.textContent = e.target.value; }));
  el.querySelectorAll('[data-scb]').forEach(i => i.addEventListener('change', e => { s[e.target.dataset.scb] = e.target.checked; X.render(); }));
  el.querySelectorAll('[data-scs]').forEach(i => i.addEventListener('change', e => { s[e.target.dataset.scs] = e.target.value; X.render(); }));
};

// ---------------- Settlement valuation
function settleModel() {
  const neu = sc(); const pl = PC.runScenario(S.input, S.result, { ...PC.DEFAULT_SCENARIO, ...PC.PERSPECTIVES.plaintiff });
  const members = S.input.employees.filter(e => e.classification === 'nonexempt' && !(S.scenario.excludeArbitration && e.arbitration)).length;
  return { neu, pl, v: PC.valueSettlement(neu, pl, S.settleIn, members), members };
}
VIEWS.settlement = el => {
  const si = S.settleIn; const { neu, pl, v, members } = settleModel();
  const sl = (k, label, min, max, step, fmt) => `<div><label class="field" for="st-${k}">${label}</label><div class="slider"><input type="range" id="st-${k}" data-st="${k}" min="${min}" max="${max}" step="${step}" value="${si[k]}"><b class="right">${fmt(si[k])}</b></div></div>`;
  const W = 640; const max = Math.max(v.demandAnchor, v.walkaway) * 1.05 || 1; const x = n => Math.round(n / max * W);
  el.innerHTML = head('Settlement valuation', 'A transparent, risk-adjusted value for negotiation, built from the scenario model and your litigation assumptions. It uses no settlement database and makes no prediction about any court or mediator.', `<button class="btn" data-act="dl-settle-memo">Download valuation memo</button>`) + `
    <div class="split">
      <div class="panel"><p class="small muted">Starts from the current scenario model (${approx(neu.total)}). Change the scenario on the Scenario model page.</p><div class="grid g2">
        ${sl('liabilityPct', 'Chance plaintiffs prove liability', 10, 95, 5, n => n + '%')}${sl('certificationPct', 'Chance a class is certified', 0, 95, 5, n => n + '%')}
        ${sl('pagaSuccessPct', 'Chance PAGA penalties are awarded', 10, 95, 5, n => n + '%')}${sl('plaintiffFeePct', 'Plaintiff fee share', 20, 40, 1, n => n + '%')}
        <label class="field">Defense cost through trial<input type="number" data-stn="defenseCostToTrial" value="${si.defenseCostToTrial}" step="10000"></label>
        <label class="field">Defense cost through mediation<input type="number" data-stn="defenseCostToMediation" value="${si.defenseCostToMediation}" step="5000"></label>
      </div></div>
      <div class="panel"><div class="kpis" style="grid-template-columns:1fr 1fr"><div class="kpi"><div class="v">${approx(v.target)}</div><div class="k">Risk-adjusted value (target)</div></div><div class="kpi risk"><div class="v">${approx(v.walkaway)}</div><div class="k">Economic walkaway</div></div><div class="kpi"><div class="v">${approx(v.opening)}</div><div class="k">Suggested opening</div></div><div class="kpi"><div class="v">${approx(v.demandAnchor)}</div><div class="k">Likely demand anchor</div></div></div>
        <svg viewBox="0 0 ${W} 70" style="width:100%;margin-top:14px" role="img" aria-label="Negotiation range"><rect x="0" y="28" width="${W}" height="10" fill="var(--sunk)"/><rect x="${x(v.opening)}" y="24" width="${Math.max(2, x(v.walkaway) - x(v.opening))}" height="18" fill="var(--ledger)" opacity=".8"/>${[['Opening', v.opening], ['Target', v.target], ['Walkaway', v.walkaway], ['Demand', v.demandAnchor]].map(([l, n], i) => `<line x1="${x(n)}" x2="${x(n)}" y1="${i % 2 ? 44 : 14}" y2="${i % 2 ? 52 : 24}" stroke="currentColor"/><text x="${Math.min(W - 40, Math.max(30, x(n)))}" y="${i % 2 ? 64 : 10}" font-size="11" text-anchor="middle" fill="currentColor">${l}</text>`).join('')}</svg>
      </div>
    </div>
    <div class="panel" style="margin-top:16px"><h3 style="margin-top:0">How it’s calculated</h3><ul class="small">${v.explanation.map(t => `<li>${esc(t)}</li>`).join('')}</ul><p class="small muted">${members.toLocaleString()} potential class members in the current scenario. Courts may reduce PAGA penalties when a full award would be unjust, arbitrary, or confiscatory (Lab. Code § 2699(e)(2)); settlement terms usually need court approval and LWDA notice.</p></div>
    <div class="panel" style="margin-top:16px"><h3 style="margin-top:0">Mediation brief points<span class="badge-ai">AI</span></h3><div id="ai-st">${S.aiCache.st ? `<div class="ai-out">${esc(S.aiCache.st)}</div>` : '<button class="btn" data-act="ai-settle">Draft defense mediation talking points</button>'}</div></div>
    <div class="panel" style="margin-top:16px"><h3 style="margin-top:0">Individual settlements during a pending case</h3><p class="small">For a filed class action, individual settlement packets (Chindarah v. Pick Up Stix) can be generated per worker with a data-driven payment schedule on the <button class="btn" data-act="go" data-to="documents">Documents</button> page. Courts can restrict misleading or coercive communications with putative class members, so have counsel approve before sending.</p></div>`;
  el.querySelectorAll('[data-st]').forEach(i => { i.addEventListener('input', e => { e.target.nextElementSibling.textContent = e.target.value; }); i.addEventListener('change', e => { si[e.target.dataset.st] = Number(e.target.value); X.render(); }); });
  el.querySelectorAll('[data-stn]').forEach(i => i.addEventListener('change', e => { si[e.target.dataset.stn] = Math.max(0, Number(e.target.value) || 0); X.render(); }));
};
X.settleModel = settleModel;
X.aiSettle = async () => {
  const out = $('#ai-st'); const { neu, pl, v } = settleModel();
  const facts = { scenario: { total: neu.total, wages: neu.wages, penalties: neu.penalties, paga: neu.paga, notes: neu.notes }, plaintiffModel: pl.total, valuation: v, patterns: S.patterns.anomalies.slice(0, 4).map(a => a.headline), arbitrationWorkers: S.input.employees.filter(e => e.arbitration).length, dataQuality: S.result.quality.score };
  out.innerHTML = '<div class="ai-out">Drafting…</div>';
  try { const r = await ai(`Draft 6–8 defense mediation talking points for a California wage-and-hour class and PAGA case, based only on these model results: arguments that narrow exposure (arbitration agreements, validity of flagged records, premiums already paid, penalty elements like willfulness and knowing-and-intentional, PAGA reasonable-steps caps and court discretion), with the modeled figure each point affects. Then list 3 risks for the defense. Use cautious language. ${GUARD}\n<data>${JSON.stringify(facts)}</data>`, { onText: ({ text }) => { out.innerHTML = `<div class="ai-out">${esc(text)}</div>`; } }); S.aiCache.st = r.text; }
  catch (e) { out.innerHTML = `<p class="small">${esc(e.message || 'Not available.')}</p>`; }
};

// ---------------- Due diligence
function ddModel() {
  const def = PC.runScenario(S.input, S.result, { ...PC.DEFAULT_SCENARIO, ...PC.PERSPECTIVES.defense });
  const neu = PC.runScenario(S.input, S.result, { ...PC.DEFAULT_SCENARIO, ...PC.PERSPECTIVES.neutral });
  const pl = PC.runScenario(S.input, S.result, { ...PC.DEFAULT_SCENARIO, ...PC.PERSPECTIVES.plaintiff });
  return PC.buildDiligence(S.input, S.result, def, neu, pl, S.patterns.anomalies, S.ddIn);
}
X.ddModel = ddModel;
VIEWS.diligence = el => {
  const d = S.ddIn; const r = ddModel(); const h = r.headline;
  el.innerHTML = head('California employment liability report', 'For buyers, lenders, and investors evaluating a California target: modeled wage-and-hour and PAGA liability, where it sits, and what to negotiate. Not an investment recommendation.', `<button class="btn primary" data-act="dl-dd">Download report (Word)</button>`) + `
    <div class="panel"><div class="grid g3">
      <label class="field">Target name<input data-dd="targetName" value="${esc(d.targetName)}"></label>
      <label class="field">Enterprise value ($)<input type="number" data-ddn="dealValue" value="${d.dealValue}" step="1000000"></label>
      <label class="field">Process remediation cost ($)<input type="number" data-ddn="processRemediationCost" value="${d.processRemediationCost}" step="5000"></label>
      <label class="field">Probability claims are asserted (%)<input type="number" data-ddn="probabilityPct" min="0" max="100" value="${d.probabilityPct}"></label>
    </div></div>
    <div class="kpis" style="margin-top:16px">
      <div class="kpi risk"><div class="v">${approx(h.likelyLow)}–${approx(h.likelyHigh)}</div><div class="k">Likely wage-and-hour exposure (incl. PAGA)</div></div>
      <div class="kpi"><div class="v">${approx(h.maximum)}</div><div class="k">Maximum theoretical exposure</div></div>
      <div class="kpi"><div class="v">${approx(h.remediation)}</div><div class="k">Estimated remediation cost (back pay + fixes)</div></div>
      <div class="kpi"><div class="v">${approx(r.adjustment.low)}–${approx(r.adjustment.high)}</div><div class="k">Indemnity / escrow discussion range${r.adjustment.pctOfDeal ? ` (${r.adjustment.pctOfDeal}% of value)` : ''}</div></div>
    </div>
    <div class="split" style="margin-top:16px">
      <div class="panel"><h3 style="margin-top:0">Material issues</h3>${r.materialIssues.length ? `<table><tbody>${r.materialIssues.map(m => `<tr><td><b>${esc(m.label)}</b><div class="cite">${esc(m.detail)}</div></td><td class="n">${money(m.amount)}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">None above 10% of modeled exposure.</p>'}
        <h3>High-risk locations</h3><table><tbody>${r.highRiskLocations.map(l => `<tr><td>${esc(l.name)}</td><td class="n">${money(l.exposure)}</td><td class="n">${Math.round(l.share * 100)}%</td></tr>`).join('')}</tbody></table>
        <h3>High-risk populations</h3><ul class="small">${r.highRiskPopulations.map(p => `<li><b>${esc(p.label)}</b> (${p.employees}): ${esc(p.detail)}</li>`).join('')}</ul></div>
      <div class="panel"><h3 style="margin-top:0">Insurance and deal protection</h3><ul class="small">${r.insurance.map(t => `<li>${esc(t)}</li>`).join('')}</ul><h3>Diligence request list</h3><ol class="small">${r.requests.map(t => `<li>${esc(t)}</li>`).join('')}</ol></div>
    </div>
    <p class="small muted">The discussion range = modeled exposure × probability claims are asserted + remediation cost. Deal counsel and the RWI broker should set final terms.</p>`;
  el.querySelectorAll('[data-dd]').forEach(i => i.addEventListener('change', e => { d[e.target.dataset.dd] = e.target.value; X.render(); }));
  el.querySelectorAll('[data-ddn]').forEach(i => i.addEventListener('change', e => { d[e.target.dataset.ddn] = Math.max(0, Number(e.target.value) || 0); X.render(); }));
};

// ---------------- Monitoring
function trend(snaps) {
  if (snaps.length < 2) return '';
  const W = 640, H = 150, pad = 30; const maxE = Math.max(...snaps.map(s => s.exposureBase), 1);
  const x = i => pad + i * (W - 2 * pad) / (snaps.length - 1); const yE = v => H - pad - v / maxE * (H - 2 * pad); const yS = v => H - pad - v / 100 * (H - 2 * pad);
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Exposure over time"><polyline fill="none" stroke="var(--ledger)" stroke-width="3" points="${snaps.map((s, i) => `${x(i)},${yE(s.exposureBase)}`).join(' ')}"/><polyline fill="none" stroke="var(--warn)" stroke-width="2" stroke-dasharray="5 4" points="${snaps.map((s, i) => `${x(i)},${yS(s.score)}`).join(' ')}"/>${snaps.map((s, i) => `<circle cx="${x(i)}" cy="${yE(s.exposureBase)}" r="4" fill="var(--ledger)"/><text x="${x(i)}" y="${H - 8}" font-size="11" text-anchor="middle" fill="var(--ink2)">${esc(s.windowEnd.slice(0, 7))}</text>`).join('')}</svg><p class="small muted"><span style="color:var(--ledger)">━</span> base exposure &nbsp; <span style="color:var(--warn)">┅</span> risk score</p>`;
}
VIEWS.monitor = el => {
  const snaps = S.snapshots; const t = S.thresholds;
  const cur = snaps[snaps.length - 1], prev = snaps[snaps.length - 2] || null;
  const alerts = cur ? PC.compareSnapshots(prev, cur, t) : [];
  el.innerHTML = head('Monitoring and alerts', 'Run an audit each month on the newest payroll period and save it here. Aldune compares each run with the last, flags what changed, and builds a dated record of the compliance program.', S.result ? '<button class="btn primary" data-act="save-snap">Save current audit as a run</button>' : '') + `
    <div class="split"><div>
      ${cur ? `<div class="panel"><h3 style="margin-top:0">Latest run: ${esc(cur.label)} (${fdate(cur.windowStart)} – ${fdate(cur.windowEnd)})</h3><div class="kpis"><div class="kpi"><div class="v">${cur.grade ? `${cur.grade}${cur.compliance !== null && cur.compliance !== undefined ? ` <span style="font-size:16px">${cur.compliance}/100</span>` : ''}` : '—'}</div><div class="k">Compliance grade${prev && prev.compliance != null && cur.compliance != null ? ` (${cur.compliance - prev.compliance >= 0 ? '+' : ''}${cur.compliance - prev.compliance})` : ''} · ${esc(cur.level)} risk</div></div><div class="kpi risk"><div class="v">${approx(cur.exposureBase)}</div><div class="k">Base exposure${prev && prev.exposureBase ? ` (${Math.round((cur.exposureBase / prev.exposureBase - 1) * 100)}%)` : ''}</div></div><div class="kpi"><div class="v">${cur.affected}</div><div class="k">Workers affected</div></div><div class="kpi"><div class="v">${cur.findings.toLocaleString()}</div><div class="k">Findings</div></div></div></div>
      <h2>Alerts</h2>${alerts.map(a => `<div class="alert ${a.severity}"><b>${esc(a.title)}</b><div class="small">${esc(a.detail)}</div><div class="small muted">Recommended: ${esc(a.action)}</div></div>`).join('')}
      <h2>Trend</h2><div class="panel trend">${trend(snaps) || '<p class="muted small">Save at least two runs to see a trend.</p>'}</div>` : '<div class="muted-box">No saved runs yet. Run an audit and choose “Save current audit as a run.” Save one for each month to start trend tracking and alerts.</div>'}
      <h2>Saved runs</h2><div class="tablewrap"><table><thead><tr><th>Run</th><th>Period</th><th class="n">Grade</th><th class="n">Exposure</th><th></th></tr></thead><tbody>${snaps.slice().reverse().map(s => `<tr><td>${esc(s.label)}<div class="cite">${esc(s.employer)}</div></td><td class="small">${fdate(s.windowStart)} – ${fdate(s.windowEnd)}</td><td class="n">${s.grade || '—'}${s.compliance != null ? ` (${s.compliance})` : ''}</td><td class="n">${approx(s.exposureBase)}</td><td><button class="btn" data-act="del-snap" data-id="${esc(s.id)}">Delete</button></td></tr>`).join('') || '<tr><td colspan="5" class="muted">None yet.</td></tr>'}</tbody></table></div>
    </div>
    <div class="panel"><h3 style="margin-top:0">Alert thresholds</h3>
      <label class="field">Alert when base exposure exceeds ($)<input type="number" data-th="exposureMax" value="${t.exposureMax}" step="10000"></label>
      <label class="field" style="margin-top:8px">Alert when a category rises by (%) per shift<input type="number" data-th="categoryIncreasePct" value="${t.categoryIncreasePct}"></label>
      <label class="field" style="margin-top:8px">Alert when compliance falls below<input type="number" data-th="scoreMax" value="${t.scoreMax}"></label>
      <p class="small muted" style="margin-top:10px">Saved runs keep summary figures only (no employee records)${S.caps.db ? ', privately in your account' : ' in this browser'}.</p>
      <h3>Monthly routine</h3><ol class="small"><li>Export the last month of punches and payroll.</li><li>Import and run the audit.</li><li>Save the run, review alerts, and open the Detective for anything that rose.</li><li>Pay amounts owed and record corrective steps.</li></ol></div></div>`;
  el.querySelectorAll('[data-th]').forEach(i => i.addEventListener('change', e => { t[e.target.dataset.th] = Number(e.target.value) || 0; X.persist(); X.render(); }));
};
X.saveSnap = async () => {
  if (!S.result) return; const label = prompt('Name this run', `${S.input.employerName} — ${S.result.engine.meta.windowEnd.slice(0, 7)}`); if (label === null) return;
  const where = await X.saveSnapshot(PC.snapshot(label || 'Run', S.input, S.result, S.patterns.anomalies));
  toast(`Run saved to ${where}`); if (S.view === 'monitor') X.render();
};
})();
