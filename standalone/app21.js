/* Aldune standalone — part 21: attorney-authored custom rules (sandboxed DSL, verification-gated) */
(() => {
'use strict';
const X = window.PCX; const { PC, S, $, esc, money, toast, VIEWS } = X;
S.customRules = S.customRules || [];
const EXAMPLE = { id: 'reporting_time', title: 'Reporting-time pay', authority: 'IWC Wage Orders § 5', scope: 'shift', applies_if: 'scheduled > 0', violation_trigger: 'hours < 0.5 * scheduled', amount: '(clamp(0.5 * scheduled, 2, 4) - hours) * rate', verification_status: 'needs_review', effective_start: '2001-01-01' };
const FIELDS = 'Shift fields: date, hours, rate, mealMinutes, meals, scheduled, seventhDay, location, department. Period fields: date, regHours, otHours, regRate, bonus. Employee fields: hours (total), rate, exempt, terminated. Functions: min, max, abs, round, clamp.';
function rows(scope) {
  if (!S.result) return []; const emp = new Map(S.result.engine.employees.map(e => [e.employee.id, e.employee]));
  if (scope === 'shift') return S.result.engine.shifts.map(s => { const e = emp.get(s.employeeId) || {}; return { date: s.date, hours: s.workedMin / 60, rate: e.hourlyRate || 0, mealMinutes: (s.meals || []).reduce((t, m) => t + (m.minutes || 0), 0), meals: (s.meals || []).length, scheduled: s.record?.scheduledMin ? s.record.scheduledMin / 60 : 0, seventhDay: !!s.seventhDay, location: s.record?.location || e.location || '', department: s.record?.department || '', employeeId: s.employeeId }; });
  if (scope === 'period') return (S.input?.payroll || []).map(p => ({ date: p.periodEnd, regHours: p.regHours, otHours: p.otHours, regRate: p.regRate || 0, bonus: p.bonus || 0, employeeId: p.employeeId }));
  return S.result.engine.employees.map(x => ({ date: x.employee.terminationDate || '', hours: S.result.engine.shifts.filter(s => s.employeeId === x.employee.id).reduce((t, s) => t + s.workedMin / 60, 0), rate: x.employee.hourlyRate || 0, exempt: x.employee.classification === 'exempt', terminated: !!x.employee.terminationDate, employeeId: x.employee.id }));
}
const baseRules = VIEWS.rules;
VIEWS.rules = el => {
  baseRules(el);
  const results = S.customRules.map(r => { try { return { r, res: PC.runRule(r, rows(r.scope)) }; } catch (e) { return { r, err: e.message }; } });
  el.insertAdjacentHTML('beforeend', `<h2>Custom rules (attorney-authored)</h2><p class="small">Write a rule in Aldune’s safe rule language. New rules stay in <b>review</b> and never affect results until an attorney marks them verified.</p>
    <div class="grid g2"><div class="panel"><textarea id="cr-src" rows="12" style="width:100%;font-family:ui-monospace,monospace;font-size:12.5px">${esc(S.crDraft || JSON.stringify(EXAMPLE, null, 2))}</textarea>
      <p class="cite">${esc(FIELDS)}</p><div class="row"><button class="btn" data-act="cr-check">Validate &amp; preview</button><button class="btn primary" data-act="cr-save">Save rule</button></div><div id="cr-out" class="small" style="margin-top:8px"></div></div>
    <div class="panel"><h3 style="margin-top:0">Your rules</h3>${results.length ? `<table><tbody>${results.map(({ r, res, err }, i) => `<tr><td><b>${esc(r.title)}</b><div class="cite">${esc(r.authority)} · ${esc(r.scope)}</div></td><td><span class="chip ${r.verification_status === 'attorney_verified' ? 'ok' : 'warn'}">${r.verification_status === 'attorney_verified' ? `verified — ${esc(r.verified_by || '')}` : 'in review'}</span></td><td class="small">${err ? esc(err) : S.result ? `${res.matches.toLocaleString()} matches${res.total ? ` · ${money(res.total)}` : ''}` : 'Run an audit to see matches'}</td><td><button class="btn" style="padding:2px 8px" data-act="cr-verify" data-i="${i}">${r.verification_status === 'attorney_verified' ? 'Return to review' : 'Verify…'}</button> <button class="btn" style="padding:2px 8px" data-act="cr-del" data-i="${i}">Delete</button></td></tr>`).join('')}</tbody></table>` : '<p class="small muted">No custom rules yet.</p>'}</div></div>`);
  $('#cr-src').addEventListener('input', e => { S.crDraft = e.target.value; });
};
function readDraft() { let r; try { r = JSON.parse($('#cr-src').value); } catch { throw new Error('The rule must be valid JSON.'); } const errs = PC.validateRule({ ...r, verification_status: 'needs_review' }); if (errs.length) throw new Error(errs.join(' · ')); return r; }
document.addEventListener('click', e => {
  const a = e.target.closest('[data-act^="cr-"]'); if (!a) return; const out = $('#cr-out');
  try {
    if (a.dataset.act === 'cr-check') { const r = readDraft(); const res = S.result ? PC.runRule({ ...r, verification_status: 'needs_review' }, rows(r.scope)) : null; out.innerHTML = `<span class="chip ok">Valid</span> ${res ? `${res.matches.toLocaleString()} matches in this audit${res.total ? `, ${money(res.total)}` : ''}.` : 'Run an audit to preview matches.'}`; }
    if (a.dataset.act === 'cr-save') { const r = readDraft(); if (r.verification_status === 'attorney_verified') r.verification_status = 'needs_review'; S.customRules = S.customRules.filter(x => x.id !== r.id).concat(r); X.persist(); toast('Saved — in review until an attorney verifies it.'); X.render(); }
    if (a.dataset.act === 'cr-verify') { const r = S.customRules[+a.dataset.i]; if (r.verification_status === 'attorney_verified') { r.verification_status = 'needs_review'; delete r.verified_by; } else { const who = prompt('Verifying attorney (name and State Bar number):'); if (!who || who.trim().length < 5) return; r.verification_status = 'attorney_verified'; r.verified_by = who.trim(); r.verified_at = new Date().toISOString(); X.log && X.log('rule.verified', { rule: r.id, by: r.verified_by }); } X.persist(); X.render(); }
    if (a.dataset.act === 'cr-del') { if (!confirm('Delete this custom rule?')) return; S.customRules.splice(+a.dataset.i, 1); X.persist(); X.render(); }
  } catch (err) { if (out) out.innerHTML = `<span class="chip flag">Error</span> ${esc(err.message)}`; else toast(err.message); }
});
X.render();
})();

