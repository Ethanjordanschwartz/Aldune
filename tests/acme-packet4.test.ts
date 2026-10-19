// Known-answer test: Acme set 4 — 50 employees, full daily punches (24-hour times, meal and second-meal columns, a
// "Rest breaks taken X of Y" log, and short row notes such as "paid 7.75h", "badge +10m pre-shift", "30m auto-deducted
// (worked through)"), but NO pay stubs. Figures the punches and stated rates prove match the key to the cent.
//
// Documented, deliberate differences from the key:
//  • Overtime: the key assumes hours were "paid at straight time"; with no payroll that can't be known, so overtime the
//    punches require is listed at low confidence (amounts equal the key's) and the scorecard marks overtime NOT tested.
//  • Jasmine: premiums $110 match; the auto-deducted 30 minutes she worked are also unpaid time (past 8 hours → 1.5×): +$82.50.
//  • Pablo: the 6 unpaid minutes a day fall past 8 hours, so they are owed at 1.5× ($31.50; the key prices straight time, $21).
//  • Marcus: the document doesn't say premiums were paid, so the late meals are owed in full at the regular rate including his
//    weekly bonus ($22/hour × 10 = $220; the key assumes premiums were paid at base and prices only the $22.20 difference).
//  • Carla: 5.5-hour shifts with no meal and no waiver on file are meal violations (key omits, $126). Every one of her seven days is
//    6 hours or less, so no seventh-day note (Lock-In Addendum § 7 / § 556 — the same rule that clears Jack; the key prices $72).
//  • Gina: an 11-hour day with no second meal and no waiver on file (key omits, $25). Her 11th-hour overtime matches ($12.50, low).
//  • Tomas: one meal premium per workday (Lab. Code § 226.7(c)) — the key charges two; his 8 badge minutes a day fall past 12
//    hours, so they are owed at double time ($26.67; the key prices straight time, $13.33).
//  • Sergio: split-shift premium measured against the state minimum the Wage Order sets ($16.10; the key uses the LA rate).
//  • Employees with only a classification line and no facts in this document (piece rate, expenses, tip pool, final pay,
//    vacation, duties, commission agreement, wage statements, pay timing, reporting time) can't be computed from it.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { extractDocument } from '@/lib/documents/browserExtract';
import { parseRecordsPacket } from '@/lib/ingest/packet';
import { normalize } from '@/lib/ingest/normalize';
import { runAudit } from '@/lib/engine/audit';
import { scorecard } from '@/lib/engine/scorecard';

const id = (rows: Record<string, unknown>[]) => { const headers = [...new Set(rows.flatMap(r => Object.keys(r)))]; return { headers, rows: rows as Record<string, string>[], mapping: Object.fromEntries(headers.map(h => [h, h])) }; };
let cache: Awaited<ReturnType<typeof build>> | null = null;
async function build() {
  const b = readFileSync('tests/fixtures/acme/acme_packet4.docx'); const pk = parseRecordsPacket(await extractDocument('a.docx', b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)))!;
  const n = normalize(pk.employer!, { employees: id(pk.tables.employees), time: id(pk.tables.time), payroll: id(pk.tables.payroll) });
  const r = runAudit(n.input, { auditDate: '2026-10-07' }, n.issues);
  const nm = new Map(n.input.employees.map(e => [e.id, e.name]));
  const F = (name: string) => r.engine.findings.filter(f => nm.get(f.employeeId) === name);
  const owed = (name: string) => Math.round(F(name).filter(f => f.confidence !== 'low' && f.amountKind !== 'liquidated').reduce((t, f) => t + f.amount, 0) * 100) / 100;
  const rule = (name: string, ruleId: string, low = false) => Math.round(F(name).filter(f => f.ruleId === ruleId && f.amountKind !== 'liquidated' && (low ? f.confidence === 'low' : f.confidence !== 'low')).reduce((t, f) => t + f.amount, 0) * 100) / 100;
  return { pk, n, r, F, owed, rule };
}
const run = async () => (cache ||= await build());

