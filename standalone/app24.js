/* Aldune — part 24: privileged audits, monthly monitoring, law updates, M&A successor sizer, settlement strategy, methodology appendix, pricing add-ons */
(() => {
'use strict';
const X = window.PCX, H = window.PCX_HOOKS; const { PC, S, $, esc, money, toast, VIEWS } = X;
const iso = () => new Date().toISOString().slice(0, 10);
const emp = () => S.input?.employerName || S.profile?.company || '[[EMPLOYER]]';

// ======================================================= Privileged audits
S.priv = S.priv || { mode: 'operational', counsel: { name: '', firm: '', email: '', bar: '', engagedOn: '' }, controlGroup: [], directedBy: '', purpose: '' };
const privOn = () => S.priv.mode === 'privileged';
const NONPRIV = /Corrective-Action Plan|reasonable steps|Evidence binder|Handbook|Onboarding|Notices & Postings|Wage Theft Prevention|Aviso al empleado|Offer of Employment|Policy/i;
// documents meant to be served, filed, or shared with a mediator or the other side never carry an attorney-client label
const OUTWARD = /Offer to Compromise|offer to compromise|998|PAGA notice|Response to PAGA|Demand letter|Notice of Proposed Class|Settlement Agreement|settlement agreement|Term Sheet|term sheet|Memorandum of Understanding|Mediation Brief|Mediation brief|Joint Stipulation|Early Evaluation|early evaluation|Class notice/;
const isOutward = m => OUTWARD.test(m.title || '') || (m.blocks || []).some(b => b.t === 'title' && OUTWARD.test(b.text || ''));
H.decorateDocs = models => { if (!privOn()) return models; return models.map(m => { if (isOutward(m)) return m; const title = m.title || ''; const non = NONPRIV.test(title) || (m.blocks || []).some(b => b.t === 'title' && NONPRIV.test(b.text || '')); return { ...m, draftBanner: non ? `${PC.NON_PRIVILEGED_LABEL}${m.draftBanner ? ` ${m.draftBanner}` : ''}` : `${PC.privilegeLabel(S.priv)}${m.draftBanner ? ` ${m.draftBanner}` : ''}` }; }); };
H.decorateFilename = name => privOn() && !/^PRIVILEGED-|reasonable|corrective|handbook|onboarding|notices|wtpa|aviso|offer|998|ene-request|paga-notice|demand|mediation-brief|settlement-agreement|term-sheet|class-settlement|response/i.test(name) ? `PRIVILEGED-${name}` : name;
const allowed = () => !privOn() || S.isOwner || window.__PAYCURE_TEST__ || !S.account || [S.priv.counsel.email, ...S.priv.controlGroup].map(x => (x || '').toLowerCase()).includes((S.account.email || '').toLowerCase());
const SENSITIVE = new Set(['exec', 'explorer', 'detective', 'findings', 'workers', 'paga', 'scenarios', 'settlement', 'diligence', 'litigation', 'reports', 'backpay', 'scorecard', 'readiness']);
const baseRender = X.render;
X.render = () => {
  if (privOn() && SENSITIVE.has(S.view) && !allowed()) { S.view = 'privilege'; toast('This audit is privileged. Access is limited to counsel and the control group.'); }
  baseRender();
  document.getElementById('priv-bar')?.remove(); // no banner — privileged mode is shown on the Privileged audits page and in watermarked exports
};
VIEWS.privilege = el => {
  const r = PC.privilegeReadiness(S.priv); const c = S.priv.counsel;
  el.innerHTML = X.head('Privileged audits', 'Run audits at the direction of counsel with controls that support attorney-client privilege and work-product protection.') + `
    <div class="seg" style="margin-bottom:12px"><button data-act="priv-mode" data-m="privileged" aria-pressed="${privOn()}">Privileged (at counsel’s direction)</button><button data-act="priv-mode" data-m="operational" aria-pressed="${!privOn()}">Operational (business purpose)</button></div>
    <div class="grid g2"><div class="panel"><h3 style="margin-top:0">Counsel of record</h3>${[['name', 'Attorney name'], ['firm', 'Law firm'], ['email', 'Email'], ['bar', 'State Bar no.'], ['engagedOn', 'Engagement letter signed (date)']].map(([k, l]) => `<label class="field">${l}<input data-pc="${k}" ${k === 'engagedOn' ? 'type="date"' : ''} value="${esc(c[k] || '')}"></label>`).join('')}
      <label class="field">Audit requested and directed by<input data-pv="directedBy" value="${esc(S.priv.directedBy)}" placeholder="e.g., A. Lawyer, Firm LLP, by letter dated …"></label>
      <label class="field">Purpose<input data-pv="purpose" value="${esc(S.priv.purpose)}" placeholder="To obtain legal advice regarding wage-and-hour and PAGA exposure"></label>
      <label class="field">Control group (emails, comma-separated)<input id="pv-cg" value="${esc(S.priv.controlGroup.join(', '))}"></label>
      <button class="btn" data-act="priv-letter" style="margin-top:8px">Engagement letter (Word)</button></div>
    <div class="panel"><h3 style="margin-top:0">Privilege readiness: ${r.score} of ${r.of}</h3><ul class="small">${r.items.map(i => `<li>${i.ok ? '✓' : '—'} ${esc(i.label)}</li>`).join('')}</ul>
      <h3>What privileged mode does</h3><ul class="small"><li>Watermarks every report, memo, and brief “Privileged & Confidential — Attorney-Client Communication / Attorney Work Product”, and prefixes downloaded file names.</li><li>Limits findings, exposure, and litigation pages to counsel and the control group.</li><li>Keeps the “reasonable steps” record (corrective-action plan, policies, notices, handbook) <b>unprivileged and separately labeled</b>, because you may need to disclose it to claim the 15% / 30% PAGA caps.</li></ul>
      <h3>Important</h3><ul class="small">${r.cautions.map(x => `<li>${esc(x)}</li>`).join('')}</ul><p class="cite">${r.authorities.map(esc).join('; ')}</p></div></div>`;
  el.querySelectorAll('[data-pc]').forEach(i => i.addEventListener('change', e => { S.priv.counsel[e.target.dataset.pc] = e.target.value.trim(); X.persist(); X.render(); }));
  el.querySelectorAll('[data-pv]').forEach(i => i.addEventListener('change', e => { S.priv[e.target.dataset.pv] = e.target.value.trim(); X.persist(); X.render(); }));
  $('#pv-cg').addEventListener('change', e => { S.priv.controlGroup = e.target.value.split(/[,;\s]+/).map(x => x.trim().toLowerCase()).filter(x => /@/.test(x)); X.persist(); X.render(); });
};

// ======================================================= Monthly monitoring (add-on)
S.mon = S.mon || { day: 5, recipients: [], enabled: false };
const nextRun = () => { const d = new Date(); const n = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + (d.getUTCDate() >= S.mon.day ? 1 : 0), S.mon.day)); return n.toISOString().slice(0, 10); };
const baseMon = VIEWS.monitor;
VIEWS.monitor = el => {
  baseMon(el); const snaps = S.snapshots || []; const last = snaps[snaps.length - 1], prev = snaps[snaps.length - 2];
  const cure = S.readiness?.noticeDate ? PC.deadlinesFor('paga_notice', S.readiness.noticeDate, { smallEmployer: (S.input?.employees?.length || 0) < 100 }) : [];
  el.querySelector('h1')?.insertAdjacentHTML('afterend', `<div class="panel" style="margin:10px 0 16px;border-left:5px solid var(--ledger)"><div class="row" style="justify-content:space-between;align-items:center"><h3 style="margin:0">Monthly real-time monitoring <span class="chip ok">Add-on</span></h3><label class="check"><input type="checkbox" id="mon-on" ${S.mon.enabled ? 'checked' : ''}> On</label></div>
    <div class="grid g3" style="grid-template-columns:repeat(3,minmax(0,1fr));margin-top:10px"><div><div class="small muted">Next monthly re-audit</div><b>${S.mon.enabled ? nextRun() : '—'}</b><div class="small">Day <input id="mon-day" type="number" min="1" max="28" value="${S.mon.day}" style="width:54px"> of each month, after payroll finalizes</div></div>
      <div><div class="small muted">Since last month</div><b>${last && prev ? `${last.exposureBase > prev.exposureBase ? '▲' : '▼'} ${money(Math.abs(last.exposureBase - prev.exposureBase))}` : 'Needs two monthly runs'}</b><div class="small">${last ? `Last run ${esc(last.windowEnd)}` : 'No saved runs yet'}</div></div>
      <div><div class="small muted">Notify each month</div><input id="mon-to" placeholder="gc@company.com, hr@company.com" value="${esc(S.mon.recipients.join(', '))}" style="width:100%"></div></div>
    ${cure.length ? `<div class="small" style="margin-top:10px"><b>Cure-window tracking:</b> ${cure.slice(0, 3).map(d => `${esc(d.label)} — <b>${esc(d.date)}</b>`).join(' · ')}</div>` : '<div class="small muted" style="margin-top:10px">Enter a PAGA notice date on PAGA readiness to track cure and lawsuit windows here.</div>'}
    <div class="row" style="margin-top:10px"><button class="btn primary" data-act="mon-run" ${S.result ? '' : 'disabled'}>Run this month’s audit and save</button><button class="btn" data-act="go" data-to="connect">Live connections</button></div>
    <p class="cite" style="margin-top:6px">With a live payroll/timekeeping connection on Aldune Cloud, the re-audit and notifications run automatically each month. In the browser edition, Aldune reminds you and re-runs from your linked folder in one click.</p></div>`);
  $('#mon-on')?.addEventListener('change', e => { S.mon.enabled = e.target.checked; X.persist(); X.render(); });
  $('#mon-day')?.addEventListener('change', e => { S.mon.day = Math.max(1, Math.min(28, +e.target.value || 5)); X.persist(); X.render(); });
  $('#mon-to')?.addEventListener('change', e => { S.mon.recipients = e.target.value.split(/[,;\s]+/).filter(x => /@/.test(x)); X.persist(); });
};

