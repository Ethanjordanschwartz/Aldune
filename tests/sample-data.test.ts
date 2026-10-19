import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseFile, normalize } from '@/lib/ingest/normalize';
import { suggestMapping } from '@/lib/ingest/mapping';
import { runAudit } from '@/lib/engine/audit';
it('sample CSVs map automatically and audit', () => {
  const load = (f: string, ds: 'employees' | 'time' | 'payroll') => { const p = parseFile(f, readFileSync(`sample-data/${f}`, 'utf8')); const s = suggestMapping(ds, p.headers); return { ...p, mapping: Object.fromEntries(s.map(x => [x.column, x.field])), s }; };
  const e = load('employees.csv', 'employees'), t = load('time_punches.csv', 'time'), p = load('payroll_register.csv', 'payroll');
  console.log([...e.s, ...t.s, ...p.s].map(x => `${x.column}→${x.field}`).join(' | '));
  const n = normalize('Sample', { employees: e, time: t, payroll: p });
  const r = runAudit(n.input, { auditDate: '2025-12-15' });
  expect(r.engine.findings.length).toBeGreaterThan(50); expect(n.issues.length).toBe(0);
});