/* ---------- Portfolio (firms, PEOs, multi-entity employers) */
(() => {
const X = window.PCX; const { PC, S, esc, money, VIEWS } = X;
VIEWS.portfolio = el => {
  const p = PC.portfolio(S.snapshots || [], new Date().toISOString().slice(0, 10));
  el.innerHTML = X.head('Portfolio', 'Every employer you audit, ranked by risk — for law firms, PEOs, and multi-entity companies.') + (p.rows.length ? `
    <div class="kpis" style="grid-template-columns:repeat(4,1fr)"><div class="kpi"><div class="v">${p.totals.employers}</div><div class="k">Employers</div></div><div class="kpi risk"><div class="v">${money(p.totals.exposure)}</div><div class="k">Combined likely exposure</div></div><div class="kpi"><div class="v">${p.totals.high}</div><div class="k">High-risk employers</div></div><div class="kpi"><div class="v">${p.totals.stale}</div><div class="k">Audits older than 90 days</div></div></div>
    <div class="tablewrap" style="margin-top:12px"><table><thead><tr><th>Employer</th><th>Risk · grade</th><th class="n">Likely exposure</th><th class="n">Change</th><th class="n">PAGA</th><th>Last audit</th></tr></thead><tbody>${p.rows.map(r => `<tr><td><b>${esc(r.employer)}</b><div class="small muted">${r.audits} audit${r.audits === 1 ? '' : 's'}</div></td><td><span class="chip ${/high|critical/i.test(r.level) ? 'flag' : /medium/i.test(r.level) ? 'warn' : 'ok'}">${esc(r.level)} risk</span>${r.latest.grade ? ` <b>${esc(r.latest.grade)}</b>` : ''}</td><td class="n">${money(r.exposure)}</td><td class="n">${r.deltaExposure === null ? '—' : `<span style="color:${r.deltaExposure > 0 ? 'var(--flag)' : 'var(--ledger)'}">${r.deltaExposure > 0 ? '▲' : '▼'} ${money(Math.abs(r.deltaExposure))}</span>`}</td><td class="n">${money(r.paga)}</td><td class="small">${esc(r.latest.windowEnd)}${r.stale ? ' <span class="chip warn">re-audit</span>' : ''}</td></tr>`).join('')}</tbody></table></div>
    <p class="cite">Each row is the latest saved audit for that employer (Monitoring → Save). Re-audit at least quarterly: PAGA reaches back one year and “all reasonable steps” requires periodic audits (Lab. Code § 2699(g)).</p>` : `<div class="panel"><p>No saved audits yet. After you run an audit, choose <b>Save to monitoring</b> — each employer you save appears here.</p><button class="btn primary" data-act="go" data-to="import">Run an audit</button></div>`);
};
X.render();
})();

