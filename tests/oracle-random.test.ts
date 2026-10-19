// Randomized differential test: fresh random workforces every run; an independent oracle (written from the statutes,
// sharing no engine code) computes daily/weekly/seventh-day overtime and meal-period violations; the engine must agree.
import { describe, expect, it } from 'vitest';
import { runAudit } from '@/lib/engine/audit';
const lcg = (seed: number) => { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32; }; };
const DAY = 864e5;
function gen(seed: number) {
  const R = lcg(seed); const ri = (a: number, b: number) => a + Math.floor(R() * (b - a + 1));
  const nEmp = ri(2, 9), start = Date.parse('2026-03-01T12:00:00Z'); // a Sunday (workweeks Sunday–Saturday)
  const employees = Array.from({ length: nEmp }, (_, i) => ({ id: `E${seed % 1000}-${i}`, name: `Worker ${i}`, classification: 'nonexempt', hourlyRate: 17 + ri(0, 1500) / 100, payFrequency: 'weekly' }));
  const time: { employeeId: string; date: string; clockIn: number; clockOut: number; meals: { out: number; in: number }[] }[] = [];
  for (const e of employees) { const allSeven = R() < 0.25; const nDays = ri(10, 21);
    for (let d = 0; d < nDays; d++) { if (!allSeven && R() < 0.2) continue; const date = new Date(start + d * DAY).toISOString().slice(0, 10);
      const ci = ri(300, 960), len = ri(180, 840); const kind = R(); const meals: { out: number; in: number }[] = [];
      if (len > 300 && kind > 0.25) { const at = ri(150, 360), ml = R() < 0.2 ? ri(15, 29) : ri(30, 45); meals.push({ out: (ci + at) % 1440, in: (ci + at + ml) % 1440 });
        if (len > 600 && R() < 0.6) { const at2 = at + ml + ri(200, 400); if (at2 + 30 < len) meals.push({ out: (ci + at2) % 1440, in: (ci + at2 + ri(20, 40)) % 1440 }); } }
      time.push({ employeeId: e.id, date, clockIn: ci, clockOut: (ci + len) % 1440, meals });
      if (R() < 0.05 && ci + len + 120 < 1440) time.push({ employeeId: e.id, date, clockIn: ci + len + 90, clockOut: ci + len + 90 + ri(60, 180), meals: [] }); // split shift
    } }
  return { employees, time };
}
// ---------------- oracle (independent) ----------------
function oracle(time: ReturnType<typeof gen>['time']) {
  const out = new Map<string, { ot: number; dt: number; codes: string[] }>(); const key = (t: { employeeId: string; date: string; clockIn: number }) => `${t.employeeId}|${t.date}|${t.clockIn}`;
  const byEmp = new Map<string, typeof time>(); for (const t of time) { if (!byEmp.has(t.employeeId)) byEmp.set(t.employeeId, []); byEmp.get(t.employeeId)!.push(t); }
  for (const list of byEmp.values()) {
    const weeks = new Map<number, typeof time>(); for (const t of list) { const day = Math.floor(Date.parse(t.date + 'T12:00:00Z') / DAY); const dow = new Date(t.date + 'T12:00:00Z').getUTCDay(); const ws = day - dow; if (!weeks.has(ws)) weeks.set(ws, []); weeks.get(ws)!.push(t); }
    for (const [ws, wk] of weeks) {
      wk.sort((a, b) => a.date === b.date ? a.clockIn - b.clockIn : a.date < b.date ? -1 : 1);
      const worked = (t: (typeof time)[number]) => { const co = t.clockOut < t.clockIn ? t.clockOut + 1440 : t.clockOut; const m = t.meals.reduce((s, x) => s + (((x.in < t.clockIn ? x.in + 1440 : x.in) - (x.out < t.clockIn ? x.out + 1440 : x.out))), 0); return co - t.clockIn - m; };
      const days = new Set(wk.filter(t => worked(t) > 0).map(t => t.date)); let weekST = 0; const today = new Map<string, number>();
      for (const t of wk) {
        const h = worked(t) / 60, prior = today.get(t.date) || 0; today.set(t.date, prior + h);
        const band = (lo: number, hi: number) => Math.max(0, Math.min(prior + h, hi) - Math.max(prior, lo));
        const isSeventh = Math.floor(Date.parse(t.date + 'T12:00:00Z') / DAY) - ws === 6 && days.size === 7;
        let st = 0, ot = 0, dt = 0;
        if (isSeventh) { ot = band(0, 8); dt = band(8, 99); } else { st = band(0, 8); ot = band(8, 12); dt = band(12, 99); }
        if (weekST + st > 40) { const x = weekST + st - 40; st -= x; ot += x; } weekST += st;
        // meal periods (Lab. Code § 512): first meal by end of 5th hour of work, 30 min; second by end of 10th hour if > 10 h
        const w = worked(t), codes: string[] = []; const ms = t.meals.map(x => ({ s: x.out < t.clockIn ? x.out + 1440 : x.out, e: x.in < t.clockIn ? x.in + 1440 : x.in })).sort((a, b) => a.s - b.s);
        if (w > 300) { if (!ms.length) codes.push('NO_MEAL_1'); else { if (ms[0].s - t.clockIn > 300) codes.push('LATE_MEAL_1'); if (ms[0].e - ms[0].s < 30) codes.push('SHORT_MEAL_1'); } }
        if (w > 600) { if (ms.length < 2) codes.push('NO_MEAL_2'); else { if (ms[1].s - t.clockIn - (ms[0].e - ms[0].s) > 600) codes.push('LATE_MEAL_2'); if (ms[1].e - ms[1].s < 30) codes.push('SHORT_MEAL_2'); } }
        out.set(key(t), { ot, dt, codes });
      }
    }
  }
  return out;
}
const SEEDS = process.env.ORACLE_SEEDS ? Array.from({ length: +process.env.ORACLE_SEEDS }, (_, i) => (Date.now() % 1e6) + i * 7919) : [11, 23, 42, 77, 101, 256, 999, 2026, 31337, 65535, (Date.now() % 1e6) | 0]; // fixed + one fresh seed per run
describe('randomized differential test (engine vs independent statute oracle)', () => {
  for (const seed of SEEDS) it(`seed ${seed}`, () => {
    const { employees, time } = gen(seed);
    const r = runAudit({ employerName: 'x', hasMealColumns: true, hasRestColumns: false, employees, timeRecords: time, payroll: [] } as never);
    const exp = oracle(time); let checked = 0; const bad: string[] = [];
    for (const s of r.engine.shifts) { const e = exp.get(`${s.employeeId}|${s.date}|${s.clockIn}`); if (!e) { bad.push(`missing oracle for ${s.employeeId} ${s.date}`); continue; } checked++;
      if (Math.abs(s.reqOT - e.ot) > 1e-6 || Math.abs(s.reqDT - e.dt) > 1e-6) bad.push(`${s.employeeId} ${s.date}: OT ${s.reqOT}/${e.ot} DT ${s.reqDT}/${e.dt}`);
      const ec = [...s.mealIssueCodes].filter(c => /MEAL/.test(c)).sort().join(','), oc = [...e.codes].sort().join(','); if (ec !== oc) bad.push(`${s.employeeId} ${s.date} ${s.clockIn}: meal ${ec} vs ${oc}`); }
    expect(checked, `seed ${seed}`).toBe(time.length); expect(bad.slice(0, 5), `seed ${seed}`).toEqual([]);
  });
});

