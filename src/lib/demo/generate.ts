import { allocateOvertime, analyzeShift } from '../engine/engine';
import { addDays, round2, weekday } from '../engine/time';
import type { AuditInput, Employee, PayrollRecord, TimeRecord } from '../engine/types';

// Fictional company with intentional anomalies. Deterministic: the same seed always produces the same data.
export const DEMO_COMPANY = 'Pacific Coast Fresh, Inc.';

function rng(seed: number) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }

const FIRST = ['Maria', 'Jose', 'Ana', 'Luis', 'Carmen', 'David', 'Rosa', 'Miguel', 'Sofia', 'Daniel', 'Elena', 'Jorge', 'Lucia', 'Carlos', 'Isabel', 'Juan', 'Patricia', 'Ricardo', 'Gabriela', 'Fernando', 'Laura', 'Andres', 'Veronica', 'Hector', 'Teresa', 'Alejandro', 'Diana', 'Oscar', 'Monica', 'Raul', 'Emily', 'James', 'Sarah', 'Michael', 'Jessica', 'Kevin', 'Ashley', 'Brian', 'Nicole', 'Tyler'];
const LAST = ['Garcia', 'Hernandez', 'Lopez', 'Martinez', 'Gonzalez', 'Rodriguez', 'Perez', 'Sanchez', 'Ramirez', 'Torres', 'Flores', 'Rivera', 'Gomez', 'Diaz', 'Reyes', 'Morales', 'Cruz', 'Ortiz', 'Gutierrez', 'Chavez', 'Ramos', 'Ruiz', 'Alvarez', 'Mendoza', 'Castillo', 'Jimenez', 'Moreno', 'Romero', 'Herrera', 'Medina', 'Nguyen', 'Kim', 'Smith', 'Johnson', 'Brown', 'Lee', 'Wilson', 'Anderson', 'Thomas', 'Clark'];
const DEPTS = [
  { name: 'Packing', titles: ['Packer', 'Sorter', 'Line lead'], rate: [17.4, 21], share: 0.38, len: 8.5, sat: 0.35 },
  { name: 'Warehouse', titles: ['Forklift operator', 'Loader', 'Shipping clerk'], rate: [19, 24], share: 0.22, len: 10, sat: 0.3 },
  { name: 'Sanitation', titles: ['Sanitation tech'], rate: [18, 20], share: 0.1, len: 8.5, sat: 0.2, night: true },
  { name: 'Transport', titles: ['Delivery driver'], rate: [22, 26], share: 0.1, len: 10.5, sat: 0.15, phone: true },
  { name: 'Retail', titles: ['Store associate', 'Cashier'], rate: [17.4, 19], share: 0.14, len: 7.5, sat: 0.4 },
  { name: 'Maintenance', titles: ['Maintenance tech', 'Mechanic'], rate: [26, 34], share: 0.06, len: 9, sat: 0.2 }
];
const LOCATIONS = ['Santa Maria', 'Oxnard', 'Salinas'];
const SUPS: Record<string, string[]> = { 'Santa Maria': ['A. Nguyen', 'B. Castillo'], Oxnard: ['R. Delgado', 'M. Ortiz'], Salinas: ['J. Romero', 'K. Lee'] };

export interface DemoOptions { employees?: number; months?: number; start?: string; seed?: number }

