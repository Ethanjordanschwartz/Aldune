// Known-answer test #2 (third-party "complex" set): 13 employees, real violations, five near-miss traps, one clean control.
// Answer key total (statewide minimum wage except the employee stated to be within Los Angeles city limits): $2,820.50.
// Aldune reproduces every figure to the cent and raises nothing on the traps (AWS 9th/10th hours, the waived second meal,
// neutral rounding, on-time final pay, the clean control). Documented differences:
//  • Marcus Bell, Wed 06/03: 11.0 hours worked with one meal and no second-meal waiver on file → a second-meal premium
//    ($25) is owed (Lab. Code § 512(a)); the key does not count it.
//  • Victor Cruz: vested vacation not paid at separation is unpaid final wages, so a waiting-time penalty (§ 203) is shown
//    as a derivative, willfulness-dependent layer; the key treats final pay as complete because the check was on time.
//  • Worksite "Los Angeles, CA": Aldune applies the City of Los Angeles minimum wage ($17.87) by default — Daniel's
//    nonproductive time and Emily's shortfall are higher than the key's statewide figures. With locations other than the
//    stated "city limits" removed, the key's figures are reproduced exactly.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { extractDocument } from '@/lib/documents/browserExtract';
import { parseRecordsPacket } from '@/lib/ingest/packet';
import { normalize } from '@/lib/ingest/normalize';
import { runAudit } from '@/lib/engine/audit';
import { scorecard } from '@/lib/engine/scorecard';

const id = (rows: Record<string, unknown>[]) => { const headers = [...new Set(rows.flatMap(r => Object.keys(r)))]; return { headers, rows: rows as Record<string, string>[], mapping: Object.fromEntries(headers.map(h => [h, h])) }; };
async function run(statewide: boolean) {
  const b = readFileSync('tests/fixtures/acme/acme_packet2.docx'); const pk = parseRecordsPacket(await extractDocument('a.docx', b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)))!;
  const emps = pk.tables.employees.map(e => (statewide && !/city limits/i.test(String(e.location || '')) ? { ...e, location: '' } : e));
  const n = normalize(pk.employer!, { employees: id(emps), time: id(pk.tables.time), payroll: id(pk.tables.payroll) });
  const r = runAudit(n.input, { auditDate: '2026-10-07' }, n.issues);
  const sum = (emp: string, pred: (f: (typeof r.engine.findings)[number]) => boolean) => Math.round(r.engine.findings.filter(f => f.employeeId === emp && f.confidence !== 'low' && pred(f)).reduce((t, f) => t + f.amount, 0) * 100) / 100;
  const owed = (emp: string, exclude: string[] = []) => sum(emp, f => (f.amountKind === 'wages' || f.amountKind === 'premium') && !exclude.includes(f.title));
  return { pk, r, sum, owed };
}
const SECOND_MEAL = 'No second meal period recorded';