/* ---------- Navigation: quick filter + collapsible sections (the sidebar now has ~40 pages) */
(() => {
const X = window.PCX; const { S } = X; const nav = document.getElementById('nav'); if (!nav || nav.dataset.enhanced) return; nav.dataset.enhanced = '1';
let collapsed = {}; try { collapsed = JSON.parse(localStorage.getItem('paycure:navCollapsed') || '{}'); } catch { collapsed = {}; }
const groups = [...nav.querySelectorAll('.nav-group')];
const membersOf = g => { const out = []; let n = g.nextElementSibling; while (n && !n.classList.contains('nav-group')) { if (n.matches('button[data-view]')) out.push(n); n = n.nextElementSibling; } return out; };
groups.forEach(g => { g.setAttribute('role', 'button'); g.tabIndex = 0; g.style.cursor = 'pointer'; g.insertAdjacentHTML('beforeend', '<span class="nav-caret" aria-hidden="true" style="float:right;margin-right:12px">▾</span>'); });
function apply() {
  const q = (document.getElementById('nav-q')?.value || '').trim().toLowerCase();
  groups.forEach(g => {
    const name = g.textContent.replace('▾', '').replace('▸', '').trim(); const mem = membersOf(g); const hasActive = mem.some(b => b.dataset.view === S.view);
    const open = q ? true : (!collapsed[name] || hasActive);
    let any = false; mem.forEach(b => { const match = !q || b.textContent.toLowerCase().includes(q); b.style.display = open && match ? '' : 'none'; if (match) any = true; });
    g.style.display = q && !any ? 'none' : ''; const c = g.querySelector('.nav-caret'); if (c) c.textContent = open ? '▾' : '▸'; g.setAttribute('aria-expanded', String(open));
  });
}
const toggle = g => { const name = g.textContent.replace('▾', '').replace('▸', '').trim(); collapsed[name] = !collapsed[name]; try { localStorage.setItem('paycure:navCollapsed', JSON.stringify(collapsed)); } catch { /* ignore */ } apply(); };
groups.forEach(g => { g.addEventListener('click', () => toggle(g)); g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(g); } }); });
(groups[0] || nav.firstElementChild).insertAdjacentHTML('beforebegin', '<div style="padding:0 12px 8px"><label class="sr" for="nav-q">Go to page</label><input id="nav-q" type="search" placeholder="Go to…" autocomplete="off" style="width:100%;padding:6px 10px;border-radius:6px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.08);color:inherit"></div>');
const qi = document.getElementById('nav-q'); qi.addEventListener('input', apply); qi.addEventListener('keydown', e => { if (e.key === 'Enter') { const first = [...nav.querySelectorAll('button[data-view]')].find(b => b.style.display !== 'none'); if (first) { first.click(); qi.value = ''; apply(); } } if (e.key === 'Escape') { qi.value = ''; apply(); } });
const baseRender = X.render; X.render = () => { baseRender(); apply(); }; apply();
})();

