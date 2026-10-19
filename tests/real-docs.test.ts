import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { extractDocument } from '@/lib/documents/browserExtract';
import { classifyDataDocument, parsePayStub, parseTimesheet, parseW2, parseRoster, cleanName, nameFromFile } from '@/lib/ingest/documents';

const D = 'tests/fixtures/real/'; const read = async (f: string) => { const b = readFileSync(D + f); return extractDocument(f, b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
describe('real-world layouts', () => {
  it('normalizes names', () => { expect(cleanName('LOPEZ, MARIA')).toBe('Maria Lopez'); expect(cleanName('HERNANDEZ, JOSE A.')).toBe('Jose A. Hernandez'); expect(nameFromFile('Paystub-Ana-Ruiz-2026-02-20.pdf')).toBe('Ana Ruiz'); expect(cleanName('Employee Name')).toBeUndefined(); });
  it('split label/value lines (Paychex-like)', async () => {
    const t = await read('Paychex_stub_0001.pdf'); expect(classifyDataDocument(t)).toBe('paystub'); const p = parsePayStub(t, 'Paychex_stub_0001.pdf');
    expect(p).toMatchObject({ employeeId: 'E2001', name: 'Maria Lopez', periodStart: '2026-02-01', periodEnd: '2026-02-14', payDate: '2026-02-20', regRate: 18.25, regHours: 80, gross: 1569.52, net: 1197.1 });
    expect(p.missing).not.toContain('gross wages');
  });
  it('Associate ID, LAST, FIRST (ADP-like)', async () => {
    const p = parsePayStub(await read('ADP_EARNINGS_STATEMENT_E2002.pdf'));
    expect(p).toMatchObject({ employeeId: 'E2002', periodStart: '2026-02-01', periodEnd: '2026-02-14', regRate: 17.5, regHours: 76, gross: 1330, net: 1060.15 }); expect(p.ws.ws_sick_leave).toBe(true);
  });
  it('month-name dates and name from the file name (Gusto-like)', async () => {
    const f = 'Paystub-Ana-Ruiz-2026-02-20.pdf'; const t = await read(f); expect(classifyDataDocument(t)).toBe('paystub'); const p = parsePayStub(t, f);
    expect(p).toMatchObject({ name: 'Ana Ruiz', periodStart: '2026-02-01', periodEnd: '2026-02-14', payDate: '2026-02-20', regRate: 19, regHours: 80, gross: 1520, net: 1276.8 });
    expect(p.missing).toContain('employer name and address');
  });
  it('week ending only', async () => {
    const p = parsePayStub(await read('stub_week_ending_E2004.pdf')); expect(p).toMatchObject({ employeeId: 'E2004', name: 'Carmen Diaz', periodStart: '2026-02-01', periodEnd: '2026-02-07', gross: 676 }); expect(p.periodNote).toMatch(/weekly/);
  });
  it('24-hour timesheet without years', async () => {
    const t = await read('Timecard_Pedro_Ramirez.pdf'); expect(classifyDataDocument(t)).toBe('timesheet'); const s = parseTimesheet(t);
    expect(s.employeeId).toBe('E2005'); expect(s.name).toBe('Pedro Ramirez'); expect(s.entries.length).toBe(5);
    expect(s.entries[0]).toMatchObject({ date: '2026-02-02', clockIn: '6:30 AM', meal1Out: '12:15 PM', meal1In: '12:45 PM', clockOut: '3:00 PM' }); expect(s.entries[3].meal1Out).toBeUndefined();
  });
  it('W-2 with split boxes; roster', async () => {
    const t = await read('W2_Rosa_Flores_2025.pdf'); expect(classifyDataDocument(t)).toBe('w2'); const w = parseW2(t, 'W2_Rosa_Flores_2025.pdf');
    expect(w).toMatchObject({ name: 'Rosa Flores', year: '2025', box1: 41200, box3: 41200, ssnLast4: '6789' }); expect(t).not.toContain('123-45-6789');
    const r = parseRoster(await read('Employee_Roster.pdf')); expect(r.map(x => x.id)).toEqual(['E2001', 'E2002', 'E2003', 'E2004', 'E2005']); expect(r[0]).toMatchObject({ name: 'Maria Lopez', title: 'Packer', rate: 18.25, hireDate: '2022-03-01' });
  });
  it('scanned PDFs are detected as needing OCR', async () => { await expect(read('scanned_stub.pdf')).rejects.toThrow(/no text layer/); });
});