describe('Acme set 2 — complex (13 employees, traps)', () => {
  it('reads every employee and the facts the traps depend on', async () => {
    const { pk } = await run(false);
    expect(pk.employees.length).toBe(13);
    const E = (k: string) => pk.tables.employees.find(e => e.employee_id === k)!;
    expect(E('E-2002').aws_daily_hours).toBe(10);
    expect(E('E-2003')).toMatchObject({ classification: 'exempt', exemption_type: 'commissioned' });
    expect(E('E-2007')).toMatchObject({ classification: 'nonexempt', annual_salary: 52000 });
    expect(E('E-2008')).toMatchObject({ classification: 'exempt', annual_salary: 70000 }); expect(String(E('E-2008').duties_note)).toMatch(/hardware/);
    expect(E('E-2010').meal2_waiver_on_file).toBe('Y');
    expect(E('E-2012')).toMatchObject({ separation_type: 'quit_with_notice', termination_date: '2026-06-13', final_pay_date: '2026-06-13', vacation_unpaid_hours: 40 });
    const t = (k: string) => pk.tables.time.filter(x => x.employee_id === k);
    expect(t('E-2002').length).toBe(8); expect(t('E-2011').length).toBe(10); expect(t('E-2011')[0].badge_in).toBe('7:48 AM');
    expect(t('E-2013').length).toBe(3); expect(t('E-2001').length).toBe(10);
    const P = (k: string) => pk.tables.payroll.find(x => x.employee_id === k)!;
    expect(P('E-2001')).toMatchObject({ reg_hours: 80, ot_hours: 10, bonus: 300, bonus_type: 'production' });
    expect(P('E-2004')).toMatchObject({ piece_earnings: 1750, rest_recovery_hours: 6, nonproductive_hours: 4 });
    expect(P('E-2005')).toMatchObject({ tips_charged: 400, tips_paid: 388, reg_rate: 14 });
    expect(P('E-2007')).toMatchObject({ reg_hours: 80, reg_rate: 25 });
  });
  it('the PDF version reads exactly the same records', async () => {
    const ld = async (f: string) => { const b = readFileSync(f); return parseRecordsPacket(await extractDocument(f, b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)))!; };
    expect((await ld('tests/fixtures/acme/acme_packet2.pdf')).tables).toEqual((await ld('tests/fixtures/acme/acme_packet2.docx')).tables);
  });
  it('statewide figures match the answer key to the cent; traps not flagged', async () => {
    const { r, owed, sum } = await run(true);
    const key: Record<string, number> = { 'E-2001': 16.67, 'E-2002': 12.5, 'E-2003': 123.33, 'E-2004': 209.49, 'E-2005': 244, 'E-2006': 69.6, 'E-2007': 600, 'E-2008': 504.81, 'E-2009': 0, 'E-2010': 20, 'E-2011': 38, 'E-2012': 920, 'E-2013': 62.1 };
    for (const [k, v] of Object.entries(key)) expect(owed(k, [SECOND_MEAL]), k).toBe(v);
    expect(Math.round(Object.keys(key).reduce((t, k) => t + owed(k, [SECOND_MEAL]), 0) * 100) / 100).toBe(2820.5);
    expect(r.engine.findings.filter(f => f.employeeId === 'E-2009' && f.state !== 'SUPPRESSED')).toEqual([]); // clean control
    // traps
    expect(r.engine.findings.some(f => f.employeeId === 'E-2002' && f.amount > 0 && /overtime/i.test(f.title) && f.amount > 12.5)).toBe(false); // AWS hours 9–10 are straight time
    expect(r.engine.findings.some(f => f.employeeId === 'E-2010' && /second meal/i.test(f.title) && f.state !== 'SUPPRESSED')).toBe(false); // valid second-meal waiver
    expect(r.engine.findings.some(f => f.employeeId === 'E-2010' && f.state === 'SUPPRESSED' && /waiv/i.test(f.suppressedBy || ''))).toBe(true); // shown as cleared
    expect(r.engine.findings.some(f => f.employeeId === 'E-2011' && /round/i.test(f.title))).toBe(false); // neutral rounding
    expect(r.engine.findings.some(f => f.employeeId === 'E-2012' && f.ruleId === 'CA-FINALPAY' && f.evidence.daysLate && !f.evidence.derivative)).toBe(false); // final pay on time
    expect(sum('E-2005', f => f.amountKind === 'liquidated')).toBe(232); expect(sum('E-2006', f => f.amountKind === 'liquidated')).toBe(69.6);
    const flagged = new Set(r.engine.findings.filter(f => f.amount > 0 && f.confidence !== 'low').map(f => f.employeeId)); expect(flagged.size).toBe(12); expect(flagged.has('E-2009')).toBe(false);
  });
  it('documented additions: second meal on an 11-hour day without a waiver; § 203 on forfeited vacation', async () => {
    const { r } = await run(true);
    const m = r.engine.findings.find(f => f.employeeId === 'E-2002' && f.title === SECOND_MEAL)!; expect(m.date).toBe('2026-06-03'); expect(m.amount).toBe(25);
    const w = r.engine.findings.find(f => f.employeeId === 'E-2012' && f.ruleId === 'CA-FINALPAY')!; expect(w.evidence.derivative).toBe(true);
  });
  it('Los Angeles worksite by default: city minimum wage for Daniel’s nonproductive time and Emily’s shortfall', async () => {
    const { owed, sum } = await run(false);
    expect(owed('E-2004')).toBe(213.37); // 141.89 rest/recovery + 4 × $17.87
    expect(owed('E-2005')).toBe(321.6); expect(sum('E-2005', f => f.amountKind === 'liquidated')).toBe(309.6); // ($17.87 − $14) × 80 + $12 tips
    expect(owed('E-2006')).toBe(69.6); expect(owed('E-2013')).toBe(62.1); // split-shift premium uses the Wage Order (state) minimum
  });
  it('scorecard: overtime is graded a violation (not A), final pay is tested, coverage is reported', async () => {
    const { pk, r } = await run(false);
    const n = normalize(pk.employer!, { employees: id(pk.tables.employees), time: id(pk.tables.time), payroll: id(pk.tables.payroll) });
    const s = scorecard(n.input, r); const A = (k: string) => s.areas.find(a => a.key === k)!;
    expect(A('overtime').state).toBe('VIOLATION'); expect(['D', 'F']).toContain(A('overtime').grade); expect(A('overtime').amount).toBeGreaterThan(1200);
    expect(A('final_pay').tested).toBe(true); expect(A('final_pay').state).toBe('VIOLATION');
    expect(A('min_wage').state).toBe('VIOLATION'); expect(A('split').state).toBe('VIOLATION');
    expect(A('classification').state).toBe('VIOLATION');
    expect(A('rest').grade).not.toBe('A');
    for (const a of s.areas) if (a.units > 0) expect(a.grade).not.toBe('A');
    expect(s.ledger.employees).toBe(13); expect(s.ledger.withAny).toBe(13);
  });
});