describe('randomized money checks (overtime paid correctly vs at straight time)', () => {
  for (const seed of (process.env.ORACLE_SEEDS ? SEEDS : SEEDS.slice(0, 8))) it(`seed ${seed}`, () => {
    const { employees, time } = gen(seed); const exp = oracle(time);
    // weekly pay periods (Sunday–Saturday) built from the ORACLE’s hours
    const per = new Map<string, { e: string; a: string; b: string; st: number; ot: number; dt: number }>();
    for (const t of time) { const o = exp.get(`${t.employeeId}|${t.date}|${t.clockIn}`)!; const d = new Date(t.date + 'T12:00:00Z'); const ws = new Date(d.getTime() - d.getUTCDay() * DAY).toISOString().slice(0, 10); const we = new Date(Date.parse(ws + 'T12:00:00Z') + 6 * DAY).toISOString().slice(0, 10);
      const k = `${t.employeeId}|${ws}`; const p = per.get(k) || { e: t.employeeId, a: ws, b: we, st: 0, ot: 0, dt: 0 };
      const co = t.clockOut < t.clockIn ? t.clockOut + 1440 : t.clockOut; const w = (co - t.clockIn - t.meals.reduce((s, x) => s + (((x.in < t.clockIn ? x.in + 1440 : x.in) - (x.out < t.clockIn ? x.out + 1440 : x.out))), 0)) / 60;
      p.st += w - o.ot - o.dt; p.ot += o.ot; p.dt += o.dt; per.set(k, p); }
    const rate = new Map(employees.map(e => [e.id, e.hourlyRate]));
    const mk = (straight: boolean) => [...per.values()].map(p => ({ employeeId: p.e, periodStart: p.a, periodEnd: p.b, payDate: p.b, regHours: straight ? p.st + p.ot + p.dt : p.st, regRate: rate.get(p.e), otHours: straight ? 0 : p.ot, otRate: rate.get(p.e)! * 1.5, dtHours: straight ? 0 : p.dt, dtRate: rate.get(p.e)! * 2, shiftDiffPay: 0, commission: 0, bonus: 0 }));
    const recon = (pay: ReturnType<typeof mk>) => runAudit({ employerName: 'x', hasMealColumns: true, hasRestColumns: false, employees, timeRecords: time, payroll: pay } as never).engine.findings.filter(f => f.ruleId === 'CA-OT-RECON');
    // A) payroll pays exactly what the law requires → nothing owed
    expect(recon(mk(false)).reduce((t, f) => t + f.amount, 0), `seed ${seed} exact payroll`).toBeLessThan(0.01);
    // B) every hour paid at straight time → owed exactly 0.5× rate per OT hour + 1.0× rate per DT hour (periods over $0.50)
    const expected = [...per.values()].map(p => 0.5 * p.ot * rate.get(p.e)! + 1.0 * p.dt * rate.get(p.e)!).filter(x => x > 0.5).reduce((a, b) => a + b, 0);
    const got = recon(mk(true)).reduce((t, f) => t + f.amount, 0);
    expect(Math.abs(got - expected), `seed ${seed}: engine ${got.toFixed(2)} vs oracle ${expected.toFixed(2)}`).toBeLessThan(0.05);
  });
});

