import { describe, expect, it } from 'vitest';
import { suggestMapping } from '@/lib/ingest/mapping';
import { normalize, parseFile } from '@/lib/ingest/normalize';
import { runAudit } from '@/lib/engine/audit';

describe('column mapping', () => {
  it('maps common variants with confidence and keeps mappings one-to-one', () => {
    const s = suggestMapping('time', ['Worker #', 'Shift Date', 'Time In', 'Lunch Out', 'Lunch In', 'Time Out', 'Notes']);
    const by = Object.fromEntries(s.map(x => [x.column, x]));
    expect(by['Worker #'].field).toBe('employee_id');
    expect(by['Shift Date'].field).toBe('date');
    expect(by['Time In'].field).toBe('clock_in');
    expect(by['Lunch Out'].field).toBe('meal1_out');
    expect(by['Lunch In'].field).toBe('meal1_in');
    expect(by['Time Out'].field).toBe('clock_out');
    expect(by['Notes'].field).toBeNull();
    expect(by['Worker #'].confidence).toBeGreaterThan(0.9);
  });
  it('maps payroll abbreviations', () => {
    const s = suggestMapping('payroll', ['Emp ID', 'Period Start', 'Period End', 'Reg Hrs', 'OT Hrs', 'Meal Premium']);
    expect(s.map(x => x.field)).toEqual(['employee_id', 'period_start', 'period_end', 'reg_hours', 'ot_hours', 'premium_hours']);
  });
});

describe('end-to-end from CSV', () => {
  it('parses, normalizes, and audits uploaded files', () => {
    const emp = parseFile('e.csv', 'Employee #,Name,Hourly Rate,FLSA Status,Pay Frequency\nEMP001,Ana Ruiz,$20.00,Non-Exempt,Bi-weekly\n');
    const time = parseFile('t.csv', 'Employee #,Date,Clock In,Meal Out,Meal In,Clock Out\nEMP001,06/17/2026,8:00 AM,1:30 PM,2:00 PM,5:00 PM\nEMP999,06/17/2026,8:00 AM,12:00 PM,12:30 PM,4:30 PM\n');
    const pay = parseFile('p.csv', 'Employee #,Period Start,Period End,Pay Date,Reg Hrs,Rate,OT Hrs,OT Rate\nEMP001,6/14/2026,6/27/2026,7/2/2026,8.5,20,0,30\n');
    const map = (d: 'employees' | 'time' | 'payroll', h: string[]) => Object.fromEntries(suggestMapping(d, h).map(x => [x.column, x.field]));
    const { input, issues } = normalize('Test Co', {
      employees: { ...emp, mapping: map('employees', emp.headers) },
      time: { ...time, mapping: map('time', time.headers) },
      payroll: { ...pay, mapping: map('payroll', pay.headers) }
    });
    expect(issues).toHaveLength(0);
    expect(input.employees[0]).toMatchObject({ id: 'EMP001', hourlyRate: 20, classification: 'nonexempt', payFrequency: 'biweekly' });
    expect(input.hasMealColumns).toBe(true);
    const r = runAudit(input, { auditDate: '2026-07-15' });
    expect(r.engine.findings.some(f => f.title === 'Potential late meal period')).toBe(true);
    expect(r.quality.checks.some(c => c.level === 'critical' && /can’t be matched/.test(c.label))).toBe(true);
  });
});
