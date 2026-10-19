// Known-answer test: Acme set 5 ("grandmaster") — 75 employees across retail, fast food, hospitality, public works,
// agriculture, and remote work; punches for 31 of them, no pay stubs. Asserts both the AMOUNT and the STATE of each
// finding (Lock-In Addendum § 1): VIOLATION = provable from the records; POTENTIAL = the condition is on the record but an
// input needed to price or prove it is missing; SUPPRESSED = present but defeated by a waiver, agreement, or stated defense.
//
// Documented differences from the key (each explained in the finding text):
//  • Overtime, weighted rates, bonuses, and commissions: no pay stubs, so they are POTENTIAL ("payment not verified"); the
//    overtime amounts the punches imply equal the key's (Ana 152, Omar 162, Henry 240, Tomas 216.67, Sofia 200, Kevin O. 125).
//  • Mei Chen: San Francisco's minimum was $19.18 from July 1, 2025 (the record "assumes" $18.67): $98.40, not $57.60.
//  • Sergio split shift: one hour at the state minimum the Wage Order sets ($16.10; the key uses the LA rate, $17.87).
//  • Jasmine (+ unpaid auto-deducted time), Pablo (OT rate on lost minutes), Tomas (one meal premium per day), Gina (second
//    meal owed — the reconciliation agrees), Carla (7-day run straddles workweeks → POTENTIAL) as in set 4.
//  • Conditions stated without numbers (travel, screening, comp time, commissions, quarterly bonus, tip pool, piece rate,
//    expenses, separations, vacation, joint employment, reporting time, wage statements, late payday, minor hours, heat
//    recovery, commissioned-exemption prongs) are POTENTIAL with the missing input named — never priced from assumptions.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { extractDocument } from '@/lib/documents/browserExtract';
import { parseRecordsPacket } from '@/lib/ingest/packet';
import { normalize } from '@/lib/ingest/normalize';
import { runAudit } from '@/lib/engine/audit';
import { analyzeShift } from '@/lib/engine/engine';
import { minWageFor } from '@/lib/engine/time';
import type { TimeRecord } from '@/lib/engine/types';

const id = (rows: Record<string, unknown>[]) => { const headers = [...new Set(rows.flatMap(r => Object.keys(r)))]; return { headers, rows: rows as Record<string, string>[], mapping: Object.fromEntries(headers.map(h => [h, h])) }; };
let cache: Awaited<ReturnType<typeof build>> | null = null;
async function build() {
  const b = readFileSync('tests/fixtures/acme/acme_packet5.docx'); const pk = parseRecordsPacket(await extractDocument('a.docx', b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)))!;
  const n = normalize(pk.employer!, { employees: id(pk.tables.employees), time: id(pk.tables.time), payroll: id(pk.tables.payroll) });
  const r = runAudit(n.input, { auditDate: '2026-10-07' }, n.issues);
  const nm = new Map(n.input.employees.map(e => [e.id, e.name]));
  const F = (name: string) => r.engine.findings.filter(f => nm.get(f.employeeId) === name);
  const owed = (name: string) => Math.round(F(name).filter(f => f.state === 'VIOLATION' && f.amountKind !== 'liquidated').reduce((t, f) => t + f.amount, 0) * 100) / 100;
  const rule = (name: string, ruleId: string, state = 'VIOLATION') => Math.round(F(name).filter(f => f.ruleId === ruleId && f.state === state && f.amountKind !== 'liquidated').reduce((t, f) => t + f.amount, 0) * 100) / 100;
  return { pk, n, r, F, owed, rule };
}
const run = async () => (cache ||= await build());

