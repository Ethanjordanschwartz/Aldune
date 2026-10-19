/* Aldune standalone — part 15: Penny’s drafts (Word export, copy) and “What is this number?” explanations for every key figure */
(() => {
'use strict';
const X = window.PCX; const { PC, S, esc, money, toast } = X;
const iso = () => new Date().toISOString().slice(0, 10);

// ======================================================= Penny drafts → Word / copy
const DRAFT_RE = /<<<DRAFT\s*\n?([\s\S]*?)\n?DRAFT>>>/;
function draftModel(text) {
  const lines = text.replace(/\r/g, '').split('\n'); const title = (lines.find(l => l.trim()) || 'Draft').replace(/^#+\s*/, '').trim();
  const blocks = []; let bullets = [];
  const flush = () => { if (bullets.length) { blocks.push({ t: 'bullets', items: bullets.map(b => [b]) }); bullets = []; } };
  lines.slice(lines.findIndex(l => l.trim()) + 1).forEach(l => {
    const t = l.trim(); if (!t) { flush(); return; }
    if (/^#{1,3}\s+/.test(t)) { flush(); blocks.push({ t: 'heading', text: t.replace(/^#+\s*/, '') }); }
    else if (/^[-*•]\s+/.test(t)) bullets.push(t.replace(/^[-*•]\s+/, '').replace(/\*\*/g, ''));
    else if (/^\d+[.)]\s+/.test(t)) { flush(); blocks.push({ t: 'p', runs: [t.replace(/\*\*/g, '')] }); }
    else { flush(); blocks.push({ t: 'p', align: 'justify', runs: [t.replace(/\*\*/g, '')] }); }
  }); flush();
  return { title, blocks: [{ t: 'title', text: title }, ...blocks] };
}
const baseRefresh = X.refreshChat;
X.refreshChat = () => {
  baseRefresh();
  const msgs = (S.conv?.messages || []).filter(m => m.role === 'assistant');
  document.querySelectorAll('#as-chat .a').forEach((n, k) => {
    const m = msgs[k]; if (!m || !DRAFT_RE.test(m.content || '') || n.querySelector('.penny-draft')) return;
    const draft = m.content.match(DRAFT_RE)[1].trim(); const before = m.content.split('<<<DRAFT')[0].replace(/\[\[[^\]]+\]\]/g, '').trim(); const after = (m.content.split('DRAFT>>>')[1] || '').replace(/\[\[[^\]]+\]\]/g, '').trim();
    const extra = [...n.querySelectorAll('.row, ol')].map(x => x.outerHTML).join('');
    n.innerHTML = `${before ? `<p>${esc(before).replace(/\n/g, '<br>')}</p>` : ''}<div class="penny-draft" style="border:1px solid var(--line);border-radius:10px;background:var(--surface);padding:12px 14px;margin:8px 0;max-height:360px;overflow:auto;white-space:pre-wrap;font-family:Georgia,serif;font-size:14px">${esc(draft)}</div><div class="row"><button class="btn primary" data-act="penny-word" data-k="${k}">Download Word</button><button class="btn" data-act="penny-copy" data-k="${k}">Copy</button></div>${after ? `<p class="small">${esc(after)}</p>` : ''}${extra}`;
  });
};
document.addEventListener('click', async e => {
  const a = e.target.closest('[data-act="penny-word"],[data-act="penny-copy"]'); if (!a) return;
  const m = (S.conv?.messages || []).filter(x => x.role === 'assistant')[+a.dataset.k]; if (!m) return; const draft = m.content.match(DRAFT_RE)?.[1]?.trim() || '';
  if (a.dataset.act === 'penny-copy') { try { await navigator.clipboard.writeText(draft); toast('Copied'); } catch { toast('Select the text and copy it.'); } return; }
  const model = { ...draftModel(draft), draftBanner: /attorney review|agreement|policy|notice|brief|release/i.test(draft) ? 'Draft for attorney review — prepared with Penny (Aldune).' : undefined };
  await X.save(`${model.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50) || 'draft'}-${iso()}.docx`, await PC.toDocxBlob([model]));
});

// ======================================================= “What is this number?”
const neutral = () => PC.runScenario(S.input, S.result, { ...PC.DEFAULT_SCENARIO, ...PC.PERSPECTIVES.neutral });
const defense = () => PC.runScenario(S.input, S.result, { ...PC.DEFAULT_SCENARIO, ...PC.PERSPECTIVES.defense });
const row = (k, v) => `<tr><td class="small">${k}</td><td class="n">${v}</td></tr>`;
const section = (what, how, from, todo, extra = '') => `<p><b>What it is.</b> ${what}</p>${extra}<p><b>How it’s calculated.</b> ${how}</p><p><b>Where it comes from.</b> ${from}</p>${todo ? `<p><b>What to do.</b> ${todo}</p>` : ''}`;
function breakdown(sc) { const cats = (sc.byCategory || []).filter(c => c.amount > 0).slice(0, 6); return `<table>${row('Wages and premiums owed', money(sc.wages))}${row('Statutory penalties (wage statements, waiting time)', money(sc.penalties))}${row('PAGA civil penalties', money(sc.paga))}${row('<b>Total</b>', `<b>${money(sc.total)}</b>`)}</table>${cats.length ? `<p class="small" style="margin-top:8px"><b>Largest areas:</b> ${cats.map(c => `${esc(c.label)} ${money(c.amount)}`).join(' · ')}</p>` : ''}`; }
const EXPLAIN = [
  [/likely exposure/i, () => { const d = defense(), n = neutral(); return ['Likely exposure', section(`The range of what a claim over these records could realistically cost, from the defense model (${money(d.total)}) to the neutral model (${money(n.total)}).`, 'Aldune adds up every finding’s amount — unpaid wages, meal and rest premiums, reimbursements, interest — plus statutory penalties (wage statements, waiting time) and PAGA penalties, over the full lookback period. The defense model uses employer-favorable assumptions; the neutral model uses middle-of-the-road ones.', 'Your time and payroll records, tested shift by shift and pay period by pay period by Aldune’s versioned California rules. Low-confidence findings and findings you dismissed are excluded.', 'Pay what’s owed first (Back-pay planner) — that removes most of the wage and interest portion and supports the PAGA reasonable-steps caps.', `<p><b>Neutral model breakdown</b></p>${breakdown(n)}`)]; }],
  [/back pay owed|owed now|^\d[\d,]* workers$/i, () => { const bp = PC.backPay(S.input, S.result, { interestRate: 0.1, includeLiquidated: false, through: S.result.engine.meta.assumptions.auditDate }); return ['Back pay owed', section('Money your workers are owed today — not penalties or lawsuit estimates.', 'Sum of unpaid wages, meal/rest/split-shift premiums, and unreimbursed expenses from each finding, plus 10% simple interest from the date each amount was due (Lab. Code § 218.6).', 'Individual findings you can open in Findings; each shows its formula and source rows.', 'Download the payroll file and wage letters in the Back-pay planner; mark workers as paid.', `<table>${row('Wages', money(bp.totals.wages))}${row('Premiums', money(bp.totals.premiums))}${row('Reimbursement', money(bp.totals.reimbursement))}${row('Interest', money(bp.totals.interest))}${row('<b>Total</b>', `<b>${money(bp.totals.total)}</b> to ${bp.totals.employees} workers`)}</table>`)]; }],
  [/w-2 wages and premiums/i, () => ['W-2 wages and premiums', section('The part of back pay that is wages — reported on Form W-2 with normal tax withholding.', 'Unpaid wages plus meal, rest, and split-shift premiums (premiums are wages; Naranjo v. Spectrum Security Services (2022) 13 Cal.5th 93).', 'Findings in the wage, overtime, minimum-wage, meal, rest, and split-shift categories.', 'Run these through payroll with the earnings codes in the payroll file.')]],
  [/reimbursement/i, () => ['Reimbursement', section('Business expenses employees paid that should have been reimbursed.', 'Unreimbursed amounts from expense findings (Lab. Code § 2802).', 'Expense data in your payroll or employee files.', 'Pay as a non-taxable reimbursement, not wages.')]],
  [/interest/i, () => ['Interest', section('Interest on money owed late.', '10% simple interest per year from each amount’s due date to the date shown (Lab. Code § 218.6; Civ. Code § 3289), or 7% when curing a PAGA notice.', 'Due dates of each finding.', 'Report on Form 1099-INT.')]],
  [/paga/i, () => { const n = neutral(); return ['PAGA penalties', section('Civil penalties an employee can seek on behalf of the State under the Private Attorneys General Act.', '$100 per employee per pay period (amended 2024 rules), with $25 for some wage-statement violations, reduced to 15% or 30% if you took reasonable steps; 65% goes to the State.', 'Pay periods in the year before a notice, counted from your records.', 'Document reasonable steps (evidence binder) and pay what’s owed — both reduce PAGA exposure.', `<table>${row('PAGA in neutral model', money(n.paga))}</table>`)]; }],
  [/findings?$/i, () => ['Findings', section('Each finding is one potential issue on one shift, pay period, or worker — for example, a late meal on March 3.', 'Count of findings the rules engine produced; some carry a dollar amount, some don’t (like recordkeeping gaps).', 'Your records, tested by Aldune’s rules.', 'Open Findings to review, dispute, or dismiss.')]],
  [/data coverage|coverage/i, () => ['Data coverage', section('How much of California law Aldune could actually test with the records you gave it.', 'Share of 10 areas fully tested (partial counts as half).', 'Which columns and documents were present (meal punches, pay stubs, termination dates, locations).', 'Add the missing records shown in the coverage panel — or fix your POS.')]],
  [/risk score|risk$/i, () => ['Risk score', section('A 0–100 summary of how serious and widespread the issues are.', 'Weighs exposure relative to payroll, how many workers are affected, and violation patterns.', 'Your findings and patterns.', 'Use it to compare runs over time, not as a legal conclusion.')]],
  [/plaintiff opening|defense opening|expected settlement|target/i, () => ['Negotiation figures', section('Opening positions and the expected settlement range for this case.', 'Plaintiff opening = realistic exposure; defense opening = 40% of risk-adjusted value (minimum 5% of realistic); expected range ≈ 10–35% of realistic exposure, bounded by risk-adjusted value.', 'The claim-by-claim damages model on the Litigation page (Kullar v. Foot Locker (2008) 168 Cal.App.4th 116).', 'Adjust the violation rates and probabilities to match your evidence.')]]
];
const baseRender = X.render;
X.render = () => {
  baseRender();
  if (!S.result && !['litigation'].includes(S.view)) return;
  document.querySelectorAll('#views .kpi').forEach(k => {
    if (k.querySelector('.kpi-why')) return; const label = (k.querySelector('.k')?.textContent || '').trim(); const val = (k.querySelector('.v')?.textContent || '').trim();
    const hit = EXPLAIN.find(([re]) => re.test(label)) || (/\$/.test(val) ? [null, () => ['This amount', section('A dollar figure calculated by Aldune’s deterministic engine from your records.', 'Each finding’s amount follows the formula shown on that finding.', 'Your time and payroll records.', 'Open the Risk Explorer to drill from this total down to individual records.')]] : null);
    if (!hit) return;
    k.style.position = 'relative'; k.insertAdjacentHTML('beforeend', `<button class="kpi-why" data-act="kpi-why" title="What is this number?" aria-label="What is this number?" style="all:unset;cursor:pointer;position:absolute;top:8px;right:10px;font-size:13px;color:var(--ink2)">ⓘ</button>`);
    k.querySelector('.kpi-why').dataset.idx = String(EXPLAIN.indexOf(hit));
  });
};
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act="kpi-why"]'); if (!b) return; e.stopPropagation();
  const k = b.closest('.kpi'); const val = (k.querySelector('.v')?.textContent || '').trim(); const idx = +b.dataset.idx;
  try { const [title, html] = idx >= 0 ? EXPLAIN[idx][1]() : ['This amount', section('A dollar figure calculated by Aldune from your records.', 'See the formula on each finding.', 'Your records.', 'Open the Risk Explorer to drill down.')]; X.openDrawer(`${title}: ${val}`, '', `${html}<div class="row" style="margin-top:12px"><button class="btn" data-act="go" data-to="explorer">Drill down in Risk Explorer</button><button class="btn" data-act="go" data-to="findings">See findings</button></div>`); }
  catch (err) { toast(err.message); }
});
})();