describe('randomized: rest table, daily premium caps, minimum wage, split shifts', () => {
  it('rest periods required follow the Wage Order table at every minute 0–1000', async () => {
    const { restRequired } = await import('@/lib/engine/engine');
    for (let w = 0; w <= 1000; w++) { const h = w / 60; const table = h < 3.5 ? 0 : h <= 6 ? 1 : h <= 10 ? 2 : h <= 14 ? 3 : 4; expect(restRequired(w), `${w} min`).toBe(table); }
  });
  for (const seed of (process.env.ORACLE_SEEDS ? SEEDS : SEEDS.slice(0, 6))) it(`seed ${seed}: premiums (≤1 meal + ≤1 rest per workday), minimum wage, split shifts`, () => {
    const R = lcg(seed * 7 + 3); const ri = (a: number, b: number) => a + Math.floor(R() * (b - a + 1));
    const employees = Array.from({ length: ri(2, 6) }, (_, i) => ({ id: `M${seed % 997}-${i}`, name: `W${i}`, classification: 'nonexempt', hourlyRate: R() < 0.3 ? 15 + ri(0, 150) / 100 : 17 + ri(0, 800) / 100, payFrequency: 'weekly' }));
    const time: { employeeId: string; date: string; clockIn: number; clockOut: number; meals: { out: number; in: number }[]; restBreaksTaken: number }[] = [];
    for (const e of employees) for (let d = 0; d < 14; d++) { if (R() < 0.25) continue; const date = new Date(Date.parse('2026-03-01T12:00:00Z') + d * DAY).toISOString().slice(0, 10);
      if (R() < 0.15) { // split day: two long segments, each may lack a meal
        const a = ri(300, 420), l1 = ri(320, 400), gap = ri(61, 150), l2 = ri(320, 400); time.push({ employeeId: e.id, date, clockIn: a, clockOut: a + l1, meals: [], restBreaksTaken: ri(0, 2) }, { employeeId: e.id, date, clockIn: a + l1 + gap, clockOut: (a + l1 + gap + l2) % 1440, meals: [], restBreaksTaken: ri(0, 2) });
      } else { const ci = ri(360, 720), len = ri(200, 600); const meals = len > 300 && R() < 0.6 ? [{ out: ci + 200, in: ci + 230 }] : []; time.push({ employeeId: e.id, date, clockIn: ci, clockOut: ci + len, meals, restBreaksTaken: ri(0, 3) }); } }
    // weekly payroll paying exactly the required hours at the employee’s rate (so only premiums / MW / split remain)
    const exp = oracle(time.map(t => ({ ...t })) as never); const per = new Map<string, { e: string; a: string; b: string; st: number; ot: number; dt: number }>();
    for (const t of time) { const o = exp.get(`${t.employeeId}|${t.date}|${t.clockIn}`)!; const d = new Date(t.date + 'T12:00:00Z'); const ws = new Date(d.getTime() - d.getUTCDay() * DAY).toISOString().slice(0, 10); const k = `${t.employeeId}|${ws}`;
      const p = per.get(k) || { e: t.employeeId, a: ws, b: new Date(Date.parse(ws + 'T12:00:00Z') + 6 * DAY).toISOString().slice(0, 10), st: 0, ot: 0, dt: 0 }; const co = t.clockOut < t.clockIn ? t.clockOut + 1440 : t.clockOut; const w = (co - t.clockIn - t.meals.reduce((s, x) => s + (x.in - x.out), 0)) / 60; p.st += w - o.ot - o.dt; p.ot += o.ot; p.dt += o.dt; per.set(k, p); }
    const rate = new Map(employees.map(e => [e.id, e.hourlyRate]));
    const payroll = [...per.values()].map(p => ({ employeeId: p.e, periodStart: p.a, periodEnd: p.b, payDate: p.b, regHours: p.st, regRate: rate.get(p.e), otHours: p.ot, otRate: rate.get(p.e)! * 1.5, dtHours: p.dt, dtRate: rate.get(p.e)! * 2, shiftDiffPay: 0, commission: 0, bonus: 0 }));
    const res = runAudit({ employerName: 'x', hasMealColumns: true, hasRestColumns: true, employees, timeRecords: time, payroll } as never);
    const sum = (rule: string, kind?: string) => res.engine.findings.filter(f => f.ruleId === rule && (!kind || f.amountKind === kind)).reduce((t, f) => t + f.amount, 0);
    // --- oracle: premiums — one hour at the rate for each workday with ANY meal issue, and one for ANY rest issue (Lab. Code § 226.7(c))
    const MW = 16.9; // California 2026
    let mealExp = 0, restExp = 0, splitExp = 0; const days = new Map<string, typeof time>(); for (const t of time) { const k = `${t.employeeId}|${t.date}`; if (!days.has(k)) days.set(k, []); days.get(k)!.push(t); }
    for (const [k, list] of days) { const id = k.split('|')[0], r = rate.get(id)!;
      const mealIssue = list.some(t => exp.get(`${t.employeeId}|${t.date}|${t.clockIn}`)!.codes.length > 0);
      const restIssue = list.some(t => { const co = t.clockOut < t.clockIn ? t.clockOut + 1440 : t.clockOut; const w = co - t.clockIn - t.meals.reduce((s, x) => s + (x.in - x.out), 0); const h = w / 60; const req = h < 3.5 ? 0 : h <= 6 ? 1 : h <= 10 ? 2 : h <= 14 ? 3 : 4; return t.restBreaksTaken < req; });
      // premium = one hour at the regular rate of compensation, which can never be below the minimum wage
      if (mealIssue) mealExp += Math.max(r, MW); if (restIssue) restExp += Math.max(r, MW);
      if (list.length > 1) { const s = [...list].sort((a, b) => a.clockIn - b.clockIn); let gap = 0; for (let i = 1; i < s.length; i++) gap = Math.max(gap, s[i].clockIn - s[i - 1].clockOut); if (gap > 60) { const hrs = s.reduce((t, x) => t + ((x.clockOut < x.clockIn ? x.clockOut + 1440 : x.clockOut) - x.clockIn - x.meals.reduce((q, m) => q + (m.in - m.out), 0)), 0) / 60; splitExp += Math.max(0, Math.round((MW * (hrs + 1) - r * hrs) * 100) / 100); } } }
    let mwExp = 0, liqExp = 0; for (const p of payroll) if (p.regRate! < MW - 0.001) { const g = MW - p.regRate!; mwExp += g * p.regHours + g * 1.5 * p.otHours + g * 2 * p.dtHours; liqExp += g * p.regHours; }
    const close = (a: number, b: number, label: string) => expect(Math.abs(a - b), `seed ${seed} ${label}: engine ${a.toFixed(2)} vs oracle ${b.toFixed(2)}`).toBeLessThan(0.05);
    close(sum('CA-MEAL'), mealExp, 'meal premiums'); close(sum('CA-REST'), restExp, 'rest premiums'); close(sum('CA-SPLIT'), splitExp, 'split-shift premiums');
    close(sum('CA-MINWAGE', 'wages'), mwExp, 'minimum-wage shortfall'); close(sum('CA-MINWAGE', 'liquidated'), liqExp, 'liquidated damages');
  });
});

