/* Aldune standalone — part 9: "Start here" guide that adapts to the user's progress, and a next-step banner on every page */
(() => {
'use strict';
const X = window.PCX; const { S, esc, VIEWS, head } = X;
S.seen = S.seen || {};
['quality', 'findings', 'solutions', 'backpay', 'reports', 'steps', 'detective', 'paga'].forEach(v => { const o = VIEWS[v]; if (o) VIEWS[v] = el => { S.seen[v] = true; return o(el); }; });

function stages() {
  const r = S.result; const ws = S.ws || { status: {}, tasks: [] }; const statuses = Object.values(ws.status || {});
  const imported = r && S.source !== 'demo'; const filesWaiting = X.readiness && X.readiness().any && !imported;
  const q = S.q2; const serious = q ? q.issues.filter(i => i.severity === 'critical' || i.severity === 'high').length : 0;
  const reportDone = (S.events || []).some(e => e.action === 'report.generated');
  return [
    { id: 'setup', title: 'Set up your company', done: !!S.profile?.done, view: 'onboard', time: '2 minutes', why: 'Tells Aldune your locations, industry, and audit period so the right California rules apply (local minimum wages, industry wage orders, PAGA statute).', how: ['Enter company name, employee count, and work locations.', 'Pick your payroll and timekeeping systems — Aldune shows the exact export to pull.', 'If you received a PAGA notice, enter its date.'] },
    { id: 'upload', title: 'Add your records', done: !!imported, current: filesWaiting, view: 'import', time: '5 minutes', why: 'Aldune finds problems in the actual pay and time records — the same records a plaintiff’s lawyer would request.', how: ['On Import data, add files to any section: pay stubs or payroll registers, timesheets or time exports, and an employee list. Hundreds of files at once are fine.', 'PDF, Word, Excel, CSV, ZIP, or a whole folder all work. You don’t need all three sections.', filesWaiting ? 'Your files are loaded — press “Analyze now” at the bottom of the Import page.' : 'Then press “Analyze now.”'], cta: filesWaiting ? 'Analyze my files' : 'Add files' },
    { id: 'quality', title: 'Check data quality', done: !!r && (S.seen.quality || !serious), view: 'quality', time: '3 minutes', why: 'Missing punches, duplicates, or gaps can create false findings or hide real ones. Each issue shows how it affects confidence.', how: ['Read the critical and high issues first.', 'Fix the source files and re-import if something is clearly wrong (for example, a missing month of payroll).'] },
    { id: 'review', title: 'Review what Aldune found', done: !!r && (statuses.length > 0 || S.seen.solutions), view: 'exec', time: '15 minutes', why: 'See total exposure, where it’s concentrated, and the patterns behind it, then confirm or dispute individual findings.', how: ['Start with the Executive dashboard and the PAGA Detective.', 'Open findings to see the calculation and source records; mark any that don’t hold up as Disputed or Dismissed with a reason.'] },
    { id: 'pay', title: 'Pay what’s owed', done: !!r && statuses.some(s => s.s === 'remediated'), view: 'backpay', time: '20 minutes', why: 'Paying wages owed stops interest from growing, is required to cure a PAGA notice, and is the strongest “reasonable step.”', how: ['Open the Back-pay planner; choose 10% interest (or 7% if curing a PAGA notice).', 'Download the payroll file for your payroll provider and the English and Spanish letters.', 'Mark workers as paid — Aldune removes those amounts from exposure.'] },
    { id: 'fix', title: 'Fix the causes', done: !!r && (ws.tasks || []).length > 0, view: 'solutions', time: '15 minutes', why: 'Without fixing the cause, the same issues return next payroll.', how: ['In the Solutions Center, open each playbook: pay now, fix the cause, prevent recurrence.', 'Create tasks with owners and due dates; download the policy and training kit.'] },
    { id: 'document', title: 'Document reasonable steps', done: !!r && reportDone, view: 'steps', time: '10 minutes', why: 'Under the 2024 PAGA amendments, documented reasonable steps can cap penalties at 15% (before a notice) or 30% (within 60 days after).', how: ['Complete the reasonable-steps checklist.', 'Generate the audit record and the board risk brief from Reports.'] },
    { id: 'monitor', title: 'Monitor every month', done: (S.snapshots || []).length > 0, view: 'monitor', time: '5 minutes a month', why: 'Catch new issues within weeks instead of years; each saved run builds a dated compliance record.', how: ['Save this audit as a monitoring run.', 'Next month, add the new pay stubs and timesheets with “Add to the current audit” and compare.'] }
  ];
}
function nextStep() { const st = stages(); return st.find(s => s.current) || st.find(s => !s.done) || null; }
X.nextStep = nextStep;

const ROLE_PATHS = [
  ['HR or payroll manager', 'Find and pay what’s owed, fix payroll settings, and set up monthly checks.', [['Add files', 'import'], ['Data quality', 'quality'], ['Back-pay planner', 'backpay'], ['Solutions Center', 'solutions'], ['Monitoring', 'monitor']]],
  ['Employment attorney', 'Quantify exposure, test a notice against the data, value settlement, and export a privileged review package.', [['Add files', 'import'], ['Findings and ledgers', 'findings'], ['PAGA exposure', 'paga'], ['Settlement valuation', 'settlement'], ['Attorney review package', 'reports']]],
  ['CFO or executive', 'See total risk, what drives it, and how much remediation reduces it.', [['Executive dashboard', 'exec'], ['Risk Explorer', 'explorer'], ['Board risk brief', 'reports']]],
  ['Received a PAGA notice', 'You have 33 days to cure or submit a cure proposal (fewer than 100 employees).', [['Upload the notice', 'review'], ['Add payroll and time records', 'import'], ['Back pay at 7%', 'backpay'], ['Cure documents', 'solutions'], ['Ask Aldune what to do', '@ask:We received a PAGA notice. What do we do now?']]]
];
const EXPORTS = X.EXPORTS = [['ADP', 'Reports → Payroll Register (detail) or Earnings Statements (PDF); Time & Attendance → Timecard detail'], ['Paychex', 'Reports → Payroll Journal; check stubs (PDF); Time & Attendance → Punch Detail'], ['Gusto', 'Reports → Payroll journal; Documents → pay stubs; Time tools → Time sheets'], ['UKG', 'Reports → Payroll register; Timecard audit or punch detail'], ['Rippling', 'Reports → Payroll register; Time & Attendance → Punch report'], ['Paylocity', 'Reporting → Payroll Register; Time & Labor → Punch detail'], ['QuickBooks', 'Reports → Payroll Details; Paycheck list (PDF stubs)'], ['FieldClock', 'Reports → Timecard export (CSV or PDF) per crew and week']];
const TROUBLE = X.TROUBLE = [
  ['My pay stubs say “need review.”', 'Aldune couldn’t find the pay period or employee on those stubs. Open the Payroll section’s file list to see what was read and correct any misread document type.', [['Open the Payroll file list', '@slot:payroll']]],
  ['Some files “couldn’t be read.”', 'Usually scans or photos with no text layer. Turn on enhanced Aldune AI to read scans, or export text PDFs from your payroll system. Old .doc files must be saved as .docx.', [['Aldune AI settings', 'aiset'], ['See all files', '@slot:']]],
  ['I only have pay stubs (or only timesheets).', 'That’s fine — Aldune runs every check your records support and lists what it couldn’t check yet.', [['Analyze what I have', '@analyze']]],
  ['The numbers look too high.', 'Check data quality first (duplicates and missing punches inflate results), then dispute or dismiss findings that don’t hold up.', [['Data quality', 'quality'], ['Findings', 'findings']]],
  ['I want this to run every month automatically.', 'Link the folder where your payroll reports download, then press Sync each month and save a monitoring run.', [['Connections', 'connect'], ['Monitoring', 'monitor']]],
  ['Is this legal advice?', 'No. Aldune is decision-support software. Have California employment counsel review findings and documents before relying on them.', [['Law library', 'law']]]
];
const actBtn = ([label, target], primary) => target.startsWith('@ask:') ? `<button class="btn ${primary ? 'primary' : ''}" data-act="guide-ask" data-q="${esc(target.slice(5))}">${esc(label)}</button>` : target.startsWith('@slot:') ? `<button class="btn ${primary ? 'primary' : ''}" data-act="guide-slot" data-ds="${esc(target.slice(6))}">${esc(label)}</button>` : target === '@analyze' ? `<button class="btn ${primary ? 'primary' : ''}" data-act="go-analyze" data-to="import">${esc(label)}</button>` : `<button class="btn ${primary ? 'primary' : ''}" data-act="go" data-to="${esc(target)}">${esc(label)}</button>`;

VIEWS.guide = el => {
  const st = stages(); const cur = nextStep(); const done = st.filter(s => s.done).length;
  el.innerHTML = head('Start here', 'A step-by-step path from your first upload to a documented, monitored compliance program. Aldune tracks where you are and shows the next thing to do.') + `
    <div class="panel" style="border:2px solid var(--ledger)"><div class="row" style="justify-content:space-between;align-items:center"><div><span class="chip ok">You are here</span><h2 style="margin:6px 0 4px">${cur ? esc(cur.title) : 'You’re all set — keep monitoring monthly'}</h2><p class="small" style="max-width:70ch">${cur ? esc(cur.why) : 'Every step is complete. Add new records each month and compare runs.'}</p>${cur ? `<ol class="small">${cur.how.map(h => `<li>${esc(h)}</li>`).join('')}</ol>` : ''}</div><div style="text-align:right"><div style="font-family:Fraunces,Georgia,serif;font-size:34px;font-weight:600">${done}/${st.length}</div><div class="small muted">steps complete</div>${cur ? `<button class="btn primary" style="margin-top:10px;padding:12px 18px" data-act="${cur.id === 'upload' && cur.current ? 'go-analyze' : 'go'}" data-to="${cur.view}">${esc(cur.cta || `Go to ${cur.title.toLowerCase()}`)} →</button>` : '<button class="btn primary" data-act="go" data-to="monitor">Open monitoring</button>'}</div></div></div>
    <h2>Your path</h2>
    <div class="tablewrap"><table><tbody>${st.map((s, i) => `<tr style="${cur && cur.id === s.id ? 'background:var(--ledger-tint)' : ''}"><td style="width:40px;font-family:Fraunces,Georgia,serif;font-size:20px">${s.done ? '✓' : i + 1}</td><td><b>${esc(s.title)}</b> <span class="cite">${esc(s.time)}</span><div class="small">${esc(s.why.split(/(?<=[.!?])\s+(?=[A-Z])/)[0])}</div></td><td style="width:140px"><button class="btn ${cur && cur.id === s.id ? 'primary' : ''}" data-act="go" data-to="${s.view}">${s.done ? 'Revisit' : 'Open'}</button></td></tr>`).join('')}</tbody></table></div>
    <h2>Paths by role</h2><div class="grid g2">${ROLE_PATHS.map(([r, d, steps]) => `<div class="panel"><b>${esc(r)}</b><p class="small muted">${esc(d)}</p><div class="row">${steps.map((st, i) => actBtn(st, i === 0) + (i < steps.length - 1 ? '<span class="muted">→</span>' : '')).join('')}</div></div>`).join('')}</div>
    <div class="panel"><h3 style="margin-top:0">Get your records from your payroll or POS system</h3><p class="small muted" style="margin-top:-4px">Aldune reads exports from all of these — any layout.</p><div class="row" style="gap:6px;flex-wrap:wrap">${EXPORTS.map(([a]) => `<span class="chip">${esc(a)}</span>`).join('')}</div>
      <div class="row" style="margin-top:10px;align-items:center;gap:8px"><label class="small" for="home-sys">Show export steps for</label><select id="home-sys"><option value="">Choose a system…</option>${EXPORTS.map(([a], k) => `<option value="${k}">${esc(a)}</option>`).join('')}</select><button class="btn primary" data-act="go" data-to="import">Upload files</button></div><div id="home-sys-steps" class="small" style="margin-top:8px"></div></div>

    <p class="small muted" style="margin-top:12px">Questions anytime: press <b>Ask Penny</b> (Ctrl+K) — answers cite California law and link to the tool that resolves the issue.</p>`;
};

// ---------- next-step banner on every working page
const SKIP = new Set(['guide', 'onboard', 'import', 'home', 'admin', 'aiset', 'plans', 'law', 'rules']);
const origRender = X.render;
X.render = () => {
  origRender();
  if (SKIP.has(S.view) || (!S.profile?.done && !S.result)) return;
  const n = nextStep(); if (!n || n.view === S.view || (S.hideNext || {})[n.id]) return;
  const host = document.querySelector('#views > section'); if (!host) return;
  host.insertAdjacentHTML('afterbegin', `<div class="alert info" style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:14px"><div><b>Next step: ${esc(n.title)}</b> <span class="small muted">· ${esc(n.why.split('.')[0])}.</span></div><div class="row"><button class="btn primary" data-act="${n.id === 'upload' && n.current ? 'go-analyze' : 'go'}" data-to="${n.view}">${esc(n.cta || 'Go')} →</button><button class="btn" data-act="go" data-to="guide">All steps</button><button class="btn" data-act="hide-next" data-id="${n.id}" aria-label="Hide this suggestion">×</button></div></div>`);
};
document.addEventListener('click', async e => {
  const a = e.target.closest('[data-act]'); if (!a) return;
  if (a.dataset.act === 'hide-next') { S.hideNext = { ...(S.hideNext || {}), [a.dataset.id]: true }; X.render(); }
  if (a.dataset.act === 'guide-ask') { const fab = document.getElementById('as-fab'); if (fab) fab.click(); setTimeout(() => X.ask && X.ask(a.dataset.q), 120); }
  if (a.dataset.act === 'guide-slot') { S.imp.step = 0; S.slotView = a.dataset.ds; X.setView('import'); }
  if (a.dataset.act === 'go-analyze') { S.imp.step = 0; X.setView('import'); setTimeout(() => X.analyzeNow && X.analyzeNow(), 50); }
});
// Home: point new users to the guide
const origHome = VIEWS.home;
VIEWS.home = el => { origHome(el); if (!S.profile?.done) return; const n = nextStep(); el.insertAdjacentHTML('afterbegin', `<div class="sol" style="border-left:5px solid var(--marker);margin-top:0"><div class="row" style="justify-content:space-between;align-items:center"><div><span class="chip ok">Next step</span><h3 style="margin-top:6px">${n ? esc(n.title) : 'Keep monitoring monthly'}</h3><p class="small">${n ? esc(n.why) : 'Add new records each month and compare.'}</p></div><div class="row"><button class="btn primary" data-act="${n && n.id === 'upload' && n.current ? 'go-analyze' : 'go'}" data-to="${n ? n.view : 'monitor'}">${n ? esc(n.cta || 'Go') : 'Open monitoring'} →</button><button class="btn" data-act="go" data-to="guide">Start-here guide</button></div></div></div>`); };
})();
