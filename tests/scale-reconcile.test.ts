import { describe, expect, it } from 'vitest';
import { generateDemo } from '@/lib/demo/generate';
import { runAudit } from '@/lib/engine/audit';
import { assessQuality } from '@/lib/engine/quality';
import { analyzePatterns } from '@/lib/engine/detective';
import { confidenceFor, ledgerFor } from '@/lib/engine/ledger';
import { buildSummary } from '@/lib/store/types';
import type { AuditInput } from '@/lib/engine/types';

/** Make a clean dataset messy: duplicates, overlaps, missing punches, bad rates, orphan rows, gaps. */
function messify(d: AuditInput, seed = 7): AuditInput {
  let s = seed; const R = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const t = d.timeRecords.slice(); const add = [] as typeof t;
  for (let i = 0; i < t.length; i += 37) { if (R() < 0.3) add.push({ ...t[i] }); }                                 // duplicates
  for (let i = 5; i < t.length; i += 53) { add.push({ ...t[i], clockIn: (t[i].clockIn ?? 0) + 120, meals: [] }); } // overlaps
  for (let i = 9; i < t.length; i += 61) t[i] = { ...t[i], clockOut: null };                                     // missing punches
  for (let i = 3; i < t.length; i += 97) t[i] = { ...t[i], meals: [{ out: t[i].meals[0]?.out ?? 600, in: null }] }; // half meal punch
  add.push({ ...t[0], employeeId: 'GHOST-1' });                                                                   // orphan
  const p = d.payroll.filter((_, i) => i % 41 !== 0).map((x, i) => (i % 29 === 0 ? { ...x, regRate: undefined } : x)); // gaps + missing rates
  return { ...d, timeRecords: [...t, ...add], payroll: p, employees: [...d.employees, d.employees[0]] };           // duplicate employee
}

describe('synthetic companies at scale, clean and messy', () => {
  const sizes: [number, number][] = [[50, 12], [500, 12], [5000, 2], [50000, 0.25]];
  for (const [n, months] of sizes) {
    it(`${n.toLocaleString()} employees × ${months} months: clean and messy run, reconcile, and stay fast`, () => {
      const t0 = Date.now(); const d = generateDemo({ employees: n, months, seed: n }); const tGen = Date.now() - t0;
      const t1 = Date.now(); const r = runAudit(d, { auditDate: d.auditDate }); const tAudit = Date.now() - t1;
      const m = messify(d); const t2 = Date.now(); const rm = runAudit(m, { auditDate: d.auditDate }); const q = assessQuality(m); const tMessy = Date.now() - t2;
      const t3 = Date.now(); analyzePatterns(d, r.engine); const tDet = Date.now() - t3;
      console.log(`${n} emp: shifts ${d.timeRecords.length.toLocaleString()}, findings ${r.engine.findings.length.toLocaleString()} | gen ${tGen}ms audit ${tAudit}ms messy+quality ${tMessy}ms detective ${tDet}ms | messy score ${q.score} (${q.confidence}), issues ${q.issues.map(i => i.code).join(',')}`);
      // Reconciliation: dashboard base exposure == sum of worker totals == sum of category bases + interest
      const empTotal = r.engine.employees.reduce((t, e) => t + e.exposure.total, 0);
      const catTotal = r.categories.reduce((t, c) => t + c.base, 0) + r.exposure.interest;
      expect(Math.abs(empTotal - r.exposure.base)).toBeLessThan(1);
      expect(Math.abs(catTotal - r.exposure.base)).toBeLessThan(1);
      // Summary (report source) matches engine counts
      const sm = buildSummary('x', 'x', false, d, r); expect(sm.counts.findings).toBe(r.engine.findings.length); expect(Math.round(sm.exposure.base)).toBe(Math.round(r.exposure.base));
      // Every finding has a ledger, a confidence trio, and (where record-based) source rows
      for (const f of r.engine.findings.slice(0, 2000)) { expect(ledgerFor(f, r.engine.meta.assumptions).formula.length).toBeGreaterThan(5); expect(confidenceFor(f).overall).toMatch(/High|Medium|Low/); if (f.date && (f.category === 'meal' || f.category === 'rest')) expect(String(f.evidence.sourceRecords)).toMatch(/time row \d+/); }
      // Messy data is detected, not silently absorbed
      if (n >= 500) for (const code of ['DUP_PUNCH', 'OVERLAP', 'MISSING_PUNCH', 'UNMATCHED_TIME', 'DUP_EMP', 'MEAL_INCOMPLETE']) expect(q.issues.map(i => i.code)).toContain(code);
      expect(rm.engine.findings.length).toBeGreaterThan(0);
      expect(tAudit).toBeLessThan(n >= 50000 ? 120000 : 30000);
    }, 300000);
  }
});
