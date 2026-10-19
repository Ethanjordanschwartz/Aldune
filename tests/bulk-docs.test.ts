import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { extractDocument } from '@/lib/documents/browserExtract';
import { classifyDataDocument, parsePayStub, parseTimesheet, parseW2, buildTables, parseDate, maskSensitive } from '@/lib/ingest/documents';
import { normalize } from '@/lib/ingest/normalize';
import { runAudit } from '@/lib/engine/audit';

const DIR = 'tests/fixtures/bulk/';
const buf = (f: string) => { const b = readFileSync(DIR + f); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };

describe('document parsers', () => {
  it('parses dates in common formats', () => {
    expect(parseDate('Pay Date: 01/23/2026')).toBe('2026-01-23'); expect(parseDate('2026-02-01')).toBe('2026-02-01'); expect(parseDate('Jan 5, 2026')).toBe('2026-01-05'); expect(parseDate('3/7/26')).toBe('2026-03-07'); expect(parseDate('13/45/2026')).toBeNull();
  });
  it('masks SSNs and EINs', () => { expect(maskSensitive('SSN 123-45-6789 EIN 12-3456789')).toBe('SSN XXX-XX-6789 EIN XX-XXXXXXX'); });
  it('reads both pay stub layouts with § 226(a) checks', async () => {
    const a = parsePayStub(await extractDocument('a.pdf', buf('paystub_E1000_2026-01-04.pdf')));
    expect(a).toMatchObject({ employeeId: 'E1000', name: 'Maria Lopez', periodStart: '2026-01-04', periodEnd: '2026-01-17', payDate: '2026-01-22' });
    expect(a.regRate).toBeGreaterThan(16); expect(a.regHours).toBeGreaterThan(50); expect(a.gross).toBeGreaterThan(800); expect(a.ws.ws_employer_name_address).toBe(true);
    const b = parsePayStub(await extractDocument('b.pdf', buf('paystub_E1001_2026-01-04.pdf')));
    expect(b).toMatchObject({ employeeId: 'E1001', name: 'Jose Hernandez', periodStart: '2026-01-04', periodEnd: '2026-01-17' });
    expect(b.regRate).toBeGreaterThan(16); expect(b.regRate).toBeLessThan(30); expect(b.regHours).toBeGreaterThan(50);
    expect(b.ws.ws_employer_name_address).toBe(false); expect(b.missing).toContain('employer name and address'); expect(b.missing).toContain('paid sick leave available');
  });
  it('reads timesheets and W-2s', async () => {
    const t = parseTimesheet(await extractDocument('t.pdf', buf('timesheet_E1002_2026-01-04.pdf')));
    expect(t.employeeId).toBe('E1002'); expect(t.entries.length).toBe(10); expect(t.entries[0]).toMatchObject({ date: '2026-01-05', clockIn: '6:30 AM' }); expect(t.entries[0].meal1Out).toBeTruthy();
    const w = parseW2(await extractDocument('w.pdf', buf('W2_2025_E1003.pdf')));
    expect(w.name).toBe('Luis Garcia'); expect(w.year).toBe('2025'); expect(w.box1).toBeGreaterThan(30000); expect(w.ssnLast4).toMatch(/^\d{4}$/);
  });
});

describe('bulk pipeline: 260 documents → audit', () => {
  it('classifies every file, builds tables, and produces a working audit', async () => {
    const files = readdirSync(DIR).filter(f => f.endsWith('.pdf'));
    const docs: { kind: ReturnType<typeof classifyDataDocument>; data: never }[] = []; const kinds: Record<string, number> = {};
    for (const f of files) { const text = await extractDocument(f, buf(f)); const kind = classifyDataDocument(text); kinds[kind] = (kinds[kind] || 0) + 1;
      docs.push({ kind, data: (kind === 'paystub' ? parsePayStub(text) : kind === 'timesheet' ? parseTimesheet(text) : parseW2(text)) as never }); }
    expect(kinds).toEqual({ paystub: 160, timesheet: 80, w2: 20 });
    const t = buildTables(docs);
    expect(t.employees.length).toBe(20); expect(t.payroll.length).toBe(160); expect(t.time.length).toBe(80 * 10);
    const id = (rows: Record<string, unknown>[]) => { const headers = Object.keys(rows[0]); return { headers, rows: rows as Record<string, string>[], mapping: Object.fromEntries(headers.map(h => [h, h])) }; };
    const n = normalize('Valley Fresh Packing, Inc.', { employees: id(t.employees), time: id(t.time), payroll: id(t.payroll) });
    expect(n.input.timeRecords.length).toBe(800); expect(n.input.payroll.length).toBe(160);
    const r = runAudit(n.input, { auditDate: '2026-05-01' });
    const cats = new Set(r.engine.findings.map(f => f.category));
    expect(cats.has('meal')).toBe(true); expect(cats.has('wage_statement')).toBe(true);
    expect(r.engine.findings.some(f => f.category === 'wage_statement' && String(f.evidence.missingItems || '').includes('employer'))).toBe(true);
    console.log('bulk audit:', r.engine.findings.length, 'findings', [...cats].join(','), 'risk', r.risk.score);
  }, 120000);
});

describe('pay stub column order regression', () => {
  it('reads zero-hour overtime lines in both layouts without swapping rate and hours', () => {
    const a = parsePayStub('ACME, Salinas, CA 93901\nEmployee: Ann Lee Employee ID: E1\nPay Period: 01/04/2026 - 01/17/2026 Pay Date: 01/22/2026\nEarnings Rate Hours Amount\nRegular 18.25 80.00 1,460.00\nOvertime 27.38 0.00 0.00\nGross Pay 1,460.00\nNet Pay 1,200.00');
    expect([a.regRate, a.regHours, a.otRate, a.otHours]).toEqual([18.25, 80, 27.38, 0]);
    const b = parsePayStub('Name: Bo Diaz\nFile Number: E2\nPeriod Beginning: 01/04/2026\nPeriod Ending: 01/17/2026\nEarnings hours rate this period\nRegular 80.00 18.2500 1,460.00\nOvertime 0.00 27.3750 0.00\nGross Pay $1,460.00\nNet Pay $1,200.00');
    expect([b.regRate, b.regHours, b.otRate, b.otHours]).toEqual([18.25, 80, 27.375, 0]);
  });
});