/* ---------- Penny: revise the last draft (built-in) and remember attached reference documents */
(() => {
const X = window.PCX; const { PC, S } = X;
const DR = /<<<DRAFT\s*\n?([\s\S]*?)\n?DRAFT>>>/;
const baseAsk = X.ask;
const lastDraft = () => [...(S.conv?.messages || [])].reverse().find(m => m.role === 'assistant' && DR.test(m.content || ''));
function revise(draft, q) {
  const ql = q.toLowerCase();
  if (/shorter|shorten|condense|trim|more concise|briefer/.test(ql)) return { text: draft.split('\n').map(l => (/^#|^\s*$|^[-*•]/.test(l) || l.length < 120) ? l : (l.split(/(?<=[.!?])\s+/)[0])).join('\n'), note: 'Shortened each paragraph to its key sentence.' };
  const add = ql.match(/\badd (?:a |an |the )?(.+?)(?: policy| section| clause| paragraph)?\s*$/);
  if (add) { const words = add[1].split(/[^a-z]+/).filter(w => w.length > 3); const pol = PC.HANDBOOK_REQUIRED.find(r => words.some(w => r.title.toLowerCase().includes(w) || r.id.includes(w)));
    if (pol) return { text: `${draft.replace(/\n*Draft for attorney review\.?\s*$/i, '')}\n\n## ${pol.title}\n${pol.text}\nAuthority: ${pol.cite}.\n\nDraft for attorney review.`, note: `Added a ${pol.title} section (${pol.cite}).` }; }
  const rm = ql.match(/\b(?:remove|delete|drop|take out) (?:the )?(.+?)(?: policy| section| clause| paragraph)?\s*$/);
  if (rm) { const key = rm[1].split(/[^a-z]+/).filter(w => w.length > 3); const parts = draft.split(/\n(?=## )/); const kept = parts.filter(p => !(p.startsWith('## ') && key.some(w => p.split('\n')[0].toLowerCase().includes(w)))); if (kept.length < parts.length) return { text: kept.join('\n'), note: `Removed ${parts.length - kept.length} section${parts.length - kept.length > 1 ? 's' : ''}.` }; }
  const co = q.match(/(?:company|employer)(?: name)? (?:is|to|as) ["“]?([^"”\n]+?)["”]?\s*$/i) || q.match(/(?:replace|use) \[?(?:employer|company)\]? with ["“]?([^"”\n]+?)["”]?\s*$/i);
  if (co) return { text: draft.replace(/\[(?:Employer|Company|employer|company)(?: name)?\]|\bthe Company\b/g, co[1].trim()), note: `Inserted “${co[1].trim()}”.` };
  return null;
}
X.ask = async q => {
  q = String(q || '').trim(); if (!q) return;
  const prev = lastDraft();
  if (prev && X.aiMode() === 'builtin' && /(shorter|shorten|condense|trim|concise|briefer|\badd\b|\bremove\b|\bdelete\b|\bdrop\b|take out|company name|employer name|replace)/i.test(q)) {
    const r = revise(prev.content.match(DR)[1], q);
    S.conv.messages.push({ role: 'user', content: q });
    S.conv.messages.push({ role: 'assistant', content: r ? `${r.note}\n<<<DRAFT\n${r.text}\nDRAFT>>>` : 'I can shorten the draft, add or remove a policy section, or insert your company name without Aldune AI. For rewording, tone, or translation, turn on Aldune AI and ask again.', citations: [] });
    const box = document.querySelector('#as-panel #as-q'); if (box) box.value = '';
    X.refreshChat(); if (X.saveConv) X.saveConv(S.conv); return;
  }
  return baseAsk(q);
};
// attached documents become Penny’s reference for drafting; built-in mode turns an attached handbook into a revised version on request
const baseAttach = X.chatAttach;
X.chatAttach = async files => {
  const before = S.docs.length; await baseAttach(files); const d = S.docs.slice(before).pop();
  if (d) { S.pennyRef = { name: d.name, text: d.text }; S.conv.messages.push({ role: 'assistant', content: `I’ll use “${d.name}” as a reference. Ask me to draft from it — for example “draft our version based on this template” or “revise this to comply with California law.”`, citations: [] }); X.refreshChat(); }
};
const baseAsk2 = X.ask;
X.ask = async q => {
  if (S.pennyRef && X.aiMode() === 'builtin' && /(revise|fix|update|rewrite|make (?:it|this) (?:compliant|legal)|based on (?:this|the|my) (?:template|document|handbook))/i.test(q || '')) {
    const plan = X.docPlan ? X.docPlan(S.pennyRef) : PC.reviewParagraphs(S.pennyRef.text.split('\n'));
    const items = []; const byB = new Map(plan.edits.filter(e => e.op !== 'insert').map(e => [e.block, e])); const ins = new Map(); plan.edits.filter(e => e.op === 'insert').forEach(e => { const l = ins.get(e.after) || []; l.push(...e.texts); ins.set(e.after, l); });
    (ins.get(-1) || []).forEach(t => items.push(t)); for (const b of plan.blocks) { const e = byB.get(b.i); if (!e) items.push(b.text); else if (e.op === 'replace') items.push(e.text); (ins.get(b.i) || []).forEach(t => items.push(t)); }
    const req = plan.findings.filter(f => f.level === 'required').length;
    S.conv.messages.push({ role: 'user', content: q }); S.conv.messages.push({ role: 'assistant', content: `Here’s “${S.pennyRef.name}” revised for California law (${plan.label.toLowerCase()}): ${req} required change${req === 1 ? '' : 's'} and ${plan.findings.length - req} recommended. Download the tracked-changes redline, the clean version, or the review memo from Review documents.\n<<<DRAFT\n${S.pennyRef.name.replace(/\.[a-z0-9]+$/i, '')} (revised)\n\n${items.join('\n\n')}\n\nDraft for attorney review.\nDRAFT>>>`, citations: [], actions: ['review_docs'] });
    const box = document.querySelector('#as-panel #as-q'); if (box) box.value = ''; X.refreshChat(); if (X.saveConv) X.saveConv(S.conv); return;
  }
  return baseAsk2(q);
};
})();

/* ---------- “Penny’s take” on the dashboard: three plain-English insights with one-click follow-ups */
(() => {
const X = window.PCX; const { PC, S, esc, money } = X;
const baseExec = X.VIEWS ? null : null; void baseExec;
const V = window.PCX.VIEWS; const prev = V.exec;
V.exec = el => {
  prev(el); if (!S.result) return;
  const cats = S.result.categories.filter(c => c.base > 0).sort((a, b) => b.base - a.base); const top = cats[0]; const pat = S.patterns?.anomalies?.[0];
  const gap = S.input ? PC.coverage(S.input, S.result, S.assumptions?.industry).items.find(i => i.status !== 'tested') : null;
  const owed = S.result.engine.employees.reduce((t, x) => t + x.exposure.wagesAndPremiums + x.exposure.reimbursement, 0);
  const pl = S.pov === 'plaintiff';
  const lc = s => s.toLowerCase();
  // the same audit, read from the side the user picked: employer counsel fixes and limits; employee counsel proves and values
  const tips = (pl ? [
    top && [`Strongest claim: ${lc(top.label)} — ${money(top.base)} across ${top.employees} worker${top.employees === 1 ? '' : 's'}, computed from the employer’s own records.`, `Build the case theory for our ${lc(top.label)} claim: elements, the records that prove each one, and the defenses to expect.`],
    pat && [`Pattern to plead: ${pat.headline} — a common practice supports class treatment and PAGA representative claims.`, `How do we use this pattern for class certification and PAGA: ${pat.headline}?`],
    owed > 0 && [`Unpaid wages and premiums of about ${money(owed)} before penalties and interest — the floor for a demand.`, 'Draft a settlement demand range: unpaid wages, interest, waiting-time and wage-statement penalties, and PAGA.'],
    gap && [`Ask for it in discovery: ${lc(gap.area)} — ${gap.why}`, `What should we request in discovery to prove ${lc(gap.area)}?`]
  ] : [
    top && [`Your biggest area is ${lc(top.label)} — ${money(top.base)} across ${top.employees} worker${top.employees === 1 ? '' : 's'}.`, `Explain our ${lc(top.label)} findings and what we should do first.`],
    pat && [`${pat.headline}.`, `Why is this happening: ${pat.headline}?`],
    owed > 0 && [`Workers are owed about ${money(owed)} today (before interest). Paying it and fixing the cause before a notice can cap PAGA penalties at 15%.`, 'How do we pay the back pay owed, and how should it be taxed?'],
    gap && [`Couldn’t fully check ${lc(gap.area)}: ${gap.why}`, `How do we fix this: ${gap.why}`]
  ]).filter(Boolean).slice(0, 3);
  const host = el.querySelector('.grid.g2, .kpis'); if (!host || !tips.length) return;
  host.insertAdjacentHTML('beforebegin', `<div class="panel" style="margin-bottom:14px;border-left:5px solid var(--marker)"><div class="row" style="justify-content:space-between;align-items:center"><b>🪙 Penny’s take <span class="small muted" style="font-weight:450">· ${pl ? 'employee counsel view' : 'employer view'}</span></b><button class="btn" data-act="penny-ask" data-q="${pl ? 'Summarize this audit for employee counsel: the strongest claims, the evidence for each, and a demand range.' : 'Give me a plain-English summary of this audit and the three things we should do this week.'}">Summarize this audit</button></div><ul style="margin:8px 0 0">${tips.map(([t, q]) => `<li style="margin:4px 0">${esc(t)} <button class="btn" style="padding:1px 8px;font-size:12px" data-act="penny-ask" data-q="${esc(q)}">Ask Penny</button></li>`).join('')}</ul></div>`);
};
document.addEventListener('click', e => { const a = e.target.closest('[data-act="penny-ask"]'); if (!a) return; const p = document.getElementById('as-panel'); if (p && !p.classList.contains('open')) document.getElementById('as-fab')?.click(); setTimeout(() => X.ask(a.dataset.q), 80); });
})();