describe('Acme set 4 — full punches, no pay stubs (50 employees)', () => {
  it('reads every employee and every shift, including rest logs and row notes', async () => {
    const { pk, n } = await run();
    expect(pk.employees.length).toBe(50); expect(pk.tables.payroll.length).toBe(0);
    expect(pk.tables.time.length).toBe(208); // 207 punched days; Sergio's 4-hour break makes his day two work periods
    expect(n.input.hasMealColumns).toBe(true); expect(n.input.hasRestColumns).toBe(true);
    const t = (emp: string) => n.input.timeRecords.filter(x => x.employeeId === emp);
    expect(t('N-GEORGE-LIN').every(x => x.restBreaksTaken === 1)).toBe(true);
    expect(t('N-NOAH-REED').every(x => x.paidMin === 465)).toBe(true);
    expect(t('N-QUINN-BARNES').every(x => x.clockIn !== null && x.badgeIn === x.clockIn - 10)).toBe(true);
    expect(t('N-JASMINE-WONG').every(x => x.mealAutoDeductMin === 30 && !x.meals.length)).toBe(true);
    expect(t('N-GRACE-KIM').every(x => x.onDutyMealAgreement)).toBe(true);
    const e = (k: string) => n.input.employees.find(x => x.id === k)!;
    expect(e('N-DAVID-PARK')).toMatchObject({ hourlyRate: 20, shiftDiffRate: 2, weeklyBonus: 120, bonusExcludedFromRR: true });
    expect(e('N-ELENA-RUIZ')).toMatchObject({ hourlyRate: 18, weeklyFlatBonus: 200 });
    expect(e('N-VICTOR-ALVAREZ')).toMatchObject({ hourlyRate: 14.5, tipCreditClaimed: true });
    expect(e('N-NINA-PATEL')).toMatchObject({ hourlyRate: 18, secondRate: 24 });
    expect(e('N-HASSAN-ALI').mealWaiver2OnFile).toBe(true);
    expect(e('N-XAVIER-REED').separationType).toBe('discharge'); expect(e('N-YARA-COSTA').separationType).toBe('quit_no_notice'); expect(e('N-ZANE-MILLER').separationType).toBe('quit_with_notice');
    expect(e('N-DIEGO-SANTOS').annualSalary).toBe(72000);
  });
  it('matches the key to the cent where the punches and stated rates prove it', async () => {
    const { owed, rule } = await run();
    expect(rule('George Lin', 'CA-MEAL')).toBe(120); expect(rule('George Lin', 'CA-REST')).toBe(120);
    expect(owed('Hana Suzuki')).toBe(95); expect(owed('Ivan Petrov')).toBe(84); expect(owed('Kevin Brown')).toBe(69);
    expect(rule('Jasmine Wong', 'CA-MEAL')).toBe(110);
    expect(rule('Kevin Osei', 'CA-MEAL')).toBe(100); expect(rule('Kevin Osei', 'CA-REST')).toBe(100);
    expect(rule('Ben Osei', 'CA-MEAL')).toBe(19);
    expect(owed('Noah Reed')).toBe(50); expect(owed('Quinn Barnes')).toBe(31.67);
    expect(rule('David Park', 'CA-REGRATE')).toBe(13.33);
    expect(owed('Nadia Haddad')).toBe(120); expect(owed('Farah Khan')).toBe(49.6); expect(owed('Victor Alvarez')).toBe(269.6);
    expect(rule('Sergio Diaz', 'CA-MINWAGE')).toBe(6.96);
    expect(rule('Tomas Rivera', 'CA-REST')).toBe(100);
  });
  it('overtime from punches without payroll is low confidence — the amounts equal the key’s straight-time assumption', async () => {
    const { rule, r, n } = await run();
    const ot = (name: string) => rule(name, 'CA-OT-UNVERIFIED', true);
    expect(ot('Ana Torres')).toBe(152); expect(ot('Omar Farouk')).toBe(162); expect(ot('Henry Adams')).toBe(240); expect(ot('Kevin Osei')).toBe(125); expect(ot('Tomas Rivera')).toBe(216.67); expect(ot('Gina Lopez')).toBe(12.5);
    const sc = scorecard(n.input, r); const otArea = sc.areas.find(a => a.key === 'overtime')!;
    expect(otArea.coverage!).toBeLessThan(60); expect(otArea.explanation).toMatch(/payroll/);
    // every worker with punches is tested for meals and rest; workers with no time records are listed as not tested
    const withTime = new Set(n.input.timeRecords.map(t => t.employeeId)); const meal = sc.areas.find(a => a.key === 'meal')!, rest = sc.areas.find(a => a.key === 'rest')!;
    expect(meal.testedWorkers).toBeGreaterThanOrEqual([...withTime].length - 1); expect(rest.testedWorkers).toBeGreaterThanOrEqual([...withTime].length - 1);
    expect(meal.explanation).toMatch(/Not tested for \d+ of/);
  });
  it('documented differences are computed the way the notes at the top say', async () => {
    const { owed, rule } = await run();
    expect(owed('Jasmine Wong')).toBe(192.5); expect(owed('Pablo Ortiz')).toBe(31.5); expect(owed('Marcus Webb')).toBe(220);
    expect(owed('Carla Diaz')).toBe(126); expect(rule('Carla Diaz', 'CA-OT-UNVERIFIED', true)).toBe(0); // every day ≤ 6 h: no seventh-day note (Lock-In Addendum § 7; Lab. Code § 556)
    expect(owed('Gina Lopez')).toBe(25); expect(owed('Tomas Rivera')).toBe(226.67); expect(rule('Sergio Diaz', 'CA-SPLIT')).toBe(16.1);
  });
  it('flags nothing (beyond low-confidence notes) for the clean controls and near-miss traps', async () => {
    const { F } = await run();
    for (const name of ['Olivia Grant', 'Jack Nolan', 'Tara Oyelaran', 'Grace Kim', 'Hassan Ali', 'Rebecca Stone', 'Tina Alvarez', 'Umar Siddiqui', 'Chen Wu', 'Frank Hughes'])
      expect(F(name).filter(f => f.confidence !== 'low' && (f.amount > 0 || ['CA-CLASS', 'CA-AWS'].includes(f.ruleId))).map(f => `${name}: ${f.ruleId}`)).toEqual([]);
  });
  it('the PDF-style plain-text version of the same packet reads the same records', async () => {
    const { pk } = await run();
    const b = readFileSync('tests/fixtures/acme/acme_packet4.docx'); const t = await extractDocument('a.docx', b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
    const piped = parseRecordsPacket(t.split('\n').map(l => (l.includes('\t') ? `| ${l.split('\t').join(' | ')} |` : l)).join('\n'))!;
    expect(piped.tables.time.length).toBe(pk.tables.time.length);
    expect(piped.tables.time.filter(x => x.paid_hours).length).toBe(pk.tables.time.filter(x => x.paid_hours).length);
    expect(piped.tables.time.filter(x => x.rest_breaks_taken !== undefined).length).toBe(pk.tables.time.filter(x => x.rest_breaks_taken !== undefined).length);
  });
});
