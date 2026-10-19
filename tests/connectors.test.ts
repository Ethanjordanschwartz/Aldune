import { describe, expect, it } from 'vitest';
import { mapCensus, mapPayroll } from '@/lib/connectors/finch';
import { mapAdpWorkers } from '@/lib/connectors/adp';
import { encryptToken, decryptToken } from '@/lib/connectors/types';
import { normalize } from '@/lib/ingest/normalize';

describe('Finch mapping', () => {
  const ind = [{ id: 'f1', first_name: 'Maria', last_name: 'Lopez' }, { id: 'f2', first_name: 'Jose', last_name: 'Hernandez' }];
  const emp = [{ id: 'f1', title: 'Packer', department: { name: 'Packing' }, location: { city: 'Salinas' }, flsa_status: 'non_exempt' as const, start_date: '2022-03-01', income: { unit: 'hourly', amount: 1825 } }, { id: 'f2', title: 'Supervisor', flsa_status: 'exempt' as const, income: { unit: 'yearly', amount: 8500000 } }];
  it('maps census rows with rates in dollars and FLSA status', () => {
    const c = mapCensus(ind, emp);
    expect(c[0]).toMatchObject({ employee_id: 'f1', name: 'Maria Lopez', classification: 'nonexempt', hourly_rate: 18.25, location: 'Salinas', department: 'Packing', hire_date: '2022-03-01' });
    expect(c[1]).toMatchObject({ classification: 'exempt', annual_salary: 85000 });
  });
  it('maps pay statements to payroll rows and feeds the normalizer', () => {
    const pay = [{ id: 'p1', pay_date: '2026-02-20', pay_period: { start_date: '2026-02-01', end_date: '2026-02-14' } }];
    const st = new Map([['p1', [{ individual_id: 'f1', earnings: [{ type: 'wage', amount: 146000, hours: 80 }, { type: 'overtime', amount: 10950, hours: 4 }, { type: 'other', name: 'Meal Premium', amount: 1825, hours: 1 }, { type: 'bonus', amount: 5000 }], gross_pay: { amount: 163775 } }]]]);
    const r = mapPayroll(pay, st)[0];
    expect(r).toMatchObject({ employee_id: 'f1', period_start: '2026-02-01', period_end: '2026-02-14', reg_hours: 80, reg_rate: 18.25, ot_hours: 4, ot_rate: 27.38, bonus: 50, gross: 1637.75, premium_hours: 1 });
    const id = (rows: Record<string, unknown>[]) => { const h = [...new Set(rows.flatMap(x => Object.keys(x)))]; return { headers: h, rows: rows as Record<string, string>[], mapping: Object.fromEntries(h.map(k => [k, k])) }; };
    const n = normalize('X', { employees: id(mapCensus(ind, emp)), payroll: id([r]) });
    expect(n.input.payroll[0]).toMatchObject({ employeeId: 'f1', regHours: 80, otHours: 4, regRate: 18.25 });
  });
});
describe('ADP mapping and token encryption', () => {
  it('maps ADP Workers API records', () => {
    const rows = mapAdpWorkers([{ associateOID: 'G3X', workerID: { idValue: 'E1042' }, person: { legalName: { givenName: 'Ana', familyName1: 'Ruiz' } }, workerDates: { originalHireDate: '2021-01-10' },
      workAssignments: [{ primaryIndicator: true, jobTitle: 'Sorter', homeWorkLocation: { address: { cityName: 'Oxnard' } }, baseRemuneration: { hourlyRateAmount: { amountValue: 19 } }, payCycleCode: { shortName: 'Biweekly' }, wageLawCoverage: { coverageCode: { shortName: 'Non-Exempt' } }, reportsTo: [{ reportsToWorkerName: { formattedName: 'R. Delgado' } }] }] }]);
    expect(rows[0]).toMatchObject({ employee_id: 'E1042', name: 'Ana Ruiz', classification: 'nonexempt', job_title: 'Sorter', location: 'Oxnard', hourly_rate: 19, pay_frequency: 'biweekly', supervisor: 'R. Delgado', hire_date: '2021-01-10' });
  });
  it('encrypts tokens at rest (AES-GCM round trip, tamper detected)', async () => {
    const key = Buffer.alloc(32, 7).toString('base64'); const enc = await encryptToken('secret-token', key);
    expect(enc).not.toContain('secret'); expect(await decryptToken(enc, key)).toBe('secret-token');
    const bad = enc.slice(0, -4) + 'AAAA'; await expect(decryptToken(bad, key)).rejects.toThrow();
  });
});