// ======================================================= Law updates (Rule registry)
const baseRules = VIEWS.rules;
VIEWS.rules = el => {
  baseRules(el); const ap = PC.appliedPacks();
  el.insertAdjacentHTML('beforeend', `<h2>Law updates</h2><p class="small">Rates and rules are dated, so scheduled changes (like January 1 minimum wages) apply automatically on their effective dates. New laws arrive as attorney-verified <b>rule packs</b>; applying one re-runs your audit so every output reflects the change.</p>
    <div class="row"><button class="btn primary" data-act="law-check">Check for updates</button>${S.isOwner ? '<label class="btn" style="cursor:pointer">Import rule pack (JSON)<input type="file" id="law-pack" accept=".json" style="display:none"></label>' : ''}</div>
    ${ap.length ? `<table style="margin-top:8px"><tbody>${ap.map(p => `<tr><td><b>${esc(p.version)}</b><div class="small muted">${esc(p.at.slice(0, 10))}</div></td><td class="small">${p.changes.map(esc).join('<br>') || 'No changes'}</td></tr>`).join('')}</tbody></table>` : '<p class="small muted" style="margin-top:6px">No rule packs applied this session.</p>'}`);
  $('#law-pack')?.addEventListener('change', async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; try { applyAndRerun(JSON.parse(await f.text())); } catch { toast('That file is not a valid rule pack.'); } });
};
async function applyAndRerun(pack) {
  const r = PC.applyPack(pack); if (!r.ok) { toast(`Rule pack rejected: ${r.errors[0]}`); return; }
  const before = S.result ? S.result.exposure.base : null; if (S.input && X.rerun) await X.rerun();
  const after = S.result ? S.result.exposure.base : null;
  toast(`${r.changes.length} change${r.changes.length === 1 ? '' : 's'} applied${r.held.length ? `, ${r.held.length} held for attorney verification` : ''}${before !== null && after !== null ? ` — exposure ${money(before)} → ${money(after)}` : ''}.`); X.render();
}
document.addEventListener('click', async e => {
  if (!e.target.closest('[data-act="law-check"]')) return;
  if (window.claude || !/^https?:$/.test(location.protocol)) { toast('Automatic law updates run on your Aldune deployment (/api/law-feed). Here, scheduled rate changes already apply on their effective dates.'); return; }
  try { const r = await fetch('/api/law-feed'); const pack = await r.json(); if (!pack.items?.length) { toast('You’re up to date.'); return; } if (PC.appliedPacks().some(p => p.version === pack.version)) { toast(`Already on ${pack.version}.`); return; } await applyAndRerun(pack); } catch { toast('Couldn’t reach the law-update feed.'); }
});

