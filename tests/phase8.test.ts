import { describe, expect, it } from 'vitest';
import { assessQuality } from '@/lib/engine/quality';
import { ledgerFor, employeeLedger } from '@/lib/engine/ledger';
import { runAudit } from '@/lib/engine/audit';
import { runEngine, DEFAULT_ASSUMPTIONS } from '@/lib/engine/engine';
import { DEFAULT_SCENARIO, NAMED_SCENARIOS, compareScenarios, pagaRegimeFor, runScenario } from '@/lib/engine/modeling';
import { RULES } from '@/lib/engine/rules/registry';
import { parseTime } from '@/lib/engine/time';
import { parseFile, normalize } from '@/lib/ingest/normalize';
import { suggestMapping } from '@/lib/ingest/mapping';
import { generateDemo } from '@/lib/demo/generate';
import type { AuditInput, TimeRecord } from '@/lib/engine/types';

const tr = (id: string, date: string, i: string, o: string, meals: [string | null, string | null][] = [['12:00', '12:30']]): TimeRecord => ({ employeeId: id, date, clockIn: parseTime(i), clockOut: parseTime(o), meals: meals.map(([a, b]) => ({ out: a ? parseTime(a) : null, in: b ? parseTime(b) : null })), restBreaksTaken: 2 });
const bad: AuditInput = {
  employerName: 'Bad Data Co', hasMealColumns: true, hasRestColumns: true,
  employees: [
    { id: 'A', name: 'A', classification: 'nonexempt', hourlyRate: 20, payFrequency: 'biweekly', location: 'X', hireDate: '2025-01-01' },
    { id: 'A', name: 'A dup', classification: 'nonexempt', hourlyRate: 21, payFrequency: 'biweekly' },
    { id: 'B', name: 'B', classification: 'exempt', annualSalary: 90000, payFrequency: 'biweekly', location: 'X' },
    { id: 'C', name: 'C', classification: 'nonexempt', payFrequency: 'biweekly', terminationDate: '2026-06-05', location: 'X' }
  ],
  timeRecords: [
    tr('A', '2026-06-01', '08:00', '16:30'), tr('A', '2026-06-01', '08:00', '16:30'),          // duplicate
    tr('A', '2026-06-02', '08:00', '16:30'), tr('A', '2026-06-02', '15:00', '20:00', []),     // overlap
    tr('A', '2026-06-03', '08:00', '08:00'),                                                  // zero length
    tr('A', '2026-06-04', '06:00', '04:00', []),                                              // 22 hours
    tr('A', '2026-06-05', '08:00', '16:30', [['12:00', null]]),                               // incomplete meal
    { employeeId: 'A', date: '2026-06-06', clockIn: null, clockOut: parseTime('17:00'), meals: [] }, // missing punch
    tr('C', '2026-06-10', '08:00', '16:30'),                                                  // after termination; no rate
    tr('ZZ', '2026-06-01', '08:00', '16:30')                                                  // unmatched
  ],
  payroll: [
    { employeeId: 'A', periodStart: '2026-05-31', periodEnd: '2026-06-13', payDate: '2026-06-18', regHours: 40, regRate: 30, otHours: 0, dtHours: 0, shiftDiffPay: 0, commission: 0, bonus: 0 },
    { employeeId: 'A', periodStart: '2026-07-12', periodEnd: '2026-07-25', payDate: '2026-07-30', regHours: 10, regRate: 20, otHours: 0, dtHours: 0, shiftDiffPay: 0, commission: 0, bonus: 0 }, // gap
    { employeeId: 'B', periodStart: '2026-05-31', periodEnd: '2026-06-13', payDate: '2026-06-18', regHours: 0, otHours: 5, dtHours: 0, shiftDiffPay: 0, commission: 0, bonus: 0 }
  ]
};