export function generateDemo(opts: DemoOptions = {}): AuditInput & { auditDate: string } {
  const N = opts.employees ?? 300, months = opts.months ?? 12, seed = opts.seed ?? 20261005;
  const R = rng(seed);
  const pick = <T,>(a: T[]) => a[Math.floor(R() * a.length)];
  const start = opts.start ?? '2025-09-28'; // Sunday
  const days = Math.round(months * 30.44);
  const end = addDays(start, days - 1);
  const auditDate = addDays(end, 9);

  const employees: (Employee & { _d: (typeof DEPTS)[number]; _p: Record<string, number> })[] = [];
  for (let i = 0; i < N; i++) {
    let x = R(), d = DEPTS[0];
    for (const dd of DEPTS) { if (x < dd.share) { d = dd; break; } x -= dd.share; }
    const loc = LOCATIONS[i % 3];
    const rate = round2(d.rate[0] + R() * (d.rate[1] - d.rate[0]));
    const term = R() < 0.12 ? addDays(start, 60 + Math.floor(R() * (days - 90))) : undefined;
    const sep = term ? pick(['discharge', 'quit_with_notice', 'quit_no_notice'] as const) : undefined;
    employees.push({
      id: `PCF-${String(1001 + i)}`, name: `${pick(FIRST)} ${pick(LAST)}`, jobTitle: pick(d.titles), department: d.name, location: loc,
      classification: 'nonexempt', hourlyRate: i % 97 === 5 ? 16.5 : rate, payFrequency: 'biweekly', hireDate: addDays(start, -Math.floor(R() * 2000)),
      terminationDate: term, separationType: sep,
      finalPayDate: term ? addDays(term, sep === 'quit_no_notice' ? (R() < 0.5 ? 3 : 9) : R() < 0.7 ? 0 : 6) : undefined,
      usesPersonalPhone: d.phone || undefined, phoneReimbursed: d.phone ? R() < 0.3 : undefined,
      arbitration: R() < 0.45, supervisor: SUPS[loc][i % 2],
      _d: d,
      _p: { lateMeal: SUPS[loc][i % 2] === 'R. Delgado' ? 0.42 : loc === 'Oxnard' ? 0.08 : 0.06 * R(), satRest: loc === 'Salinas' ? 0.55 : 0, shortMeal: 0.04 * R(), missRest: loc === 'Salinas' ? 0.06 : 0.03, offClock: d.night ? 0.25 : 0.0, secondMeal: d.len >= 10 ? 0.15 : 0, waiver2: d.name === 'Warehouse' && R() < 0.6 ? 1 : 0, attest: loc === 'Santa Maria' ? 1 : 0, noRestData: loc === 'Oxnard' ? 1 : 0 }
    });
  }
  // exempt and contractor workers
  employees.push(
    { id: 'PCF-9001', name: 'Patricia Reyes', jobTitle: 'Shift supervisor', department: 'Packing', location: 'Oxnard', classification: 'exempt', annualSalary: 64000, exemptDutiesPct: 40, payFrequency: 'biweekly', _d: { ...DEPTS[0], len: 10.5 }, _p: { lateMeal: 0.5, missRest: 0.6, attest: 0, noRestData: 0 } },
    { id: 'PCF-9002', name: 'Robert Chen', jobTitle: 'Operations manager', department: 'Operations', location: 'Santa Maria', classification: 'exempt', annualSalary: 112000, exemptDutiesPct: 80, payFrequency: 'biweekly', _d: DEPTS[0], _p: {} },
    { id: 'PCF-9003', name: 'Tony Alvarez', jobTitle: 'Equipment mechanic (contract)', department: 'Maintenance', location: 'Salinas', classification: 'contractor', hourlyRate: 35, abc: { a: true, b: false, c: false }, payFrequency: 'biweekly', _d: { ...DEPTS[5], len: 10 }, _p: { missRest: 0.6, attest: 0, noRestData: 0 } }
  );

  const timeRecords: TimeRecord[] = [];
  const t = (h: number) => Math.round(h * 60);
  for (const e of employees) {
    if (e.id === 'PCF-9002') continue;
    const d = e._d, p = e._p;
    for (let i = 0; i < days; i++) {
      const date = addDays(start, i); const wd = weekday(date);
      if (e.terminationDate && date > e.terminationDate) break;
      if (wd === 0 || (wd === 6 && R() > (d.sat || 0))) continue;
      if (R() < 0.04) continue; // absences
      const jitter = () => Math.floor(R() * 9) - 4;
      const ci = (d.night ? t(22) : t(6) + (d.name === 'Retail' ? t(3) : 0)) + jitter();
      const len = t(d.len + (R() < 0.15 ? 1 : 0)) + jitter();
      let mealAt = t(4.5) + jitter(), mealLen = 30;
      if (R() < (p.lateMeal || 0)) mealAt = t(5.15 + R() * 0.9);
      if (R() < (p.shortMeal || 0)) mealLen = 18 + Math.floor(R() * 9);
      const meals = [{ out: ci + mealAt, in: ci + mealAt + mealLen }];
      if (len > 600 && !(p.waiver2 && len <= 720) && R() > (p.secondMeal ?? 0.5)) meals.push({ out: ci + mealLen + t(9.4), in: ci + mealLen + t(9.4) + 30 });
      const mealTotal = meals.reduce((s, m) => s + m.in - m.out, 0);
      const worked = len; const co = ci + worked + mealTotal;
      const req = worked < 210 ? 0 : Math.floor(worked / 240) + (worked % 240 > 120 ? 1 : 0);
      const missedRest = R() < (wd === 6 && p.satRest ? p.satRest : (p.missRest || 0));
      const rec: TimeRecord = { employeeId: e.id, date, clockIn: ci % 1440, clockOut: co % 1440, meals: meals.map(m => ({ out: m.out % 1440, in: m.in % 1440 })), mealWaiver2: !!p.waiver2, location: e.location, department: e.department };
      if (p.attest) {
        rec.attestation = { mealProvided: !(R() < 0.03), restProvided: !missedRest, offClockWork: R() < (p.offClock || 0) * 0.5, method: 'kiosk' };
        if (rec.attestation.offClockWork) rec.attestation.offClockMinutes = 10 + Math.floor(R() * 20);
        rec.restBreaksTaken = null;
      } else if (p.noRestData) rec.restBreaksTaken = null;
      else { rec.restBreaksTaken = missedRest ? Math.max(0, req - 1) : req; rec.shortestRestMinutes = R() < 0.03 ? 7 : 10; }
      timeRecords.push(rec);
    }
  }

  // Payroll: emulate a typical system — correct daily OT allocation, base-rate OT, partial premiums, some edits.
  const payroll: PayrollRecord[] = [];
  const periods: { s: string; e: string; pay: string }[] = [];
  for (let s = start, k = 0; s <= end; s = addDays(s, 14), k++) periods.push({ s, e: addDays(s, 13), pay: addDays(s, k === 10 ? 23 : 19) }); // one late payroll (holiday week)
  const byEmp = new Map<string, TimeRecord[]>(); timeRecords.forEach(r => { if (!byEmp.has(r.employeeId)) byEmp.set(r.employeeId, []); byEmp.get(r.employeeId)!.push(r); });
  for (const e of employees) {
    if (e.classification === 'contractor') continue;
    const shifts = (byEmp.get(e.id) || []).map(r => analyzeShift(r, true)!).filter(Boolean);
    allocateOvertime(shifts, { industry: 'general', workweekStart: 0 });
    const premRate = e._d.name === 'Packing' || e.location === 'Salinas' ? 0.2 : 0.6;
    for (const P of periods) {
      if (e.terminationDate && P.s > e.terminationDate) break;
      const ps = shifts.filter(s => s.date >= P.s && s.date <= P.e);
      const rate = e.hourlyRate || 0;
      const row: PayrollRecord = { employeeId: e.id, periodStart: P.s, periodEnd: P.e, payDate: P.pay, regHours: 0, regRate: rate || undefined, otHours: 0, otRate: rate ? round2(rate * 1.5) : undefined, dtHours: 0, dtRate: rate ? round2(rate * 2) : undefined, premiumHours: 0, premiumRate: rate || undefined, shiftDiffPay: 0, commission: 0, bonus: 0, wageStatement: { gross: true, hours: e.classification !== 'exempt', rates: true, deductions: true, net: true, periodDates: true, employeeId: true, employerNameAddress: e.location !== 'Salinas', sickLeave: e.location !== 'Salinas' } };
      if (e.classification === 'exempt') { row.grossPay = round2((e.annualSalary || 0) / 26); payroll.push(row); continue; }
      let st = ps.reduce((a, s) => a + s.reqST, 0); const ot = ps.reduce((a, s) => a + s.reqOT, 0), dt = ps.reduce((a, s) => a + s.reqDT, 0);
      if (e._d.night && R() < 0.5) st -= 0.5 + Math.floor(R() * 3) * 0.25; // pre-shift time trimmed
      row.regHours = round2(Math.max(0, st)); row.otHours = round2(ot); row.dtHours = round2(dt);
      if (e._d.night) row.shiftDiffPay = round2(1.5 * ps.reduce((a, s) => a + s.workedMin / 60, 0));
      if (e._d.name === 'Warehouse' && R() < 0.5) { row.bonus = 150; row.bonusType = 'production'; }
      if (e._d.name === 'Maintenance' && R() < 0.3) { row.bonus = 400; row.bonusType = 'flat'; }
      const owed = ps.reduce((a, s) => a + (s.mealIssueCodes.length ? 1 : 0) + (s.restIssueCodes.length ? 1 : 0), 0);
      row.premiumHours = Math.floor(owed * premRate);
      if (e._d.phone) { row.expensesIncurred = round2(80 + R() * 60); row.expensesReimbursed = R() < 0.7 ? row.expensesIncurred : 0; }
      row.grossPay = round2(row.regHours * rate + row.otHours * (row.otRate || 0) + row.dtHours * (row.dtRate || 0) + (row.premiumHours || 0) * rate + row.shiftDiffPay + row.bonus);
      payroll.push(row);
    }
  }
  timeRecords.forEach((t, i) => { t.sourceRow = i + 2; }); payroll.forEach((p, i) => { p.sourceRow = i + 2; });
  // sex from the first name (no random draw, so every other number in the demo stays the same) — powers the pay-equity demo
  const FEMALE = new Set(['Maria', 'Ana', 'Carmen', 'Rosa', 'Sofia', 'Elena', 'Lucia', 'Isabel', 'Patricia', 'Gabriela', 'Laura', 'Veronica', 'Teresa', 'Diana', 'Monica', 'Emily', 'Sarah', 'Jessica', 'Ashley', 'Nicole']);
  const clean = employees.map(({ _d, _p, ...rest }) => ({ ...rest, sex: rest.classification === 'contractor' ? undefined : FEMALE.has(String(rest.name).split(' ')[0]) ? 'F' : 'M' }) as Employee);
  return { employerName: DEMO_COMPANY, employees: clean, timeRecords, payroll, hasMealColumns: true, hasRestColumns: true, auditDate };
}