describe('Acme set 5 — 75 employees, finding states and amounts', () => {
  it('reads all 75 employees and every punched day', async () => {
    const { pk } = await run(); expect(pk.employees.length).toBe(75); expect(pk.tables.time.length).toBe(220); expect(pk.tables.payroll.length).toBe(0);
  });
  it('every finding carries a state; owed-now counts VIOLATION only', async () => {
    const { r } = await run();
    expect(r.engine.findings.every(f => ['VIOLATION', 'POTENTIAL', 'SUPPRESSED'].includes(f.state!))).toBe(true);
    expect(r.engine.findings.filter(f => f.state === 'SUPPRESSED').every(f => f.amount === 0 && f.suppressedBy)).toBe(true);
    expect(r.engine.findings.filter(f => f.state === 'POTENTIAL' && f.ruleId === 'CA-STATED').every(f => f.amount === 0 && f.missingInput)).toBe(true);
  });
  it('matches the key to the cent where the records prove it', async () => {
    const { owed, rule } = await run();
    expect(rule('George Lin', 'CA-MEAL')).toBe(120); expect(rule('George Lin', 'CA-REST')).toBe(120);
    expect(owed('Hana Suzuki')).toBe(95); expect(owed('Ivan Petrov')).toBe(84); expect(owed('Kevin Brown')).toBe(69);
    expect(rule('Jasmine Wong', 'CA-MEAL')).toBe(110); expect(rule('Kevin Osei', 'CA-MEAL')).toBe(100); expect(rule('Kevin Osei', 'CA-REST')).toBe(100);
    expect(rule('Ben Osei', 'CA-MEAL')).toBe(19); expect(owed('Noah Reed')).toBe(50); expect(owed('Quinn Barnes')).toBe(31.67);
    expect(rule('Sofia Marquez', 'CA-MEAL')).toBe(200);
    expect(owed('Nadia Haddad')).toBe(120); expect(owed('Farah Khan')).toBe(49.6); expect(owed('Jose Marin')).toBe(120); expect(owed('Leon Bishop')).toBe(560); expect(owed('Victor Alvarez')).toBe(269.6);
    expect(rule('Sergio Diaz', 'CA-MINWAGE')).toBe(6.96);
  });
  it('a prevailing wage is not a minimum wage: no liquidated damages paired with it', async () => {
    const { F } = await run();
    expect(F('Leon Bishop').some(f => f.amountKind === 'liquidated')).toBe(false);
    expect(F('Leon Bishop').find(f => f.ruleId === 'CA-MINWAGE')!.authorities.join(' ')).toMatch(/1771/);
    for (const n of ['Nadia Haddad', 'Farah Khan', 'Jose Marin', 'Victor Alvarez']) expect(F(n).some(f => f.amountKind === 'liquidated' && f.amount > 0)).toBe(true);
  });
  it('overtime from punches without pay stubs is POTENTIAL, with the key’s amounts', async () => {
    const { rule } = await run(); const P = (n: string) => rule(n, 'CA-OT-UNVERIFIED', 'POTENTIAL');
    expect([P('Ana Torres'), P('Omar Farouk'), P('Henry Adams'), P('Tomas Rivera'), P('Sofia Marquez'), P('Kevin Osei'), P('Ben Osei')]).toEqual([152, 162, 240, 216.67, 200, 125, 76]);
  });
  it('conditions stated without numbers are POTENTIAL and name what is missing', async () => {
    const { F } = await run();
    const st = (n: string) => F(n).filter(f => f.ruleId === 'CA-STATED' && f.state === 'POTENTIAL').map(f => f.category);
    expect(st('Ravi Shah')).toContain('timekeeping'); expect(st('Dana Cole')).toContain('timekeeping'); expect(st('Pedro Ramos')).toContain('overtime');
    expect(st('Priscilla Gomez')).toContain('regular_rate'); expect(st('Owen Clarke')).toContain('regular_rate'); expect(st('Marcus Webb')).toContain('regular_rate');
    expect(st('David Park')).toContain('regular_rate'); expect(st('Elena Ruiz')).toContain('regular_rate'); expect(st('Nina Patel')).toContain('regular_rate');
    expect(st('Wendy Zhao')).toContain('tips'); expect(st('Quentin Lee')).toContain('piece_rate'); expect(st('Priya Nair')).toContain('expenses'); expect(st('Grace Lee')).toContain('expenses');
    expect(st('Xavier Reed')).toContain('final_pay'); expect(st('Zane Miller')).toContain('final_pay'); expect(st('Ingrid Vogel')).toContain('overtime');
    expect(st('Rita Mendez')).toContain('reporting_time'); expect(st('Cora Blake')).toContain('reporting_time'); expect(st('Liam Walsh')).toContain('wage_statement'); expect(st('Nora Pace')).toContain('wage_statement');
    expect(st('Mia Flores')).toContain('pay_timing'); expect(st('Tyler Ng')).toContain('recordkeeping'); expect(st('Hector Ruiz')).toContain('rest'); expect(st('Sam Carter')).toContain('classification');
    expect(F('Ravi Shah').find(f => f.ruleId === 'CA-STATED')!.missingInput).toMatch(/minutes of travel/);
  });
  it('exemption failures stated in the records are flagged', async () => {
    const { F } = await run();
    for (const n of ['Aisha Bello', 'Blake Turner', 'Diego Santos', 'Emma Fisher']) expect(F(n).some(f => f.ruleId === 'CA-CLASS' && f.state === 'VIOLATION')).toBe(true);
    expect(F('Isla Reyes').some(f => f.ruleId === 'CA-DAYREST')).toBe(true);
  });
  it('near-miss traps and clean controls: no VIOLATION; waivers, agreements, and stated defenses show as SUPPRESSED', async () => {
    const { F } = await run();
    for (const n of ['Olivia Grant', 'Jack Nolan', 'Tara Oyelaran', 'Grace Kim', 'Hassan Ali', 'Rebecca Stone', 'Derek Hunt', 'Alice Monroe', 'Victor Hughes', 'Nadia Cole', 'Omar Reyes', 'Chen Wu', 'Frank Hughes', 'Dawn Porter', 'Evan Blackwell', 'Grace Liu', 'Noah Kim', 'Sara Holt', 'Tina Alvarez', 'Umar Siddiqui'])
      expect(F(n).filter(f => f.state === 'VIOLATION').map(f => `${n}: ${f.ruleId} ${f.title}`)).toEqual([]);
    for (const n of ['Grace Kim', 'Hassan Ali', 'Alice Monroe', 'Victor Hughes', 'Nadia Cole', 'Omar Reyes', 'Dawn Porter']) expect(F(n).some(f => f.state === 'SUPPRESSED')).toBe(true);
    expect(F('Jack Nolan').length).toBe(0);
  });
  it('documented differences', async () => {
    const { owed, rule } = await run();
    expect(owed('Mei Chen')).toBe(98.4); expect(rule('Sergio Diaz', 'CA-SPLIT')).toBe(16.1); expect(owed('Gina Lopez')).toBe(25); expect(owed('Jasmine Wong')).toBe(192.5); expect(owed('Pablo Ortiz')).toBe(31.5); expect(owed('Tomas Rivera')).toBe(226.67);
  });
});

