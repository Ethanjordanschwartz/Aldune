// POS and timekeeping guidance for California compliance: required settings (with authority), vendor capabilities
// (verified only where the vendor documents them), and recommendations driven by the employer's own punch data.
import type { AuditInput } from '../engine/types';
import type { AuditResult } from '../engine/audit';
import type { DocModel } from '../documents/render';

export interface PosRequirement { id: string; setting: string; why: string; cite: string }
export const CA_POS_REQUIREMENTS: PosRequirement[] = [
  { id: 'record-meals', setting: 'Require clock-out and clock-in for every meal period', why: 'Employers must record meal periods; without them meal compliance can’t be shown and the missing records are a violation.', cite: 'IWC Wage Orders § 7(A)(3); Lab. Code § 1174' },
  { id: 'no-autodeduct', setting: 'Turn off automatic meal deductions', why: 'Auto-deducted meals hide missed and short meals and are a common class-action theory.', cite: 'Donohue v. AMN Services (2021) 11 Cal.5th 58' },
  { id: 'no-rounding', setting: 'Pay to the minute; never round meal punches', why: 'Meal punches may not be rounded, and rounding that undercompensates over time is unlawful.', cite: 'Donohue (2021); Lab. Code § 1194' },
  { id: 'meal-alerts', setting: 'Alert before the end of the 5th hour (and 10th) of work', why: 'The first meal must start by the end of the fifth hour; the second by the end of the tenth.', cite: 'Lab. Code § 512(a)' },
  { id: 'attestation', setting: 'End-of-shift attestation for meal, rest, and recovery periods — with an honest “No” option and a reason', why: 'Attestations are strong evidence that breaks were provided, but only if employees can freely report a missed break; every “No” should trigger a premium. Coercive or one-sided attestations undermine the defense.', cite: 'Brinker (2012) 53 Cal.4th 1004; Donohue (2021); Lab. Code § 226.7' },
  { id: 'premium-pay', setting: 'Pay meal/rest premiums automatically at the regular rate, as a separate earnings code', why: 'Premiums are wages owed at the regular rate of compensation and must appear on the wage statement.', cite: 'Lab. Code §§ 226, 226.7; Ferra (2021) 11 Cal.5th 858; Naranjo (2022) 13 Cal.5th 93' },
  { id: 'waivers', setting: 'Store signed meal waivers and apply them only within legal limits', why: 'First-meal waivers apply only to workdays of 6 hours or less; second-meal waivers only to workdays of 12 hours or less when the first meal was taken. Systems that auto-dismiss missed meals must respect these limits.', cite: 'Lab. Code § 512(a); Wage Orders § 11' },
  { id: 'edit-audit', setting: 'Require employee acknowledgment of time edits and keep an audit trail', why: 'Manager edits without employee confirmation are a leading source of off-the-clock and meal claims.', cite: 'Lab. Code § 1174; Troester v. Starbucks (2018) 5 Cal.5th 829' },
  { id: 'overtime', setting: 'Daily, weekly, and seventh-day overtime and double time; regular rate includes differentials and nondiscretionary bonuses', why: 'California overtime is daily as well as weekly, and the regular rate includes more than base pay.', cite: 'Lab. Code § 510; Alvarado (2018) 4 Cal.5th 542' },
  { id: 'split-reporting', setting: 'Split-shift premium and reporting-time pay rules', why: 'Common in restaurants and retail; both are owed automatically when triggered.', cite: 'IWC Wage Orders §§ 4(C), 5' },
  { id: 'local-mw', setting: 'Local minimum wage tables by work location and effective date', why: 'City and county rates change on January 1 and July 1.', cite: 'Local ordinances; Lab. Code § 1182.12' },
  { id: 'tips', setting: 'Tips to employees only (no owners/managers); credit-card tips paid by next payday', why: 'Gratuities belong to employees.', cite: 'Lab. Code § 351' },
  { id: 'retention', setting: 'Keep time and payroll data at least 3 years (4 recommended) and export it on demand', why: 'Records requests must be answered within 21 days; PAGA and class claims reach back 1–4 years.', cite: 'Lab. Code §§ 226, 1174; Code Civ. Proc. § 338; Bus. & Prof. Code § 17208' }
];
export interface PosSystem { id: string; name: string; kind: 'POS' | 'Scheduling / time clock' | 'Payroll' | 'Custom'; verified: string[]; source?: string; check: string[] }
const CHECK_GENERIC = ['Where are meal break clock-outs configured, and can they be required?', 'Can it require an end-of-shift break attestation with a “No” option?', 'Can it calculate and pay meal/rest premiums at the regular rate?', 'Can rounding and automatic meal deductions be turned off?', 'Does it keep an audit trail of time edits with employee acknowledgment?'];
export const POS_SYSTEMS: PosSystem[] = [
  { id: '7shifts', name: '7shifts', kind: 'Scheduling / time clock', source: '7shifts Help Center (California Labor Compliance; More Tools)', verified: ['California Labor Compliance mode flags missed meal breaks and meals not started before the end of the 5th hour', 'Meal-break waivers can be stored and, when enabled, missed meals covered by a waiver can be auto-dismissed', 'Employee attestation at punch-out; missed rest breaks must be handled by attestation each time (waivers can’t dismiss rest breaks)', 'Labor Exceptions Report for reviewing and processing meal-break premium pay', 'Compliance features may require a higher plan tier'], check: ['Confirm auto-dismissal only applies within the legal waiver limits (≤6 h first meal; ≤12 h second meal with the first taken).', 'Confirm every attestation “No” flows to premium pay at the regular rate.'] },
  { id: 'toast', name: 'Toast', kind: 'POS', verified: [], check: CHECK_GENERIC },
  { id: 'square', name: 'Square', kind: 'POS', verified: [], check: CHECK_GENERIC },
  { id: 'clover', name: 'Clover', kind: 'POS', verified: [], check: CHECK_GENERIC },
  { id: 'lightspeed', name: 'Lightspeed', kind: 'POS', verified: [], check: CHECK_GENERIC },
  { id: 'touchbistro', name: 'TouchBistro', kind: 'POS', verified: [], check: CHECK_GENERIC },
  { id: 'spoton', name: 'SpotOn', kind: 'POS', verified: [], check: CHECK_GENERIC },
  { id: 'homebase', name: 'Homebase', kind: 'Scheduling / time clock', verified: [], check: CHECK_GENERIC },
  { id: 'wheniwork', name: 'When I Work', kind: 'Scheduling / time clock', verified: [], check: CHECK_GENERIC },
  { id: 'deputy', name: 'Deputy', kind: 'Scheduling / time clock', verified: [], check: CHECK_GENERIC },
  { id: 'adp', name: 'ADP (Workforce Now / RUN)', kind: 'Payroll', verified: [], check: CHECK_GENERIC },
  { id: 'paychex', name: 'Paychex Flex', kind: 'Payroll', verified: [], check: CHECK_GENERIC },
  { id: 'gusto', name: 'Gusto', kind: 'Payroll', verified: [], check: CHECK_GENERIC },
  { id: 'custom', name: 'Custom / in-house POS', kind: 'Custom', verified: [], check: ['Document how meal punches, attestations, premiums, and edits are captured — courts and opposing counsel will ask.', ...CHECK_GENERIC] }
];

