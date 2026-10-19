/* Aldune — part 38: case documents must change something.
   On the Litigation page, show exactly what the uploaded case papers did (claims, class period, PAGA notice date and penalty
   rules, settled workers, drafts' caption) and compare what is ALLEGED with what the RECORDS show — supported, unsupported,
   and found-but-not-alleged — for either side. A PAGA notice date read from the papers also sets the PAGA rules for the audit. */
(() => {
'use strict';
const X = window.PCX; const { PC, S, esc, money, VIEWS } = X;
const CLAIM_CATS = { meal: ['meal'], rest: ['rest'], unpaid_wages: ['timekeeping', 'reconciliation', 'min_wage'], overtime: ['overtime', 'regular_rate', 'reconciliation'], wage_statement: ['wage_statement'], waiting_time: ['final_pay'], expenses: ['expenses'] };
const CLAIM_LABEL = { meal: 'Meal periods', rest: 'Rest periods', unpaid_wages: 'Off-the-clock / unpaid time', overtime: 'Overtime', wage_statement: 'Wage statements', waiting_time: 'Waiting time', expenses: 'Expenses', paga: 'PAGA' };
const CAT_TO_CLAIM = {}; for (const [k, cats] of Object.entries(CLAIM_CATS)) for (const c of cats) CAT_TO_CLAIM[c] ||= k;

function effects() {
  const L = S.lit || {}; const f = L.facts; if (!f || !(L.docs || []).length) return [];
  const out = [];
  if (f.claims?.length) out.push(`Claims alleged set the damages model: ${f.claims.map(c => CLAIM_LABEL[c] || c).join(', ')}.`);
  if (f.claims?.includes('ucl')) out.push('A UCL claim extends the class period to 4 years (Bus. & Prof. Code § 17208).');
  if (f.pagaNoticeDate) out.push(`PAGA notice dated ${f.pagaNoticeDate}: sets the PAGA rules (${PC.pagaRegimeFor(f.pagaNoticeDate) === 'post2024' ? '2024 reform — 15%/30% caps available' : 'pre-reform rules'}) and the one-year penalty lookback.`);
  if (f.settledCount && f.settledEligible) out.push(`${f.settledCount} of ${f.settledEligible} workers signed individual settlements${f.settledPaid ? ` (${money(f.settledPaid)} paid)` : ''} — their share is removed from class value and credited in negotiation.`);
  if (f.caption) out.push(`Caption, court, and case number fill the mediation brief, demand, term sheet, and notices.`);
  const reviewed = (L.docs || []).filter(d => /settlement agreement|release of claims/i.test(d.text)).length; if (reviewed) out.push(`${reviewed} settlement agreement${reviewed === 1 ? '' : 's'} checked for Lab. Code § 206.5, Gov. Code § 12964.5, and the PAGA carve-out (see below).`);
  const arb = (L.docs || []).filter(d => d.type === 'arbitration').length; if (arb) out.push(`${arb} arbitration agreement${arb === 1 ? '' : 's'} found — set the arbitration share in the model to the share of workers who signed.`);
  return out;
}
function crossCheck() {
  const f = S.lit?.facts; if (!f || !S.result) return null;
  const F = S.result.engine.findings.filter(x => x.state === 'VIOLATION' || (!x.state && x.confidence !== 'low'));
  const byClaim = {}; for (const x of F) { const k = CAT_TO_CLAIM[x.category]; if (!k) continue; const g = byClaim[k] ||= { n: 0, amt: 0, w: new Set() }; g.n++; g.amt += x.amount; g.w.add(x.employeeId); }
  const alleged = (f.claims || []).filter(c => CLAIM_CATS[c]);
  const supported = alleged.filter(c => byClaim[c]); const unsupported = alleged.filter(c => !byClaim[c]); const notAlleged = Object.keys(byClaim).filter(c => !alleged.includes(c));
  return { byClaim, supported, unsupported, notAlleged };
}

const base = VIEWS.litigation;
VIEWS.litigation = el => {
  // a PAGA notice date read from the case papers drives the audit's PAGA rules unless the company profile already has one
  const f = S.lit?.facts; if (f?.pagaNoticeDate && S.profile && !S.profile.noticeDate) { S.profile.noticeDate = f.pagaNoticeDate; S.profile.noticeFromCase = true; X.persist && X.persist(); }
  base(el);
  const host = el.querySelector('.grid.g2'); if (!host) return;
  const D = (S.lit?.side || 'defense') === 'defense';
  const ef = effects(); const cc = crossCheck();
  const why = `<div class="panel" style="margin-bottom:14px"><h3 style="margin-top:0">What your case documents do here</h3>${ef.length ? `<ul class="small" style="margin:6px 0 0">${ef.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : `<p class="small" style="margin:0">Upload the complaint, PAGA notice, or settlement papers and Aldune will: read the claims, dates, and parties; set the damages model and PAGA rules from them; compare every allegation with what your records actually show${S.result ? '' : ' (once an audit is loaded)'}; check any settlement agreement for required terms; and fill the caption into the mediation brief, demand, and term sheet. Nothing is uploaded anywhere — documents are read in your browser.</p>`}</div>`;
  const tbl = cc ? `<div class="panel" style="margin-bottom:14px"><h3 style="margin-top:0">Allegations vs. your records</h3>
    <div class="tablewrap"><table><thead><tr><th>Claim</th><th>Alleged</th><th>Records show</th><th>${D ? 'For the defense' : 'For employees'}</th></tr></thead><tbody>
    ${[...new Set([...cc.supported, ...cc.unsupported, ...cc.notAlleged])].map(c => { const g = cc.byClaim[c]; const al = cc.supported.includes(c) || cc.unsupported.includes(c);
      const note = !g ? (D ? 'Records reviewed show no violation — a basis to contest or narrow this claim (confirm coverage first).' : 'Not supported by the records reviewed — get the missing records in discovery or narrow the claim.') : !al ? (D ? 'Found in the records but not alleged — fix it now; it may be added by amendment or a new PAGA notice.' : 'Found in the records but not alleged — consider amending or a supplemental PAGA notice (within the limitations period).') : (D ? 'Supported by your own records — prioritize cure and settlement value here.' : 'Supported by the employer’s records — lead with this claim.');
      return `<tr><td><b>${esc(CLAIM_LABEL[c] || c)}</b></td><td>${al ? 'Yes' : '<span class="muted">No</span>'}</td><td class="small">${g ? `${g.n.toLocaleString()} findings · ${g.w.size} workers · ${money(Math.round(g.amt))}` : '<span class="muted">No violation found</span>'}</td><td class="small">${note}</td></tr>`; }).join('')}
    </tbody></table></div><p class="cite" style="margin:6px 0 0">Counts use provable findings only (potential issues and cleared items excluded). Areas the audit couldn’t test are not evidence either way — see the Compliance scorecard.</p></div>` : '';
  host.insertAdjacentHTML('beforebegin', why + tbl);
};
X.litCrossCheck = crossCheck;
})();

/* Exculpatory documents uploaded under "Policies and notices" are applied before each run */
(() => {
'use strict';
const X = window.PCX; const { PC, S, esc, VIEWS } = X; const H = window.PCX_HOOKS;
const baseBefore = H.beforeRun;
H.beforeRun = async (input, source) => {
  if (baseBefore && !(await baseBefore(input, source))) return false;
  try { const docs = (S.docs || []).filter(d => d.text); S.excul = docs.length ? PC.applyExculpatory(input, docs.map(d => ({ name: d.name, text: d.text }))) : null; } catch (e) { console.warn(e); S.excul = null; }
  return true;
};
const KIND = { meal1: 'first-meal waiver', meal2: 'second-meal waiver', onduty: 'on-duty meal agreement', aws: 'alternative workweek election' };
const baseImport = VIEWS.import;
VIEWS.import = el => {
  baseImport(el);
  const x = S.excul; if (!x || (!x.applied.length && !x.notApplied.length)) return;
  const host = el.querySelector('.al-loaded') || el.querySelector('h1'); if (!host) return;
  const by = {}; for (const a of x.applied) (by[`${a.doc}|${a.kind}`] ||= []).push(a.name);
  host.insertAdjacentHTML('afterend', `<div class="panel" style="margin:10px 0;border-left:3px solid var(--ok)!important"><b>Documents applied to the audit</b>
    <ul class="small" style="margin:6px 0 0">${Object.entries(by).map(([k, names]) => { const [doc, kind] = k.split('|'); return `<li>“${esc(doc)}” — ${KIND[kind]} for ${esc(names.slice(0, 6).join(', '))}${names.length > 6 ? ` and ${names.length - 6} more` : ''}. Matching findings are shown as cleared.</li>`; }).join('')}
    ${x.notApplied.map(n => `<li class="muted">“${esc(n.doc)}” (${KIND[n.kind]}) not applied: ${esc(n.why)}.</li>`).join('')}</ul></div>`);
};
})();