describe('randomized penalties: wage statements (§ 226(e)) and waiting time (§ 203)', () => {
  for (const seed of (process.env.ORACLE_SEEDS ? SEEDS : SEEDS.slice(0, 6))) it(`seed ${seed}`, () => {
    const R = lcg(seed * 13 + 5); const ri = (a: number, b: number) => a + Math.floor(R() * (b - a + 1));
    const auditDate = '2026-09-30'; const types = ['discharge', 'quit_with_notice', 'quit_no_notice'] as const;
    const employees = Array.from({ length: ri(3, 10) }, (_, i) => { const term = R() < 0.6; const t = types[ri(0, 2)]; const td = new Date(Date.parse('2026-06-01T12:00:00Z') + ri(0, 60) * DAY).toISOString().slice(0, 10);
      return { id: `P${seed % 991}-${i}`, name: `W${i}`, classification: 'nonexempt', hourlyRate: 17 + ri(0, 1000) / 100, payFrequency: 'weekly', ...(term ? { terminationDate: td, separationType: t, finalPayDate: new Date(Date.parse(td + 'T12:00:00Z') + ri(0, 45) * DAY).toISOString().slice(0, 10) } : {}) }; });
    const payroll: Record<string, unknown>[] = []; const time: Record<string, unknown>[] = [];
    for (const e of employees) { const weeks = ri(40, 70);
      for (let w = 0; w < weeks; w++) { const a = new Date(Date.parse('2025-06-01T12:00:00Z') + w * 7 * DAY).toISOString().slice(0, 10), b = new Date(Date.parse(a + 'T12:00:00Z') + 6 * DAY).toISOString().slice(0, 10);
        payroll.push({ employeeId: e.id, periodStart: a, periodEnd: b, payDate: b, regHours: 40, regRate: e.hourlyRate, otHours: 0, dtHours: 0, shiftDiffPay: 0, commission: 0, bonus: 0, wageStatement: { gross: true, hours: R() < 0.15, rates: true, employeeId: true } }); }
      for (let d = 0; d < 5; d++) time.push({ employeeId: e.id, date: new Date(Date.parse('2026-05-04T12:00:00Z') + d * DAY).toISOString().slice(0, 10), clockIn: 480, clockOut: 480 + ri(360, 600), meals: [{ out: 720, in: 750 }] }); }
    const r = runAudit({ employerName: 'x', hasMealColumns: true, hasRestColumns: false, employees, timeRecords: time, payroll } as never, { auditDate, derivative203: false, derivative226: false });
    // ---- oracle § 226(e)
    let wsExp = 0; const wsBy = new Map<string, number>();
    for (const e of employees) { const viol = payroll.filter(p => p.employeeId === e.id && (p.wageStatement as Record<string, boolean>).hours === false && (Date.parse(auditDate) - Date.parse(String(p.payDate))) / DAY <= 365).length;
      const pen = viol === 0 ? 0 : Math.min(4000, 50 + 100 * (viol - 1)); wsBy.set(e.id, pen); wsExp += pen; }
    const wsGot = r.engine.findings.filter(f => f.ruleId === 'CA-WS-226').reduce((t, f) => t + f.amount, 0);
    expect(Math.abs(wsGot - wsExp), `seed ${seed} § 226(e): engine ${wsGot} vs oracle ${wsExp}`).toBeLessThan(0.01);
    for (const ee of r.engine.employees) expect(ee.exposure.penalties - (r.engine.findings.filter(f => f.employeeId === ee.employee.id && f.ruleId === 'CA-FINALPAY').reduce((t, f) => t + f.amount, 0)), `seed ${seed} cap for ${ee.employee.id}`).toBeLessThanOrEqual(4000.001);
    // ---- oracle § 203: daily wage (rate × usual daily hours, max 12) × days late (max 30); due on discharge / last day with notice / 72 h after a quit without notice
    let wtExp = 0;
    for (const e of employees as { id: string; hourlyRate: number; terminationDate?: string; separationType?: string; finalPayDate?: string }[]) { if (!e.terminationDate) continue;
      const due = e.separationType === 'quit_no_notice' ? new Date(Date.parse(e.terminationDate + 'T12:00:00Z') + 3 * DAY).toISOString().slice(0, 10) : e.terminationDate;
      const late = Math.min(30, Math.max(0, Math.round((Date.parse(e.finalPayDate!) - Date.parse(due)) / DAY)));
      const sh = time.filter(t => t.employeeId === e.id) as { clockIn: number; clockOut: number; meals: { out: number; in: number }[] }[]; const avgH = sh.reduce((t, x) => t + (x.clockOut - x.clockIn - x.meals.reduce((q, m) => q + m.in - m.out, 0)), 0) / 60 / sh.length;
      wtExp += Math.round(e.hourlyRate * Math.min(avgH, 12) * 100) / 100 * late; }
    const wtGot = r.engine.findings.filter(f => f.ruleId === 'CA-FINALPAY').reduce((t, f) => t + f.amount, 0);
    expect(Math.abs(wtGot - wtExp), `seed ${seed} § 203: engine ${wtGot.toFixed(2)} vs oracle ${wtExp.toFixed(2)}`).toBeLessThan(0.05);
  });
});