export interface PosRecommendation { priority: 'high' | 'medium' | 'low'; title: string; evidence: string; action: string; cite: string; requirement: string }
/** Recommendations derived from the employer's own records. */
export function posRecommendations(input: AuditInput, r: AuditResult | null): PosRecommendation[] {
  const out: PosRecommendation[] = []; const recs = input.timeRecords;
  if (recs.length && !input.hasMealColumns) out.push({ priority: 'high', title: 'Your system isn’t recording meal breaks', evidence: `${recs.length.toLocaleString()} shifts have no meal punches.`, action: 'Require meal clock-out/clock-in for shifts over 5 hours.', cite: 'Wage Orders § 7(A)(3)', requirement: 'record-meals' });
  const meals = recs.flatMap(t => t.meals.filter(m => m.out !== null && m.in !== null).map(m => (m.in as number) - (m.out as number)));
  if (meals.length > 20 && meals.filter(m => m === 30).length / meals.length > 0.9) out.push({ priority: 'high', title: 'Meal periods look automatically deducted', evidence: `${Math.round(meals.filter(m => m === 30).length / meals.length * 100)}% of meals are exactly 30 minutes.`, action: 'Turn off automatic meal deductions and require actual meal punches.', cite: 'Donohue (2021)', requirement: 'no-autodeduct' });
  const punches = recs.flatMap(t => [t.clockIn, t.clockOut]).filter((x): x is number => x !== null);
  if (punches.length > 40 && punches.filter(p => p % 15 === 0).length / punches.length > 0.85) out.push({ priority: 'high', title: 'Punches appear rounded', evidence: `${Math.round(punches.filter(p => p % 15 === 0).length / punches.length * 100)}% of punches fall on quarter hours.`, action: 'Disable rounding; pay to the minute.', cite: 'Donohue (2021); Lab. Code § 1194', requirement: 'no-rounding' });
  if (recs.length && !input.hasRestColumns && !recs.some(t => t.attestation)) out.push({ priority: 'medium', title: 'No break attestations in your records', evidence: 'Rest breaks can’t be shown from punches alone.', action: 'Add an end-of-shift attestation covering meal, rest, and recovery periods, with an honest “No” option that triggers a premium.', cite: 'Brinker (2012); Lab. Code § 226.7', requirement: 'attestation' });
  if (r) {
    const late = r.engine.findings.filter(f => f.category === 'meal' && /LATE/.test(String(f.evidence.issues || ''))).length;
    if (late > 5) out.push({ priority: 'medium', title: 'Late meals are common', evidence: `${late} late meal periods found.`, action: 'Turn on a 4½-hour meal alert (and 9½-hour for second meals).', cite: 'Lab. Code § 512(a)', requirement: 'meal-alerts' });
    const unpaid = r.engine.findings.filter(f => f.category === 'meal' && !f.premiumIndicated && f.amount > 0).length; const paid = r.engine.findings.filter(f => f.premiumIndicated).length;
    if (unpaid > 5 && paid === 0) out.push({ priority: 'high', title: 'Meal premiums aren’t being paid', evidence: `${unpaid} meal issues with no premium on payroll.`, action: 'Configure automatic premium pay at the regular rate as its own earnings code.', cite: 'Lab. Code § 226.7; Ferra (2021)', requirement: 'premium-pay' });
    if (r.engine.findings.some(f => f.category === 'split_shift' && f.amount > 0)) out.push({ priority: 'medium', title: 'Split-shift premiums owed', evidence: 'Unpaid split shifts found.', action: 'Enable the split-shift premium rule.', cite: 'Wage Orders § 4(C)', requirement: 'split-reporting' });
    if (r.engine.findings.some(f => f.category === 'regular_rate')) out.push({ priority: 'medium', title: 'Overtime paid at base rate', evidence: 'Regular-rate shortfalls found.', action: 'Include differentials and nondiscretionary bonuses in the regular rate.', cite: 'Lab. Code § 510; Alvarado (2018)', requirement: 'overtime' });
  }
  const ord = { high: 0, medium: 1, low: 2 }; return out.sort((a, b) => ord[a.priority] - ord[b.priority]);
}
export function posConfigMemo(employer: string, system: PosSystem, recs: PosRecommendation[], date: string): DocModel {
  return { title: `Timekeeping configuration request — ${system.name}`, draftBanner: 'Prepared with Aldune. Confirm settings with your vendor’s documentation.', blocks: [
    { t: 'title', text: `California Timekeeping Configuration Request — ${system.name}` }, { t: 'p', runs: [`${employer} · ${date}`] },
    ...(recs.length ? [{ t: 'heading' as const, text: 'What our records show' }, { t: 'table' as const, head: ['Priority', 'Issue', 'Evidence', 'Requested change', 'Authority'], rows: recs.map(x => [x.priority, x.title, x.evidence, x.action, x.cite]) }] : []),
    { t: 'heading', text: 'Required California settings' }, { t: 'table', head: ['Setting', 'Why', 'Authority'], rows: CA_POS_REQUIREMENTS.map(q => [q.setting, q.why, q.cite]) },
    { t: 'heading', text: `Questions for ${system.name}` }, { t: 'bullets', items: system.check.map(c => [c]) },
    ...(system.verified.length ? [{ t: 'p' as const, runs: [{ text: `Documented ${system.name} capabilities (${system.source}): `, bold: true }, system.verified.join('; ') + '.'] }] : [])
  ] };
}
