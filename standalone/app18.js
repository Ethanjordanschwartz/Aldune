/* Aldune standalone — part 18: worker classification, arbitration analysis, deadline calculator, template library, attorney-attention flags */
(() => {
'use strict';
const X = window.PCX; const { PC, S, $, esc, money, toast, VIEWS } = X;
const iso = () => new Date().toISOString().slice(0, 10);
const emp = () => S.input?.employerName || S.profile?.company || '[[EMPLOYER]]';

// ======================================================= Worker classification
S.cls = S.cls || { worker: '', abc: { A: null, B: null, C: null }, exemption: '', met: [], borello: {}, knowing: {} };
const tri = (name, v) => `<select data-tri="${name}" style="min-width:110px"><option value="" ${v === null || v === undefined ? 'selected' : ''}>Unknown</option><option value="1" ${v === true ? 'selected' : ''}>Yes</option><option value="0" ${v === false ? 'selected' : ''}>No</option></select>`;
const ABC = [['A', 'Free from the hiring entity’s control and direction, in contract and in fact'], ['B', 'Performs work outside the usual course of the hiring entity’s business'], ['C', 'Customarily engaged in an independently established trade, occupation, or business of the same nature']];
VIEWS.classify = el => {
  const c = S.cls; const ex = c.exemption ? PC.EXEMPTIONS[c.exemption] : null;
  const r = PC.classifyWorker({ abc: c.abc, exemption: c.exemption || undefined, exemptionMet: c.met, borello: c.borello, knowingIndicators: c.knowing });
  el.innerHTML = X.head('Worker classification', 'Contractor or employee? Answer what you know — unknowns count against contractor status.') + `
    <div class="grid g2"><div>
      <div class="panel"><label class="field">Worker or role<input id="cl-worker" value="${esc(c.worker)}" placeholder="e.g., Delivery drivers paid on 1099"></label>
        <h3>ABC test (Lab. Code § 2775) — the hiring entity must prove all three</h3><table><tbody>${ABC.map(([k, l]) => `<tr><td><b>${k}</b> ${esc(l)}</td><td>${tri(`abc.${k}`, c.abc[k])}</td></tr>`).join('')}</tbody></table>
        <h3>AB 5 exemption (optional)</h3><select id="cl-ex"><option value="">None</option>${Object.entries(PC.EXEMPTIONS).map(([k, v]) => `<option value="${k}" ${c.exemption === k ? 'selected' : ''}>${esc(v.label)}</option>`).join('')}</select>
        ${ex ? `<div style="margin-top:8px">${ex.conditions.map((q, i) => `<label class="check" style="display:flex;margin:4px 0"><input type="checkbox" data-met="${i}" ${c.met[i] ? 'checked' : ''}> ${esc(q)}</label>`).join('')}</div>` : ''}</div>
      <div class="panel" style="margin-top:12px"><h3 style="margin-top:0">Borello factors</h3><table><tbody>${PC.BORELLO.map(f => `<tr><td class="small">${esc(f.label)}</td><td>${tri(`b.${f.key}`, c.borello[f.key])}</td></tr>`).join('')}</tbody></table>
        <h3>Knowing-conduct indicators (§ 226.8)</h3>${[['priorAdvice', 'Was advised the workers are likely employees'], ['priorFinding', 'Prior agency or court finding'], ['feesCharged', 'Charges workers fees or deductions']].map(([k, l]) => `<label class="check" style="display:flex"><input type="checkbox" data-know="${k}" ${c.knowing[k] ? 'checked' : ''}> ${l}</label>`).join('')}</div></div>
      <div><div class="panel" style="border-left:5px solid ${r.likelyEmployee ? 'var(--flag)' : 'var(--ledger)'}"><h3 style="margin-top:0">${r.likelyEmployee ? 'Likely an employee' : 'Contractor status supportable'}</h3>
        <table><tbody>${r.routing.map(x => `<tr><td class="small"><b>${esc(x.claims)}</b><div class="cite">${esc(x.cite)}</div></td><td><span class="chip">${esc(x.test)}</span></td><td class="small">${esc(x.result)}</td></tr>`).join('')}</tbody></table>
        <p class="small">${esc(r.abc.note)}</p>${r.exemption ? `<p class="small"><b>${esc(r.exemption.label)}:</b> ${r.exemption.applies ? 'all conditions met — Borello governs wage-order claims.' : `${r.exemption.missing.length} condition${r.exemption.missing.length === 1 ? '' : 's'} not established.`}</p>` : ''}
        <p class="small"><b>Borello risk:</b> ${r.borello.risk} (${r.borello.score}/100)</p>${r.penalty226_8 ? `<div class="alert high small">${esc(r.penalty226_8)}</div>` : ''}
        <p class="cite">${esc(r.note)}</p><button class="btn primary" data-act="cl-memo">Classification memo (Word)</button></div></div></div>`;
  const save = () => { X.persist && X.persist(); X.render(); };
  $('#cl-worker').addEventListener('change', e => { c.worker = e.target.value; });
  $('#cl-ex').addEventListener('change', e => { c.exemption = e.target.value; c.met = []; save(); });
  el.querySelectorAll('[data-tri]').forEach(s => s.addEventListener('change', e => { const [g, k] = e.target.dataset.tri.split('.'); const v = e.target.value === '' ? null : e.target.value === '1'; if (g === 'abc') c.abc[k] = v; else c.borello[k] = v; save(); }));
  el.querySelectorAll('[data-met]').forEach(s => s.addEventListener('change', e => { c.met[+e.target.dataset.met] = e.target.checked; save(); }));
  el.querySelectorAll('[data-know]').forEach(s => s.addEventListener('change', e => { c.knowing[e.target.dataset.know] = e.target.checked; save(); }));
};

// ======================================================= Arbitration analysis on Review documents
const baseReview = VIEWS.review;
VIEWS.review = el => {
  baseReview(el); const arbs = (S.docs || []).filter(d => d.type === 'arbitration'); if (!arbs.length) return;
  const tone = { high: 'flag', medium: 'warn', low: 'ok', info: '' };
  el.insertAdjacentHTML('beforeend', `<h2>Arbitration agreement analysis</h2>${arbs.map(d => { const a = PC.analyzeArbitration(d.text); return `<div class="panel" style="margin-bottom:12px;border-left:5px solid ${a.overall === 'likely enforceable' ? 'var(--ledger)' : a.overall === 'likely void' ? 'var(--flag)' : 'var(--marker)'}"><div class="row" style="justify-content:space-between"><b>${esc(d.name)}</b><span class="chip">${esc(a.overall)}</span></div>
    <div class="grid g2" style="margin-top:8px"><table><tbody>${Object.entries({ 'Individual claims': a.routing.individualClaims, 'Class claims': a.routing.classClaims, 'Individual PAGA': a.routing.individualPaga, 'Non-individual PAGA': a.routing.nonIndividualPaga }).map(([k, v]) => `<tr><td class="small"><b>${k}</b></td><td class="small">${esc(v)}</td></tr>`).join('')}</tbody></table><p class="small"><b>Exposure effect:</b> ${esc(a.exposureEffect)}</p></div>
    <table style="margin-top:8px"><tbody>${a.findings.map(f => `<tr><td><span class="chip ${tone[f.severity]}">${f.severity}</span></td><td><b>${esc(f.label)}</b><div class="small">${esc(f.detail)}</div><div class="cite">${esc(f.cite)}</div></td></tr>`).join('')}</tbody></table>
    <div class="row" style="margin-top:8px"><button class="btn" data-act="tpl2" data-k="arb">Compliant replacement agreement (Word)</button></div></div>`; }).join('')}`);
};

// ======================================================= Deadline calculator on the Compliance calendar
S.dl = S.dl || { ev: 'paga_notice', date: iso(), small: true, disputed: false };
const baseCal = VIEWS.calendar;
VIEWS.calendar = el => {
  baseCal(el); const d = S.dl; const list = PC.deadlinesFor(d.ev, d.date, { smallEmployer: d.small, disputed: d.disputed });
  el.querySelector('h2')?.insertAdjacentHTML('beforebegin', `<div class="panel" style="margin-top:14px"><h3 style="margin-top:0">Deadline calculator</h3><div class="row" style="align-items:flex-end">
    <label class="field">What happened?<select id="dl-ev">${Object.entries(PC.DEADLINE_EVENTS).map(([k, v]) => `<option value="${k}" ${d.ev === k ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label>
    <label class="field">Date<input type="date" id="dl-date" value="${esc(d.date)}"></label>
    ${d.ev === 'paga_notice' ? `<label class="check"><input type="checkbox" id="dl-small" ${d.small ? 'checked' : ''}> Fewer than 100 employees</label>` : ''}${d.ev === 'fair_chance' ? `<label class="check"><input type="checkbox" id="dl-disp" ${d.disputed ? 'checked' : ''}> Applicant disputes accuracy</label>` : ''}</div>
    <table style="margin-top:8px"><tbody>${list.map(x => `<tr><td style="white-space:nowrap"><b>${new Date(x.date + 'T12:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</b></td><td>${esc(x.label)}<div class="small muted">${esc(x.rule)}</div></td><td><span class="chip">${x.kind === 'deadline' ? 'deadline' : x.kind === 'waiting' ? 'waiting period' : 'look-back'}</span></td><td class="cite">${esc(x.cite)}</td></tr>`).join('')}</tbody></table>
    <button class="btn" data-act="dl-ics" style="margin-top:8px">Add these to my calendar (.ics)</button><p class="cite">Deadlines falling on a weekend or federal holiday move to the next business day (Code Civ. Proc. § 12a); waiting periods and look-back dates do not.</p></div>`);
  $('#dl-ev').addEventListener('change', e => { d.ev = e.target.value; X.render(); });
  $('#dl-date').addEventListener('change', e => { if (e.target.value) { d.date = e.target.value; X.render(); } });
  $('#dl-small')?.addEventListener('change', e => { d.small = e.target.checked; X.render(); });
  $('#dl-disp')?.addEventListener('change', e => { d.disputed = e.target.checked; X.render(); });
};

// ======================================================= Template library in Letters & packets
const TPL2 = [['arb', 'Mutual arbitration agreement (Armendariz-compliant, PAGA-severable)'], ['commission', 'Commission agreement (§ 2751)'], ['piece', 'Piece-rate compensation plan (§ 226.2)'], ['wtpa_en', 'Wage Theft Prevention Act notice — English (§ 2810.5)'], ['wtpa_es', 'Aviso al empleado — Español (§ 2810.5)'], ['notice', 'Class settlement notice (Rules of Court 3.766)']];
const baseDocs = VIEWS.documents;
VIEWS.documents = el => { baseDocs(el); el.insertAdjacentHTML('beforeend', `<h2>More templates</h2><div class="row">${TPL2.map(([k, l]) => `<button class="btn" data-act="tpl2" data-k="${k}">${esc(l)}</button>`).join('')}</div><p class="cite">Aldune asks once for the facts each template needs and fills them in; every rule cites its authority. Have counsel review before use.</p>`); };

// ======================================================= Attorney attention flags on the dashboard (never penalties)
function attention() {
  if (!S.result) return [];
  const since = S.result.engine.meta.windowEnd ? new Date(new Date(S.result.engine.meta.windowEnd).getTime() - 365 * 864e5).toISOString().slice(0, 10) : '0000';
  const owed = new Map(); for (const f of S.result.engine.findings) if (f.amount > 0 && f.confidence !== 'low' && !f.premiumIndicated && ['wages', 'premium'].includes(f.amountKind) && (f.date || f.periodEnd || '9999') >= since) owed.set(f.employeeId, (owed.get(f.employeeId) || 0) + f.amount);
  const over950 = [...owed.values()].filter(v => v > 950).length; const total = [...owed.values()].reduce((a, b) => a + b, 0); const out = [];
  if (over950 || (owed.size >= 2 && total > 2350)) out.push(['Criminal wage-theft thresholds reached', `${over950} worker${over950 === 1 ? '' : 's'} owed over $950 and ${money(total)} in total within 12 months. Penal Code § 487m applies only to intentional theft — have counsel assess intent and pay what’s owed promptly.`, 'Pen. Code § 487m; Lab. Code § 216']);
  return out;
}
const baseExec = VIEWS.exec;
VIEWS.exec = el => { baseExec(el); const a = attention(); if (!a.length) return; const host = el.querySelector('.panel'); host?.insertAdjacentHTML('beforebegin', `<div class="alert high" style="margin-bottom:12px"><b>Attorney attention</b>${a.map(([t, d, c]) => `<div class="small" style="margin-top:4px"><b>${esc(t)}.</b> ${esc(d)} <span class="cite">${esc(c)}</span></div>`).join('')}</div>`); };

// ======================================================= actions
document.addEventListener('click', async e => {
  const a = e.target.closest('[data-act]'); if (!a) return; const d = a.dataset;
  try {
    if (d.act === 'cl-memo') { const c = S.cls; await X.saveDocx([PC.docs2.classificationMemo(c.worker || 'Worker', PC.classifyWorker({ abc: c.abc, exemption: c.exemption || undefined, exemptionMet: c.met, borello: c.borello, knowingIndicators: c.knowing }))], `classification-memo-${iso()}.docx`); }
    const F2 = () => ({ address: S.party?.employerAddress, contact: S.party?.contact, provider: S.party?.arbProvider, rate: S.party?.pieceRate, commissionPlan: S.party?.commissionPlan, signerName: S.party?.signerName, signerTitle: S.party?.signerTitle });
    if (d.act === 'tpl2') { const T = PC.docs2; const m = { arb: () => T.arbitrationAgreement(emp(), F2()), commission: () => T.commissionAgreement(emp(), F2()), piece: () => T.pieceRatePlan(emp(), F2()), wtpa_en: () => T.wtpaNotice(emp(), 'en', F2()), wtpa_es: () => T.wtpaNotice(emp(), 'es', F2()), notice: () => T.classNotice([S.lit?.facts?.caption, S.lit?.facts?.caseNumber && `Case No. ${S.lit.facts.caseNumber}`, S.lit?.facts?.court].filter(Boolean).join(' · '), { classDefinition: S.lit?.facts?.classDefinition, employer: emp(), claims: S.lit?.facts?.claims, classStart: S.lit?.ctx?.classStart, classEnd: S.lit?.ctx?.classEnd }) }[d.k](); await X.saveDocx([m], `${{ arb: 'arbitration-agreement', commission: 'commission-agreement', piece: 'piece-rate-plan', wtpa_en: 'wtpa-notice-en', wtpa_es: 'aviso-empleado-es', notice: 'class-settlement-notice' }[d.k]}-${iso()}.docx`); }
    if (d.act === 'dl-ics') { const list = PC.deadlinesFor(S.dl.ev, S.dl.date, { smallEmployer: S.dl.small, disputed: S.dl.disputed }); const st = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z'; const q = t => t.replace(/[,;\\]/g, m => '\\' + m);
      await X.save(`deadlines-${S.dl.ev}-${iso()}.ics`, new Blob([`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Aldune//Deadlines//EN\r\n${list.map((x, i) => `BEGIN:VEVENT\r\nUID:aldune-dl-${S.dl.ev}-${x.date}-${i}@aldune\r\nDTSTAMP:${st}\r\nDTSTART;VALUE=DATE:${x.date.replace(/-/g, '')}\r\nSUMMARY:${q(x.label)}\r\nDESCRIPTION:${q(`${x.rule} — ${x.cite}`)}\r\nEND:VEVENT`).join('\r\n')}\r\nEND:VCALENDAR\r\n`], { type: 'text/calendar' })); }
  } catch (err) { toast(err.message); }
});
X.render();
})();