describe('data-quality engine (adversarial dataset)', () => {
  const q = assessQuality(bad);
  const codes = q.issues.map(i => i.code);
  it('detects every planted problem with the right severity', () => {
    for (const c of ['DUP_EMP', 'DUP_PUNCH', 'OVERLAP', 'IMPOSSIBLE', 'MEAL_INCOMPLETE', 'MISSING_PUNCH', 'UNMATCHED_TIME', 'NO_RATE', 'ACTIVE_AFTER_TERM', 'EXEMPT_OT', 'PAY_GAP', 'RATE_MISMATCH', 'TERM_INCOMPLETE']) expect(codes, c).toContain(c);
    expect(q.issues.find(i => i.code === 'UNMATCHED_TIME')!.severity).toBe('critical');
    expect(q.issues[0].severity).toBe('critical');
    expect(q.confidence).toBe('Low'); expect(q.score).toBeLessThan(70);
    expect(q.issues.find(i => i.code === 'IMPOSSIBLE')!.examples.join(' ')).toMatch(/A on 2026-06-03/);
  });
  it('scores the clean demo highly', () => { const d = generateDemo({ employees: 40, months: 2 }); const r = assessQuality(d); expect(r.issues.filter(i => i.severity === 'critical')).toHaveLength(0); expect(r.score).toBeGreaterThanOrEqual(80); });
  it('engine survives the bad dataset without throwing', () => { expect(() => runAudit(bad, { auditDate: '2026-08-01' })).not.toThrow(); });
});

describe('calculation ledger', () => {
  const d = generateDemo({ employees: 60, months: 3 }); const r = runEngine(d, { auditDate: d.auditDate });
  it('reproduces every meal/rest premium as 1 hour × regular rate', () => {
    const prem = r.findings.filter(f => (f.category === 'meal' || f.category === 'rest') && f.date && !f.premiumIndicated && f.ruleId !== 'CA-REGRATE');
    expect(prem.length).toBeGreaterThan(50);
    for (const f of prem) { const l = ledgerFor(f, r.meta.assumptions); expect(l.formula).toMatch(/regular rate/); expect(Number(l.inputs[1].value.slice(1))).toBeCloseTo(f.amount, 1); expect(l.ruleVersion).toBe(f.ruleVersion); }
  });
  it('gives every finding a formula and ties employee totals to findings', () => {
    for (const f of r.findings) { const l = ledgerFor(f, DEFAULT_ASSUMPTIONS); expect(l.formula.length).toBeGreaterThan(5); expect(l.authority.length).toBeGreaterThan(0); }
    const s = r.employees.find(e => e.exposure.total > 0)!; const led = employeeLedger(s, r.findings.filter(f => f.employeeId === s.employee.id));
    const sum = led.lines.reduce((t, x) => t + x.amount, 0) + led.interest;
    expect(sum).toBeCloseTo(s.exposure.total, 0);
  });
});

describe('PAGA versioning and named scenarios', () => {
  const d = generateDemo({ employees: 80, months: 6 }); const a = runAudit(d, { auditDate: d.auditDate });
  it('selects the statute by notice date', () => { expect(pagaRegimeFor('2024-06-18')).toBe('pre2024'); expect(pagaRegimeFor('2024-06-19')).toBe('post2024'); expect(pagaRegimeFor()).toBe('post2024'); });
  it('pre-2024 ignores reasonable-steps caps and can apply $200 subsequent penalties', () => {
    const post = runScenario(d, a, { ...DEFAULT_SCENARIO, pagaCap: 'pre' });
    const pre = runScenario(d, a, { ...DEFAULT_SCENARIO, pagaCap: 'pre', pagaRegime: 'pre2024', pagaWeeklyHalf: false });
    const pre200 = runScenario(d, a, { ...DEFAULT_SCENARIO, pagaRegime: 'pre2024', pre2024Subsequent200: true });
    expect(pre.paga).toBeGreaterThan(post.paga);
    expect(pre200.paga).toBeGreaterThan(pre.paga);
    expect(pre.notes.join(' ')).toMatch(/25%/);
  });
  it('orders named scenarios sensibly and diffs them', () => {
    const by = Object.fromEntries(NAMED_SCENARIOS.map(n => [n.id, runScenario(d, a, { ...DEFAULT_SCENARIO, ...n.inputs })]));
    expect(by.B.paga).toBeLessThan(by.C.paga); expect(by.C.paga).toBeLessThan(by.A.paga);
    expect(by.E.total).toBeLessThan(by.A.total); expect(by.A.total).toBeLessThan(by.F.total); expect(by.D.total).toBeLessThan(by.A.total);
    const diff = compareScenarios(by.A, by.F); expect(diff.total).toBe(by.F.total - by.A.total); expect(diff.byCategory.length).toBeGreaterThan(0);
  });
  it('excluding dismissed findings lowers exposure', () => {
    const meal = a.engine.findings.filter(f => f.category === 'meal').map(f => f.id);
    const base = runScenario(d, a, DEFAULT_SCENARIO), ex = runScenario(d, a, { ...DEFAULT_SCENARIO, excludeFindingIds: meal });
    expect(ex.byCategory.find(c => c.category === 'meal')).toBeUndefined(); expect(ex.total).toBeLessThan(base.total);
  });
  it('every rule has authority, version, effective date, applicability, exceptions, and review date', () => {
    for (const r of Object.values(RULES)) { expect(r.authorities.length).toBeGreaterThan(0); expect(r.version).toMatch(/^CA-/); expect(r.effectiveDate).toMatch(/^\d{4}-/); expect(r.appliesTo).toBeTruthy(); expect(r.exceptions!.length).toBeGreaterThan(0); expect(r.lastReviewed).toBeTruthy(); }
  });
});

