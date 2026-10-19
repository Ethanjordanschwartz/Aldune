/* Aldune standalone — part 17: Penny server + chat design, PAGA readiness, POS attestation integration, compliance calendar, spec documents */
(() => {
'use strict';
const X = window.PCX; const { PC, S, $, esc, money, toast, VIEWS } = X;
const iso = () => new Date().toISOString().slice(0, 10);

// ======================================================= Penny chat design
document.head.insertAdjacentHTML('beforeend', `<style id="penny-style">
#as-chat .a{white-space:normal;background:var(--surface);border:1px solid var(--line);border-radius:14px;border-top-left-radius:4px;padding:12px 16px;line-height:1.6;max-width:100%;box-shadow:0 1px 2px rgba(0,0,0,.04)}
#as-chat .a::before{content:"🪙 Penny";display:block;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--ink2);margin-bottom:6px}
#as-chat .u{white-space:pre-wrap;background:var(--ink);color:#fff;border-radius:14px;border-top-right-radius:4px;padding:10px 14px;margin-left:auto;max-width:85%;line-height:1.5}
#as-chat .a p{margin:0 0 10px}#as-chat .a p:last-child{margin-bottom:0}
#as-chat .a ul,#as-chat .a ol{margin:4px 0 10px;padding-left:22px}#as-chat .a li{margin:3px 0}
#as-chat .a .pm-h{margin:14px 0 6px;font-size:15px;line-height:1.3}#as-chat .a h3.pm-h{font-size:16px}
#as-chat .a .pm-table{font-size:13px;margin:6px 0 10px}#as-chat .a .pm-table th{background:var(--paper);text-align:left}
#as-chat .a code{background:var(--paper);border:1px solid var(--line);border-radius:4px;padding:0 4px;font-size:12.5px}
#as-chat .a hr{border:0;border-top:1px solid var(--line);margin:12px 0}
#as-chat .cite-btn{border:1px solid var(--ledger);background:transparent;color:var(--ledger);border-radius:999px;font-size:10.5px;font-weight:700;padding:0 6px;margin:0 2px;cursor:pointer;vertical-align:1px;line-height:16px}
#as-chat .a ol.small{border-top:1px solid var(--line);padding-top:8px;margin-top:10px}
</style>`);

// ======================================================= Penny server (same-domain /api/penny on your own deployment)
async function detectServer() {
  if (window.claude || !/^https?:$/.test(location.protocol) || S.cfg.assistantEndpoint) return;
  try { const r = await fetch('/api/penny', { method: 'GET', headers: { accept: 'application/json' } }); if (!r.ok) return; const j = await r.json(); if (j && j.ok && j.name === 'penny') { S.cfg.assistantEndpoint = '/api/penny'; S.pennyServer = true; X.refreshChat && X.refreshChat(); X.render(); } } catch { /* no server on this host */ }
}
detectServer();
const baseStatus = X.aiStatus;
X.aiStatus = () => S.pennyServer ? { on: true, msg: 'Penny’s full AI is on (Penny server).' } : baseStatus();

// ======================================================= PAGA readiness (reasonable steps) + pick-up-sticks
S.readiness = S.readiness || {};
function evidence() {
  const snaps = S.snapshots || []; const last = snaps.length ? snaps[snaps.length - 1].windowEnd : (S.result ? iso() : undefined);
  const hb = (S.docs || []).filter(d => d.type === 'handbook'); const score = hb.length ? Math.max(...hb.map(d => PC.reviewHandbook(d.text).score)) : undefined;
  const owedEmp = new Set(), paidEmp = new Set();
  if (S.result) { const byEmp = new Map(); for (const f of S.result.engine.findings) if (f.amount > 0 && f.confidence !== 'low' && !f.premiumIndicated && ['wages', 'premium', 'reimbursement'].includes(f.amountKind)) { if (!byEmp.has(f.employeeId)) byEmp.set(f.employeeId, []); byEmp.get(f.employeeId).push(f); }
    for (const [e, fs] of byEmp) { owedEmp.add(e); if (fs.every(f => (S.status || {})[f.id] === 'remediated')) paidEmp.add(e); } }
  const st = Object.values(S.status || {}); 
  return { auditsRun: Math.max(snaps.length, S.result ? 1 : 0), lastAuditDate: last, policyScore: score ?? (S.readiness.policies ? 90 : undefined), policiesReviewed: hb.length > 0 || !!S.readiness.policies, trainingDocumented: !!S.readiness.training, owedWorkers: owedEmp.size, paidWorkers: paidEmp.size, tasksOpen: st.filter(x => x === 'in_progress').length, tasksDone: st.filter(x => x === 'remediated').length, noticeDate: S.readiness.noticeDate || undefined, today: iso() };
}
VIEWS.readiness = el => {
  const r = PC.reasonableSteps(evidence()); const sticks = S.result ? PC.pickUpSticks(S.input, S.result) : null;
  const tone = { met: 'ok', partial: 'warn', missing: 'flag' };
  el.innerHTML = X.head('PAGA readiness', 'Document “all reasonable steps” to qualify for the 15% or 30% PAGA cap — and fix issues in the order that cuts exposure fastest.') + `
    <div class="kpis" style="grid-template-columns:repeat(3,1fr)"><div class="kpi"><div class="v">${r.score}/100</div><div class="k">Reasonable-steps evidence</div></div><div class="kpi ${r.likelyCap === 'none' ? 'risk' : ''}"><div class="v">${r.likelyCap === 'none' ? 'Not yet' : r.likelyCap + ' cap'}</div><div class="k">Likely PAGA cap</div></div><div class="kpi"><div class="v">${r.categories.filter(c => c.status === 'met').length} of 4</div><div class="k">Categories documented</div></div></div>
    <p class="small" style="margin-top:8px">${esc(r.explanation)}</p>
    <div class="row" style="margin:6px 0 12px"><label class="check"><input type="checkbox" id="rd-train" ${S.readiness.training ? 'checked' : ''}> Supervisor training completed and logged</label><label class="check"><input type="checkbox" id="rd-pol" ${S.readiness.policies ? 'checked' : ''}> Compliant written policies adopted and acknowledged</label><label class="field" style="max-width:220px">PAGA notice date (if any)<input type="date" id="rd-notice" value="${esc(S.readiness.noticeDate || '')}"></label></div>
    <table><tbody>${r.categories.map(c => `<tr><td><span class="chip ${tone[c.status]}">${c.status}</span></td><td><b>${esc(c.label)}</b><div class="small">${esc(c.evidence)}</div>${c.missing.length ? `<div class="small"><b>To do:</b> ${c.missing.map(esc).join(' · ')}</div>` : ''}</td></tr>`).join('')}</tbody></table>
    <p class="cite">${esc(r.note)} Lab. Code § 2699(g)–(h).</p>
    ${sticks ? `<h2>Fix-first order</h2><p class="small muted">Each step removes the most exposure per unit of effort. Amounts use the neutral model.</p>
    <div class="tablewrap"><table><thead><tr><th>#</th><th>Fix</th><th class="n">Removes</th><th class="n">Exposure after</th></tr></thead><tbody><tr><td></td><td class="small">Starting exposure</td><td></td><td class="n"><b>${money(sticks.start)}</b></td></tr>${sticks.steps.map((s, i) => `<tr><td>${i + 1}</td><td><b>${esc(s.label)}</b></td><td class="n">${money(s.removes)}</td><td class="n">${money(s.remaining)}</td></tr>`).join('')}</tbody></table></div>
    <div class="row" style="margin-top:10px"><button class="btn primary" data-act="go" data-to="solutions">Open Solutions Center</button><button class="btn" data-act="go" data-to="backpay">Back-pay planner</button><button class="btn" data-act="rd-plan">Corrective-action plan (Word)</button></div>` : '<p class="small muted">Run an audit to see the fix order.</p>'}`;
  $('#rd-train').addEventListener('change', e => { S.readiness.training = e.target.checked ? iso() : ''; X.persist(); X.render(); });
  $('#rd-pol').addEventListener('change', e => { S.readiness.policies = e.target.checked ? iso() : ''; X.persist(); X.render(); });
  $('#rd-notice').addEventListener('change', e => { S.readiness.noticeDate = e.target.value; X.persist(); X.render(); });
};

// ======================================================= Shift attestation → your POS and your audit
const QUESTIONS = { en: ['Were you provided a 30-minute, uninterrupted meal break that started before the end of your 5th hour of work today? (Yes / No / I chose to waive it — shift 6 hours or less)', 'Were you provided all of your 10-minute rest breaks today? (Yes / No)', 'Did you do any work today while clocked out? (No / Yes — how many minutes?)', 'If you answered “No” to a break question, what happened? (optional)'], es: ['¿Se le dio hoy un descanso para comer de 30 minutos, sin interrupciones, que empezó antes del final de su 5.ª hora de trabajo? (Sí / No / Decidí renunciar — turno de 6 horas o menos)', '¿Se le dieron hoy todos sus descansos de 10 minutos? (Sí / No)', '¿Trabajó hoy mientras estaba fuera del reloj? (No / Sí — ¿cuántos minutos?)', 'Si contestó “No” a una pregunta de descanso, ¿qué pasó? (opcional)'] };
const SYN = { emp: ['employee id', 'employee', 'emp id', 'id', 'employee number', 'worker', 'name', 'employee name'], date: ['date', 'shift date', 'business date', 'clock out date', 'punch date'], meal: ['meal', 'meal provided', 'meal break', 'attest meal', 'meal attestation', 'took meal'], rest: ['rest', 'rest provided', 'rest break', 'attest rest', 'rest attestation', 'took breaks', 'breaks provided'], off: ['off clock', 'off-the-clock', 'worked off clock', 'off clock minutes'] };
const yes = v => /^(y|yes|true|1|sí|si|provided|taken)$/i.test(String(v ?? '').trim());
function importAttest(rows) {
  if (!rows.length) return 0; const cols = Object.keys(rows[0]); const find = k => cols.find(c => SYN[k].includes(c.toLowerCase().trim()));
  const ce = find('emp'), cd = find('date'), cm = find('meal'), cr = find('rest'), co = find('off'); if (!ce || !cd || (!cm && !cr)) throw new Error('Couldn’t find employee, date, and meal or rest columns in this report.');
  let n = 0; for (const r of rows) { const d = new Date(r[cd]); if (isNaN(d)) continue; S.att.push({ emp: String(r[ce]).trim(), date: d.toISOString().slice(0, 10), meal: cm ? yes(r[cm]) : true, rest: cr ? yes(r[cr]) : true, off: co ? !/^(0|no|n|false)?$/i.test(String(r[co] || '').trim()) : false, mins: co ? Number(r[co]) || 0 : 0, lang: 'pos', src: 'pos' }); n++; }
  X.persist(); return n;
}
function applyAttestToAudit() {
  if (!S.input) { toast('Add time records first.'); return; }
  const map = new Map(S.att.map(a => [`${a.emp}|${a.date}`, a])); let n = 0;
  S.input.timeRecords = S.input.timeRecords.map(t => { const a = map.get(`${t.employeeId}|${t.date}`); if (!a) return t; n++; return { ...t, attestation: { mealProvided: a.meal, restProvided: a.rest, offClockWork: a.off } }; });
  if (!n) { toast('No attestations match the employee IDs and dates in your time records.'); return; }
  X.rerun ? X.rerun() : X.runPipeline && X.runPipeline(); toast(`Applied ${n} attestation${n === 1 ? '' : 's'} to the audit.`);
}
const baseAttest = VIEWS.attest;
VIEWS.attest = el => {
  baseAttest(el); const sys = PC.POS_SYSTEMS.find(p => p.id === (S.posSys || 'custom')) || PC.POS_SYSTEMS[0];
  el.insertAdjacentHTML('beforeend', `<h2>Put this in your POS — so it happens at every clock-out</h2>
    <div class="grid g2">
      <div class="panel"><h3 style="margin-top:0">1. Ask the questions in your POS</h3><p class="small">Most modern time systems can ask custom questions at clock-out. Paste these, word for word, then export the answers to Aldune.</p>
        <div class="seg" style="margin-bottom:8px"><button data-act="aq-lang" data-l="en" aria-pressed="${(S.aqLang || 'en') === 'en'}">English</button><button data-act="aq-lang" data-l="es" aria-pressed="${S.aqLang === 'es'}">Español</button></div>
        <ol class="small" id="aq-list">${QUESTIONS[S.aqLang || 'en'].map(q => `<li>${esc(q)}</li>`).join('')}</ol>
        <div class="row"><button class="btn primary" data-act="aq-copy">Copy questions</button><button class="btn" data-act="go" data-to="pos">POS setup steps</button></div>
        <p class="small" style="margin-top:8px">${sys.id === '7shifts' ? '<b>7shifts:</b> Company Settings → Labor &amp; Compliance → enable California Labor Compliance and Employee Attestation; use Custom Attestation for these questions; export the Labor Exceptions / attestation report.' : `<b>${esc(sys.name)}:</b> ask your vendor whether it supports custom clock-out questions or break attestations and an attestation export; if not, use the Aldune kiosk (2).`}</p>
        <p class="cite">An honest “No” must always be allowed and must trigger a premium — one-sided attestations carry little weight (Brinker (2012) 53 Cal.4th 1004; Donohue (2021) 11 Cal.5th 58; Lab. Code § 226.7).</p></div>
      <div class="panel"><h3 style="margin-top:0">2. Or run the Aldune kiosk at the timeclock</h3><p class="small">Open full-screen kiosk mode on a tablet beside your POS. Answers save automatically and reset for the next employee.</p>
        <button class="btn primary" data-act="kiosk-open">Open kiosk mode</button>
        <h3>3. Import attestation reports</h3><p class="small">CSV or Excel from your POS with employee, date, and meal/rest answers.</p>
        <label class="btn" style="cursor:pointer">Import attestation report<input type="file" id="aq-file" accept=".csv,.xlsx,.xls,.xlsm,.xlsb,.ods,.fods,.tsv" style="display:none"></label>
        <h3>4. Use them in your audit</h3><p class="small">${S.att.length.toLocaleString()} attestation${S.att.length === 1 ? '' : 's'} on file. “Yes” answers support that breaks were provided; “No” answers become premiums owed.</p>
        <button class="btn primary" data-act="aq-apply" ${S.att.length && S.input ? '' : 'disabled'}>Apply to this audit</button>
        <p class="cite" style="margin-top:8px">Aldune Cloud adds a live POS webhook so answers arrive automatically.</p></div></div>`);
  $('#aq-file').addEventListener('change', async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; try { const wb = PC.XLSX.read(await f.arrayBuffer()); const rows = PC.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' }); toast(`Imported ${importAttest(rows)} attestations.`); X.render(); } catch (err) { toast(err.message); } });
};
document.addEventListener('click', async e => {
  const a = e.target.closest('[data-act]'); if (!a) return; const d = a.dataset;
  if (d.act === 'aq-lang') { S.aqLang = d.l; X.render(); }
  if (d.act === 'aq-copy') { try { await navigator.clipboard.writeText(QUESTIONS[S.aqLang || 'en'].map((q, i) => `${i + 1}. ${q}`).join('\n')); toast('Questions copied'); } catch { toast('Select the questions and copy them.'); } }
  if (d.act === 'aq-apply') applyAttestToAudit();
  if (d.act === 'k-submit') setTimeout(() => X.persist(), 50);
  if (d.act === 'kiosk-open') { document.body.classList.add('kiosk'); X.setView('attest'); try { await document.documentElement.requestFullscreen?.(); } catch { /* optional */ } toast('Kiosk mode — press Esc or the Exit button to leave.'); }
  if (d.act === 'kiosk-exit') { document.body.classList.remove('kiosk'); try { await document.exitFullscreen?.(); } catch { /* ignore */ } }
});
document.head.insertAdjacentHTML('beforeend', '<style>body.kiosk #nav,body.kiosk #as-fab,body.kiosk .disclaimer,body.kiosk #views>.grid,body.kiosk #views>h2{display:none!important}body.kiosk #views{max-width:640px;margin:0 auto}body.kiosk .kiosk-exit{display:block!important}</style>');
document.body.insertAdjacentHTML('beforeend', '<button class="btn kiosk-exit" data-act="kiosk-exit" style="display:none;position:fixed;top:10px;right:10px;z-index:50">Exit kiosk</button>');

// ======================================================= Compliance calendar (dated, exportable)
function nthWeekday(y, m, wd, n) { const d = new Date(Date.UTC(y, m, 1)); let c = 0; while (true) { if (d.getUTCDay() === wd && ++c === n) return d.toISOString().slice(0, 10); d.setUTCDate(d.getUTCDate() + 1); } }
function calendar(fromIso) {
  const y0 = +fromIso.slice(0, 4); const ev = [];
  for (const y of [y0, y0 + 1]) {
    ev.push([`${y}-01-01`, 'State and many local minimum wages change; update pay rates and exempt salaries', 'Lab. Code §§ 515, 1182.12'], [`${y}-01-31`, 'Q4 payroll tax return (DE 9 / DE 9C); W-2s to employees', 'Unemp. Ins. Code § 1088; 26 U.S.C. § 6051'], [`${y}-02-01`, 'Annual Workplace Know Your Rights notice to every employee', 'Lab. Code § 1551 (SB 294)'], [`${y}-02-01`, 'Post Cal/OSHA Form 300A summary (through April 30)', 'Cal. Code Regs., tit. 8, § 14300.32'], [`${y}-04-30`, 'Q1 payroll tax return (DE 9 / DE 9C)', 'Unemp. Ins. Code § 1088'], [nthWeekday(y, 4, 3, 2), 'Pay data report due (100+ employees)', 'Gov. Code § 12999'], [`${y}-07-01`, 'Mid-year local minimum wage changes (e.g., Los Angeles, San Francisco, Berkeley, Emeryville); health care and hotel rate steps', 'Local ordinances; Lab. Code § 1182.14'], [`${y}-07-31`, 'Q2 payroll tax return (DE 9 / DE 9C)', 'Unemp. Ins. Code § 1088'], [`${y}-10-31`, 'Q3 payroll tax return (DE 9 / DE 9C)', 'Unemp. Ins. Code § 1088'], [`${y}-12-01`, 'Year-end review: handbook updates for new laws; next year’s rates loaded', 'Aldune law watch list']);
    for (let m = 0; m < 12; m++) ev.push([`${y}-${String(m + 1).padStart(2, '0')}-05`, 'Monthly Aldune audit — keeps “reasonable steps” evidence current for the PAGA caps', 'Lab. Code § 2699(g)']);
  }
  return ev.filter(e => e[0] >= fromIso).sort((a, b) => a[0].localeCompare(b[0])).slice(0, 40);
}
const RECURRING = [['Every 2 years', 'Sexual harassment prevention training (2 h supervisors, 1 h others; 5+ employees); new supervisors within 6 months', 'Gov. Code § 12950.1'], ['Every year', 'Workplace violence prevention training and plan review', 'Lab. Code § 6401.9'], ['Every pay period', 'Wage statements with all 9 required items and paid sick leave balance', 'Lab. Code §§ 226, 246'], ['Within 7 days of changes', 'Updated Wage Theft Prevention Act notice', 'Lab. Code § 2810.5'], ['Within 33 days of a PAGA notice', 'Cure proposal (fewer than 100 employees) — 65-day lawsuit window', 'Lab. Code § 2699.3']];
S.calDone = S.calDone || {};
VIEWS.calendar = el => {
  const ev = calendar(iso());
  el.innerHTML = X.head('Compliance calendar', 'Every recurring California deadline, dated — check them off or add them to your calendar.') + `
    <div class="row" style="margin-bottom:12px"><button class="btn primary" data-act="cal-ics">Add to my calendar (.ics)</button><button class="btn" data-act="go" data-to="notices">Notices &amp; postings</button><button class="btn" data-act="go" data-to="readiness">PAGA readiness</button></div>
    <div class="tablewrap"><table><thead><tr><th></th><th>Date</th><th>What’s due</th><th>Authority</th></tr></thead><tbody>${ev.map(([d, w, c]) => { const k = `${d}|${w.slice(0, 30)}`; return `<tr><td><input type="checkbox" data-cal="${esc(k)}" ${S.calDone[k] ? 'checked' : ''} aria-label="Done"></td><td style="white-space:nowrap"><b>${new Date(d + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</b></td><td>${esc(w)}</td><td class="cite">${esc(c)}</td></tr>`; }).join('')}</tbody></table></div>
    <h2>Recurring obligations</h2><table><tbody>${RECURRING.map(([w, r, c]) => `<tr><td class="small" style="white-space:nowrap"><b>${esc(w)}</b></td><td>${esc(r)}</td><td class="cite">${esc(c)}</td></tr>`).join('')}</tbody></table>`;
  el.querySelectorAll('[data-cal]').forEach(c => c.addEventListener('change', e => { S.calDone[e.target.dataset.cal] = e.target.checked; X.persist(); }));
};
document.addEventListener('click', async e => {
  if (!e.target.closest('[data-act="cal-ics"]')) return;
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z'; const esc2 = t => t.replace(/[,;\\]/g, m => '\\' + m);
  const body = calendar(iso()).map(([d, w, c], i) => ['BEGIN:VEVENT', `UID:aldune-${d}-${i}@aldune`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${d.replace(/-/g, '')}`, `SUMMARY:${esc2(w)}`, `DESCRIPTION:${esc2(c)} — Aldune compliance calendar`, 'BEGIN:VALARM', 'TRIGGER:-P3D', 'ACTION:DISPLAY', `DESCRIPTION:${esc2(w)}`, 'END:VALARM', 'END:VEVENT'].join('\r\n')).join('\r\n');
  await X.save(`aldune-compliance-calendar-${iso()}.ics`, new Blob([`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Aldune//Compliance Calendar//EN\r\nCALSCALE:GREGORIAN\r\n${body}\r\nEND:VCALENDAR\r\n`], { type: 'text/calendar' }));
});

// ======================================================= spec documents on the Litigation page
const baseLit = VIEWS.litigation;
VIEWS.litigation = el => {
  baseLit(el); const row = el.querySelector('[data-act="lit-doc"][data-k="term"]');
  if (row) row.insertAdjacentHTML('afterend', '<button class="btn" data-act="lit-doc2" data-k="agreement">Class &amp; PAGA settlement agreement</button><button class="btn" data-act="lit-doc2" data-k="approval">Fairness analysis (approval)</button>');
};
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-act="lit-doc2"]'); if (!b) return;
  try {
    const i = S.lit.inputs || PC.LIT_DEFAULTS; const v = PC.valueClaims(i); const n = PC.negotiation(v, S.lit.side); const f = S.lit.facts || { claims: i.claims, plaintiffs: [], sources: [], arbitration: false };
    const a = PC.allocation(S.lit.gross || Math.round((n.expectedLow + n.expectedHigh) / 2 / 1000) * 1000, v); const emp = f.defendant || S.input?.employerName || S.party?.employerName || 'Defendant';
    const m = b.dataset.k === 'agreement' ? PC.lit.classSettlementAgreement(f, a, { ...(S.lit.ctx || {}), date: iso(), employer: emp, workweeks: v.workweeks }) : PC.lit.approvalMemo(f, v, a, { ...(S.lit.ctx || {}), date: iso(), employer: emp });
    await X.saveDocx([m], `${b.dataset.k === 'agreement' ? 'class-paga-settlement-agreement' : 'settlement-fairness-analysis'}-${iso()}.docx`);
  } catch (err) { toast(err.message); }
});
document.addEventListener('click', async e => {
  if (!e.target.closest('[data-act="rd-plan"]')) return;
  const r = PC.reasonableSteps(evidence()); const sticks = PC.pickUpSticks(S.input, S.result);
  await X.saveDocx([{ title: 'Corrective-action plan', draftBanner: 'Prepared with Aldune. Attorney review required.', blocks: [{ t: 'title', text: `Corrective-Action Plan — ${S.input?.employerName || ''}` }, { t: 'p', runs: [`Prepared ${iso()} to document “all reasonable steps” under Labor Code section 2699(g): periodic payroll audits, lawful written policies, supervisor training, and corrective action.`] }, { t: 'heading', text: 'Evidence status' }, { t: 'table', head: ['Category', 'Status', 'Evidence', 'Next steps'], rows: r.categories.map(c => [c.label, c.status, c.evidence, c.missing.join('; ') || '—']) }, { t: 'heading', text: 'Fix-first order' }, { t: 'table', head: ['#', 'Fix', 'Exposure removed', 'Exposure after', 'Owner', 'Due'], rows: sticks.steps.map((s, k) => [String(k + 1), s.label, money(s.removes), money(s.remaining), /pay|back|wage|premium|reimburs/i.test(s.label) ? 'Payroll' : /polic|train|handbook|notice|attest/i.test(s.label) ? 'Human Resources' : /pos|timekeep|clock|system|config/i.test(s.label) ? 'Operations / timekeeping vendor' : 'Human Resources', new Date(Date.now() + 14 * (k + 1) * 864e5).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })]) }, { t: 'p', runs: [{ text: r.note, italic: true }] }] }], `corrective-action-plan-${iso()}.docx`);
});
X.render();
})();
