import { describe, expect, it } from 'vitest';
import { compile, parse, validateRule, runRule, DslError } from '@/lib/rules/dsl';
describe('rule DSL', () => {
  it('evaluates arithmetic, comparisons, logic, paths, and whitelisted functions', () => {
    const ctx = { shift: { hours: 6.5, meal: false }, employee: { nonexempt: true, rate: 20 } };
    expect(compile('employee.nonexempt AND shift.hours > 5 AND NOT shift.meal')(ctx)).toBe(true);
    expect(compile('clamp(0.5 * 7, 2, 4) * employee.rate')(ctx)).toBe(70);
    expect(compile('max(0, 1 * 16.9 - (employee.rate - 16.9) * 8)')(ctx)).toBe(0);
    expect(compile('(1 + 2) * 3 == 9 || false')(ctx)).toBe(true);
  });
  it('is sandboxed: no prototype access, no unknown functions, no code', () => {
    for (const bad of ['constructor.constructor("return process")()', 'shift.__proto__', 'eval(1)', 'shift.hours; alert(1)', 'a'.repeat(501), '('.repeat(60) + '1' + ')'.repeat(60)]) expect(() => parse(bad), bad).toThrow(DslError);
    expect(compile('shift.toString')({ shift: { hours: 1 } })).toBeNull();
    expect(compile('missing.field > 1')({})).toBe(false);
  });
  it('rules are validated and gated by attorney verification', () => {
    expect(validateRule({ id: 'x', title: '', authority: '', scope: 'shift' as const, violation_trigger: 'shift.hours >' }).length).toBeGreaterThan(2);
    expect(validateRule({ id: 'report_time', title: 'Reporting time', authority: 'Wage Order § 5', scope: 'shift', violation_trigger: 'shift.hours < 2', verification_status: 'attorney_verified' })).toContain('attorney_verified rules must name the verifying attorney (verified_by)');
    const rows = [{ date: '2026-03-02', hours: 1.5, scheduled: 8, rate: 20 }, { date: '2026-03-03', hours: 8, scheduled: 8, rate: 20 }, { date: '2025-01-01', hours: 1, scheduled: 8, rate: 20 }];
    const r = runRule({ id: 'rt', title: 'Reporting time', authority: 'IWC Wage Orders § 5', scope: 'shift', applies_if: 'scheduled > 0', violation_trigger: 'hours < 0.5 * scheduled', amount: '(clamp(0.5 * scheduled, 2, 4) - hours) * rate', verification_status: 'needs_review', effective_start: '2026-01-01' }, rows);
    expect(r.matches).toBe(1); expect(r.total).toBe(50); expect(r.live).toBe(false);
  });
});