describe('randomized PAGA units: one per aggrieved employee per PAY PERIOD (not per day)', () => {
  for (const seed of (process.env.ORACLE_SEEDS ? SEEDS : SEEDS.slice(0, 6))) it(`seed ${seed}`, () => {
    const R = lcg(seed * 17 + 9); const ri = (a: number, b: number) => a + Math.floor(R() * (b - a + 1));
    const auditDate = '2026-04-30'; const employees = Array.from({ length: ri(2, 7) }, (_, i) => ({ id: `G${seed % 983}-${i}`, name: `W${i}`, classification: 'nonexempt', hourlyRate: 17 + ri(0, 600) / 100, payFrequency: 'biweekly' }));
    const time: Record<string, unknown>[] = []; const payroll: Record<string, unknown>[] = [];
    for (const e of employees) { for (let w = 0; w < 6; w++) { const a = new Date(Date.parse('2026-03-01T12:00:00Z') + w * 14 * DAY).toISOString().slice(0, 10); payroll.push({ employeeId: e.id, periodStart: a, periodEnd: new Date(Date.parse(a + 'T12:00:00Z') + 13 * DAY).toISOString().slice(0, 10), payDate: new Date(Date.parse(a + 'T12:00:00Z') + 18 * DAY).toISOString().slice(0, 10), regHours: 0, regRate: e.hourlyRate, otHours: 0, dtHours: 0, shiftDiffPay: 0, commission: 0, bonus: 0 }); }
      for (let d = 0; d < 56; d++) { if (R() < 0.35) continue; const date = new Date(Date.parse('2026-03-01T12:00:00Z') + d * DAY).toISOString().slice(0, 10);
        if (R() < 0.3) { time.push({ employeeId: e.id, date, clockIn: 420, clockOut: 660, meals: [] }, { employeeId: e.id, date, clockIn: 780, clockOut: 1020, meals: [] }); }
        else { const len = ri(240, 480); time.push({ employeeId: e.id, date, clockIn: 480, clockOut: 480 + len, meals: len > 300 && R() < 0.5 ? [] : len > 300 ? [{ out: 660, in: 690 }] : [] }); } } }
    for (const p of payroll) { const hrs = (time as { employeeId: string; date: string; clockIn: number; clockOut: number; meals: { out: number; in: number }[] }[]).filter(t => t.employeeId === p.employeeId && t.date >= String(p.periodStart) && t.date <= String(p.periodEnd)).reduce((s, t) => s + (t.clockOut - t.clockIn - t.meals.reduce((q, m) => q + m.in - m.out, 0)) / 60, 0); p.regHours = Math.round(hrs * 100) / 100; }
    const r = runAudit({ employerName: 'x', hasMealColumns: true, hasRestColumns: false, employees, timeRecords: time, payroll } as never, { auditDate });
    const per = (id: string, d: string) => (payroll.find(p => p.employeeId === id && d >= String(p.periodStart) && d <= String(p.periodEnd)) || {}).periodStart;
    const units = new Set<string>(); const stacked = new Map<string, Set<string>>();
    for (const f of r.engine.findings) { if (f.confidence === 'low' || f.premiumIndicated || f.category === 'data') continue; const d = f.date || f.periodEnd; if (!d) continue; const k = `${f.employeeId}|${per(f.employeeId, d) || f.periodStart || d}`; units.add(k); if (!stacked.has(k)) stacked.set(k, new Set()); stacked.get(k)!.add(f.category); }
    const pen = r.engine.meta.assumptions.pagaPenalty; const sumStacked = [...stacked.values()].reduce((t, s) => t + s.size, 0);
    expect(r.paga.employeePayPeriods, `seed ${seed}: pay-period units`).toBe(units.size);
    expect(r.paga.perPeriodLow, `seed ${seed}: unstacked $`).toBeCloseTo(units.size * pen, 2);
    expect(r.paga.stackedHigh, `seed ${seed}: stacked $`).toBeCloseTo(sumStacked * pen, 2);
  });
});

