/* Aldune standalone — part 6: AI provider settings, built-in fallbacks, law library, confidence, Risk Explorer, strategies, board brief, continuous monitoring */
(() => {
'use strict';
const X = window.PCX; const { PC, S, $, esc, money, approx, fdate, pct, toast, head, VIEWS, openDrawer } = X;
const builtin = () => X.aiMode() === 'builtin';
const out = (id, text) => { const el = $(id); if (el) el.innerHTML = `<div class="ai-out">${esc(text)}</div><p class="cite">Written by the built-in engine from your audit data. Connect an AI provider for a narrative version.</p>`; };

// ======================================================= deterministic fallbacks for narrative features
const strategies = () => {
  const run = over => PC.runScenario(S.input, S.result, { ...PC.DEFAULT_SCENARIO, ...PC.PERSPECTIVES.neutral, pagaRegime: S.scenario.pagaRegime || 'post2024', excludeFindingIds: S.scenario.excludeFindingIds || [], ...over });
  const base = run({});
  const top20 = S.result.engine.employees.slice().sort((a, b) => b.exposure.total - a.exposure.total).slice(0, 20).map(e => e.employee.id);
  const biggest = S.result.categories.filter(c => c.base > 0).slice(0, 3).map(c => c.category);
  const list = [
    ['Fix meal periods', { excludeCategories: ['meal'] }], ['Fix rest periods', { excludeCategories: ['rest'] }], ['Fix regular-rate and overtime pay', { excludeCategories: ['regular_rate', 'reconciliation'] }],
    ['Pay and correct the 20 highest-exposure workers', { excludeEmployeeIds: top20 }], ['Document reasonable steps before any notice (15% PAGA cap)', { pagaCap: 'pre' }],
    [`Fix the three largest areas (${biggest.map(c => PC.CATEGORY_LABELS[c]).join(', ')}) and document reasonable steps`, { excludeCategories: biggest, pagaCap: 'pre' }]
  ].map(([name, over]) => { const r = run(over); return { name, total: r.total, delta: r.total - base.total, pctCut: base.total ? (base.total - r.total) / base.total : 0 }; });
  return { base, list: list.sort((a, b) => a.total - b.total) };
};
X.strategies = strategies;
const execText = () => { const r = S.result, p = S.patterns.anomalies[0], st = strategies(); const cats = r.categories.filter(c => c.base > 0).slice(0, 3);
  return `${S.input.employerName}'s records from ${fdate(r.engine.meta.windowStart)} to ${fdate(r.engine.meta.windowEnd)} (${S.input.employees.length.toLocaleString()} workers, ${r.engine.shifts.length.toLocaleString()} shifts) show a risk score of ${r.risk.score}/100 (${r.risk.level}). Estimated potential exposure is ${approx(r.exposure.low)}–${approx(r.exposure.high)} in the records reviewed and ${approx(r.exposure.lookbackLow)}–${approx(r.exposure.lookbackHigh)} over the limitations periods; the neutral litigation model is ${approx(st.base.total)}.\n\nThe largest areas are ${cats.map(c => `${c.label.toLowerCase()} (${approx(c.base)}, ${c.employees} workers)`).join(', ')}.${p ? ` The strongest pattern: ${p.headline}. ${p.investigate}` : ''}\n\nNext steps:\n1. Pay amounts owed now (${approx(r.engine.employees.reduce((t, e) => t + e.exposure.wagesAndPremiums + e.exposure.reimbursement + e.exposure.interest, 0))}) with unconditional wage letters.\n2. ${st.list[0].name} — modeled to cut exposure by about ${Math.round(st.list[0].pctCut * 100)}%.\n3. Document corrective steps to support the PAGA reasonable-steps caps, and re-run the audit next month.\n\nThese are preliminary findings from the data supplied; have California employment counsel review before relying on them.`; };
const wrap = (name, fallback) => { const orig = X[name]; X[name] = async (...a) => (builtin() ? fallback(...a) : orig(...a)); };
wrap('aiExec', () => { S.aiCache.exec = execText(); out('#ai-exec', S.aiCache.exec); });
wrap('aiDet', () => { const t = S.patterns.anomalies.slice(0, 5).map((a, i) => `${i + 1}. ${a.headline}. ${a.explanation} Investigate: ${a.investigate}`).join('\n\n') || 'No statistically significant concentrations were found.'; S.aiCache.det = t; out('#ai-det', t); });
wrap('aiFinding', id => { const f = S.result.engine.findings.find(x => x.id === id); const l = PC.ledgerFor(f, S.result.engine.meta.assumptions); const c = PC.confidenceFor(f, (S.q2 && S.q2.confidence) || 'High'); out('#ai-f', `${f.explanation}\n\nHow the amount was calculated: ${l.formula} = ${money(l.result, true)}.\n\nWhat could make it a non-issue: ${(PC.RULES[f.ruleId]?.exceptions || []).slice(0, 3).join('; ') || 'see the rule’s exceptions'}.\n\nConfidence — legal ${c.legal}, data ${c.data}, calculation ${c.calculation}. ${c.reasons.join(' ')}`); });
wrap('aiSettle', () => { const { v } = X.settleModel(); const t = ['Defense points (modeled):', ...v.explanation.map(x => `• ${x}`), '• Arbitration agreements remove individual class claims but not representative PAGA claims (Iskanian; Viking River; Adolph).', '• Penalty elements — willfulness (§ 203) and knowing-and-intentional injury (§ 226(e)) — are frequently contested.', '• Premiums already paid and reasonable steps taken reduce PAGA exposure (Lab. Code § 2699, 2024 amendments).', 'Risks: Donohue presumption for meal punches; Naranjo makes unpaid premiums support derivative claims; courts may not dismiss PAGA claims as unmanageable (Estrada).'].join('\n'); S.aiCache.st = t; out('#ai-st', t); });

// ======================================================= AI provider settings
VIEWS.aiset = el => {
  const c = X.aiConfig(); let raw = {}; try { raw = JSON.parse(localStorage.getItem('paycure:ai') || '{}'); } catch { raw = {}; }
  const enhanced = X.aiMode() !== 'builtin'; const owner = S.isOwner || !S.caps.db;
  el.innerHTML = head('Aldune AI', 'Everything in Aldune works right here in your browser. Calculations, findings, the investigator, document review, letters, and the law library are always on. Enhanced AI adds conversational, open-ended answers on top.') + `
    <div class="kpis"><div class="kpi"><div class="v" style="font-size:22px">On</div><div class="k">Aldune Intelligence — grounded answers from your data and the cited law library</div></div><div class="kpi"><div class="v" style="font-size:22px">${enhanced ? 'Connected' : 'Not connected'}</div><div class="k">Enhanced AI — free-form questions, narratives, and AI document review</div></div></div>
    <div class="grid g2" style="margin-top:14px">
      <div class="panel"><h3 style="margin-top:0">Aldune Intelligence (always on)</h3><p class="small">Answers questions about your audit — risks, findings, workers, patterns, what-if scenarios — and California wage-and-hour law from Aldune’s cited knowledge base, then links you to the tool that resolves it. It never guesses: out-of-scope questions are declined.</p></div>
      ${owner ? `<div class="panel"><h3 style="margin-top:0">Enhanced AI connection (administrator)</h3><p class="small">Connect once for your workspace. Use your Aldune AI endpoint (recommended — the key stays on your server; template in <code>standalone/proxy/</code>) or an Anthropic API key stored only in this browser.</p>
        <label class="field">Workspace AI endpoint<input id="ai-ep" value="${esc(raw.endpoint || S.cfg.assistantEndpoint || '')}" placeholder="https://ai.yourdomain.com/messages"></label>
        <label class="field" style="margin-top:8px">Or API key (this browser only)<input id="ai-key" type="password" autocomplete="off" value="${raw.key ? '••••••••' + esc(String(raw.key).slice(-4)) : ''}" placeholder="sk-ant-…"></label>
        <label class="field" style="margin-top:8px">Model<select id="ai-model">${['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-haiku-4-5-20251001'].map(m => `<option ${c.model === m ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
        <div class="row" style="margin-top:10px"><button class="btn primary" data-act="ai-save">Save</button><button class="btn" data-act="ai-test">Test connection</button><button class="btn" data-act="ai-clear">Disconnect</button></div></div>` : `<div class="panel"><h3 style="margin-top:0">Enhanced AI</h3><p class="small">${enhanced ? 'Your workspace has enhanced AI enabled.' : 'Your workspace administrator can enable enhanced AI. Everything else works now.'}</p></div>`}</div>`;
};

// ======================================================= law library (closed-universe knowledge base)
VIEWS.law = el => {
  el.innerHTML = head('California wage-and-hour law library', `The curated knowledge base Aldune’s assistant answers from — ${PC.LAW.length} topics with authorities and verification dates. Legal information, not legal advice.`) + `<label class="field" style="max-width:420px">Search<input id="law-q" placeholder="e.g., second meal, Los Angeles minimum wage, PAGA 2024"></label><div id="law-list" style="margin-top:12px"></div>`;
  const draw = q => { const list = q ? PC.searchLaw(q, 12).map(h => h.topic) : PC.LAW; $('#law-list').innerHTML = list.map(t => `<details class="law" id="law-${esc(t.id)}" ${S.lawOpen === t.id ? 'open' : ''}><summary>${esc(t.title)}${t.status ? ' <span class="chip warn">open question</span>' : ''}</summary><p>${esc(t.summary)}</p><ul class="small">${t.points.map(p => `<li>${esc(p)}</li>`).join('')}</ul>${t.status ? `<p class="note small">${esc(t.status)}</p>` : ''}<p class="cite">${t.citations.map(esc).join(' · ')} · verified ${esc(t.verified)}${t.engineRule ? ` · applied by rule ${esc(t.engineRule)}` : ''}</p></details>`).join('') || '<p class="muted">No matching topic in the knowledge base.</p>'; };
  draw(''); $('#law-q').addEventListener('input', e => draw(e.target.value.trim()));
};

// ======================================================= finding drawer: confidence trio + source records
const origOpen = X.openFinding;
X.openFinding = id => {
  origOpen(id); const f = S.result.engine.findings.find(x => x.id === id); if (!f) return;
  const c = PC.confidenceFor(f, (S.q2 && S.q2.confidence) || 'High'); const tone = l => (l === 'High' ? 'ok' : l === 'Medium' ? 'warn' : 'flag');
  const src = f.evidence.sourceRecords; const recs = (S.recordsBy.get(f.employeeId) || []).filter(t => t.date === f.date);
  const html = `<div class="panel" style="padding:12px 14px;margin-bottom:12px"><b class="small">Why was this flagged?</b><div class="row" style="margin-top:6px"><span class="chip ${tone(c.legal)}">Legal/rule: ${c.legal}</span><span class="chip ${tone(c.data)}">Data: ${c.data}</span><span class="chip ${tone(c.calculation)}">Calculation: ${c.calculation}</span><span class="chip ${tone(c.overall)}">Overall: ${c.overall}</span></div>${c.reasons.length ? `<ul class="small" style="margin-top:6px">${c.reasons.map(r => `<li>${esc(r)}</li>`).join('')}</ul>` : ''}
    <p class="small" style="margin-top:6px"><b>Source records:</b> ${esc(src || 'derived from the employee census and payroll register')}</p>
    ${recs.length ? `<div class="tablewrap"><table><thead><tr><th>Row</th><th>Date</th><th>In</th><th>Meal out</th><th>Meal in</th><th>Out</th><th>Rest breaks</th></tr></thead><tbody>${recs.map(t => `<tr><td class="small">${t.sourceRow || '—'}</td><td class="small">${t.date}</td><td class="small">${PC.fmtTime(t.clockIn)}</td><td class="small">${PC.fmtTime(t.meals[0]?.out)}</td><td class="small">${PC.fmtTime(t.meals[0]?.in)}</td><td class="small">${PC.fmtTime(t.clockOut)}</td><td class="small">${t.restBreaksTaken ?? (t.attestation ? `attested ${t.attestation.restProvided === false ? 'missed' : 'taken'}` : '—')}</td></tr>`).join('')}</tbody></table></div>` : ''}</div>`;
  $('#drawer-body').insertAdjacentHTML('afterbegin', html);
};

// ======================================================= Risk Explorer: total → category → worker → finding → records → calculation
S.rx = { cat: null, emp: null };
VIEWS.explorer = el => {
  const r = S.result; const counted = f => f.confidence !== 'low' && !f.premiumIndicated;
  const crumbs = [`<button class="btn" data-act="rx" data-cat="" data-emp="">All exposure ${approx(r.exposure.base)}</button>`];
  let body = '';
  if (!S.rx.cat) {
    const max = Math.max(1, ...r.categories.map(c => c.base));
    body = `<p class="small muted">Base estimate in the records reviewed (high and medium confidence) plus interest. Select a category.</p><div class="tablewrap"><table><thead><tr><th>Category</th><th></th><th class="n">Records</th><th class="n">Workers</th><th class="n">Base</th><th class="n">Share</th></tr></thead><tbody>${r.categories.filter(c => c.findings > 0).map(c => `<tr class="click" data-act="rx" data-cat="${c.category}" data-emp=""><td><b>${esc(c.label)}</b></td><td style="width:30%"><div style="height:10px;background:var(--sunk);border-radius:2px"><div style="height:10px;width:${c.base / max * 100}%;background:var(--ledger);border-radius:2px"></div></div></td><td class="n">${c.findings.toLocaleString()}</td><td class="n">${c.employees}</td><td class="n">${money(c.base)}</td><td class="n">${pct(c.base / r.exposure.base)}</td></tr>`).join('')}<tr><td>Interest (10% simple)</td><td></td><td></td><td></td><td class="n">${money(r.exposure.interest)}</td><td class="n">${pct(r.exposure.interest / r.exposure.base)}</td></tr></tbody></table></div>`;
  } else if (!S.rx.emp) {
    const fs = r.engine.findings.filter(f => f.category === S.rx.cat && counted(f)); const by = new Map(); fs.forEach(f => { const g = by.get(f.employeeId) || { n: 0, a: 0 }; g.n++; g.a += f.amount; by.set(f.employeeId, g); });
    crumbs.push(`<span>›</span><b>${esc(PC.CATEGORY_LABELS[S.rx.cat])}</b>`);
    body = `<div class="tablewrap"><table><thead><tr><th>Worker</th><th>Location / supervisor</th><th class="n">Findings</th><th class="n">Amount</th></tr></thead><tbody>${[...by.entries()].sort((a, b) => b[1].a - a[1].a).slice(0, 300).map(([id, g]) => { const e = S.empIndex.get(id) || {}; return `<tr class="click" data-act="rx" data-cat="${S.rx.cat}" data-emp="${esc(id)}"><td><b>${esc(e.name || id)}</b><div class="cite">${esc(e.jobTitle || '')}</div></td><td class="small">${esc(e.location || '')} · ${esc(e.supervisor || '')}</td><td class="n">${g.n}</td><td class="n">${money(g.a, true)}</td></tr>`; }).join('')}</tbody></table></div>`;
  } else {
    const e = S.empIndex.get(S.rx.emp) || {}; const fs = r.engine.findings.filter(f => f.category === S.rx.cat && f.employeeId === S.rx.emp).sort((a, b) => (a.date || a.periodStart || '').localeCompare(b.date || b.periodStart || ''));
    crumbs.push(`<span>›</span><button class="btn" data-act="rx" data-cat="${S.rx.cat}" data-emp="">${esc(PC.CATEGORY_LABELS[S.rx.cat])}</button><span>›</span><b>${esc(e.name || S.rx.emp)}</b>`);
    body = `<p class="small muted">Open a finding to see its source records, calculation ledger, confidence, and review status.</p><div class="tablewrap"><table><thead><tr><th>Date / period</th><th>Finding</th><th>Formula</th><th class="n">Amount</th><th>Status</th></tr></thead><tbody>${fs.map(f => { const l = PC.ledgerFor(f, r.engine.meta.assumptions); return `<tr class="click" data-finding="${f.id}"><td class="small">${f.date ? fdate(f.date) : `${fdate(f.periodStart)} – ${fdate(f.periodEnd)}`}</td><td>${esc(f.title)}<div class="cite">${f.id} · ${f.confidence === 'low' ? 'insufficient evidence' : f.confidence + ' confidence'}</div></td><td class="small">${esc(l.formula)}</td><td class="n">${f.premiumIndicated ? '<span class="cite">premium paid?</span>' : money(f.amount, true)}</td><td><span class="chip">${esc((S.ws?.status?.[f.id]?.s) || 'new')}</span></td></tr>`; }).join('')}</tbody></table></div>`;
  }
  el.innerHTML = head('Risk Explorer', 'Drill from the total down to the individual punch: category → worker → finding → source records → calculation. Every level adds up to the one above it.') + `<div class="row" style="margin-bottom:12px">${crumbs.join(' ')}</div>${body}<h2>How much could remediation reduce exposure?</h2>${stratTable()}`;
};
function stratTable() {
  const st = strategies();
  return `<div class="tablewrap"><table><thead><tr><th>Strategy</th><th class="n">Current</th><th class="n">After</th><th class="n">Difference</th><th class="n">Reduction</th></tr></thead><tbody>${st.list.map(s => `<tr><td>${esc(s.name)}</td><td class="n">${money(st.base.total)}</td><td class="n">${money(s.total)}</td><td class="n">${money(s.delta)}</td><td class="n"><b>${Math.round(s.pctCut * 100)}%</b></td></tr>`).join('')}</tbody></table></div><p class="cite">Neutral litigation model (full lookback, PAGA one year). “Fix” means the category is corrected and amounts owed are paid; prospective fixes don’t erase past liability unless paid or released.</p>`;
}
X.stratTable = stratTable;
const origExec = VIEWS.exec;
VIEWS.exec = el => { origExec(el); el.insertAdjacentHTML('beforeend', `<div class="panel" style="margin-top:16px"><h3 style="margin-top:0">How much could remediation reduce exposure?</h3>${stratTable()}<div class="row" style="margin-top:10px"><button class="btn primary" data-act="rpt" data-r="board">One-click board risk brief</button><button class="btn" data-act="go" data-to="explorer">Open Risk Explorer</button></div></div>`); };

// ======================================================= board brief report
if (X.REPORTS) X.REPORTS.board = ['Board risk brief', 'One-click brief for the CEO, CFO, GC, or board: risk, concentration, drivers, actions, and how much remediation reduces exposure.', () => {
  const r = S.result, st = strategies(), P = t => ({ t: 'p', runs: [t] }), H = t => ({ t: 'heading', text: t });
  const locs = X.byLocation().slice(0, 5); const top = r.engine.employees.slice().sort((a, b) => b.exposure.total - a.exposure.total).slice(0, 5);
  return { title: 'Board risk brief', draftBanner: 'CONFIDENTIAL — Prepared with Aldune decision-support software. Not legal advice.', blocks: [
    { t: 'title', text: `California Wage-and-Hour Risk Brief — ${S.input.employerName}` }, P(`${fdate(r.engine.meta.windowStart)} – ${fdate(r.engine.meta.windowEnd)} · ${S.input.employees.length.toLocaleString()} workers · risk ${r.risk.score}/100 (${r.risk.level}) · data quality ${S.q2?.score ?? r.quality.score}%`),
    H('1. How much risk do we have?'), { t: 'table', head: ['Measure', 'Amount'], rows: [['Owed to workers now (wages, premiums, interest)', money(r.engine.employees.reduce((t, e) => t + e.exposure.wagesAndPremiums + e.exposure.reimbursement + e.exposure.interest, 0))], ['Exposure in records reviewed (low–high)', `${money(r.exposure.low)} – ${money(r.exposure.high)}`], ['Modeled litigation exposure (neutral)', money(st.base.total)], ['PAGA, one year (calculated range)', `${money(r.paga.annualLow)} – ${money(r.paga.annualHigh)}`]] },
    H('2. Where is it concentrated?'), { t: 'table', head: ['Location', 'Exposure', 'Workers'], rows: locs.map(l => [l.name, money(l.exposure), String(l.employees)]) },
    H('3. What are the largest problems?'), { t: 'table', head: ['Area', 'Records', 'Workers', 'Base'], rows: r.categories.filter(c => c.base > 0).slice(0, 5).map(c => [c.label, c.findings.toLocaleString(), String(c.employees), money(c.base)]) },
    H('4. What drives it?'), { t: 'bullets', items: (S.patterns.anomalies.slice(0, 4).map(a => [`${a.headline}. ${a.investigate}`])).concat(top.length ? [[`Highest-exposure workers: ${top.map(t => `${t.employee.name} (${money(t.exposure.total)})`).join('; ')}.`]] : []) },
    H('5. What should we do next — and what is it worth?'), { t: 'table', head: ['Strategy', 'Exposure after', 'Reduction'], rows: st.list.map(s => [s.name, money(s.total), `${Math.round(s.pctCut * 100)}%`]) },
    { t: 'bullets', items: [['Pay identified amounts with unconditional letters (Lab. Code § 206.5).'], ['Fix root causes at the locations and supervisors above.'], ['Document reasonable steps (periodic audits, policies, training) to support the PAGA 15% cap.'], ['Monitor monthly and report trend to leadership.']] },
    P('Estimates depend on the data supplied and the assumptions shown in the full report; they are not determinations of liability. Have qualified California employment counsel review.')] };
}];

// ======================================================= rule registry: effective-dated minimum wages
const origRules = VIEWS.rules;
VIEWS.rules = el => { origRules(el); el.insertAdjacentHTML('beforeend', `<h2>Local minimum wage ordinances (applied by work location)</h2><div class="tablewrap"><table><thead><tr><th>Locality</th><th>Effective-dated rates</th></tr></thead><tbody>${Object.entries(PC.LOCAL_MIN_WAGE).map(([c, s]) => `<tr><td>${esc(c.replace(/\b\w/g, m => m.toUpperCase()))}</td><td class="small">${s.map(x => `${money(x.rate, true)} from ${x.effective}${x.note ? ` (${esc(x.note)})` : ''}`).join(' · ')}</td></tr>`).join('')}</tbody></table></div><h2>Industry minimum wages</h2><table><tbody>${Object.values(PC.INDUSTRY_MIN_WAGE).map(x => `<tr><td>${esc(x.label)}</td><td class="small">${x.schedule.map(s => `${money(s.rate, true)} from ${s.effective}`).join(' · ')}</td></tr>`).join('')}</tbody></table><h2>Agricultural overtime phase-in (AB 1066)</h2><table><thead><tr><th>Year</th><th>26+ employees</th><th>25 or fewer</th></tr></thead><tbody>${[2019, 2020, 2021, 2022, 2023, 2024, 2025].map(y => { const a = PC.agOvertimeThresholds(`${y}-06-01`, false), b = PC.agOvertimeThresholds(`${y}-06-01`, true); const f = t => `OT after ${t.daily} h/day or ${t.weekly} h/week${t.dt !== Infinity ? `; DT after ${t.dt} h` : ''}`; return `<tr><td>${y}</td><td class="small">${f(a)}</td><td class="small">${f(b)}</td></tr>`; }).join('')}</tbody></table><p class="cite">Seventh consecutive day: 1.5× for the first 8 hours and 2× after 8 hours, including agriculture. Sources: DIR, UC Berkeley Labor Center inventory, CalChamber, AB 1066 — see docs/LEGAL_SOURCES.md.</p>`); };

// ======================================================= continuous monitoring: append new periods to the current audit
const origImport = VIEWS.import;
VIEWS.import = el => { origImport(el); if (S.imp.step === 0 && S.input && S.source !== 'demo') el.querySelector('.panel').insertAdjacentHTML('beforeend', `<label class="check" style="margin-top:10px"><input type="checkbox" id="im-append" ${S.imp.append ? 'checked' : ''}> Add these files to the current audit (continuous monitoring): new periods are merged, duplicates are dropped, and changes are compared with your last saved run.</label>`); const a = $('#im-append'); if (a) a.addEventListener('change', e => { S.imp.append = e.target.checked; }); };
const origRun = X.impRun;
X.impRun = async () => {
  if (!(S.imp.append && S.input)) return origRun();
  const n = S.imp.norm, cur = S.input; const key = t => `${t.employeeId}|${t.date}|${t.clockIn}|${t.clockOut}`; const pk = p => `${p.employeeId}|${p.periodStart}`;
  const ids = new Set(cur.employees.map(e => e.id)); const tk = new Set(cur.timeRecords.map(key)); const pks = new Set(cur.payroll.map(pk));
  const added = { employees: n.input.employees.filter(e => !ids.has(e.id)), time: n.input.timeRecords.filter(t => !tk.has(key(t))), pay: n.input.payroll.filter(p => !pks.has(pk(p))) };
  const merged = { ...cur, employees: [...cur.employees.map(e => n.input.employees.find(x => x.id === e.id) || e), ...added.employees], timeRecords: [...cur.timeRecords, ...added.time], payroll: [...cur.payroll, ...added.pay], hasMealColumns: cur.hasMealColumns && n.input.hasMealColumns };
  X.log('monitoring.append', { newShifts: added.time.length, newPayroll: added.pay.length, newWorkers: added.employees.length });
  const prev = S.snapshots[S.snapshots.length - 1];
  await X.runPipeline(merged, `${S.label} + ${new Date().toLocaleDateString()}`, 'import');
  const snap = PC.snapshot(`Auto ${new Date().toISOString().slice(0, 10)}`, S.input, S.result, S.patterns.anomalies); const alerts = PC.compareSnapshots(prev || null, snap, S.thresholds);
  await X.saveSnapshot(snap);
  openDrawer('New data analyzed', `${added.time.length.toLocaleString()} new shifts · ${added.pay.length.toLocaleString()} payroll rows · ${added.employees.length} new workers`, alerts.map(a => `<div class="alert ${a.severity}"><b>${esc(a.title)}</b><div class="small">${esc(a.detail)}</div><div class="small muted">${esc(a.action)}</div></div>`).join('') + '<p><button class="btn" data-act="go" data-to="monitor">Open monitoring</button></p>');
};

// ======================================================= events
document.addEventListener('click', async e => {
  const a = e.target.closest('[data-act]'); if (!a) return; const d = a.dataset;
  if (d.act === 'rx') { S.rx = { cat: d.cat || null, emp: d.emp || null }; X.render(); }
  if (d.act === 'ai-save') { const k = $('#ai-key').value.trim(); let raw = {}; try { raw = JSON.parse(localStorage.getItem('paycure:ai') || '{}'); } catch { raw = {}; } if (k && !k.startsWith('••')) { if (!/^sk-ant-/.test(k)) { toast('That doesn’t look like an Anthropic API key (sk-ant-…).'); return; } raw.key = k; } const ep = $('#ai-ep').value.trim(); if (ep && !/^https:\/\//.test(ep)) { toast('Endpoint must start with https://'); return; } raw.endpoint = ep; raw.model = $('#ai-model').value; try { localStorage.setItem('paycure:ai', JSON.stringify(raw)); toast('Saved in this browser'); } catch { toast('This browser blocks local storage.'); } X.render(); }
  if (d.act === 'ai-clear') { try { localStorage.removeItem('paycure:ai'); } catch { /* ignore */ } toast('Removed'); X.render(); }
  if (d.act === 'ai-test') { try { const r = await X.ai('Reply with the single word OK.'); toast(`Connected: ${String(r.text).slice(0, 40)}`); } catch (err) { toast(`Not connected: ${err.message}`); } }
});
})();
