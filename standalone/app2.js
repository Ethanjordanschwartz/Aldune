/* Aldune standalone — part 2: executive dashboard, Detective, findings, workers */
(() => {
'use strict';
const X = window.PCX; const { PC, S, $, esc, money, approx, fdate, pct, toast, head, ai, GUARD, VIEWS, openDrawer } = X;
const RISKC = { Low: '#2F7D4F', Moderate: '#B08900', Elevated: '#C2671A', High: '#B42318', Critical: '#7A1410' };
const counted = f => f.confidence !== 'low' && !f.premiumIndicated;

function gaugeGrade(score, grade, level) {
  const col = score >= 80 ? 'var(--ledger)' : score >= 60 ? 'var(--warn)' : 'var(--flag)'; const c = Math.PI * 70, p = Math.max(0, Math.min(100, score)) / 100;
  return `<svg viewBox="0 0 180 104" width="190" role="img" aria-label="Compliance grade ${grade}, ${score} of 100"><path d="M20 94 A70 70 0 0 1 160 94" fill="none" stroke="var(--sunk)" stroke-width="16" stroke-linecap="round"/><path d="M20 94 A70 70 0 0 1 160 94" fill="none" stroke="${col}" stroke-width="16" stroke-linecap="round" stroke-dasharray="${c * p} ${c}"/><text x="90" y="78" text-anchor="middle" font-size="34" font-weight="800" fill="currentColor">${grade}</text><text x="90" y="98" text-anchor="middle" font-size="12" fill="currentColor" opacity=".7">${score}/100 · ${level} risk</text></svg>`;
}
function gauge(score, level) {
  const c = Math.PI * 70, p = Math.max(0, Math.min(100, score)) / 100;
  return `<svg viewBox="0 0 180 104" width="190" role="img" aria-label="Risk score ${score} of 100, ${level}"><path d="M20 94 A70 70 0 0 1 160 94" fill="none" stroke="var(--sunk)" stroke-width="16" stroke-linecap="round"/><path d="M20 94 A70 70 0 0 1 160 94" fill="none" stroke="${RISKC[level]}" stroke-width="16" stroke-linecap="round" stroke-dasharray="${c * p} ${c}"/><text x="90" y="80" text-anchor="middle" font-size="34" font-weight="800" fill="currentColor">${score}</text><text x="90" y="99" text-anchor="middle" font-size="12" fill="var(--ink2)">of 100</text></svg>`;
}
const bars = rows => { const max = Math.max(1, ...rows.map(r => r.v)); return `<div class="bars">${rows.map(r => `<div class="bar"><span>${esc(r.l)}${r.s ? `<br><span class="cite">${esc(r.s)}</span>` : ''}</span><span class="track" aria-hidden="true"><span class="fill ${r.pen ? 'pen' : ''}" style="width:${Math.max(r.v ? 1.5 : 0, r.v / max * 100)}%"></span></span><span class="amt">${r.fmt ? r.fmt(r.v) : approx(r.v)}</span></div>`).join('')}</div>`; };
X.bars = bars; X.gauge = gauge;

function byLocation() {
  const m = new Map();
  S.result.engine.findings.forEach(f => { if (!counted(f)) return; const l = S.empIndex.get(f.employeeId)?.location || 'Unassigned'; const g = m.get(l) || { x: 0, n: 0, e: new Set() }; g.x += f.amount; g.n++; g.e.add(f.employeeId); m.set(l, g); });
  return [...m.entries()].map(([k, g]) => ({ name: k, exposure: g.x, findings: g.n, employees: g.e.size })).sort((a, b) => b.exposure - a.exposure);
}
X.byLocation = byLocation;

// ---------------- Executive dashboard ("PAGA CFO")
VIEWS.exec = el => {
  const r = S.result, e = r.exposure, m = r.engine.meta;
  const def = PC.runScenario(S.input, r, { ...PC.DEFAULT_SCENARIO, ...PC.PERSPECTIVES.defense });
  const neu = PC.runScenario(S.input, r, { ...PC.DEFAULT_SCENARIO, ...PC.PERSPECTIVES.neutral });
  const pl = PC.runScenario(S.input, r, { ...PC.DEFAULT_SCENARIO, ...PC.PERSPECTIVES.plaintiff });
  const locs = byLocation(); const top = r.categories.filter(c => c.base > 0)[0]; const an = S.patterns.anomalies[0];
  const owed = r.engine.employees.reduce((t, x) => t + x.exposure.wagesAndPremiums + x.exposure.reimbursement + x.exposure.interest, 0);
  const affected = new Set(r.engine.findings.filter(counted).map(f => f.employeeId)).size;
  el.innerHTML = head(S.input.employerName, `California labor exposure · ${fdate(m.windowStart)} – ${fdate(m.windowEnd)} · ${S.input.employees.length.toLocaleString()} workers · ${r.engine.shifts.length.toLocaleString()} shifts · data quality ${r.quality.score}%`, `<button class="btn" data-act="save-snap">Save to monitoring</button><button class="btn primary" data-act="go" data-to="documents">Fix what’s owed</button>`) + `
    <div class="kpis">
      <div class="kpi risk"><div class="v">${approx(def.total)}–${approx(neu.total)}</div><div class="k">Likely exposure (defense to neutral model, full lookback)</div></div>
      <div class="kpi"><div class="v">${approx(pl.total)}</div><div class="k">Maximum theoretical exposure (plaintiff model)</div></div>
      <div class="kpi"><div class="v">${approx(owed)}</div><div class="k">Owed to workers now — the core of a cure</div></div>
      <div class="kpi"><div class="v">${affected.toLocaleString()}</div><div class="k">Workers with at least one finding</div></div>
    </div>
    <div class="split" style="margin-top:16px">
      <div class="panel"><h3 style="margin-top:0">Compliance grade</h3><div class="row" style="align-items:center;gap:20px">${(() => { const sc = PC.scorecard(S.input, r); return sc.overall === null ? `<div style="width:190px;text-align:center"><div style="font-family:var(--head);font-size:30px;font-weight:800">Incomplete</div><div class="small muted">${sc.coverage}% of areas testable</div></div>` : gaugeGrade(sc.overall, sc.grade, r.risk.level); })()}<div style="flex:1;min-width:220px"><div style="font-size:22px;font-weight:800;color:${RISKC[r.risk.level]}">${r.risk.level}</div>
        <table style="margin-top:6px"><tbody>${r.risk.components.map(c => `<tr><td class="small"><b>${c.name}.</b> <span class="muted">${esc(c.detail)}</span></td><td class="n small"><b>${c.points}/${c.max}</b></td></tr>`).join('')}</tbody></table></div></div></div>
      <div class="panel"><h3 style="margin-top:0">What to do next</h3>
        <ol class="steps-list small">
          ${top ? `<li><b>Highest-risk issue:</b> ${esc(top.label)} — ${top.findings.toLocaleString()} record${top.findings === 1 ? '' : 's'}, ${top.employees} worker${top.employees === 1 ? '' : 's'}, ${approx(top.base)} in the records reviewed.</li>` : ''}
          ${locs[0] ? `<li><b>Highest-risk location:</b> ${esc(locs[0].name)} — ${approx(locs[0].exposure)} across ${locs[0].employees} worker${locs[0].employees === 1 ? '' : 's'}.</li>` : ''}
          ${an ? `<li><b>Pattern to investigate:</b> ${esc(an.headline)}. <button class="btn" data-act="go" data-to="detective">Open the Detective</button></li>` : ''}
          <li><b>Pay amounts owed</b> (${approx(owed)}) with unconditional letters. <button class="btn" data-act="go" data-to="documents">Generate letters</button></li>
          <li><b>Document reasonable steps</b> to support the PAGA 15% cap. <button class="btn" data-act="go" data-to="steps">Open checklist</button></li>
        </ol></div>
    </div>
    <div class="split" style="margin-top:16px">
      <div class="panel"><h3 style="margin-top:0">Where the exposure comes from</h3><p class="small muted">Base estimate in the records reviewed. Penalties shown in amber.</p>${bars(r.categories.filter(c => c.base > 0).map(c => ({ l: c.label, s: `${c.findings.toLocaleString()} record${c.findings === 1 ? '' : 's'} · ${c.employees} worker${c.employees === 1 ? '' : 's'}`, v: c.base, pen: ['wage_statement', 'final_pay', 'pay_timing'].includes(c.category) })))}</div>
      <div class="panel"><h3 style="margin-top:0">By location</h3>${bars(locs.map(l => ({ l: l.name, s: `${l.findings.toLocaleString()} record${l.findings === 1 ? '' : 's'} · ${l.employees} worker${l.employees === 1 ? '' : 's'}`, v: l.exposure })))}
        <h3>Exposure ranges</h3><table><tbody>
        <tr><td>In records reviewed</td><td class="n">${approx(e.low)}–${approx(e.high)}</td></tr>
        <tr><td>Extended to limitations periods</td><td class="n">${approx(e.lookbackLow)}–${approx(e.lookbackHigh)}</td></tr>
        <tr><td>PAGA penalties, one year</td><td class="n">${approx(r.paga.annualLow)}–${approx(r.paga.annualHigh)}</td></tr></tbody></table>
        <p class="small muted" style="margin-top:8px">Confidence: ${e.confidence}. See Methodology for assumptions.</p></div>
    </div>
    <div class="panel" style="margin-top:16px"><h3 style="margin-top:0">Executive summary<span class="badge-ai">AI</span></h3><div id="ai-exec">${S.aiCache.exec ? `<div class="ai-out">${esc(S.aiCache.exec)}</div>` : `<button class="btn" data-act="ai-exec">Write summary for leadership</button>`}</div></div>`;
};
X.aiExec = async () => {
  const out = $('#ai-exec'); const r = S.result;
  const facts = { employer: S.input.employerName, window: [r.engine.meta.windowStart, r.engine.meta.windowEnd], workers: S.input.employees.length, shifts: r.engine.shifts.length, dataQuality: r.quality.score, risk: { score: r.risk.score, level: r.risk.level }, exposure: r.exposure, paga: { low: r.paga.annualLow, high: r.paga.annualHigh }, categories: r.categories.map(c => ({ label: c.label, findings: c.findings, workers: c.employees, base: Math.round(c.base) })), locations: byLocation().slice(0, 6).map(l => ({ ...l, exposure: Math.round(l.exposure) })), patterns: S.patterns.anomalies.slice(0, 4).map(a => ({ headline: a.headline, explanation: a.explanation, investigate: a.investigate })) };
  out.innerHTML = '<div class="ai-out">Writing…</div>';
  try { const res = await ai(`Write an executive summary (180–240 words, two short paragraphs, then three numbered next steps) of this preliminary California wage-and-hour audit for a CFO and general counsel. ${GUARD}\n<data>${JSON.stringify(facts)}</data>`, { onText: ({ text }) => { out.innerHTML = `<div class="ai-out">${esc(text)}</div>`; } }); S.aiCache.exec = res.text; }
  catch (e) { out.innerHTML = `<p class="small">${esc(e.message || 'The summary didn’t finish.')}</p>`; }
};

// ---------------- PAGA Detective
VIEWS.detective = el => {
  const p = S.patterns;
  el.innerHTML = head('PAGA Detective', 'Where problems concentrate, what the affected shifts have in common, and what to investigate. Every pattern is a statistically tested comparison against the company-wide rate (two-proportion z-test, at least 5 workers and 60 shifts, at least 1.5× the baseline).', `<button class="btn" data-act="dl-detective">Download investigation memo</button>`) + `
    <div class="kpis"><div class="kpi"><div class="v">${pct(p.baselines.meal)}</div><div class="k">Company-wide share of shifts with meal-period issues</div></div><div class="kpi"><div class="v">${pct(p.baselines.rest)}</div><div class="k">Share with rest-period issues</div></div><div class="kpi"><div class="v">${pct(p.baselines.unpaid_premium)}</div><div class="k">Flagged shifts with no premium paid</div></div><div class="kpi"><div class="v">${p.anomalies.length}</div><div class="k">Significant patterns found</div></div></div>
    <div class="panel" style="margin-top:14px"><h3 style="margin-top:0">Investigator’s narrative<span class="badge-ai">AI</span></h3><div id="ai-det">${S.aiCache.det ? `<div class="ai-out">${esc(S.aiCache.det)}</div>` : '<button class="btn" data-act="ai-det">Explain these patterns</button>'}</div></div>
    ${p.anomalies.length ? p.anomalies.map((a, i) => `
      <article class="anom"><span class="lift">${a.lift.toFixed(1)}×</span><h3>${i + 1}. ${esc(a.dimension)}: ${esc(a.value)}</h3>
        <div class="step"><b>Anomaly</b><span>${pct(a.rate)} of ${a.shifts.toLocaleString()} shifts have ${esc(a.metricLabel)}, versus ${pct(a.baseline)} company-wide (z = ${a.z}). About ${a.excessEvents.toLocaleString()} more problem shifts than expected, involving ${a.employees} workers — roughly ${approx(a.excessExposure)} in premiums.</span></div>
        <div class="step"><b>Possible explanation</b><span>${esc(a.explanation)}${a.drivers.slice(1).map(d => ` Also ${pct(d.share)} are “${esc(d.value)}” (vs ${pct(d.baseline)}).`).join('')}</span></div>
        <div class="step"><b>Investigate</b><span>${esc(a.investigate)}</span></div>
        <div class="row" style="margin-top:10px"><button class="btn" data-act="det-findings" data-dim="${esc(a.dimension)}" data-val="${esc(a.value)}" data-metric="${a.metric}">See the records</button></div>
      </article>`).join('') : '<div class="muted-box">No statistically significant concentrations. Problems are spread evenly — look at company-wide policies and payroll configuration.</div>'}
    <p class="small muted">Patterns show correlation, not cause. Interview supervisors and employees and review schedules before drawing conclusions.</p>`;
};
X.aiDet = async () => {
  const out = $('#ai-det');
  const data = S.patterns.anomalies.slice(0, 8).map(a => ({ pattern: a.headline, rate: a.rate, baseline: a.baseline, lift: a.lift, workers: a.employees, excessShifts: a.excessEvents, excessPremiums: a.excessExposure, drivers: a.drivers, suggested: a.investigate }));
  out.innerHTML = '<div class="ai-out">Thinking…</div>';
  try { const res = await ai(`You are helping an employment lawyer and HR leader investigate wage-and-hour patterns. Using only these statistically tested patterns, write a concise investigation narrative (under 220 words): which patterns likely share a root cause, what operational practices could explain them, the order to investigate in, and what records or interviews would confirm or rule out each explanation. ${GUARD}\n<data>${JSON.stringify(data)}</data>`, { onText: ({ text }) => { out.innerHTML = `<div class="ai-out">${esc(text)}</div>`; } }); S.aiCache.det = res.text; }
  catch (e) { out.innerHTML = `<p class="small">${esc(e.message || 'The narrative didn’t finish.')}</p>`; }
};

// ---------------- Findings
const CAT = PC.CATEGORY_LABELS; const STATUS = { open: 'New', under_review: 'Under review', confirmed: 'Confirmed', disputed: 'Disputed', remediated: 'Remediated', dismissed: 'Dismissed' };
S.fq = { status: '', cat: '', sev: '', conf: '', loc: '', q: '', sort: 'exposure', page: 1, emp: '', dim: '', val: '' };
function filteredFindings() {
  const q = S.fq; const s = q.q.toLowerCase();
  let list = S.result.engine.findings.filter(f => {
    const e = S.empIndex.get(f.employeeId) || {};
    if (q.status && (S.status[f.id] || 'open') !== q.status) return false;
    if (q.cat && f.category !== q.cat) return false; if (q.sev && f.severity !== q.sev) return false; if (q.conf && f.confidence !== q.conf) return false;
    if (q.loc && e.location !== q.loc) return false; if (q.emp && f.employeeId !== q.emp) return false;
    if (q.dim) { const v = { Location: e.location, Department: e.department, Supervisor: e.supervisor, 'Job title': e.jobTitle }[q.dim]; if (v !== undefined && v !== q.val) return false; if (q.dim === 'Day of week' && f.date && new Date(f.date + 'T00:00:00Z').toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }) !== q.val) return false; }
    if (s && !(f.id.toLowerCase().includes(s) || f.employeeId.toLowerCase().includes(s) || (e.name || '').toLowerCase().includes(s) || f.title.toLowerCase().includes(s))) return false;
    return true;
  });
  const sev = { high: 3, medium: 2, low: 1 };
  list = list.slice().sort((a, b) => q.sort === 'exposure' ? b.amount - a.amount : q.sort === 'severity' ? sev[b.severity] - sev[a.severity] : (b.date || b.periodEnd || '').localeCompare(a.date || a.periodEnd || ''));
  return list;
}
VIEWS.findings = el => {
  const q = S.fq; const list = filteredFindings(); const per = 50; const pages = Math.max(1, Math.ceil(list.length / per)); q.page = Math.min(q.page, pages);
  const items = list.slice((q.page - 1) * per, q.page * per);
  const locs = [...new Set(S.input.employees.map(e => e.location).filter(Boolean))];
  const sel = (id, opts, cur, label) => `<label class="field">${label}<select id="${id}"><option value="">All</option>${opts.map(([v, l]) => `<option value="${esc(v)}" ${cur === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;
  el.innerHTML = head('Findings', 'Every record the rules flagged, with the evidence behind it. Open one to review it and record a decision.', `<button class="btn" data-act="dl-findings">Export CSV</button>`) + `
    <div class="panel"><div class="row">
      <label class="field" style="flex:1;min-width:200px">Search<input id="fq-q" value="${esc(q.q)}" placeholder="Finding ID, worker, issue"></label>
      ${sel('fq-cat', S.result.categories.map(c => [c.category, c.label]), q.cat, 'Category')}${sel('fq-sev', [['high', 'High'], ['medium', 'Medium'], ['low', 'Low']], q.sev, 'Severity')}
      ${sel('fq-conf', [['high', 'High'], ['medium', 'Medium'], ['low', 'Insufficient evidence']], q.conf, 'Confidence')}${sel('fq-loc', locs.map(l => [l, l]), q.loc, 'Location')}${sel('fq-status', Object.entries(STATUS), q.status, 'Status')}
      <label class="field">Sort<select id="fq-sort">${[['exposure', 'Highest exposure'], ['date', 'Newest'], ['severity', 'Severity']].map(([v, l]) => `<option value="${v}" ${q.sort === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    </div>${q.emp || q.dim ? `<p class="small" style="margin-top:8px">Filtered to ${q.emp ? esc(S.empIndex.get(q.emp)?.name || q.emp) : `${esc(q.dim)}: ${esc(q.val)}`} <button class="btn" data-act="fq-clear">Clear</button></p>` : ''}</div>
    <p class="small muted" style="margin:10px 0">${list.length.toLocaleString()} findings · page ${q.page} of ${pages}</p>
    <div class="tablewrap"><table><thead><tr><th>ID</th><th>Worker</th><th>When</th><th>Finding</th><th>Status</th><th class="n">Estimated</th></tr></thead><tbody>
    ${items.map(f => { const e = S.empIndex.get(f.employeeId) || {}; return `<tr class="click" data-finding="${f.id}"><td class="small">${f.id}</td><td>${esc(e.name || f.employeeId)}<div class="cite">${esc(e.location || '')}</div></td><td class="small">${f.date ? fdate(f.date) : f.periodStart ? fdate(f.periodStart) + '–' : '—'}</td><td>${esc(f.title)}<div class="cite">${esc(CAT[f.category] || f.category)} · ${f.state === 'SUPPRESSED' ? `<b style="color:var(--ok)">cleared</b> — ${esc(f.suppressedBy || 'document on file')}` : f.state === 'POTENTIAL' ? `<b>potential</b> — ${f.missingInput ? 'needs ' + esc(f.missingInput) : 'payment or amount not verified'}` : f.confidence + ' confidence'}</div></td><td><span class="chip ${S.status[f.id] && S.status[f.id] !== 'open' ? 'ok' : ''}">${STATUS[S.status[f.id] || 'open']}</span></td><td class="n">${f.premiumIndicated ? '<span class="cite">premium paid?</span>' : f.state === 'SUPPRESSED' ? '<span class="cite">$0 · cleared</span>' : f.state === 'POTENTIAL' && !f.amount ? '<span class="cite">not priced</span>' : f.state === 'POTENTIAL' ? `<span class="cite">${money(f.amount, true)} if unpaid</span>` : money(f.amount, true)}</td></tr>`; }).join('')}
    </tbody></table></div>
    <div class="row" style="margin-top:10px">${q.page > 1 ? '<button class="btn" data-act="fq-prev">Previous</button>' : ''}${q.page < pages ? '<button class="btn" data-act="fq-next">Next</button>' : ''}</div>`;
  const bind = (id, k, ev = 'change') => { const n = $('#' + id); if (n) n.addEventListener(ev, e => { q[k] = e.target.value; q.page = 1; if (ev === 'change') X.render(); }); };
  bind('fq-cat', 'cat'); bind('fq-sev', 'sev'); bind('fq-conf', 'conf'); bind('fq-loc', 'loc'); bind('fq-sort', 'sort'); bind('fq-status', 'status');
  const qi = $('#fq-q'); qi.addEventListener('keydown', e => { if (e.key === 'Enter') { q.q = e.target.value; q.page = 1; X.render(); } });
};
X.filteredFindings = filteredFindings;
X.openFinding = id => {
  const f = S.result.engine.findings.find(x => x.id === id); if (!f) return; const e = S.empIndex.get(f.employeeId) || {}; const rule = PC.RULES[f.ruleId];
  openDrawer(f.title, `${f.id} · ${e.name || f.employeeId} · ${f.date ? fdate(f.date) : `${fdate(f.periodStart)} – ${fdate(f.periodEnd)}`}`, `
    <div class="row"><span class="chip ${f.severity === 'high' ? 'flag' : f.severity === 'medium' ? 'warn' : ''}">${f.severity} severity</span><span class="chip">${f.confidence === 'low' ? 'Insufficient evidence' : f.confidence + ' confidence'}</span>${f.premiumIndicated ? '<span class="chip ok">Payroll indicates a premium may have been paid</span>' : ''}</div>
    <p style="margin-top:12px">${esc(f.explanation)}</p><p><b>Estimated potential exposure:</b> ${money(f.amount, true)} (${f.amountKind === 'none' ? 'flag only' : f.amountKind})</p>
    <h3>Evidence from the records</h3><div class="tablewrap"><table><tbody>${Object.entries(f.evidence).filter(([, v]) => v !== null && v !== '').map(([k, v]) => `<tr><th>${esc(k.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()))}</th><td>${esc(String(v))}</td></tr>`).join('')}</tbody></table></div>
    ${f.notes ? (() => { const pl = S.pov === 'plaintiff'; const a = pl ? ['For employee counsel', f.notes.plaintiff, 'For the employer', f.notes.defense] : ['For the employer', f.notes.defense, 'For employee counsel', f.notes.plaintiff]; return `<h3>What to do</h3><div class="panel" style="padding:12px 14px"><b>${a[0]}</b><p class="small" style="margin:4px 0 10px">${esc(a[1])}</p><details><summary class="small">${a[2]}</summary><p class="small">${esc(a[3])}</p></details></div>`; })() : ''}
    <h3>Review</h3><div class="row"><select id="fd-status">${Object.entries(STATUS).map(([v, l]) => `<option value="${v}" ${(S.status[f.id] || 'open') === v ? 'selected' : ''}>${l}</option>`).join('')}</select><input id="fd-note" placeholder="Note (optional)" value="${esc((S.notes || {})[f.id] || '')}" style="flex:1;border:1px solid var(--line);border-radius:4px;padding:7px"><button class="btn primary" data-act="fd-save" data-id="${f.id}">Save</button></div>
    <h3>Rule applied</h3><p class="small"><b>${esc(rule?.name || f.ruleId)}</b> · ${esc(f.ruleVersion)}<br>${esc(rule?.calculation || '')}</p><p class="cite">${f.authorities.map(esc).join(' · ')}</p>
    <h3>Explain<span class="badge-ai">AI</span></h3><div id="ai-f"><button class="btn" data-act="ai-finding" data-id="${f.id}">Explain this finding in plain English</button></div>
    <p style="margin-top:14px"><button class="btn" data-act="open-worker" data-id="${esc(f.employeeId)}">Open ${esc(e.name || 'worker')}’s timecards</button></p>`);
};
X.aiFinding = async id => {
  const f = S.result.engine.findings.find(x => x.id === id); const out = $('#ai-f');
  out.innerHTML = '<div class="ai-out">Writing…</div>';
  try { await ai(`Explain this compliance finding to an HR manager in 3–5 sentences: what the records show, why it was flagged, what facts could make it a non-issue, and what to review next. ${GUARD}\n<data>${JSON.stringify(f)}</data>`, { onText: ({ text }) => { out.innerHTML = `<div class="ai-out">${esc(text)}</div>`; } }); }
  catch (e) { out.innerHTML = `<p class="small">${esc(e.message || 'Not available.')}</p>`; }
};

// ---------------- Workers and timecards
S.wq = { q: '', loc: '', page: 1 };
VIEWS.workers = el => {
  const q = S.wq; const s = q.q.toLowerCase();
  const list = S.result.engine.employees.filter(e => (!q.loc || e.employee.location === q.loc) && (!s || e.employee.name.toLowerCase().includes(s) || e.employee.id.toLowerCase().includes(s))).sort((a, b) => b.exposure.total - a.exposure.total);
  const per = 50, pages = Math.max(1, Math.ceil(list.length / per)); q.page = Math.min(q.page, pages);
  const locs = [...new Set(S.input.employees.map(e => e.location).filter(Boolean))];
  el.innerHTML = head('Workers and timecards', 'Estimated amounts by worker. Open a worker to see every shift drawn to scale and every pay period behind the numbers.') + `
    <div class="panel"><div class="row"><label class="field" style="flex:1">Search<input id="wq-q" value="${esc(q.q)}" placeholder="Name or ID"></label><label class="field">Location<select id="wq-loc"><option value="">All</option>${locs.map(l => `<option ${q.loc === l ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label></div></div>
    <div class="tablewrap" style="margin-top:12px"><table><thead><tr><th>Worker</th><th>Location / supervisor</th><th>Status</th><th class="n">Flagged shifts</th><th class="n">Owed now</th><th class="n">Penalties</th><th class="n">Total</th></tr></thead><tbody>
    ${list.slice((q.page - 1) * per, q.page * per).map(w => `<tr class="click" data-worker="${esc(w.employee.id)}"><td><b>${esc(w.employee.name)}</b><div class="cite">${esc(w.employee.jobTitle || '')} · ${esc(w.employee.id)}</div></td><td>${esc(w.employee.location || '')}<div class="cite">${esc(w.employee.supervisor || '')}</div></td><td>${w.misclassified ? '<span class="chip flag">Possibly misclassified</span>' : `<span class="chip">${esc(w.employee.classification)}</span>`}${w.employee.arbitration ? '<span class="chip">Arbitration</span>' : ''}</td><td class="n">${w.flaggedShifts}</td><td class="n">${money(w.exposure.wagesAndPremiums + w.exposure.reimbursement + w.exposure.interest)}</td><td class="n">${money(w.exposure.penalties + w.exposure.liquidated)}</td><td class="n"><b>${money(w.exposure.total)}</b></td></tr>`).join('')}
    </tbody></table></div><div class="row" style="margin-top:10px">${q.page > 1 ? '<button class="btn" data-act="wq-prev">Previous</button>' : ''}${q.page < pages ? '<button class="btn" data-act="wq-next">Next</button>' : ''}<span class="small muted">Page ${q.page} of ${pages}</span></div>`;
  $('#wq-q').addEventListener('keydown', e => { if (e.key === 'Enter') { q.q = e.target.value; q.page = 1; X.render(); } });
  $('#wq-loc').addEventListener('change', e => { q.loc = e.target.value; q.page = 1; X.render(); });
};
function strip(s, span, flagged) {
  const W = 1000, x = m => m / span * W, rel = m => m - s.clockIn;
  const at = t => { let v = t; s.meals.forEach(ml => { if (rel(ml.start) < v) v += ml.minutes; }); return v; };
  const marks = [s.workedMin > 300 ? at(300) : null, s.workedMin > 600 ? at(600) : null].filter(v => v !== null);
  return `<svg viewBox="0 0 ${W} 26" preserveAspectRatio="none" style="width:100%;height:26px;display:block" role="img" aria-label="Shift ${PC.fmtTime(s.clockIn)} to ${PC.fmtTime(s.clockOut)}"><rect x="0" y="7" width="${x(s.clockOut - s.clockIn)}" height="12" rx="2" fill="var(--work)"/>${s.meals.map(m => `<rect x="${x(rel(m.start))}" y="4" width="${Math.max(2, x(m.minutes))}" height="18" fill="var(--paper)" stroke="${m.minutes < 30 ? 'var(--flag)' : 'var(--ledger)'}" stroke-width="2"/>`).join('')}${marks.map(m => `<line x1="${x(m)}" x2="${x(m)}" y1="0" y2="26" stroke="var(--marker)" stroke-width="4"/>`).join('')}${flagged ? `<circle cx="${x(s.meals[0] ? rel(s.meals[0].start) : marks[0] || 0)}" cy="13" r="6" fill="var(--flag)"/>` : ''}</svg>`;
}
X.openWorker = id => {
  const w = S.sumIndex.get(id); if (!w) return; const fs = S.findingsBy.get(id) || [];
  const recs = S.recordsBy.get(id) || [];
  const shifts = recs.map(r => PC.analyzeShift(r, S.input.hasMealColumns)).filter(Boolean); PC.allocateOvertime(shifts, S.result.engine.meta.assumptions);
  const byDate = new Map(); fs.forEach(f => { if (f.date) { if (!byDate.has(f.date)) byDate.set(f.date, []); byDate.get(f.date).push(f); } });
  const flagged = shifts.filter(s => byDate.has(s.date)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 80);
  const span = Math.max(720, ...flagged.map(s => s.clockOut - s.clockIn));
  const periodF = fs.filter(f => !f.date);
  openDrawer(w.employee.name, `${w.employee.jobTitle || ''} · ${w.employee.location || ''} · ${w.employee.id}${w.misclassified ? ' · analyzed as nonexempt' : ''}`, `
    <div class="kpis" style="grid-template-columns:repeat(3,1fr)"><div class="kpi"><div class="v">${w.flaggedShifts}</div><div class="k">Shifts with meal/rest findings of ${w.shifts}</div></div><div class="kpi risk"><div class="v">${money(w.exposure.wagesAndPremiums + w.exposure.reimbursement + w.exposure.interest, true)}</div><div class="k">Owed now</div></div><div class="kpi"><div class="v">${money(w.exposure.penalties + w.exposure.liquidated, true)}</div><div class="k">Penalties</div></div></div>
    ${periodF.length ? `<h3>Pay period and employment findings</h3><div class="tablewrap"><table><tbody>${periodF.map(f => `<tr class="click" data-finding="${f.id}"><td class="small">${f.periodStart ? fdate(f.periodStart) : '—'}</td><td>${esc(f.title)}</td><td class="n">${money(f.amount, true)}</td></tr>`).join('')}</tbody></table></div>` : ''}
    <h3>Flagged shifts</h3><p class="cite">Yellow lines mark the end of the 5th and 10th hours of work. Showing up to 80 most recent flagged shifts.</p>
    ${flagged.map(s => `<div class="tc-row"><div class="d"><b>${new Date(s.date + 'T00:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })}</b>${(s.workedMin / 60).toFixed(2)} h</div><div>${strip(s, span, byDate.get(s.date).some(f => f.category === 'meal'))}<div class="why">${byDate.get(s.date).map(f => `<span class="${f.premiumIndicated ? 'fine' : 'bad'}">${esc(f.title)}</span>`).join('<br>')}<br><span class="fine">${PC.fmtTime(s.clockIn)} – ${PC.fmtTime(s.clockOut)}${s.meals.map(m => ` · meal ${PC.fmtTime(m.start)} (${m.minutes} min)`).join('')}</span></div></div></div>`).join('') || '<p class="muted">No flagged shifts.</p>'}
    <div class="row" style="margin-top:14px"><button class="btn primary" data-act="worker-letter" data-id="${esc(id)}">Wage letter for this worker</button><button class="btn" data-act="worker-findings" data-id="${esc(id)}">All findings</button></div>`);
};
})();