describe('adversarial imports', () => {
  it('handles malformed CSV, hostile filenames, and absurd values without crashing', () => {
    const csv = 'Employee #,Date,Clock In,Clock Out\n"E1,2026-06-01,08:00,16:30\nE2,not-a-date,25:99,-4\nE3,2026-06-01,8:00 AM,99999\n<script>alert(1)</script>,2026-06-01,08:00,16:00\n';
    const p = parseFile('../../etc/passwd<img src=x>.csv', csv);
    const map = Object.fromEntries(suggestMapping('time', p.headers).map(x => [x.column, x.field]));
    const n = normalize('X', { employees: { headers: ['Employee #'], rows: [{ 'Employee #': 'E3' }], mapping: { 'Employee #': 'employee_id' } }, time: { ...p, mapping: map } });
    expect(Array.isArray(n.input.timeRecords)).toBe(true);
    expect(() => runAudit(n.input, { auditDate: '2026-07-01' })).not.toThrow();
    expect(() => assessQuality(n.input, n.issues)).not.toThrow();
  });
});

describe('post-2024 PAGA penalty limits and scenario exclusions', () => {
  const d = generateDemo({ employees: 60, months: 4 }); const a = runAudit(d, { auditDate: d.auditDate });
  it('$25 wage-statement, $50 isolated, $200 enhanced behave as statute describes', () => {
    const base = runScenario(d, a, { ...DEFAULT_SCENARIO, pagaMode: 'stacked' });
    const noLimits = runScenario(d, a, { ...DEFAULT_SCENARIO, pagaMode: 'stacked', ws25: false, isolated50: false });
    const enh = runScenario(d, a, { ...DEFAULT_SCENARIO, pagaMode: 'stacked', enhanced200: true, pagaWeeklyHalf: false });
    expect(base.paga).toBeLessThan(noLimits.paga); expect(noLimits.paga).toBeLessThan(enh.paga);
    expect(base.notes.join(' ')).toMatch(/\$25 for wage-statement/);
  });
  it('excluding workers or remediating a category lowers exposure and says so', () => {
    const base = runScenario(d, a, DEFAULT_SCENARIO);
    const top = a.engine.employees.slice().sort((x, y) => y.exposure.total - x.exposure.total).slice(0, 5).map(x => x.employee.id);
    const ex = runScenario(d, a, { ...DEFAULT_SCENARIO, excludeEmployeeIds: top });
    const fixMeal = runScenario(d, a, { ...DEFAULT_SCENARIO, excludeCategories: ['meal'] });
    expect(ex.total).toBeLessThan(base.total); expect(fixMeal.byCategory.some(c => c.category === 'meal')).toBe(false);
    expect(ex.notes.join(' ')).toMatch(/5 workers excluded/); expect(fixMeal.notes.join(' ')).toMatch(/Treated as remediated: Meal periods/);
  });
});