describe('Lock-in edge cases (minute boundaries, offsets, exceptions, rate floors)', () => {
  const rec = (inn: number, out: number, meals: [number, number][], extra: Partial<TimeRecord> = {}): TimeRecord => ({ employeeId: 'E', date: '2026-06-01', clockIn: inn, clockOut: out, meals: meals.map(([o, i]) => ({ out: o, in: i })), ...extra } as TimeRecord);
  it('first meal starting exactly at the end of the 5th hour is on time; one minute later is late', () => {
    expect(analyzeShift(rec(480, 1020, [[780, 810]]), true)!.mealIssueCodes).toEqual([]);
    expect(analyzeShift(rec(480, 1020, [[781, 811]]), true)!.mealIssueCodes).toEqual(['LATE_MEAL_1']);
    expect(analyzeShift(rec(480, 1020, [[770, 800]]), true)!.mealIssueCodes).toEqual([]); // 4h50m
  });
  it('a 30-minute meal is compliant; 29 minutes is short', () => {
    expect(analyzeShift(rec(480, 1020, [[720, 750]]), true)!.mealIssueCodes).toEqual([]);
    expect(analyzeShift(rec(480, 1020, [[720, 749]]), true)!.mealIssueCodes).toEqual(['SHORT_MEAL_1']);
  });
  it('a first-meal waiver covers a shift of exactly 6 hours, not 6 hours and 1 minute', () => {
    const a = analyzeShift(rec(540, 900, [], { mealWaiver1: true }), true)!; expect(a.mealIssueCodes).toEqual([]); expect(a.mealSuppressed).toEqual(['WAIVER_1']);
    expect(analyzeShift(rec(540, 901, [], { mealWaiver1: true }), true)!.mealIssueCodes).toEqual(['NO_MEAL_1']);
  });
  it('a second-meal waiver never covers a day over 12 hours', () => {
    expect(analyzeShift(rec(360, 1110, [[660, 690]], { mealWaiver2: true }), true)!.mealIssueCodes).toEqual([]); // 12h00m worked
    expect(analyzeShift(rec(360, 1111, [[660, 690]], { mealWaiver2: true }), true)!.mealIssueCodes).toEqual(['NO_MEAL_2']);
  });
  it('rate floor: the highest of state, city, industry, and a stated floor', () => {
    expect(minWageFor('2026-06-10', {}).rate).toBe(16.9);
    expect(minWageFor('2026-06-10', { industryWage: 'fast_food' }).rate).toBe(20);
    expect(minWageFor('2026-06-10', { location: 'Los Angeles' }).rate).toBe(17.87);
    expect(minWageFor('2026-06-10', { location: 'Vernon', employeeLocal: 45, employeeLocalSource: 'Prevailing wage' })).toEqual({ rate: 45, source: 'Prevailing wage' });
  });
});
