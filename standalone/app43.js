/* Aldune — part 43: demo polish (owner is showing the product).
   • In the sample-data demo, the "Next step: set up your company" nudge is hidden — the demo is already set up.
   • Portfolio and Monitoring are never empty in the demo: the demo audit is saved with a prior month (so month-over-month change
     shows) plus three clearly labeled sample employers. All of it is marked demo and removed when a real audit is loaded. */
(() => {
'use strict';
const X = window.PCX; const { PC, S } = X;
const isDemo = () => !!(S.input && S.input.employerName === PC.DEMO_COMPANY);
const SAMPLES = [['Harbor Grill Restaurants (sample)', 0.42, 0.9, 61], ['Valley Ag Packers (sample)', 1.35, 1.12, 78], ['Sunrise Home Care (sample)', 0.27, 0.8, 44]];
function seed() {
  S.snapshots = (S.snapshots || []);
  if (!isDemo()) { if (S.snapshots.some(s => s.demo)) { S.snapshots = S.snapshots.filter(s => !s.demo); X.persist && X.persist(); } return; }
  if (!S.result || S.snapshots.some(s => s.demo)) return;
  let cur; try { cur = PC.snapshot('Monthly re-audit', S.input, S.result, S.patterns?.anomalies || []); } catch (e) { console.warn(e); return; }
  const now = new Date(); const d = n => new Date(now.getTime() - n * 864e5).toISOString();
  const scale = (s, f, employer, id, created, label) => ({ ...s, id, employer, label, createdAt: created, demo: true, exposureBase: Math.round(s.exposureBase * f), exposureLow: Math.round(s.exposureLow * f), exposureHigh: Math.round(s.exposureHigh * f), paga: Math.round(s.paga * f), findings: Math.round(s.findings * f), affected: Math.round(s.affected * Math.min(1.2, f)) });
  const shiftEnd = (iso, n) => new Date(Date.parse(iso + 'T12:00:00Z') - n * 864e5).toISOString().slice(0, 10);
  const LV = { 78: ['High', 'D'], 61: ['Elevated', 'C'], 44: ['Moderate', 'B'] };
  // sample employers first and the demo company last, so "latest run" and "since last month" compare the demo company with itself
  const list = SAMPLES.map(([name, f, sf, score], k) => ({ ...scale(cur, f, name, `demo-s${k}`, d(40 - k * 9), 'Quarterly audit'), score, level: LV[score][0], grade: LV[score][1], employees: Math.round(cur.employees * sf), windowEnd: shiftEnd(cur.windowEnd, 20 + k * 11) }));
  list.push({ ...scale(cur, 1.18, cur.employer, 'demo-prev', d(31), 'Monthly re-audit (prior month)'), windowEnd: shiftEnd(cur.windowEnd, 30), score: Math.min(100, cur.score + 6) });
  list.push({ ...cur, id: 'demo-cur', createdAt: d(1), demo: true });
  if (S.mon && !S.mon.demoSet) { S.mon.enabled = true; S.mon.demoSet = true; }
  S.snapshots = [...S.snapshots, ...list]; X.persist && X.persist();
}
const base = X.render;
X.render = (...a) => {
  try { seed(); } catch (e) { console.warn(e); }
  const r = base(...a);
  if (isDemo()) document.querySelectorAll('#views .alert.info').forEach(n => { if (/^\s*Next step:/.test(n.textContent || '')) n.remove(); });
  return r;
};
X.isDemo = isDemo;
X.render();
})();

