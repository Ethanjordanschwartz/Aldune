// PDF pay stubs with multi-column earnings tables (three layouts) → field-level accuracy against truth.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { extractDocument } from '@/lib/documents/browserExtract';
import { classifyDataDocument, parsePayStub } from '@/lib/ingest/documents';
const D = 'tests/fixtures/messy/stubs/'; const T = JSON.parse(readFileSync(D + 'truth.json', 'utf8'));
describe('PDF pay stubs', () => {
  it('reads hours, rates, OT/DT/premiums, gross, dates, and identity from three layouts', async () => {
    const fields = ['regHours', 'regRate', 'otHours', 'dtHours', 'premiumHours', 'gross', 'periodStart', 'periodEnd', 'payDate'];
    let ok = 0, total = 0; const misses: string[] = [];
    for (const t of T) {
      const b = readFileSync(D + t.file); const text = await extractDocument(t.file, b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
      const kind = classifyDataDocument(text); const s = parsePayStub(text, t.file) as unknown as Record<string, unknown>;
      if (kind !== 'paystub') misses.push(`${t.file}: classified ${kind}`);
      for (const f of fields) { total++; const got = f === 'gross' ? (s.gross ?? s.grossPay) : s[f]; const want = t[f]; const eq = typeof want === 'number' ? Math.abs(Number(got ?? 0) - want) < 0.011 : got === want; if (eq) ok++; else misses.push(`${t.file} ${f}: got ${got} want ${want}`); }
      total++; if ((s.employeeId === t.id) || String(s.name || '').toLowerCase().includes(t.name.split(' ')[1].toLowerCase())) ok++; else misses.push(`${t.file} identity: ${s.employeeId}/${s.name}`);
    }
    console.log(`STUB ACCURACY ${(ok / total * 100).toFixed(1)}%`, misses.slice(0, 12).join(' | '));
    expect(ok / total).toBeGreaterThanOrEqual(0.98);
  }, 60000);
});
