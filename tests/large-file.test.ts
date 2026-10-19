// One very large messy file: 300,000 shifts (Toast-style, title lines, combined date-times) → speed and exactness.
import { describe, expect, it } from 'vitest';
import { parseFile, normalize, type Mapping } from '@/lib/ingest/normalize';
import { suggestMapping } from '@/lib/ingest/mapping';
import { runAudit } from '@/lib/engine/audit';
describe('large single file', () => {
  it('300,000 shifts parse and normalize within budget with exact times', () => {
    const N = 300000; const lines = ['Big Chain — Time Entries', 'Date range: 01/01/2025 - 12/31/2025', '', 'Employee,Job Title,In Date,Out Date,Unpaid Break Time'];
    const ap = (m: number) => { const h = Math.floor(m / 60) % 24; return `${((h + 11) % 12) + 1}:${String(m % 60).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`; };
    for (let i = 0; i < N; i++) { const d = new Date(Date.UTC(2025, 0, 1 + (i % 360))); const ds = `${d.getUTCMonth() + 1}/${d.getUTCDate()}/25`; const start = 360 + (i % 180); lines.push(`"Worker${String(Math.floor(i / 360)).padStart(4, '0')}, Pat",Cook,${ds} ${ap(start)},${ds} ${ap(start + 480)},30`); }
    const text = lines.join('\n'); console.log(`LARGE: ${(text.length / 1e6).toFixed(1)} MB`);
    let t = Date.now(); const pf = parseFile('big.csv', text); const tp = Date.now() - t;
    const mapping: Mapping = Object.fromEntries(suggestMapping('time', pf.headers).map(s => [s.column, s.field]));
    t = Date.now(); const r = normalize('x', { time: { ...pf, mapping } }); const tn = Date.now() - t;
    console.log(`LARGE: parse ${tp} ms, normalize ${tn} ms, ${r.input.timeRecords.length.toLocaleString()} shifts`);
    expect(r.input.timeRecords.length).toBe(N);
    const s = r.input.timeRecords[12345]; const st = 360 + (12345 % 180); expect([s.clockIn, s.clockOut]).toEqual([st, (st + 480) % 1440]);
    expect(tp + tn).toBeLessThan(60000);
    t = Date.now(); const a = runAudit(r.input); const ta = Date.now() - t; console.log(`LARGE: audit ${ta} ms, ${a.engine.shifts.length.toLocaleString()} shifts, ${a.engine.employees.length} workers, ${a.engine.findings.length.toLocaleString()} findings`);
    expect(a.engine.shifts.length).toBe(N); expect(ta).toBeLessThan(90000);
  }, 180000);
});
