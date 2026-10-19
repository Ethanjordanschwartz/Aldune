import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { extractText } from '@/lib/documents/extract';
import { classifyDocument, quickCheckDocument } from '@/lib/documents/review';
const buf = (f: string) => { const b = readFileSync(`tests/fixtures/${f}`); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };

describe('document intelligence on sample documents', () => {
  it('extracts and checks the arbitration agreement', async () => {
    const t = await extractText('Arbitration_Agreement.docx', buf('Arbitration_Agreement.docx'));
    expect(t.length).toBeGreaterThan(1000); expect(classifyDocument(t)).toBe('arbitration');
    const q = quickCheckDocument('arbitration', t); console.log(q.map(x => `${x.found ? '✓' : '·'} ${x.label}`).join('\n'));
    expect(q.find(x => x.label === 'Addresses PAGA claims')!.found).toBe(true);
  });
  it('flags the Spanish rest-period waiver in the meal waiver', async () => {
    const t = await extractText('Meal_Break_Waiver.docx', buf('Meal_Break_Waiver.docx'));
    expect(classifyDocument(t)).toBe('waiver');
    const risk = quickCheckDocument('waiver', t).find(x => x.risk)!;
    console.log(risk.label, risk.found);
    expect(risk.found).toBe(true);
  });
  it('extracts the PDF settlement packet and detects missing protections', async () => {
    const t = await extractText('settlement.pdf', buf('settlement.pdf'));
    expect(t).toMatch(/Settlement Agreement/i); expect(classifyDocument(t)).toBe('settlement');
    const q = quickCheckDocument('settlement', t); console.log(q.map(x => `${x.found ? '✓' : '·'} ${x.label}`).join('\n'));
    expect(q.find(x => x.label.startsWith('§ 12964.5'))!.found).toBe(false);
  });
  it('rejects unsupported formats with a clear message', async () => {
    await expect(extractText('old.doc', new ArrayBuffer(4))).rejects.toThrow(/\.docx or PDF/);
  });
});
