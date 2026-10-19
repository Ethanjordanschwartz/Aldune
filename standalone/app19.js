/* Aldune standalone — part 19: data-integrity gate before every analysis; day-of-rest (Mendoza) attention flag */
(() => {
'use strict';
const X = window.PCX, H = window.PCX_HOOKS; const { PC, S, esc, toast, VIEWS } = X;
const prev = H.beforeRun;
H.beforeRun = async (input, source) => {
  try {
    const r = PC.checkIntegrity(input); input.timeRecords = r.input.timeRecords; S.integrity = { issues: r.issues, removedDuplicates: r.removedDuplicates, at: new Date().toISOString() };
    if (r.removedDuplicates) toast(`Removed ${r.removedDuplicates.toLocaleString()} duplicate shift${r.removedDuplicates === 1 ? '' : 's'} so they aren’t counted twice.`);
  } catch (e) { console.warn('integrity check failed', e); }
  return prev ? prev(input, source) : true;
};
const tone = { high: 'flag', medium: 'warn', low: '' };
const baseQ = VIEWS.quality;
VIEWS.quality = el => {
  baseQ(el); const g = S.integrity; if (!g) return;
  el.insertAdjacentHTML('afterbegin', `<div class="panel" style="margin-bottom:14px;border-left:5px solid ${g.issues.some(i => i.severity === 'high') ? 'var(--flag)' : g.issues.length ? 'var(--marker)' : 'var(--ledger)'}"><h3 style="margin-top:0">Data integrity</h3>
    ${g.issues.length ? `<table><tbody>${g.issues.map(i => `<tr><td><span class="chip ${tone[i.severity]}">${i.count.toLocaleString()}</span></td><td><b>${esc(i.message)}</b><div class="small">${esc(i.fix)}</div><div class="small muted">e.g., ${i.examples.map(esc).join(' · ')}</div></td></tr>`).join('')}</tbody></table>` : '<p class="small">No duplicates, overlaps, impossible shifts, or date problems found.</p>'}</div>`);
};
function dayOfRest() {
  if (!S.result) return null; const wk = new Map();
  for (const s of S.result.engine.shifts) { const k = `${s.employeeId}|${s.weekStart}`; if (!wk.has(k)) wk.set(k, { dates: new Set(), long: false }); const w = wk.get(k); w.dates.add(s.date); if ((s.workedMin || 0) > 360) w.long = true; }
  const weeks = [...wk.values()].filter(w => w.dates.size >= 7 && w.long).length; return weeks ? weeks : null;
}
const baseExec = VIEWS.exec;
VIEWS.exec = el => {
  baseExec(el); const n = dayOfRest(); if (!n) return;
  const item = `<div class="small" style="margin-top:4px"><b>Day of rest.</b> ${n} workweek${n === 1 ? '' : 's'} with seven workdays and at least one shift over 6 hours. Employers may not cause employees to work more than six days in seven unless the employee independently chooses to, fully informed and without encouragement (Mendoza v. Nordstrom (2017) 2 Cal.5th 1074). Document that choice or schedule a rest day. <span class="cite">Lab. Code §§ 551, 552, 556</span></div>`;
  const box = [...el.querySelectorAll('.alert.high')].find(a => /Attorney attention/.test(a.textContent));
  if (box) box.insertAdjacentHTML('beforeend', item); else el.querySelector('.panel')?.insertAdjacentHTML('beforebegin', `<div class="alert high" style="margin-bottom:12px"><b>Attorney attention</b>${item}</div>`);
};
})();
