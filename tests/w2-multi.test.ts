import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { extractDocument } from '@/lib/documents/browserExtract';
import { parseW2s, parseW2Table, classifyDataDocument } from '@/lib/ingest/documents';
import { parseFile } from '@/lib/ingest/normalize';
const D = 'tests/fixtures/messy/w2/'; const T = JSON.parse(readFileSync(D + 'truth.json', 'utf8'));
const check = (ws: { name?: string; box1?: number }[]) => { const ok = T.filter((p: { name: string; box1: number }) => ws.some(w => (w.name || '').toLowerCase().includes(p.name.split(' ')[1].toLowerCase()) && Math.abs((w.box1 || 0) - p.box1) < 0.01)).length; return ok; };
describe('many W-2s in one file', () => {
  it('a batch PDF (40 employees × 2 copies) yields 40 W-2s with correct Box 1', async () => {
    const b = readFileSync(D + 'w2_batch_2025.pdf'); const text = await extractDocument('w.pdf', b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
    expect(classifyDataDocument(text)).toBe('w2'); const ws = parseW2s(text); expect(ws).toHaveLength(40); expect(check(ws)).toBe(40);
  }, 60000);
  it('W-2 registers in CSV and Excel yield 40 W-2s (totals row skipped)', () => {
    for (const f of ['w2_register_2025.csv', 'w2_register_2025.xlsx']) { const b = readFileSync(D + f); const pf = parseFile(f, f.endsWith('.csv') ? b.toString('utf8') : b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); const ws = parseW2Table(pf.headers, pf.rows); expect(ws, f).toHaveLength(40); expect(check(ws), f).toBe(40); expect(ws[0].year).toBe('2025'); }
  });
});

describe('one massive W-2 document (300 employees)', () => {
  const T3 = JSON.parse(readFileSync(D + 'truth300.json', 'utf8')) as { name: string; ssn4: string; box1: number }[];
  for (const f of ['w2_irs_style_300.pdf', 'w2_register_300.pdf']) it(`${f}: 300 distinct workers with correct Box 1`, async () => {
    const { buildTables } = await import('@/lib/ingest/documents');
    const b = readFileSync(D + f); const text = await extractDocument(f, b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
    expect(classifyDataDocument(text)).toBe('w2'); const ws = parseW2s(text, f); expect(ws).toHaveLength(300);
    const ok = T3.filter(p => ws.some(w => w.ssnLast4 === p.ssn4 && Math.abs((w.box1 || 0) - p.box1) < 0.01 && (w.name || '').toLowerCase().replace(/[^a-z]/g, '') === p.name.toLowerCase().replace(/[^a-z]/g, ''))).length;
    expect(ok).toBe(300); expect(buildTables(ws.map(w => ({ kind: 'w2' as const, data: w }))).employees).toHaveLength(300);
  }, 120000);
});

describe('same name, different people', () => {
  it('two “Maria Garcia” W-2s with different SSN last-4 are two workers; a duplicate copy is not', async () => {
    const { buildTables } = await import('@/lib/ingest/documents');
    const ws = [{ name: 'Maria Garcia', ssnLast4: '1111', box1: 30000 }, { name: 'Maria Garcia', ssnLast4: '2222', box1: 41000 }, { name: 'Maria Garcia', ssnLast4: '1111', box1: 30000 }, { name: 'John Lee', ssnLast4: '3333', box1: 25000 }];
    expect(buildTables(ws.map(w => ({ kind: 'w2' as const, data: w }))).employees).toHaveLength(3);
  });
});