// ======================================================= M&A successor-liability and escrow sizer
S.ma = S.ma || { dealType: 'stock', closeDate: iso(), pendingNotices: 0, probability: 0.5, continuity: {} };
const baseDil = VIEWS.diligence;
VIEWS.diligence = el => {
  baseDil(el); if (!S.result) return; const m = S.ma; const r = PC.maDiligence(S.result, m);
  el.insertAdjacentHTML('beforeend', `<h2>Successor liability and deal protections</h2><div class="grid g2"><div class="panel">
    <label class="field">Deal structure<select id="ma-type">${[['stock', 'Stock purchase'], ['merger', 'Merger'], ['asset', 'Asset purchase']].map(([k, l]) => `<option value="${k}" ${m.dealType === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <label class="field">Expected closing<input type="date" id="ma-close" value="${esc(m.closeDate)}"></label><label class="field">Pending PAGA notices or wage suits<input type="number" min="0" id="ma-pend" value="${m.pendingNotices}"></label>
    <label class="field">Probability exposure is asserted (0–1)<input type="number" step="0.05" min="0" max="1" id="ma-p" value="${m.probability}"></label>
    ${m.dealType === 'asset' ? `<div class="small" style="margin-top:6px"><b>Continuity after closing</b>${[['sameWorkforce', 'Substantially the same facilities or workforce'], ['sameManagers', 'Same owners or managers controlling labor relations'], ['sameOwnersFamily', 'Owner/officer is an immediate family member of the seller’s']].map(([k, l]) => `<label class="check" style="display:flex"><input type="checkbox" data-mac="${k}" ${m.continuity[k] ? 'checked' : ''}> ${l}</label>`).join('')}</div>` : ''}</div>
    <div class="panel"><table><tbody>${[['Wages and premiums — 3-year window', r.windows.wages3], ['Wages and premiums — 4-year UCL window', r.windows.ucl4], ['Statutory penalties (3 years)', r.windows.penalties], ['PAGA penalties (annual, unstacked)', r.pagaPenalties], ['Realistic pre-close exposure', r.realistic], ['Special indemnity', r.indemnity], ['Escrow / holdback', r.escrow]].map(([l, v]) => `<tr><td class="small">${l}</td><td class="n"><b>${money(v)}</b></td></tr>`).join('')}<tr><td class="small">Survival through</td><td class="n">${esc(r.survival || '—')}</td></tr></tbody></table>
      <p class="small" style="margin-top:8px">${esc(r.posture)}</p><button class="btn primary" data-act="ma-memo">Diligence memo (Word)</button><p class="cite">${r.authorities.map(esc).join('; ')}</p></div></div>`);
  const upd = () => { X.persist(); X.render(); };
  $('#ma-type').addEventListener('change', e => { m.dealType = e.target.value; upd(); }); $('#ma-close').addEventListener('change', e => { m.closeDate = e.target.value || iso(); upd(); });
  $('#ma-pend').addEventListener('change', e => { m.pendingNotices = Math.max(0, +e.target.value || 0); upd(); }); $('#ma-p').addEventListener('change', e => { m.probability = Math.max(0, Math.min(1, +e.target.value || 0)); upd(); });
  el.querySelectorAll('[data-mac]').forEach(c => c.addEventListener('change', e => { m.continuity[e.target.dataset.mac] = e.target.checked; upd(); }));
};

// ======================================================= Settlement strategy (pick-off / pick-up-sticks) on Litigation
S.strat = S.strat || { claims: ['class', 'paga'], arbitration: true, overlapping: false, alleged: '', suffered: '' };
const baseLit = VIEWS.litigation;
VIEWS.litigation = el => {
  baseLit(el); const st = S.strat; const side = S.lit?.side || 'defense'; const v = PC.valueClaims(S.lit?.inputs || PC.LIT_DEFAULTS);
  const pagaV = v.claims.find(c => c.claim === 'paga')?.riskAdjusted || 0; const classV = Math.max(0, v.totals.riskAdjusted - pagaV);
  const split = s => s.split(/[,;]+/).map(x => x.trim().toLowerCase()).filter(Boolean);
  const pb = PC.playbook({ mode: side, claims: st.claims, arbitration: st.arbitration, overlapping: st.overlapping, employeesUnder100: (S.lit?.inputs?.classSize || 200) < 100, complaintServed: !!S.lit?.facts?.filedDate, noticeDate: S.lit?.facts?.pagaNoticeDate || iso(), alleged: split(st.alleged), suffered: split(st.suffered), exposure: { class: classV, paga: pagaV, individual: Math.round(v.totals.realistic / Math.max(1, S.lit?.inputs?.classSize || 200)) } });
  const tactics = ['voluntary_buyout', 'involuntary_pickoff', 'unaccepted_offer', 'deposit_judgment', 'race_to_settle', 'standing_challenge', 'arbitration_first', 'ene_cure'];
  const tone = { works: 'ok', does_not_work: 'flag', open_question: 'warn', leverage_only: 'warn', not_applicable: '' }; const word = { works: 'works', does_not_work: 'does not work', open_question: 'open question', leverage_only: 'leverage only', not_applicable: '—' };
  el.insertAdjacentHTML('beforeend', `<h2>Settlement strategy: pick-off and pick-up-sticks</h2><div class="panel"><div class="row">${['class', 'paga', 'flsa'].map(c => `<label class="check"><input type="checkbox" data-sc="${c}" ${st.claims.includes(c) ? 'checked' : ''}> ${c === 'paga' ? 'PAGA' : c === 'flsa' ? 'FLSA collective' : 'Class'}</label>`).join('')}<label class="check"><input type="checkbox" id="st-arb" ${st.arbitration ? 'checked' : ''}> Arbitration agreement</label><label class="check"><input type="checkbox" id="st-ov" ${st.overlapping ? 'checked' : ''}> Overlapping PAGA action</label></div>
    <div class="grid g2" style="margin-top:6px"><label class="field">Violations alleged (comma-separated)<input id="st-al" value="${esc(st.alleged)}" placeholder="meal, rest, wage_statement"></label><label class="field">Violations the plaintiff personally suffered<input id="st-su" value="${esc(st.suffered)}" placeholder="meal"></label></div>
    <div class="tablewrap" style="margin-top:10px"><table><thead><tr><th>Tactic</th>${st.claims.map(c => `<th>${c === 'paga' ? 'PAGA' : c === 'flsa' ? 'FLSA' : 'Class'}</th>`).join('')}</tr></thead><tbody>${tactics.map(t => `<tr><td class="small"><b>${esc(PC.TACTIC_LABEL[t])}</b></td>${st.claims.map(c => { const r = PC.tacticViability(t, c); return `<td class="small" title="${esc(r.why + ' ' + r.authorities.join('; ') + (r.currency.length ? ' — ' + r.currency.join(' ') : ''))}"><span class="chip ${tone[r.viability]}">${word[r.viability]}</span></td>`; }).join('')}</tr>`).join('')}</tbody></table></div>
    <h3>${side === 'defense' ? 'Defense' : 'Plaintiff'} playbook</h3><table><tbody>${pb.steps.map((s, i) => `<tr><td>${i + 1}</td><td class="small"><b>${esc(s.step)}</b><div>${esc(s.effect)}${s.approvals ? ` <b>${esc(s.approvals)}</b>` : ''}</div><div class="cite">${s.authorities.map(esc).join('; ')}</div></td><td class="n">${money(s.residual)}</td></tr>`).join('')}</tbody></table>
    ${pb.guardrails ? `<p class="small" style="margin-top:6px"><b>Guardrails:</b> ${pb.guardrails.map(esc).join(' ')}</p>` : ''}
    <div class="row" style="margin-top:8px"><button class="btn primary" data-act="st-doc" data-k="memo">Strategy memo</button>${side === 'defense' ? '<button class="btn" data-act="st-doc" data-k="998">§ 998 offer</button><button class="btn" data-act="st-doc" data-k="ene">ENE request + cure plan</button><button class="btn" data-act="st-doc" data-k="standing">Standing challenge outline</button>' : ''}</div></div>`);
  const upd = () => { X.persist(); X.render(); };
  el.querySelectorAll('[data-sc]').forEach(c => c.addEventListener('change', e => { const k = e.target.dataset.sc; st.claims = e.target.checked ? [...new Set([...st.claims, k])] : st.claims.filter(x => x !== k); if (!st.claims.length) st.claims = ['paga']; upd(); }));
  $('#st-arb').addEventListener('change', e => { st.arbitration = e.target.checked; upd(); }); $('#st-ov').addEventListener('change', e => { st.overlapping = e.target.checked; upd(); });
  $('#st-al').addEventListener('change', e => { st.alleged = e.target.value; upd(); }); $('#st-su').addEventListener('change', e => { st.suffered = e.target.value; upd(); });
  S._pb = pb;
};

// ======================================================= Methodology appendix (Reports)
const baseReports = VIEWS.reports;
VIEWS.reports = el => { baseReports(el); if (!S.result) return; el.querySelector('h1')?.insertAdjacentHTML('afterend', '<div class="row" style="margin:8px 0 14px"><button class="btn primary" data-act="method-doc">Methodology &amp; reproducibility appendix (Word)</button><span class="small muted">Expert-ready: input fingerprint, rule versions, assumptions, exclusions.</span></div>'); };

// ======================================================= Pricing: add-ons and service tiers
const basePricing = VIEWS['p-pricing'];
VIEWS['p-pricing'] = el => {
  basePricing(el); const A = PC.ADDONS; const sec = el.querySelector('.pub-sec .pub'); if (!sec) return;
  sec.querySelector('.grid')?.insertAdjacentHTML('afterend', `<h2 style="margin-top:40px">Optional add-ons</h2><div class="grid g2">${Object.values(A).map(a => `<div class="pub-card"><span class="chip ok">Add-on</span><h3 style="margin:8px 0 0">${esc(a.name)}</h3><div style="font-family:var(--head);font-size:26px;font-weight:800;margin:6px 0">${a.oneTime ? `$${a.oneTime.toLocaleString()}<span class="small muted"> one time</span>` : `$${a.monthly}<span class="small muted">/mo</span>`}${(a.includedIn || []).filter(k => k !== 'enterprise').length ? `<span class="small muted"> · included with ${a.includedIn.filter(k => k !== 'enterprise').map(k => PC.PLANS[k]?.name || k).join(' and ')}</span>` : ''}</div><p class="small">${esc(a.blurb)}</p><ul class="small">${a.points.map(p => `<li>${esc(p)}</li>`).join('')}</ul></div>`).join('')}</div>
    <h2 style="margin-top:40px">How you want it done</h2><div class="grid g3">${PC.SERVICE_TIERS.map(t => `<div class="pub-card"><h3 style="margin:0">${esc(t.name)}</h3><div style="font-weight:700;margin:6px 0;color:var(--ledger)">${esc(t.price)}</div><ul class="small">${t.points.map(p => `<li>${esc(p)}</li>`).join('')}</ul></div>`).join('')}</div>`);
};

// ======================================================= actions
document.addEventListener('click', async e => {
  const a = e.target.closest('[data-act]'); if (!a) return; const d = a.dataset;
  try {
    if (d.act === 'priv-mode') { S.priv.mode = d.m; X.persist(); X.log && X.log('privilege.mode', { mode: d.m }); X.render(); }
    if (d.act === 'priv-letter') await X.saveDocx([PC.docs3.kovelEngagement(S.priv.counsel, emp())], `engagement-letter-${iso()}.docx`);
    if (d.act === 'mon-run') { const snap = PC.snapshot(`Monthly re-audit ${iso().slice(0, 7)}`, S.input, S.result, S.patterns?.anomalies || []); await X.saveSnapshot(snap); X.log && X.log('monitoring.monthly_run', {}); toast('This month’s audit was saved — it counts toward your reasonable-steps record.'); X.render(); }
    if (d.act === 'ma-memo') await X.saveDocx([PC.docs3.maMemo(emp(), PC.maDiligence(S.result, S.ma), S.ma.closeDate)], `ma-diligence-memo-${iso()}.docx`);
    if (d.act === 'st-doc') { const cap = S.lit?.facts?.caption || '[[CAPTION]]'; const pb = S._pb; const alleged = S.strat.alleged.split(/[,;]+/).map(x => x.trim()).filter(Boolean);
      const m = { memo: () => PC.docs3.strategyMemo(cap, S.lit?.side || 'defense', pb), 998: () => PC.docs3.offer998(cap, Math.max(5000, Math.round((pb.start || 0) * 0.01 / 1000) * 1000)), ene: () => PC.docs3.eneRequest(cap, alleged.length ? alleged : ['[[VIOLATION]]']), standing: () => PC.docs3.standingOutline(cap, PC.standingCheck(alleged, S.strat.suffered.split(/[,;]+/).map(x => x.trim()).filter(Boolean), S.lit?.facts?.pagaNoticeDate || iso())) }[d.k]();
      await X.saveDocx([m], `${{ memo: 'settlement-strategy-memo', 998: 'ccp-998-offer', ene: 'ene-request-cure-plan', standing: 'paga-standing-challenge' }[d.k]}-${iso()}.docx`); }
    if (d.act === 'method-doc') { const meta = S.result.engine.meta; const g = S.integrity;
      await X.saveDocx([PC.docs3.methodologyAppendix({ employer: emp(), ranAt: meta.ranAt, inputHash: meta.inputHash, window: `${meta.windowStart} – ${meta.windowEnd}`, software: meta.softwareVersion, rules: meta.ruleVersions, assumptions: meta.assumptions, counts: { 'Workers analyzed': S.result.engine.employees.length, 'Shifts analyzed': S.result.engine.shifts.length, 'Pay periods analyzed': S.input.payroll.length, 'Findings': S.result.engine.findings.length }, excluded: ['Low-confidence findings are excluded from exposure totals.', 'Findings marked dismissed or remediated are tracked separately.', 'Premiums already shown as paid on payroll are not counted as owed.'], integrity: g ? [`${g.removedDuplicates} exact duplicate shifts removed before analysis.`, ...g.issues.map(i => `${i.count} — ${i.message}`)] : [], sources: (S.importLog || []).map(x => String(x)) })], `methodology-appendix-${iso()}.docx`); }
  } catch (err) { toast(err.message); }
});
X.render();
})();
