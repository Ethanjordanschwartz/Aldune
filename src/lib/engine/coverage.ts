// Plain-language data coverage: what Aldune could test with the records provided, what it couldn't, why it matters, and how to fix it.
import type { AuditInput } from './types';
import type { AuditResult } from './audit';
import { industryProfile } from './industries';

export type CoverageStatus = 'tested' | 'partial' | 'not_tested';
export interface CoverageItem { area: string; status: CoverageStatus; why: string; risk?: string; fix?: string; law: string }
export function coverage(input: AuditInput, r: AuditResult | null, industry?: string): { items: CoverageItem[]; score: number; headline: string } {
  const t = input.timeRecords.length, p = input.payroll.length, e = input.employees.length; const prof = industryProfile(industry);
  const ws = (k: string) => input.payroll.filter(x => (x.wageStatement as Record<string, boolean | undefined>)?.[k] !== undefined);
  const items: CoverageItem[] = [];
  items.push(t ? (input.hasMealColumns ? { area: 'Meal periods', status: 'tested', why: `Checked ${t.toLocaleString()} shifts for missed, late, and short meals${prof.firstMealMin === 360 ? ' (Wage Order 12 timing)' : ''}.`, law: 'Lab. Code §§ 226.7, 512' }
    : { area: 'Meal periods', status: 'not_tested', why: 'Your time records don’t include meal punches (common with POS and simple time clocks).', risk: 'California requires recording meal periods. Without them you can’t prove compliance, and missing records are themselves a violation (flagged as Recordkeeping).', fix: 'Turn on meal-break punching in your time system (in most POS systems: Settings → Time clock → require break clock-in/out), or add end-of-shift attestations in Aldune.', law: 'Wage Order § 7(A)(3); Lab. Code § 1174' })
    : { area: 'Meal periods', status: 'not_tested', why: 'No time records were added.', fix: 'Add timesheets or a time-punch export to the Time punches section.', law: 'Lab. Code § 512' });
  items.push(t ? (input.hasRestColumns ? { area: 'Rest breaks', status: 'tested', why: 'Checked recorded or attested rest breaks.', law: 'Wage Orders § 12' }
    : { area: 'Rest breaks', status: 'partial', why: 'Rest breaks usually aren’t punched, so they can’t be tested from time records alone.', risk: 'Rest-break claims rely on testimony; an attestation record is the best evidence that breaks were provided.', fix: 'Use Aldune’s end-of-shift attestation (Settings → Attestations) so every shift records whether breaks were provided.', law: 'Wage Orders § 12; Lab. Code § 226.7' })
    : { area: 'Rest breaks', status: 'not_tested', why: 'No time records were added.', law: 'Wage Orders § 12' });
  items.push(t ? { area: 'Overtime from punches', status: 'tested', why: `Daily, weekly, and seventh-day overtime${prof.overtime === 'household' ? ' (9/45 personal-attendant rule)' : prof.overtime === 'agriculture' ? ' (agricultural phase-in)' : ''}.`, law: 'Lab. Code § 510' } : { area: 'Overtime from punches', status: 'not_tested', why: 'No time records.', fix: 'Add time punches.', law: 'Lab. Code § 510' });
  items.push(p ? { area: 'Pay rates, overtime pay, minimum wage', status: 'tested', why: `Checked ${p.toLocaleString()} pay periods against state, local, and industry minimum wages and the regular rate.`, law: 'Lab. Code §§ 510, 1194, 1197' } : { area: 'Pay rates, overtime pay, minimum wage', status: 'not_tested', why: 'No payroll records or pay stubs.', fix: 'Add pay stubs (PDF is fine) or a payroll register to the Payroll section.', law: 'Lab. Code §§ 510, 1194' });
  items.push(t && p ? { area: 'Hours worked vs. hours paid', status: 'tested', why: 'Compared punched hours to paid hours for each period.', law: 'Lab. Code §§ 1194, 1198' } : { area: 'Hours worked vs. hours paid', status: 'not_tested', why: 'Needs both time records and payroll for the same periods.', fix: 'Add whichever is missing.', law: 'Lab. Code § 1194' });
  const wsKnown = ws('sickLeave').length + ws('employerNameAddress').length;
  items.push(p ? (wsKnown ? { area: 'Pay stub contents', status: 'tested', why: 'Checked the items § 226(a) requires on every pay stub.', law: 'Lab. Code § 226(a)' } : { area: 'Pay stub contents', status: 'partial', why: 'Payroll registers don’t show what printed on the stubs.', fix: 'Add a sample of actual pay stubs (PDF) so Aldune can check each required item.', law: 'Lab. Code § 226(a)' }) : { area: 'Pay stub contents', status: 'not_tested', why: 'No pay stubs.', law: 'Lab. Code § 226(a)' });
  items.push(p && input.payroll.some(x => x.payDate) ? { area: 'Paydays', status: 'tested', why: 'Checked pay dates against § 204 deadlines.', law: 'Lab. Code § 204' } : { area: 'Paydays', status: 'not_tested', why: 'Pay dates weren’t included.', fix: 'Include the pay date column or pay stubs.', law: 'Lab. Code § 204' });
  const terms = input.employees.filter(x => x.terminationDate).length;
  items.push(terms ? { area: 'Final pay', status: 'tested', why: `Checked ${terms} separations.`, law: 'Lab. Code §§ 201–203' } : { area: 'Final pay', status: 'partial', why: 'No termination dates in the employee list.', fix: 'Add termination dates (and final pay dates) for former employees.', law: 'Lab. Code §§ 201–203' });
  const classified = input.employees.filter(x => x.classification !== 'nonexempt' || x.annualSalary).length;
  items.push(e && classified ? { area: 'Exempt and contractor classification', status: 'tested', why: `Checked ${classified} exempt or contractor workers against salary and duties tests.`, law: 'Lab. Code §§ 515, 2775' } : { area: 'Exempt and contractor classification', status: 'partial', why: 'No exempt or contractor workers identified, or no salaries provided.', fix: 'Include exempt status and salaries in the employee list.', law: 'Lab. Code § 515' });
  const locs = input.employees.filter(x => x.location).length;
  items.push({ area: 'Local minimum wages', status: locs ? 'tested' : 'partial', why: locs ? 'Applied city and county rates by work location.' : 'Work locations weren’t provided, so only state and industry rates were applied.', fix: locs ? undefined : 'Add each worker’s work city.', law: 'Local ordinances' });
  const pts = { tested: 1, partial: 0.5, not_tested: 0 }; const score = Math.round(items.reduce((s, i) => s + pts[i.status], 0) / items.length * 100);
  const gaps = items.filter(i => i.status !== 'tested').length;
  return { items, score, headline: gaps ? `Aldune fully tested ${items.length - gaps} of ${items.length} areas. ${gaps} need more data — see how to fix each below.` : `Aldune tested all ${items.length} areas.` };
}
