// Policies and the payroll memo are complete documents: no blanks, required California content, and real length.
import { describe, it, expect } from 'vitest';
import { mealRestPolicyFull, timekeepingPolicyFull, expensePolicyFull, payrollConfigMemoFull } from '@/lib/documents/policies';
import type { DocModel } from '@/lib/documents/render';
const text = (m: DocModel) => m.blocks.map(b => ('text' in b ? b.text : '') + ('runs' in b ? b.runs.map(r => typeof r === 'string' ? r : r.text).join('') : '') + ('items' in b ? b.items.flat().map(r => typeof r === 'string' ? r : r.text).join(' ') : '') + ('rows' in b ? b.rows.flat().join(' ') : '')).join('\n');
const P = { employerName: 'Valley Produce Co.', contact: 'Human Resources, (559) 555-0100', effectiveDate: '2026-11-01' };
const noBlanks = (t: string) => { expect(t).not.toMatch(/\[\[|\[\$|_{3,}|\bTBD\b|\[[A-Z][a-z]+ ?[a-z]*\]/); };
describe('policies', () => {
  it('meal and rest policy covers the California rules', () => {
    const t = text(mealRestPolicyFull(P)); noBlanks(t);
    for (const s of ['end of your fifth hour', 'tenth hour', 'no more than six hours', 'no more than twelve hours', 'revoke', 'regular rate of compensation', 'one meal premium and one rest premium', 'Augustus', 'Donohue', 'Ferra', 'November 1, 2026', '§ 1174(d)']) expect(t).toContain(s);
    expect(t.split(/\s+/).length).toBeGreaterThan(1300);
  });
  it('timekeeping policy covers hours worked, rounding, overtime, reporting time, split shifts, records', () => {
    const t = text(timekeepingPolicyFull(P)); noBlanks(t);
    for (const s of ['de minimis', 'not rounded', 'Over 12 in a workday', 'seventh consecutive', 'half the scheduled shift', 'Wage Order § 4(C)', '21 days', 'Frlekin', 'Huerta']) expect(t).toContain(s);
    expect(t.split(/\s+/).length).toBeGreaterThan(1200);
  });
  it('expense policy states the stipend when given and never forfeits late claims', () => {
    const t = text(expensePolicyFull({ ...P, phoneStipend: 30 })); noBlanks(t);
    expect(t).toContain('$30.00 per month'); expect(t).toContain('Cochran'); expect(t).toContain('never forfeits'); expect(t).toContain('§ 2804');
    expect(text(expensePolicyFull(P))).not.toContain('$0');
  });
  it('payroll memo flags audit categories and lists location minimum wages', () => {
    const t = text(payrollConfigMemoFull(P, { date: '2026-10-07', categories: ['meal', 'piece_rate', 'tips'], locations: [{ name: 'Los Angeles', rate: 17.87, source: 'City of Los Angeles' }] })); noBlanks(t);
    expect(t).toContain('Meal premium earnings code (found in audit)'); expect(t).toContain('§ 226.2'); expect(t).toContain('$17.87'); expect(t).toContain('§ 226(a)');
  });
});
