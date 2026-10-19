/* Aldune — part 46: confirm or correct punches read from a scan with low confidence.
   Days the built-in text recognition was unsure of are kept, flagged, and their findings stay POTENTIAL. Here the reviewer settles
   them: on the Findings page, a "Days to confirm" panel lists each flagged day with its punches as editable times; in a finding's
   detail panel, the same editor appears for that day. "Confirm" (as read) or "Save" (corrected) clears the flag, logs who/what in
   the audit trail, and re-runs the audit — so the findings for that day become provable (or disappear) on the facts confirmed. */
(() => {
'use strict';
const X = window.PCX; const { S, esc, toast, VIEWS } = X;
const hhmm = m => (m === null || m === undefined || isNaN(m)) ? '' : `${String(Math.floor(((m % 1440) + 1440) % 1440 / 60)).padStart(2, '0')}:${String(((m % 60) + 60) % 60).padStart(2, '0')}`;
const mins = v => { const m = /^(\d{1,2}):(\d{2})$/.exec(v || ''); return m ? +m[1] * 60 + +m[2] : null; };
const fdate = d => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const flagged = () => (S.input?.timeRecords || []).filter(t => t.lowConfidence);
const nameOf = id => (S.input?.employees || []).find(e => e.id === id)?.name || id;
const key = t => `${t.employeeId}|${t.date}`;

function editor(t, compact) {
  const k = esc(key(t)); const m = t.meals || [];
  const f = (lab, field, v) => `<label class="field" style="margin:0;min-width:96px">${lab}<input type="time" data-pc="${k}" data-f="${field}" value="${hhmm(v)}"></label>`;
  return `<div class="row" style="gap:8px;align-items:flex-end;flex-wrap:wrap">${f('In', 'in', t.clockIn)}${f('Meal out', 'm1o', m[0]?.out)}${f('Meal in', 'm1i', m[0]?.in)}${m[1] ? f('Meal 2 out', 'm2o', m[1].out) + f('Meal 2 in', 'm2i', m[1].in) : ''}${f('Out', 'out', t.clockOut)}
    <button class="btn" data-act="pc-confirm" data-k="${k}">Confirm as read</button><button class="btn primary" data-act="pc-save" data-k="${k}">Save correction</button>${compact ? '' : ''}</div>`;
}
async function settle(k, corrected) {
  const t = flagged().find(x => key(x) === k); if (!t) return;
  const before = { in: t.clockIn, out: t.clockOut, meals: JSON.parse(JSON.stringify(t.meals || [])) };
  if (corrected) {
    const v = f => mins(document.querySelector(`[data-pc="${CSS.escape(k)}"][data-f="${f}"]`)?.value);
    const ci = v('in'), co = v('out'); if (ci === null || co === null) { toast('Enter both the clock-in and clock-out times.'); return; }
    const meals = [[v('m1o'), v('m1i')], [v('m2o'), v('m2i')]].filter(([a, b]) => a !== null && b !== null).map(([a, b]) => ({ out: a, in: b }));
    t.clockIn = ci; t.clockOut = co; t.meals = meals; delete t.mealsUnknown;
  }
  delete t.lowConfidence;
  X.log && X.log('punch.confirmed', { employee: nameOf(t.employeeId), date: t.date, corrected: !!corrected, before: { in: hhmm(before.in), out: hhmm(before.out) }, after: { in: hhmm(t.clockIn), out: hhmm(t.clockOut) } });
  X.closeDrawer && X.closeDrawer();
  await X.rerun(); toast(`${nameOf(t.employeeId)}, ${fdate(t.date)}: punches ${corrected ? 'corrected' : 'confirmed'} — audit updated`);
}

// Findings page: one panel listing every day to confirm
const baseFind = VIEWS.findings;
if (baseFind) VIEWS.findings = el => {
  baseFind(el); const list = flagged(); if (!list.length) return;
  const h1 = el.querySelector('h1'); if (!h1) return;
  h1.insertAdjacentHTML('afterend', `<div class="panel" id="pc-panel" style="margin:10px 0 14px;border-left:4px solid var(--warn)!important"><div class="row" style="justify-content:space-between;align-items:center"><div><b>${list.length} day${list.length === 1 ? '' : 's'} to confirm</b> <span class="small muted">— read from a scan with low confidence. Findings on these days stay “potential” until the punches are confirmed.</span></div>${list.length > 1 ? '<button class="btn" data-act="pc-confirm-all">Confirm all as read</button>' : ''}</div>
    <div class="tablewrap" style="margin-top:8px"><table><tbody>${list.slice(0, 25).map(t => `<tr><td style="white-space:nowrap"><b>${esc(nameOf(t.employeeId))}</b><div class="small muted">${fdate(t.date)}</div></td><td>${editor(t, true)}</td></tr>`).join('')}</tbody></table></div>${list.length > 25 ? `<p class="small muted">Showing 25 of ${list.length}.</p>` : ''}</div>`);
};
// finding detail: the day's editor at the top when that day was read with low confidence
const baseOpen = X.openFinding;
X.openFinding = id => {
  baseOpen(id); const f = S.result?.engine.findings.find(x => x.id === id); if (!f || !f.date) return;
  const t = flagged().find(x => x.employeeId === f.employeeId && x.date === f.date); const body = document.getElementById('drawer-body'); if (!t || !body) return;
  body.insertAdjacentHTML('afterbegin', `<div class="panel" style="margin-bottom:12px;border-left:4px solid var(--warn)!important"><b>Confirm this day’s punches</b><p class="small" style="margin:4px 0 8px">They were read from a scan with low confidence, so this finding is “potential.” Compare with the original and confirm or correct them.</p>${editor(t)}</div>`);
};
document.addEventListener('click', async e => {
  const a = e.target.closest('[data-act]'); if (!a) return;
  try {
    if (a.dataset.act === 'pc-confirm') await settle(a.dataset.k, false);
    if (a.dataset.act === 'pc-save') await settle(a.dataset.k, true);
    if (a.dataset.act === 'pc-confirm-all') { const n = flagged().length; flagged().forEach(t => { delete t.lowConfidence; }); X.log && X.log('punch.confirmed', { days: n, bulk: true }); await X.rerun(); toast(`${n} days confirmed as read — audit updated`); }
  } catch (err) { toast(err.message || 'Could not update the punches.'); }
});
X.punchesToConfirm = flagged;
})();
