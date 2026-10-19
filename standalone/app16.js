/* Aldune standalone — part 16: Penny AI status with one-click fixes, notices & postings checklist, case timeline */
(() => {
'use strict';
const X = window.PCX; const { PC, S, $, esc, toast, VIEWS } = X;
const VIEWER = () => S.cfg.viewerUrl || 'https://claude.ai/artifact/VRCRGGqf88MjZnHF2R2Yiz';
const iso = () => new Date().toISOString().slice(0, 10);

// ======================================================= Penny AI status
function aiStatus() {
  if (S.aiError === 'not_granted') return { on: false, msg: 'You declined Penny’s AI for this visit, so she’s answering from Aldune’s built-in library.', btn: '<button class="btn primary" data-act="ai-reload">Reload and allow</button>' };
  if (X.aiMode() !== 'builtin') return { on: true, msg: 'Penny’s full AI is on — ask anything, or have her draft anything.' };
  if (window.claude && !S.capsReady) return { on: false, msg: 'Connecting Penny’s AI…' };
  if (window.claude) return { on: false, msg: 'Penny’s full AI turns on when Aldune is opened inside Claude (sign in to claude.ai). Here she answers from Aldune’s built-in library.', btn: `<a class="btn primary" href="${esc(VIEWER())}" target="_blank" rel="noopener">Open Penny in Claude ↗</a>` };
  return { on: false, msg: 'This copy of Aldune has no AI connection yet. Connect your Aldune Cloud AI endpoint on the Penny AI page, or open Aldune inside Claude.', btn: `<button class="btn primary" data-act="go" data-to="aiset">Penny AI settings</button> <a class="btn" href="${esc(VIEWER())}" target="_blank" rel="noopener">Open in Claude ↗</a>` };
}
X.aiStatus = aiStatus;
const baseRefresh = X.refreshChat;
X.refreshChat = () => {
  baseRefresh();
  const st = aiStatus();
  document.querySelectorAll('[data-chat-root]').forEach(r => { r.querySelector('.penny-status')?.remove(); if (st.on) return; r.insertAdjacentHTML('afterbegin', `<div class="penny-status alert info" style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:8px"><span class="small">${esc(st.msg)}</span>${st.btn || ''}</div>`); });
};
// refresh the banner once the capability check finishes (it can take a few seconds after load)
let tries = 0; const poll = setInterval(() => { if (S.capsReady || ++tries > 30) { clearInterval(poll); if (document.querySelector('[data-chat-root]')) X.refreshChat(); } }, 500);
document.addEventListener('click', e => { if (e.target.closest('[data-act="ai-reload"]')) location.reload(); });

// Penny AI page: status first, settings below
const baseAiset = VIEWS.aiset;
VIEWS.aiset = el => {
  baseAiset(el); const st = aiStatus(); const h = el.querySelector('h1'); if (h) h.textContent = 'Penny AI';
  const host = el.querySelector('.kpis') || el.querySelector('.panel');
  if (host) host.insertAdjacentHTML('beforebegin', `<div class="sol" style="border-left:5px solid ${st.on ? 'var(--ledger)' : 'var(--marker)'};margin-top:0"><div class="row" style="justify-content:space-between;align-items:center"><div><h3 style="margin:0">${st.on ? '🪙 Penny’s full AI is on' : '🪙 Turn on Penny’s full AI'}</h3><p class="small" style="margin:4px 0 0">${esc(st.msg)}</p></div><div class="row">${st.btn || '<button class="btn primary" data-act="go" data-to="ask">Ask Penny</button>'}</div></div>
    <details style="margin-top:8px"><summary class="small">Where Penny’s AI works</summary><ul class="small"><li><b>Inside Claude</b> (this app at claude.ai): on automatically using your Claude account — the first question asks you to allow it.</li><li><b>Aldune Cloud</b> (your own domain): on for every customer through your server-side AI connection.</li><li><b>Opened directly or downloaded</b>: browsers can’t safely hold an AI key, so connect your Aldune Cloud endpoint below or open Aldune in Claude.</li></ul></details></div>`);
};
document.querySelectorAll('#nav button[data-view="aiset"]').forEach(b => { b.textContent = '🪙 Penny AI'; });

// ======================================================= Notices & postings checklist (California)
const NOTICES = [
  ['At hire', 'Wage Theft Prevention Act notice (pay rates, payday, employer info, sick leave)', 'Lab. Code § 2810.5', 'Non-exempt employees; update within 7 days of changes'],
  ['At hire', 'Workplace Know Your Rights notice, with emergency-contact designation', 'Lab. Code §§ 1550–1559 (SB 294)', 'Also annually to every employee'],
  ['At hire', 'Sexual harassment information sheet (CRD-185 or equivalent)', 'Gov. Code § 12950', 'All employers'],
  ['At hire', 'Workers’ compensation new-hire pamphlet', 'Lab. Code § 3551', 'All employers'],
  ['At hire', 'State Disability Insurance (DE 2515) and Paid Family Leave (DE 2511) brochures', 'Unemp. Ins. Code §§ 2613, 3303.1', 'All employers'],
  ['At hire', 'Lactation accommodation policy', 'Lab. Code § 1034', 'Include in handbook; also on request'],
  ['At hire', 'Victims of domestic violence, sexual assault, and stalking leave rights', 'Gov. Code § 12945.8', 'Employers with 25+ employees: notice at hire, annually, and on request'],
  ['On request', 'Pay scale for the employee’s current position', 'Lab. Code § 432.3', 'All employers; postings require pay scales at 15+ employees'],
  ['On request', 'Copies of wage statements/payroll records (21 days) and personnel file (30 days)', 'Lab. Code §§ 226(b)–(c), 1198.5', '$750 penalty for each failure'],
  ['Posted', 'Applicable IWC Wage Order and California minimum wage poster', 'Lab. Code §§ 1183, 1182.12', 'Where employees can easily read it'],
  ['Posted', 'Local minimum wage / paid leave ordinance posters', 'Local ordinances', 'If you have workers in those cities'],
  ['Posted', 'Payday notice (regular paydays, time and place of payment)', 'Lab. Code § 207', 'All employers'],
  ['Posted', 'California Civil Rights Department posters (discrimination, family/pregnancy leave, transgender rights)', 'Gov. Code § 12950; Cal. Code Regs., tit. 2', 'Employers with 5+ for leave posters'],
  ['Posted', 'Cal/OSHA “Safety and Health Protection on the Job” and heat illness/Workplace Violence Prevention Plan availability', 'Lab. Code §§ 6328, 6401.9', 'All employers'],
  ['Every 2 years', 'Harassment prevention training (2 h supervisors, 1 h others)', 'Gov. Code § 12950.1', 'Employers with 5+ employees'],
  ['Every year', 'Workplace violence prevention training; plan review', 'Lab. Code § 6401.9', 'Most employers'],
  ['Before separation', 'Final pay on time; “Change in Relationship” notice (EDD DE 2320) and UI/SDI/PFL info', 'Lab. Code §§ 201–203; Unemp. Ins. Code § 1089', 'Immediately on discharge; 72 hours for resignations without notice']
];
S.noticesDone = S.noticesDone || {};
VIEWS.notices = el => {
  const done = NOTICES.filter((_, i) => S.noticesDone[i]).length;
  el.innerHTML = X.head('Notices & postings', 'What California requires you to give, post, and train — with the law for each.') + `
    <div class="row" style="margin-bottom:12px"><span class="chip ${done === NOTICES.length ? 'ok' : ''}">${done} of ${NOTICES.length} done</span><button class="btn" data-act="notices-docx">Checklist (Word)</button><button class="btn" data-act="penny-ask" data-q="Draft our new-hire Wage Theft Prevention Act notice (Labor Code 2810.5) with all required fields.">Ask Penny to draft a notice</button></div>
    <div class="tablewrap"><table><thead><tr><th></th><th>When</th><th>Requirement</th><th>Authority</th><th>Applies to</th></tr></thead><tbody>${NOTICES.map(([w, r, c, a], i) => `<tr><td><input type="checkbox" data-nt="${i}" ${S.noticesDone[i] ? 'checked' : ''} aria-label="Done"></td><td class="small" style="white-space:nowrap">${esc(w)}</td><td>${esc(r)}</td><td class="cite">${esc(c)}</td><td class="small">${esc(a)}</td></tr>`).join('')}</tbody></table></div>
    <p class="cite" style="margin-top:8px">Missing notices are a frequent PAGA allegation. Confirm current forms with the Labor Commissioner, CRD, EDD, and Cal/OSHA.</p>`;
  el.querySelectorAll('[data-nt]').forEach(c => c.addEventListener('change', e => { S.noticesDone[e.target.dataset.nt] = e.target.checked; X.persist(); X.render(); }));
};
document.addEventListener('click', async e => {
  if (!e.target.closest('[data-act="notices-docx"]')) return;
  await X.saveDocx([{ title: 'California notices and postings checklist', blocks: [{ t: 'title', text: `California Notices & Postings Checklist — ${S.profile?.company || S.input?.employerName || ''}` }, { t: 'table', head: ['Done', 'When', 'Requirement', 'Authority', 'Applies to'], rows: NOTICES.map(([w, r, c, a], i) => [S.noticesDone[i] ? '✓' : '', w, r, c, a]) }] }], `notices-postings-checklist-${iso()}.docx`);
});

// ======================================================= case timeline on the Litigation page
const baseLit = VIEWS.litigation;
VIEWS.litigation = el => {
  baseLit(el); const docs = (S.lit?.docs || []); if (!docs.length) return;
  const t = PC.caseTimeline(docs.map(d => ({ name: d.name, text: d.text }))); if (!t.length) return;
  const host = el.querySelectorAll('.panel')[2] || el.querySelector('.panel');
  host.insertAdjacentHTML('beforebegin', `<details class="panel" style="margin-top:14px" open><summary><b>Case timeline</b> <span class="small muted">${t.length} dated events from your documents</span></summary><div class="tablewrap" style="max-height:300px;overflow:auto;margin-top:8px"><table><tbody>${t.map(x => `<tr><td style="white-space:nowrap" class="small"><b>${esc(x.date)}</b></td><td class="small">${esc(x.event)}</td><td class="cite">${esc(x.source)}</td></tr>`).join('')}</tbody></table></div><button class="btn" style="margin-top:8px" data-act="timeline-xlsx">Timeline (Excel)</button></details>`);
};
document.addEventListener('click', async e => {
  if (!e.target.closest('[data-act="timeline-xlsx"]')) return;
  const t = PC.caseTimeline((S.lit?.docs || []).map(d => ({ name: d.name, text: d.text }))); const XL = PC.XLSX; const wb = XL.utils.book_new(); XL.utils.book_append_sheet(wb, XL.utils.json_to_sheet(t), 'Timeline');
  await X.save(`case-timeline-${iso()}.xlsx`, new Blob([XL.write(wb, { bookType: 'xlsx', type: 'array' })]));
});
X.render();
})();

/* ---------- saved conversations: mark answers saved by older versions so retired wording can’t confuse */
(() => {
const X = window.PCX; const { S } = X;
const RETIRED = /I don’t have a cited answer for that|With Aldune AI turned on \(Aldune AI page\)|isn’t covered by Aldune’s California wage-and-hour knowledge base/;
const base = X.refreshChat;
X.refreshChat = () => {
  base();
  const msgs = (S.conv?.messages || []).filter(m => m.role === 'assistant');
  document.querySelectorAll('#as-chat .a').forEach((n, k) => { const m = msgs[k]; if (!m || !RETIRED.test(m.content || '') || n.querySelector('.penny-old')) return; n.insertAdjacentHTML('afterbegin', '<div class="penny-old small" style="color:var(--ink2);margin-bottom:4px">This answer was saved by an older version of Penny. <button class="btn" style="padding:1px 8px;font-size:12px" data-act="as-new">New chat</button></div>'); });
};
})();