/* ---------- Pay equity (Lab. Code § 1197.5) */
(() => {
const X = window.PCX; const { PC, S, esc, money, VIEWS } = X;
VIEWS.payequity = el => {
  const r = S.input ? PC.payEquity(S.input) : null;
  el.innerHTML = X.head('Pay equity', 'Pay differences within the same job, by sex and by race or ethnicity — for attorney review.') + (!r || !r.available ? `<div class="panel"><p>To run this review, include <b>sex</b> and/or <b>race / ethnicity</b> columns in your employee list (optional columns on the Import page). This data stays in your browser and is used only here — never in wage findings.</p><button class="btn primary" data-act="go" data-to="import">Import data</button></div>` : `
    <div class="kpis" style="grid-template-columns:repeat(3,1fr)"><div class="kpi"><div class="v">${r.titlesReviewed}</div><div class="k">Job titles reviewed</div></div><div class="kpi ${r.rows.length ? 'risk' : ''}"><div class="v">${r.rows.length}</div><div class="k">Gaps of 5% or more</div></div><div class="kpi"><div class="v">${r.rows.length ? money(Math.max(...r.rows.map(x => x.annualGapPerWorker))) : '$0'}</div><div class="k">Largest annual gap per worker</div></div></div>
    ${r.rows.length ? `<div class="tablewrap" style="margin-top:12px"><table><thead><tr><th>Job title</th><th>Compared</th><th class="n">Higher-paid avg.</th><th class="n">Lower-paid avg.</th><th class="n">Gap</th><th>Context</th></tr></thead><tbody>${r.rows.map(x => `<tr><td><b>${esc(x.title)}</b><div class="small muted">${esc(x.dimension)}</div></td><td class="small">${esc(x.high.group)} (${x.high.n}) vs ${esc(x.low.group)} (${x.low.n})</td><td class="n">$${x.high.mean.toFixed(2)}</td><td class="n">$${x.low.mean.toFixed(2)}</td><td class="n"><b>${x.gapPct}%</b><div class="small">${money(x.annualGapPerWorker)}/yr</div></td><td class="small">${esc(x.note)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="small" style="margin-top:12px">No within-title gaps of 5% or more.</p>'}
    <p class="cite" style="margin-top:8px">${esc(r.method)} Remedies for violations include the wage difference plus an equal amount as liquidated damages; recovery reaches back up to six years. ${esc(r.cite)}.</p>`);
};
X.render();
})();

/* ---------- System fingerprints on the dashboard: root causes before individual findings */
(() => {
const X = window.PCX; const { PC, S, esc, VIEWS } = X;
// fingerprints are computed once per audit and shared (dashboard re-renders often)
let fpCache = { r: null, f: [] }; X.fpOf = () => { if (S.result && fpCache.r !== S.result) fpCache = { r: S.result, f: PC.fingerprints(S.input, S.result) }; return S.result ? fpCache.f : []; };
const baseExec = VIEWS.exec;
VIEWS.exec = el => {
  baseExec(el); if (!S.result || !S.input) return; const f = X.fpOf(); if (!f.length) return;
  const host = el.querySelector('.kpis'); if (!host) return;
  host.insertAdjacentHTML('afterend', `<div class="panel" style="margin:12px 0;border-left:5px solid var(--flag)"><h3 style="margin-top:0">System problems behind your findings</h3><p class="small muted" style="margin-top:-6px">Fix these settings first — each one creates findings on every affected shift or pay period.</p>${f.map(x => `<details style="margin:6px 0"><summary><b>${esc(x.title)}</b> <span class="chip ${x.strength === 'strong' ? 'flag' : 'warn'}">${x.strength}</span> <span class="small muted">${x.affected} worker${x.affected === 1 ? '' : 's'}</span></summary><div class="small" style="margin:6px 0 0 14px"><div><b>Evidence:</b> ${esc(x.evidence)}</div><div><b>What it means:</b> ${esc(x.meaning)}</div><div><b>Fix:</b> ${esc(x.fix)}</div><div class="cite">${esc(x.cite)}</div></div></details>`).join('')}<div class="row" style="margin-top:6px"><button class="btn" data-act="go" data-to="pos">POS &amp; timekeeping setup</button><button class="btn" data-act="pos-memo">Configuration request (Word)</button></div></div>`);
};
X.render();
})();
