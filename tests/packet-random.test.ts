// Randomized round trip for multi-employee records packets: generate a workforce, write it as a packet in a random
// house style (header style, cell separator, 12/24-hour clock, date format, column order, meal as a range), read it
// back, and require every shift and pay stub to come back exactly. A fresh seed each run; PACKET_SEEDS=N for more.
import { describe, it, expect } from 'vitest';
import { parseRecordsPacket } from '@/lib/ingest/packet';
import { fmtTime, addDays } from '@/lib/engine/time';

function rng(seed: number) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const FIRST = ['Maria', 'James', 'Linda', 'Robert', 'Ashley', 'David', 'Jennifer', 'Carlos', 'Nguyen', 'Priya', 'Omar', 'Grace', 'Luis', 'Hannah', 'Tomas', 'Aisha'];
const LAST = ['Gonzalez', 'Carter', 'Nguyen', 'Smith', 'Brown', 'Lee', 'White', 'Ramirez', 'Patel', 'Okafor', 'Kim', 'Rossi', 'Haddad', 'Silva', 'Cohen', 'Murphy'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const pad = (n: number) => String(n).padStart(2, '0');

function makeCase(seed: number) {
  const R = rng(seed); const pick = <T,>(a: T[]) => a[Math.floor(R() * a.length)]; const int = (lo: number, hi: number) => lo + Math.floor(R() * (hi - lo + 1));
  const style = { head: pick(['num', 'name']), sep: pick(['tab', 'pipe', 'md']), clock: pick(['12', '24']), date: pick(['dowmd', 'mdy', 'iso']), cols: pick(['std', 'outfirst', 'range']) };
  if (style.cols === 'range' && style.clock === '24') style.clock = '12';
  const t = (m: number) => { const x = ((m % 1440) + 1440) % 1440; return style.clock === '12' ? fmtTime(x) : `${pad(Math.floor(x / 60))}:${pad(x % 60)}`; };
  const fmtD = (d: string) => { const [y, mo, da] = d.split('-'); const w = DOW[new Date(d + 'T00:00:00Z').getUTCDay()]; return style.date === 'iso' ? d : style.date === 'mdy' ? `${mo}/${da}/${y}` : `${w} ${mo}/${da}`; };
  const row = (cells: (string | number)[]) => (style.sep === 'tab' ? cells.join('\t') : style.sep === 'pipe' ? cells.join(' | ') : `| ${cells.join(' | ')} |`);
  // a Sunday start between 2024 and 2026 (sometimes spanning New Year)
  let start = `${pick([2024, 2025, 2026])}-${pad(int(1, 12))}-${pad(int(1, 28))}`; while (new Date(start + 'T00:00:00Z').getUTCDay() !== 0) start = addDays(start, 1);
  if (R() < 0.15) { start = `${pick([2024, 2025])}-12-21`; while (new Date(start + 'T00:00:00Z').getUTCDay() !== 0) start = addDays(start, 1); }
  const nPer = int(1, 2); const periods = Array.from({ length: nPer }, (_, k) => ({ s: addDays(start, 14 * k), e: addDays(start, 14 * k + 13) }));
  const payDate = addDays(periods[nPer - 1].e, 5);
  const fmtLong = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const out: string[] = ['SAMPLE CO. — PAYROLL RECORDS', `Employer: Sample Co., Inc. | 10 Main St, Fresno, CA 93721`, `Pay Period: ${fmtLong(periods[0].s)} - ${fmtLong(periods[nPer - 1].e)} (biweekly) | Pay Date: ${fmtLong(payDate)}`];
  const n = int(2, 9); const used = new Set<string>();
  const expectTime: Record<string, string>[] = [], expectPay: Record<string, string | number>[] = [];
  for (let k = 0; k < n; k++) {
    let name = `${pick(FIRST)} ${pick(LAST)}`; while (used.has(name)) name = `${pick(FIRST)} ${pick(LAST)}`; used.add(name);
    const id = R() < 0.5 ? `E-${1000 + k}` : String(20000 + int(0, 9999) * 10 + k);
    const rate = int(1700, 4500) / 100;
    if (style.head === 'num') out.push(`EMPLOYEE ${k + 1} — ${name}`, `Employee ID: ${id} | Classification: Non-exempt (hourly) | Hire date: 0${int(1, 9)}/1${int(0, 9)}/2020`);
    else out.push(`Employee Name: ${name} | Employee ID: ${id}`, `Classification: Non-exempt (hourly) | Hire date: 0${int(1, 9)}/1${int(0, 9)}/2020`);
    out.push(`Worksite: Fresno, CA | Base rate: $${rate.toFixed(2)}/hour`);
    for (const p of periods) {
      const reg = int(40, 80), ot = R() < 0.4 ? int(1, 12) : 0;
      out.push(`Pay Stub - Period ${p.s.slice(5, 7)}/${p.s.slice(8)}/${p.s.slice(0, 4)}-${p.e.slice(5, 7)}/${p.e.slice(8)}/${p.e.slice(0, 4)}`, row(['Earnings', 'Hours', 'Rate', 'Amount']), row(['Regular', reg.toFixed(2), `$${rate.toFixed(2)}`, `$${(reg * rate).toFixed(2)}`]));
      if (ot || R() < 0.5) out.push(row(['Overtime', ot.toFixed(2), `$${(rate * 1.5).toFixed(2)}`, `$${(ot * rate * 1.5).toFixed(2)}`]));
      out.push(row(['Gross pay', '', '', `$${(reg * rate + ot * rate * 1.5).toFixed(2)}`]));
      expectPay.push({ employee_id: id, period_start: p.s, period_end: p.e, reg_hours: reg, reg_rate: rate, ot_hours: ot });
    }
    out.push('Timesheet');
    const hdr = style.cols === 'std' ? ['Date', 'Time In', 'Meal Out', 'Meal In', 'Time Out', 'Hours'] : style.cols === 'outfirst' ? ['Date', 'In', 'Out', 'Lunch Out', 'Lunch In', 'Hours'] : ['Date', 'Start', 'Meal', 'End', 'Hours'];
    out.push(row(hdr));
    for (const p of periods) for (let d = p.s; d <= p.e; d = addDays(d, 1)) {
      const r0 = R();
      if (r0 < 0.3) continue;
      if (r0 < 0.38) { out.push(row([fmtD(d), 'OFF', '', '', ...(style.cols === 'range' ? [] : ['']), '0.00'])); continue; }
      const inn = int(5 * 60, 11 * 60), len = int(4 * 60, 13 * 60) - (int(0, 3) === 0 ? 0 : 0);
      const hasMeal = len > 300 && R() < 0.85; const mo = inn + int(180, Math.max(180, Math.min(330, len - 30))), ml = int(20, 45);
      const outM = inn + len + (hasMeal ? ml : 0);
      const e: Record<string, string> = { employee_id: id, date: d, clock_in: fmtTime(inn), clock_out: fmtTime(outM), meal1_out: hasMeal ? fmtTime(mo) : '', meal1_in: hasMeal ? fmtTime(mo + ml) : '', meal2_out: '', meal2_in: '' };
      const hrs = (len / 60).toFixed(2);
      if (style.cols === 'std') out.push(row([fmtD(d), t(inn), hasMeal ? t(mo) : 'None', hasMeal ? t(mo + ml) : 'None', t(outM), hrs]));
      else if (style.cols === 'outfirst') out.push(row([fmtD(d), t(inn), t(outM), hasMeal ? t(mo) : '', hasMeal ? t(mo + ml) : '', hrs]));
      else out.push(row([fmtD(d), t(inn), hasMeal ? `${t(mo).replace(/ (AM|PM)$/, (mo < 720) === (mo + ml < 720) ? '' : ' $1')}-${t(mo + ml)}` : 'None', t(outM), hrs]));
      expectTime.push(e);
    }
    out.push(row(['Period total', '', '', '', '', '']));
  }
  out.push('End of records.');
  return { text: out.join('\n'), style, n, expectTime, expectPay };
}

const SEEDS = Number(process.env.PACKET_SEEDS || 6);
describe('records packet — random house styles round-trip exactly', () => {
  const base = Math.floor(Math.random() * 1e6);
  for (let i = 0; i < SEEDS; i++) {
    const seed = base + i;
    it(`seed ${seed}`, () => {
      const c = makeCase(seed);
      const pk = parseRecordsPacket(c.text);
      expect(pk, `style ${JSON.stringify(c.style)}`).not.toBeNull();
      expect(pk!.employees.length).toBe(c.n);
      const got = pk!.tables.time.map(r => ({ employee_id: String(r.employee_id), date: r.date, clock_in: r.clock_in, clock_out: r.clock_out, meal1_out: r.meal1_out, meal1_in: r.meal1_in, meal2_out: r.meal2_out, meal2_in: r.meal2_in }));
      if (process.env.PACKET_DEBUG) { const k = got.findIndex((g, i) => JSON.stringify(g) !== JSON.stringify(c.expectTime[i])); if (k >= 0 || got.length !== c.expectTime.length) { const e = c.expectTime[k]; console.log('SEED', seed, JSON.stringify(c.style), 'n', got.length, c.expectTime.length, '\nGOT', JSON.stringify(got[k]), '\nEXP', JSON.stringify(e), '\nLINES', c.text.split('\n').filter(l => e && l.includes(e.date.slice(5, 7)) ).slice(0, 0).join('\n'), '\nCTX', c.text.split('\n').slice(0, 14).join('\n')); } }
      expect(got, `seed ${seed} style ${JSON.stringify(c.style)}`).toEqual(c.expectTime);
      const pay = pk!.tables.payroll.map(r => ({ employee_id: String(r.employee_id), period_start: r.period_start, period_end: r.period_end, reg_hours: r.reg_hours, reg_rate: r.reg_rate, ot_hours: r.ot_hours }));
      expect(pay, `seed ${seed} style ${JSON.stringify(c.style)}`).toEqual(c.expectPay);
    });
  }
});
