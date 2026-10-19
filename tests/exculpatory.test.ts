import { describe, it, expect } from 'vitest';
import { applyExculpatory, documentKinds } from '@/lib/documents/exculpatory';
import { runAudit } from '@/lib/engine/audit';
import type { AuditInput } from '@/lib/engine/types';

const input = (): AuditInput => ({ employerName: 'Test Co', hasMealColumns: true, hasRestColumns: false, payroll: [],
  employees: [{ id: 'E1', name: 'Hassan Ali', classification: 'nonexempt', hourlyRate: 21 }, { id: 'E2', name: 'Maria Lopez', classification: 'nonexempt', hourlyRate: 21 }] as AuditInput['employees'],
  timeRecords: ['E1', 'E2'].flatMap(id => ['2026-06-01', '2026-06-02'].map(date => ({ employeeId: id, date, clockIn: 480, clockOut: 1140, meals: [{ out: 720, in: 750 }] }))) as AuditInput['timeRecords'] });

describe('exculpatory documents gate findings', () => {
  it('recognizes waiver, on-duty, and AWS documents', () => {
    expect(documentKinds('Second Meal Period Waiver. I voluntarily waive my second meal period on days I work more than 10 but not more than 12 hours.')).toEqual(['meal2']);
    expect(documentKinds('On-duty meal period agreement. The nature of the work prevents relief. Employee agrees...')).toEqual(['onduty']);
    expect(documentKinds('Alternative workweek election results: secret ballot, two-thirds approved a 4/10 schedule.')).toEqual(['aws']);
  });
  it('a signed second-meal waiver naming the employee suppresses that employee’s second-meal findings only', () => {
    const base = runAudit(input()); const m2 = (r: ReturnType<typeof runAudit>, id: string) => r.engine.findings.filter(f => f.employeeId === id && f.ruleId === 'CA-MEAL' && f.state === 'VIOLATION').length;
    expect(m2(base, 'E1')).toBe(2); expect(m2(base, 'E2')).toBe(2);
    const inp = input(); const res = applyExculpatory(inp, [{ name: 'Ali second meal waiver.pdf', text: 'SECOND MEAL PERIOD WAIVER — Employee: Hassan Ali. I waive my second meal period on shifts over 10 hours but not more than 12 hours. Employee signature: /s/ Hassan Ali' }]);
    expect(res.applied).toEqual([{ employeeId: 'E1', name: 'Hassan Ali', kind: 'meal2', doc: 'Ali second meal waiver.pdf' }]);
    const r = runAudit(inp); expect(m2(r, 'E1')).toBe(0); expect(m2(r, 'E2')).toBe(2);
    const sup = r.engine.findings.find(f => f.employeeId === 'E1' && f.state === 'SUPPRESSED')!; expect(sup.suppressedBy).toMatch(/Ali second meal waiver\.pdf/);
  });
  it('unsigned or revoked documents are not applied, and say why', () => {
    const inp = input();
    const a = applyExculpatory(inp, [{ name: 'blank form.docx', text: 'Second meal period waiver for Hassan Ali — more than 10 hours, not more than 12 hours. ________ (employee)' }]);
    expect(a.applied).toEqual([]); expect(a.notApplied[0].why).toMatch(/no signature/);
    const b = applyExculpatory(inp, [{ name: 'revoked.pdf', text: 'Second meal period waiver, Hassan Ali, signed 1/2/2026. This waiver was revoked on 3/1/2026. Signature on file.' }]);
    expect(b.applied).toEqual([]); expect(b.notApplied[0].why).toMatch(/revoked/);
  });
});