/* Sample case papers for the Litigation demo (fictional: plaintiff and case are invented; the employer is the demo company) */
(() => {
'use strict';
const X = window.PCX; const { PC, S, VIEWS, toast } = X;
const SAMPLE = [{"name": "Sanchez_Complaint_(sample).txt", "text": "LAW OFFICES OF SAMPLE & PARTNERS\nAttorneys for Plaintiff MARIA SANCHEZ\n\nSUPERIOR COURT OF THE STATE OF CALIFORNIA, COUNTY OF VENTURA\n\nMARIA SANCHEZ, individually and on behalf of all others similarly situated, and as a representative of the State of California,\nPlaintiff,\nv.\nPACIFIC COAST FRESH, INC., a California corporation; and DOES 1 through 50, inclusive,\nDefendants.\n\nCase No. 26CV07731\nCLASS AND REPRESENTATIVE ACTION COMPLAINT FOR DAMAGES AND CIVIL PENALTIES\nComplaint Filed: September 8, 2026\n\n1. Plaintiff MARIA SANCHEZ, an individual, brings this action on behalf of herself and a class of current and former non-exempt employees of Defendant PACIFIC COAST FRESH, INC.\n2. The Class is defined as: All current and former hourly, non-exempt employees of Defendant in California at any time from four years before the filing of this Complaint through the date of class certification.\n3. On information and belief, the class consists of more than 55 current and former employees.\n4. Defendant required employees to work through their meal periods and failed to provide timely, uninterrupted 30-minute meal periods before the end of the fifth hour of work, and failed to pay one additional hour of pay for each workday a meal period was not provided.\n5. Defendant failed to authorize and permit rest periods of ten minutes for every four hours worked or major fraction thereof.\n6. Defendant failed to pay overtime at the regular rate of pay because it excluded nondiscretionary bonuses from the regular rate.\n7. Defendant failed to reimburse employees for the use of personal cell phones required for work, in violation of Labor Code section 2802.\n8. Defendant failed to provide accurate itemized wage statements as required by Labor Code section 226(a).\n\nFIRST CAUSE OF ACTION Failure to Provide Meal Periods (Lab. Code \u00a7\u00a7 226.7, 512) (Against All Defendants)\n9. Plaintiff incorporates the preceding paragraphs.\nSECOND CAUSE OF ACTION Failure to Authorize and Permit Rest Periods (Lab. Code \u00a7 226.7) (Against All Defendants)\n10. Plaintiff incorporates the preceding paragraphs.\nTHIRD CAUSE OF ACTION Failure to Pay Overtime Wages (Lab. Code \u00a7\u00a7 510, 1194) (Against All Defendants)\n11. Plaintiff incorporates the preceding paragraphs.\nFOURTH CAUSE OF ACTION Failure to Reimburse Business Expenses (Lab. Code \u00a7 2802) (Against All Defendants)\n12. Plaintiff incorporates the preceding paragraphs.\nFIFTH CAUSE OF ACTION Failure to Provide Accurate Wage Statements (Lab. Code \u00a7 226) (Against All Defendants)\n13. Plaintiff incorporates the preceding paragraphs.\nSIXTH CAUSE OF ACTION Violation of Business and Professions Code Section 17200 (Against All Defendants)\n14. Defendant's violations constitute unfair competition.\nSEVENTH CAUSE OF ACTION Civil Penalties Under the Private Attorneys General Act (Lab. Code \u00a7 2699) (Against All Defendants)\n15. On June 15, 2026, Plaintiff gave written notice to the Labor and Workforce Development Agency and to Defendant of the violations alleged herein.\nPRAYER FOR RELIEF: Plaintiff prays for unpaid premiums, wages, penalties, interest, and attorneys' fees.\n"}, {"name": "PAGA_Notice_Sanchez_(sample).txt", "text": "June 15, 2026\nVIA ONLINE FILING - Labor and Workforce Development Agency\nVIA CERTIFIED MAIL - Pacific Coast Fresh, Inc.\nRe: Notice of Labor Code Violations Pursuant to the Private Attorneys General Act (Labor Code section 2699.3) on behalf of Maria Sanchez\nMs. Sanchez worked as a packer. Defendant failed to provide compliant meal periods because supervisors required work through lunch on busy days, in violation of Labor Code sections 226.7 and 512. Defendant failed to authorize and permit rest periods (section 226.7). Defendant did not pay overtime at the correct regular rate because it excluded production bonuses (sections 510, 1194). Defendant failed to reimburse cell phone expenses (section 2802) and failed to provide accurate wage statements (section 226).\n"}, {"name": "LWDA_Letter_(sample).txt", "text": "Labor and Workforce Development Agency\nAugust 21, 2026\nCase No. LWDA-CM-1188421-26\nRe: PAGA notice filed June 15, 2026 \u2014 Maria Sanchez v. Pacific Coast Fresh, Inc.\nThe Labor and Workforce Development Agency does not intend to investigate the allegations in the above notice. This letter constitutes notice under Labor Code section 2699.3.\n"}, {"name": "Answer_(sample).txt", "text": "SUPERIOR COURT OF THE STATE OF CALIFORNIA, COUNTY OF VENTURA\nMARIA SANCHEZ v. PACIFIC COAST FRESH, INC. Case No. 26CV07731\nDEFENDANT'S ANSWER TO PLAINTIFF'S CLASS AND REPRESENTATIVE ACTION COMPLAINT\nDefendant Pacific Coast Fresh, Inc. answers the Complaint as follows. Under Code of Civil Procedure section 431.30(d), Defendant generally denies each and every allegation of the unverified Complaint.\nAFFIRMATIVE DEFENSES\nFIRST AFFIRMATIVE DEFENSE (Statute of Limitations) The claims are barred in part by Code of Civil Procedure sections 338 and 340.\nSECOND AFFIRMATIVE DEFENSE (Lack of Standing) Plaintiff lacks standing to pursue civil penalties for violations she did not personally suffer.\nTHIRD AFFIRMATIVE DEFENSE (Good Faith Dispute) Any failure to pay wages at separation resulted from a good faith dispute.\n"}];
const base = VIEWS.litigation;
VIEWS.litigation = el => {
  base(el);
  if ((S.lit?.docs || []).length) return;
  const drop = el.querySelector('#lit-drop'); if (!drop) return;
  drop.insertAdjacentHTML('afterend', `<div class="row" style="margin-top:8px;align-items:center;gap:8px"><button class="btn" data-act="lit-sample">Try it with sample case papers</button><span class="small muted">A fictional complaint, PAGA notice, LWDA letter, and answer${X.isDemo && X.isDemo() ? ' against the demo company' : ''}.</span></div>`);
};
document.addEventListener('click', e => {
  if (!e.target.closest('[data-act="lit-sample"]')) return;
  const L0 = (S.lit ||= { side: 'defense', docs: [], facts: null, inputs: null, gross: 0, ctx: {} });
  // dates move with today so the demo always shows live deadlines: notice 75 days ago, LWDA letter at day 60, complaint 10 days ago
  const ago = n => new Date(Date.now() - n * 864e5).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const sub = t => t.replace(/June 15, 2026/g, ago(75)).replace(/August 21, 2026/g, ago(15)).replace(/September 8, 2026/g, ago(10));
  for (const d0 of SAMPLE) { const d = { ...d0, text: sub(d0.text) }; if (!L0.docs.some(x => x.name === d.name)) L0.docs.push({ name: d.name, text: d.text, type: PC.classifyDocument(d.text), kind: PC.classifyCaseDocument(d.text), chars: d.text.length, added: new Date().toISOString().slice(0, 10) }); }
  X.litRefresh && X.litRefresh(); X.persist && X.persist(); X.render(); toast('Analyzed 4 sample case papers');
  setTimeout(() => document.getElementById('lit-analysis')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
});
X.render();
})();
