// Settlement-strategy, privilege, methodology, and M&A documents. Facts in [[PLACEHOLDERS]]; authority on each proposition.
import type { DocModel } from './render';
import type { playbook, standingCheck } from '../litigation/tactics';
import type { maDiligence } from '../ma/successor';
const B = 'DRAFT — prepared with Aldune. Attorney review required before use.'; const P = (x: string) => `______________________ (${x.toLowerCase()})`;
const cityOf = (addr?: string) => addr?.match(/,\s*([A-Za-z .'-]+),?\s+(?:CA|California)\b/)?.[1]?.trim();
const $ = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
export function offer998(caption: string, amount: number): DocModel {
  return { title: 'Offer to compromise (CCP § 998)', draftBanner: B, blocks: [{ t: 'title', text: 'Offer to Compromise Under Code of Civil Procedure Section 998' }, { t: 'p', runs: [caption] },
    { t: 'p', align: 'justify', runs: [`To Plaintiff and Plaintiff’s counsel: Defendant offers to allow judgment to be taken against it on Plaintiff’s individual claims in the amount of ${$(amount)}, plus costs incurred to the date of this offer and reasonable attorney’s fees as determined by the court, if any are recoverable. This offer does not include, and does not resolve, any representative claim under the Private Attorneys General Act.`] },
    { t: 'p', align: 'justify', runs: ['To accept, sign the statement below. This offer is deemed withdrawn if not accepted before trial or within 30 days after it is made, whichever occurs first. If not accepted and Plaintiff fails to obtain a more favorable judgment, Plaintiff may not recover post-offer costs and shall pay Defendant’s costs from the time of the offer, and the court may require Plaintiff to pay a reasonable sum for Defendant’s expert witness costs.'] },
    { t: 'p', runs: [{ text: 'Code Civ. Proc. § 998. A settled individual claim does not end PAGA standing (Kim v. Reins International California, Inc. (2020) 9 Cal.5th 73).', italic: true }] },
    { t: 'signature', lines: [{ label: 'Counsel for Defendant' }, { label: 'Plaintiff accepts the offer' }] }] };
}
export function eneRequest(caption: string, items: string[]): DocModel {
  return { title: 'Request for early evaluation conference and stay', draftBanner: B, blocks: [{ t: 'title', text: 'Request for Early Evaluation Conference and Stay; Confidential Cure Plan' }, { t: 'p', runs: [caption] },
    { t: 'p', align: 'justify', runs: ['Defendant requests an early evaluation conference and a stay of proceedings under Labor Code section 2699.3. Absent good cause, the court shall stay the action and set the conference within 70 days; Defendant will submit a confidential statement and, as to violations it intends to cure, a confidential cure plan within 21 days.'] },
    { t: 'heading', text: 'Confidential cure plan (lodged with the neutral)' }, { t: 'table', head: ['Alleged violation', 'Cure (abate · comply · make whole)', 'Completion date'], rows: items.map(v => [v, 'Corrected practice; current compliance shown by records; unpaid wages for three years plus 7% interest, any liquidated damages, and reasonable lodestar fees', P('DATE')]) },
    { t: 'p', runs: [{ text: 'Lab. Code §§ 2699(g)–(h), 2699.3. Verify current § 2699.3 text before filing.', italic: true }] }] };
}
export function standingOutline(caption: string, sc: ReturnType<typeof standingCheck>): DocModel {
  return { title: 'PAGA standing challenge (outline)', draftBanner: B, blocks: [{ t: 'title', text: 'Outline: Challenge to PAGA Standing for Violations Not Personally Suffered' }, { t: 'p', runs: [caption] },
    { t: 'p', align: 'justify', runs: [`Applicable test: ${sc.test}. ${sc.note}`] },
    { t: 'bullets', items: [['Vehicle: demurrer or motion for summary adjudication directed at the unsuffered violations.'], ['Evidence: Plaintiff’s time and pay records show no instance of the challenged violations during the limitations period.'], ['Relief: strike or adjudicate the representative claim as to those violations; it does not end the claim for violations Plaintiff suffered.']] },
    { t: 'p', runs: [{ text: `${sc.authority}; verify the operative effective date of the “each violation” text.`, italic: true }] }] };
}
export function strategyMemo(caption: string, mode: string, pb: ReturnType<typeof playbook>): DocModel {
  return { title: 'Settlement strategy memo', draftBanner: `${B} Privileged and confidential if prepared at counsel’s direction.`, blocks: [{ t: 'title', text: `Settlement Strategy — ${mode === 'defense' ? 'Defense' : 'Plaintiff'} (${caption})` },
    { t: 'table', head: ['#', 'Move', 'Effect', 'Residual exposure', 'Authority'], rows: pb.steps.map((s: { step: string; effect: string; residual: number; authorities: string[]; approvals?: string }, i: number) => [String(i + 1), s.step + (s.approvals ? ` (${s.approvals})` : ''), s.effect, $(s.residual), s.authorities.join('; ')]) },
    { t: 'p', runs: [`Starting exposure ${$(pb.start)}; after the sequence ${$(pb.end)}.`] }, ...(pb.guardrails ? [{ t: 'heading' as const, text: 'Guardrails' }, { t: 'bullets' as const, items: pb.guardrails.map(g => [g]) }] : [])] };
}
export function kovelEngagement(counsel: { name: string; firm: string }, client: string): DocModel {
  return { title: 'Engagement of consultant by counsel', draftBanner: B, blocks: [{ t: 'title', text: 'Consultant Engagement Agreement (Counsel – Client – Aldune)' },
    { t: 'p', align: 'justify', runs: [`${counsel.firm || P('LAW FIRM')} (“Counsel”), counsel to ${client || P('CLIENT')} (“Client”), retains Aldune (“Consultant”) to assist Counsel in rendering legal advice to Client regarding California wage-and-hour and PAGA compliance and anticipated litigation.`] },
    { t: 'bullets', items: [['Consultant works at Counsel’s direction; its analyses are prepared for Counsel to enable Counsel’s legal advice.'], ['Deliverables go to Counsel (and the designated control group) and are labeled privileged and confidential attorney work product.'], ['Consultant will keep Client information confidential, restrict access to the designated control group, and not disclose it without Counsel’s written consent or legal compulsion (with prompt notice to Counsel).'], ['Client pays Consultant’s fees; the engagement and direction remain with Counsel.'], ['Facts and underlying business records are not privileged; compliance records Client may later disclose to support a defense are maintained separately and are not covered by this engagement.']] },
    { t: 'p', runs: [{ text: 'Evid. Code §§ 952, 954; Code Civ. Proc. § 2018.030; cf. United States v. Kovel (2d Cir. 1961) 296 F.2d 918. Privilege protection is not guaranteed — counsel must confirm the structure.', italic: true }] },
    { t: 'signature', lines: [{ label: `Counsel — ${counsel.name || P('ATTORNEY')}` }, { label: `Client — ${client || P('CLIENT')}` }, { label: 'Aldune' }] }] };
}
export function methodologyAppendix(m: { employer: string; ranAt: string; inputHash: string; window: string; software: string; rules: Record<string, string>; assumptions: Record<string, unknown>; counts: Record<string, number>; excluded: string[]; integrity: string[]; sources: string[] }): DocModel {
  return { title: 'Methodology and reproducibility appendix', draftBanner: B, blocks: [{ t: 'title', text: `Methodology and Reproducibility — ${m.employer}` },
    { t: 'p', align: 'justify', runs: ['This appendix documents the data, rules, assumptions, and computations used so that a qualified analyst can reproduce every figure. All records provided were analyzed (no sampling or extrapolation); calculations are deterministic — the same inputs and rule versions produce identical results.'] },
    { t: 'table', head: ['Item', 'Value'], rows: [['Analysis run', m.ranAt], ['Input fingerprint (hash of normalized records)', m.inputHash], ['Audit window', m.window], ['Software version', m.software], ...Object.entries(m.counts).map(([k, v]) => [k, v.toLocaleString()])] },
    { t: 'heading', text: 'Rule versions' }, { t: 'table', head: ['Rule', 'Version'], rows: Object.entries(m.rules) },
    { t: 'heading', text: 'Assumptions' }, { t: 'table', head: ['Assumption', 'Value'], rows: Object.entries(m.assumptions).map(([k, v]) => [k, String(v)]) },
    { t: 'heading', text: 'Data sources' }, { t: 'bullets', items: (m.sources.length ? m.sources : ['[[List source files and exports]]']).map(s => [s]) },
    { t: 'heading', text: 'Exclusions and data integrity' }, { t: 'bullets', items: [...m.excluded, ...m.integrity].map(s => [s]) },
    { t: 'p', runs: [{ text: 'Sampling, if later used, must follow Duran v. U.S. Bank National Assn. (2014) 59 Cal.4th 1 (expert-designed, testable, preserving affirmative defenses).', italic: true }] }] };
}
export function maMemo(target: string, r: ReturnType<typeof maDiligence>, closeDate: string): DocModel {
  return { title: 'Wage-and-hour diligence memo', draftBanner: `${B} Privileged and confidential if prepared at counsel’s direction.`, blocks: [{ t: 'title', text: `Wage-and-Hour and PAGA Diligence — ${target}` }, { t: 'p', runs: [`Assumed closing: ${closeDate}.`] },
    { t: 'table', head: ['Measure', 'Amount'], rows: [['Wages and premiums, 3-year window', $(r.windows.wages3)], ['Wages and premiums, 4-year UCL window', $(r.windows.ucl4)], ['Statutory penalties (3 years)', $(r.windows.penalties)], ['PAGA penalties (annual, unstacked)', $(r.pagaPenalties)], ['Realistic pre-close exposure', $(r.realistic)], ['Recommended special indemnity', $(r.indemnity)], ['Recommended escrow / holdback', $(r.escrow)], ['Survival through', r.survival || '—']] },
    { t: 'p', align: 'justify', runs: [r.posture] }, { t: 'heading', text: 'Recommended deal protections' }, { t: 'bullets', items: r.recommendations.map(x => [x]) },
    { t: 'p', runs: [{ text: r.authorities.join('; '), italic: true }] }] };
}

/** Full PAGA cure proposal built from the audit (small-employer confidential cure, or the cure plan for an ENE). */
export function cureProposalFull(a: { signerName?: string; signerTitle?: string; employerAddress?: string; employer: string; noticeDate: string; noticeRef?: string; small: boolean; counsel?: string; plan: { rows: { employeeId: string; name: string; wages: number; premiums: number; reimbursement: number; liquidated: number; interest: number; total: number; terminated: boolean }[]; totals: { wages: number; premiums: number; reimbursement: number; liquidated: number; interest: number; total: number; employees: number } }; cats: { label: string; category: string; base: number; findings: number; employees: number }[]; fixes: { label: string; fix: string; cite: string }[]; payBy?: string }): DocModel {
  const t = a.plan.totals; const payBy = a.payBy || P('PAYMENT DATE');
  const lookback = (() => { const d = new Date(a.noticeDate + 'T12:00:00Z'); if (isNaN(d.getTime())) return P('THREE YEARS BEFORE NOTICE'); d.setUTCFullYear(d.getUTCFullYear() - 3); return d.toISOString().slice(0, 10); })();
  const cats = a.cats.filter(c => c.base > 0);
  return { title: 'PAGA cure proposal', draftBanner: `${B} Confidential — submitted under Labor Code section 2699.3.`, blocks: [
    { t: 'title', text: a.small ? 'Confidential Proposal to Cure — Labor Code Section 2699.3' : 'Confidential Cure Plan — Early Evaluation Conference (Labor Code Section 2699.3)' },
    { t: 'p', runs: [`${a.employer} · PAGA notice dated ${a.noticeDate || P('NOTICE DATE')}${a.noticeRef ? ` · LWDA No. ${a.noticeRef}` : ''}`] },
    { t: 'p', runs: ['To: Labor and Workforce Development Agency (via the PAGA Filing Portal) and counsel for the aggrieved employee'] },
    { t: 'p', align: 'justify', runs: [`${a.employer}${a.counsel ? `, through counsel ${a.counsel},` : ''} ${a.small ? 'employed fewer than 100 employees during the period covered by the notice and submits this confidential proposal to cure within 33 days of the notice' : 'submits this confidential cure plan in connection with its request for an early evaluation conference'}. ${a.employer} disputes liability and does not admit any violation; it proposes the following cure to abate each alleged violation, bring its practices into compliance, and make each aggrieved employee whole.`] },
    { t: 'heading', text: '1. Summary of the cure' },
    { t: 'table', head: ['Measure', 'Amount'], rows: [['Employees to be paid', t.employees.toLocaleString()], ['Unpaid wages', $(t.wages)], ['Meal, rest, and split-shift premiums', $(t.premiums)], ['Unreimbursed business expenses', $(t.reimbursement)], ['Liquidated damages (minimum wage)', $(t.liquidated)], ['Interest at 7% per year', $(t.interest)], ['Total to employees', $(t.total)], ['Reasonable lodestar attorney’s fees of the aggrieved employee', 'As documented by the aggrieved employee’s counsel (lodestar)'], ['Payment date', payBy]] },
    { t: 'heading', text: '2. Cure by alleged violation' },
    { t: 'table', head: ['Alleged violation', 'Employees', 'Amount owed (before interest)', 'How it is cured'], rows: cats.map(c => [c.label, c.employees.toLocaleString(), $(c.base), c.category === 'wage_statement' ? 'Corrected wage statements issued for affected periods; template fixed' : c.category === 'final_pay' ? 'Not curable before suit under § 2699.5 — disputed; final-pay practices corrected' : 'Payment as scheduled in Exhibit A; practice corrected as described in Section 4']) },
    { t: 'heading', text: '3. How each employee is made whole' },
    { t: 'bullets', items: [[`Look-back: all unpaid wages and premiums for the three years before the notice (from ${lookback}).`], ['Interest: 7% simple interest per year from each amount’s original due date through the payment date.'], ['Liquidated damages: included for minimum-wage underpayments (Lab. Code § 1194.2).'], ['Attorney’s fees: reasonable lodestar fees of the aggrieved employee’s counsel.'], ['Tax treatment: wages and premiums paid through payroll on Form W-2 with withholding; interest and reimbursements reported separately; no release is required to receive undisputed wages (Lab. Code § 206.5).'], ['Former employees: paid by check to the last known address, with a skip-trace for returned mail; unclaimed amounts handled under the Unclaimed Property Law.']] },
    { t: 'heading', text: '4. Corrective actions (abate and comply)' },
    { t: 'table', head: ['Change', 'Authority', 'Effective'], rows: (a.fixes.length ? a.fixes : [{ label: 'Practice correction', fix: 'Policies, timekeeping, and payroll settings conformed to the Labor Code for every alleged violation', cite: 'Lab. Code § 2699.3' }]).map(f => [`${f.label}: ${f.fix}`, f.cite, `Before ${payBy}`]) },
    { t: 'heading', text: '5. Notice to employees' },
    { t: 'p', align: 'justify', runs: ['Each employee receives a written notice (English and Spanish) explaining the amount, how it was calculated, the pay periods covered, and that payment does not require signing any release. Exhibit A lists each payment.'] },
    { t: 'heading', text: '6. Representations' },
    { t: 'bullets', items: [[`${a.employer} has not cured the same violation within the prior 12 months.`], ['Proof of payment (payroll register, cleared checks or deposit confirmations) and of the corrected practices will be provided as the Agency directs.'], ['This proposal is confidential and is submitted for settlement and cure purposes only.']] },
    { t: 'heading', text: 'Verification' },
    { t: 'p', align: 'justify', runs: [`I, ${a.signerName || P('name')}, am the ${a.signerTitle || P('title')} of ${a.employer}. I have read this proposal and the facts stated are true of my own knowledge. I declare under penalty of perjury under the laws of the State of California that the foregoing is true and correct. Executed on ____________________ at ${cityOf(a.employerAddress) || P('city')}, California.`] },
    { t: 'signature', lines: [{ label: `${a.signerName || 'Authorized officer'}${a.signerTitle ? `, ${a.signerTitle}` : ''}, ${a.employer}` }, { label: 'Counsel' }] },
    { t: 'pagebreak' },
    { t: 'heading', text: 'Exhibit A — Payment schedule' },
    { t: 'table', head: ['Employee', 'ID', 'Status', 'Wages', 'Premiums', 'Reimb.', 'Liquidated', 'Interest (7%)', 'Total'], rows: a.plan.rows.filter(r => r.total > 0).map(r => [r.name, r.employeeId, r.terminated ? 'Former' : 'Current', $(r.wages), $(r.premiums), $(r.reimbursement), $(r.liquidated), $(r.interest), $(r.total)]) },
    { t: 'heading', text: 'Exhibit index' },
    { t: 'bullets', items: [['Exhibit A — Payment schedule (above)'], ['Exhibit B — Revised policies (meal and rest periods, timekeeping, expense reimbursement)'], ['Exhibit C — Payroll and timekeeping configuration changes'], ['Exhibit D — Supervisor training records'], ['Exhibit E — Corrected wage statements (if applicable)']] },
    { t: 'p', runs: [{ text: 'Lab. Code §§ 206.5, 1194.2, 2699(g)–(h), 2699.3, 2699.5; Code Civ. Proc. § 2015.5. Verify current § 2699.3 text before submission.', italic: true }] }] };
}

/** Employee records request (plaintiff side): wage statements and time/payroll records, personnel file, signed instruments. */
export function recordsRequest(a: { employee: string; employer: string; counsel?: string }): DocModel {
  return { title: 'Records request', draftBanner: B, blocks: [{ t: 'title', text: 'Request for Employment Records' }, { t: 'p', runs: [`To: ${a.employer}`] }, { t: 'p', runs: [`Re: ${a.employee}${a.counsel ? ` — through counsel, ${a.counsel}` : ''}`] },
    { t: 'p', align: 'justify', runs: [`${a.counsel ? 'On behalf of our client, we' : 'I'} request copies of the following records within the time the law requires:`] },
    { t: 'table', head: ['Records', 'Deadline', 'Penalty for failure', 'Authority'], rows: [['Itemized wage statements and the payroll records used to prepare them', '21 calendar days', '$750', 'Lab. Code § 226(b)–(c), (f)'], ['Personnel file', '30 calendar days', '$750', 'Lab. Code § 1198.5'], ['Every instrument signed relating to obtaining or holding employment (including any arbitration agreement)', 'On request', 'Misdemeanor', 'Lab. Code § 432'], ['Time records, including meal-period records', 'With the payroll records', '—', 'Lab. Code § 1174; IWC Wage Orders § 7']] },
    { t: 'p', runs: ['Please send the records to the address below or by email. Thank you.'] }, { t: 'signature', lines: [{ label: a.counsel || a.employee }] }] };
}

/** Corrected wage statements for one employee: what was missing per period, the § 226(a) checklist, and corrected figures. */
export function correctedWageStatementsFull(a: { signerName?: string; signerTitle?: string; employeeAddress?: string; employer: string; employerAddress?: string; employeeName: string; employeeId: string; date: string; contact?: string; periods: { start: string; end: string; missing: string[]; derivative: boolean; regHours?: number; regRate?: number | string; otHours?: number; otRate?: number | string; dtHours?: number; gross?: number | string; added: number }[] }): DocModel {
  const items = [['Gross wages earned', '§ 226(a)(1)'], ['Total hours worked (nonexempt employees)', '§ 226(a)(2)'], ['Piece-rate units and rate (if paid by piece)', '§ 226(a)(3)'], ['All deductions', '§ 226(a)(4)'], ['Net wages earned', '§ 226(a)(5)'], ['Inclusive dates of the pay period', '§ 226(a)(6)'], ['Employee name and last four digits of SSN or an employee ID', '§ 226(a)(7)'], ['Employer’s legal name and address', '§ 226(a)(8)'], ['All applicable hourly rates and hours worked at each rate', '§ 226(a)(9)'], ['Paid sick leave available', '§ 246(i)']];
  return { title: `Corrected wage statements — ${a.employeeName}`, draftBanner: B, blocks: [
    { t: 'p', runs: [{ text: a.employer, bold: true }] }, { t: 'p', runs: [a.employerAddress || ''] }, { t: 'p', runs: [a.date] }, { t: 'p', runs: [`${a.employeeName} (Employee ID ${a.employeeId})`, ...(a.employeeAddress ? ['\n', a.employeeAddress] : [])] },
    { t: 'p', runs: [{ text: 'Re: Corrected wage statements', bold: true }] },
    { t: 'p', align: 'justify', runs: [`Enclosed are corrected wage statements for ${a.periods.length} pay period${a.periods.length === 1 ? '' : 's'}. ${a.employer} reviewed its payroll records and is correcting these statements so they show every item California law requires. Each corrected statement replaces the original for that pay period. Any additional wages owed for these periods are being paid separately and are reflected below.`] },
    { t: 'p', align: 'justify', runs: [`${a.employer} provides these corrections voluntarily and in good faith. They are not an admission that any law was violated or that any penalty is owed.`] },
    { t: 'heading', text: 'What changed on each statement' },
    { t: 'table', head: ['Pay period', 'Missing or inaccurate on the original'], rows: a.periods.map(p => [`${p.start} – ${p.end}`, [...p.missing, ...(p.derivative ? ['Gross and net wages, hours, and rates did not include all wages and premiums earned'] : [])].join('; ') || '—']) },
    { t: 'heading', text: 'Corrected figures' },
    { t: 'table', head: ['Pay period', 'Regular hours × rate', 'Overtime hours × rate', 'Double-time hours', 'Gross on original', 'Added wages and premiums'], rows: a.periods.map(p => [`${p.start} – ${p.end}`, `${p.regHours ?? '—'} × ${p.regRate ?? '—'}`, `${p.otHours ?? 0} × ${p.otRate ?? '—'}`, String(p.dtHours ?? 0), String(p.gross ?? '—'), $(p.added)]) },
    { t: 'p', runs: [{ text: 'Deductions and net wages: shown on each enclosed corrected statement from the payroll system.', italic: true }] },
    { t: 'heading', text: 'Every corrected statement shows' },
    { t: 'table', head: ['Required item', 'Authority', 'On corrected statement'], rows: items.map(([l, c]) => [l, `Lab. Code ${c}`, '✓']) },
    { t: 'p', align: 'justify', runs: [`Questions: ${a.contact || `Human Resources at ${a.employer}`}. ${a.employer} will not retaliate against you for asking about your pay.`] },
    { t: 'signature', lines: [{ label: `${a.signerName || 'Human Resources'}${a.signerTitle ? `, ${a.signerTitle}` : ''}, ${a.employer}` }] },
    { t: 'p', runs: [{ text: 'Lab. Code §§ 226(a), 246(i). Employers must keep copies of wage statements for at least three years.', italic: true }] }] };
}
