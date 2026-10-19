/* Aldune standalone — part 20: compliance scorecard, dashboard grade, plain-language vs attorney mode */
(() => {
'use strict';
const X = window.PCX; const { PC, S, esc, VIEWS } = X;
const gradeColor = g => ({ A: 'var(--ledger)', B: 'var(--ledger)', C: 'var(--marker)', D: 'var(--flag)', F: 'var(--flag)', Incomplete: 'var(--ink3)' }[g] || 'var(--line)');
VIEWS.scorecard = el => {
  if (!S.result) { el.innerHTML = X.head('Compliance scorecard', 'Run an audit to see your grade.') + '<button class="btn primary" data-act="go" data-to="import">Add files</button>'; return; }
  const s = PC.scorecard(S.input, S.result);
  el.innerHTML = X.head('Compliance scorecard', 'How compliant each area is, from your own records — a trend you can track and share with your board or insurer.') + `
    <div class="kpis" style="grid-template-columns:repeat(4,1fr)"><div class="kpi" style="border-left:6px solid ${gradeColor(s.grade)}"><div class="v">${s.grade}${s.overall !== null ? ` <span style="font-size:18px">${s.overall}/100</span>` : ''}</div><div class="k">Overall compliance grade</div></div><div class="kpi"><div class="v">${s.coverage}%</div><div class="k">Test coverage (workers × areas)</div></div><div class="kpi"><div class="v">${s.ledger.withAny} / ${s.ledger.employees}</div><div class="k">Workers with records read · ${s.ledger.shifts.toLocaleString()} shifts · ${s.ledger.payPeriods.toLocaleString()} pay periods</div></div><div class="kpi"><div class="v">${s.areas.filter(a => a.state === 'VIOLATION').length}</div><div class="k">Areas with potential issues</div></div></div>
    <div class="tablewrap" style="margin-top:12px"><table><thead><tr><th>Area</th><th>Grade</th><th>Result</th><th class="n">Coverage</th><th>What drove it</th></tr></thead><tbody>${s.areas.map(a => `<tr><td><b>${esc(a.label)}</b></td><td><span class="chip" style="background:${gradeColor(a.grade)};color:#fff;border:0">${a.grade}</span></td><td class="small">${({ VIOLATION: 'Potential issues', COMPLIANT: 'Tested — no issues', PARTIAL: 'No issues in what was tested', NOT_TESTED: 'Not tested', 'N/A': 'Does not apply' })[a.state]}</td><td class="n">${a.coverage === null ? '—' : `${a.coverage}% <span class="cite">(${a.testedWorkers}/${a.applicableWorkers})</span>`}</td><td class="small">${esc(a.explanation)}</td></tr>`).join('')}</tbody></table></div>
    <p class="cite" style="margin-top:8px">${esc(s.method)}</p>
    <div class="row"><button class="btn primary" data-act="go" data-to="readiness">Improve it: PAGA readiness</button><button class="btn" data-act="go" data-to="solutions">Solutions Center</button></div>`;
};
const baseExec = VIEWS.exec;
VIEWS.exec = el => {
  baseExec(el); if (!S.result) return; const s = PC.scorecard(S.input, S.result);
  const k = el.querySelector('.kpis'); if (!k) return;
  k.insertAdjacentHTML('afterend', `<div class="row" style="margin:8px 0 12px;align-items:center"><button class="btn" data-act="go" data-to="scorecard" style="border-left:5px solid ${gradeColor(s.grade)}">Compliance grade: <b>${s.grade}</b>${s.overall !== null ? ` (${s.overall}/100)` : ''} — see scorecard</button></div>`);
};
// plain-language vs attorney mode: citations stay one click away
document.head.insertAdjacentHTML('beforeend', '<style>body.plain .cite{display:none}body.plain .cite-keep{display:block}</style>');
S.cfg.plain = S.cfg.plain ?? false; if (S.cfg.plain) document.body.classList.add('plain');
const nav = document.getElementById('nav');
if (nav && !document.getElementById('cite-toggle')) nav.insertAdjacentHTML('beforeend', `<label id="cite-toggle" class="small" style="display:flex;gap:6px;align-items:center;margin:14px 12px 0;color:inherit;opacity:.85;cursor:pointer"><input type="checkbox" ${S.cfg.plain ? '' : 'checked'}> Show legal citations</label>`);
document.getElementById('cite-toggle')?.querySelector('input').addEventListener('change', e => { S.cfg.plain = !e.target.checked; document.body.classList.toggle('plain', S.cfg.plain); try { localStorage.setItem('paycure:plain', S.cfg.plain ? '1' : '0'); } catch { /* ignore */ } });
try { if (localStorage.getItem('paycure:plain') === '1') { S.cfg.plain = true; document.body.classList.add('plain'); const i = document.querySelector('#cite-toggle input'); if (i) i.checked = false; } } catch { /* ignore */ }
// joint-employer check on the Worker classification page
S.je = S.je || {};
const baseCls = VIEWS.classify;
VIEWS.classify = el => {
  baseCls(el); const j = PC.jointEmployer(S.je);
  const Q = [['controlsWages', 'Sets or controls their pay'], ['controlsHours', 'Sets or controls their schedules or hours'], ['controlsConditions', 'Controls working conditions (supervision, rules, discipline)'], ['knewOfWorkAndCouldPrevent', 'Knew of the work and could have prevented it'], ['commonLawEngagement', 'Hired them directly (common-law engagement)'], ['laborContractor', 'Workers come from a staffing agency or labor contractor'], ['usualCourse', 'Work is within your usual course of business'], ['atClientPremises', 'Work is performed on your premises']];
  el.insertAdjacentHTML('beforeend', `<h2>Joint employer check (staffing agencies, franchisors, PEOs)</h2><div class="grid g2"><div class="panel">${Q.map(([k, l]) => `<label class="check" style="display:flex;margin:4px 0"><input type="checkbox" data-je="${k}" ${S.je[k] ? 'checked' : ''}> ${l}</label>`).join('')}<label class="field" style="max-width:220px">Workers supplied by the contractor<input type="number" min="0" id="je-n" value="${S.je.clientWorkers || 0}"></label></div>
    <div class="panel" style="border-left:5px solid ${j.likelyJointEmployer ? 'var(--flag)' : 'var(--ledger)'}"><h3 style="margin-top:0">${j.likelyJointEmployer ? 'Likely a joint employer' : 'Joint employment not established'}</h3><ul class="small">${j.alternatives.map(a => `<li>${a.met ? '✓' : '—'} ${esc(a.test)}</li>`).join('')}</ul>${j.note2810 ? `<div class="alert medium small">${esc(j.note2810)}</div>` : ''}<p class="cite">${j.cites.map(esc).join('; ')}</p></div></div>`);
  el.querySelectorAll('[data-je]').forEach(c => c.addEventListener('change', e => { S.je[e.target.dataset.je] = e.target.checked; X.render(); }));
  el.querySelector('#je-n')?.addEventListener('change', e => { S.je.clientWorkers = Number(e.target.value) || 0; X.render(); });
};
X.render();
})();