describe('pay period from frequency when no payroll exists', () => {
  it('weekly → Sunday start; semimonthly → 1st/16th; monthly → 1st; biweekly → fixed 14-day blocks', async () => {
    const { periodFor } = await import('@/lib/engine/exposure');
    expect(periodFor('2026-03-04', 'weekly')).toBe('2026-03-01'); expect(periodFor('2026-03-07', 'weekly')).toBe('2026-03-01'); expect(periodFor('2026-03-08', 'weekly')).toBe('2026-03-08');
    expect(periodFor('2026-03-15', 'semimonthly')).toBe('2026-03-01'); expect(periodFor('2026-03-16', 'semimonthly')).toBe('2026-03-16'); expect(periodFor('2026-03-31', 'monthly')).toBe('2026-03-01');
    const b = (d: string) => periodFor(d, 'biweekly'); const start = b('2026-03-01');
    for (let k = 0; k < 14; k++) expect(b(new Date(Date.parse(start + 'T12:00:00Z') + k * 864e5).toISOString().slice(0, 10))).toBe(start);
    expect(b(new Date(Date.parse(start + 'T12:00:00Z') + 14 * 864e5).toISOString().slice(0, 10))).not.toBe(start);
  });
});

describe('randomized reporting-time pay (Wage Order § 5(A))', () => {
  for (const seed of (process.env.ORACLE_SEEDS ? SEEDS : SEEDS.slice(0, 6))) it(`seed ${seed}`, () => {
    const R = lcg(seed * 19 + 1); const ri = (a: number, b: number) => a + Math.floor(R() * (b - a + 1));
    const employees = Array.from({ length: ri(2, 6) }, (_, i) => ({ id: `T${seed % 977}-${i}`, name: `W${i}`, classification: 'nonexempt', hourlyRate: 17 + ri(0, 800) / 100, payFrequency: 'weekly' }));
    const time: { employeeId: string; date: string; clockIn: number; clockOut: number; meals: never[]; scheduledMin?: number }[] = [];
    for (const e of employees) for (let d = 0; d < 20; d++) { const date = new Date(Date.parse('2026-03-01T12:00:00Z') + d * DAY).toISOString().slice(0, 10); const sched = R() < 0.7 ? ri(180, 600) : undefined; const worked = ri(45, 290);
      time.push({ employeeId: e.id, date, clockIn: 600, clockOut: 600 + worked, meals: [], ...(sched ? { scheduledMin: sched } : {}) }); }
    const r = runAudit({ employerName: 'x', hasMealColumns: true, hasRestColumns: false, employees, timeRecords: time, payroll: [] } as never);
    const rate = new Map(employees.map(e => [e.id, e.hourlyRate])); let exp = 0;
    for (const t of time) { if (!t.scheduledMin) continue; const w = t.clockOut - t.clockIn; if (w * 2 >= t.scheduledMin) continue; const hrs = Math.min(4, Math.max(2, t.scheduledMin / 120)); exp += Math.round(Math.max(0, hrs - w / 60) * rate.get(t.employeeId)! * 100) / 100; }
    const got = r.engine.findings.filter(f => f.ruleId === 'CA-REPORT').reduce((s, f) => s + f.amount, 0);
    expect(Math.abs(got - exp), `seed ${seed}: engine ${got.toFixed(2)} vs oracle ${exp.toFixed(2)}`).toBeLessThan(0.05);
  });
});

describe('randomized expense reimbursement (Lab. Code § 2802)', () => {
  for (const seed of (process.env.ORACLE_SEEDS ? SEEDS : SEEDS.slice(0, 6))) it(`seed ${seed}`, () => {
    const R = lcg(seed * 23 + 7); const ri = (a: number, b: number) => a + Math.floor(R() * (b - a + 1));
    const wStart = '2026-01-04', wEnd = '2026-06-27'; // window set by the data (Sunday–Saturday)
    const employees = Array.from({ length: ri(3, 9) }, (_, i) => { const hire = R() < 0.4 ? new Date(Date.parse('2026-02-01T12:00:00Z') + ri(0, 90) * DAY).toISOString().slice(0, 10) : '2024-05-01'; const term = R() < 0.3 ? new Date(Date.parse('2026-04-01T12:00:00Z') + ri(0, 60) * DAY).toISOString().slice(0, 10) : undefined;
      return { id: `X${seed % 971}-${i}`, name: `W${i}`, classification: R() < 0.15 ? 'contractor' : 'nonexempt', hourlyRate: 20, payFrequency: 'weekly', hireDate: hire, ...(term ? { terminationDate: term, finalPayDate: term } : {}), usesPersonalPhone: R() < 0.6, phoneReimbursed: R() < 0.3 }; });
    const time = [{ employeeId: employees[0].id, date: wStart, clockIn: 480, clockOut: 720, meals: [] }, { employeeId: employees[0].id, date: wEnd, clockIn: 480, clockOut: 720, meals: [] }];
    const payroll: Record<string, unknown>[] = []; for (const e of employees) for (let w = 0; w < 6; w++) { const a = new Date(Date.parse(wStart + 'T12:00:00Z') + w * 7 * DAY).toISOString().slice(0, 10); payroll.push({ employeeId: e.id, periodStart: a, periodEnd: new Date(Date.parse(a + 'T12:00:00Z') + 6 * DAY).toISOString().slice(0, 10), payDate: new Date(Date.parse(a + 'T12:00:00Z') + 6 * DAY).toISOString().slice(0, 10), regHours: 0, otHours: 0, dtHours: 0, shiftDiffPay: 0, commission: 0, bonus: 0, expensesIncurred: ri(0, 3) ? ri(0, 20000) / 100 : undefined, expensesReimbursed: R() < 0.5 ? ri(0, 20000) / 100 : undefined }); }
    const r = runAudit({ employerName: 'x', hasMealColumns: false, hasRestColumns: false, employees, timeRecords: time, payroll } as never, { auditDate: '2026-07-01' });
    const monthly = r.engine.meta.assumptions.phoneMonthly;
    for (const e of employees as { id: string; classification: string; hireDate: string; terminationDate?: string; usesPersonalPhone: boolean; phoneReimbursed: boolean }[]) {
      // ---- oracle: (1) every period’s unreimbursed balance over $0.50; (2) phone estimate only for employed weeks inside the window
      let exp = 0; for (const p of payroll.filter(x => x.employeeId === e.id)) { const u = Number(p.expensesIncurred || 0) - Number(p.expensesReimbursed || 0); if (u > 0.5) exp += u; }
      if (e.usesPersonalPhone && !e.phoneReimbursed && e.classification !== 'contractor') { const a = e.hireDate > wStart ? e.hireDate : wStart, b = e.terminationDate && e.terminationDate < wEnd ? e.terminationDate : wEnd; const weeks = Math.max(0, (Date.parse(b) - Date.parse(a)) / DAY + 1) / 7; exp += monthly * weeks / 4.33; }
      const got = r.engine.findings.filter(f => f.employeeId === e.id && f.ruleId === 'CA-EXPENSE').reduce((s, f) => s + f.amount, 0);
      expect(Math.abs(got - exp), `seed ${seed} ${e.id} (hire ${e.hireDate}, term ${e.terminationDate || '—'}): engine ${got.toFixed(2)} vs oracle ${exp.toFixed(2)}`).toBeLessThan(0.05);
    }
  });
});
