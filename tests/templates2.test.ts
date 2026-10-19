import { describe, expect, it } from 'vitest';
import { arbitrationAgreement, commissionAgreement, pieceRatePlan, wtpaNotice, classificationMemo, classNotice } from '@/lib/documents/templates2';
import { classifyWorker } from '@/lib/classification';
import { analyzeArbitration } from '@/lib/documents/arbitration';
import { toHtml } from '@/lib/documents/render';
describe('Vol. II document library', () => {
  it('our own arbitration agreement passes our analyzer (no poison pill, no Armendariz defects)', () => {
    const html = toHtml([arbitrationAgreement('Acme')]); const text = html.replace(/<[^>]+>/g, ' ');
    const a = analyzeArbitration(text); expect(a.overall).toBe('likely enforceable'); expect(a.findings.map(f => f.id)).not.toContain('poison_pill'); expect(a.findings.map(f => f.id)).not.toContain('fees');
  });
  it('commission, piece-rate, WTPA (EN/ES), memo, and class notice contain required content', () => {
    expect(toHtml([commissionAgreement('Acme')])).toMatch(/2751/);
    expect(toHtml([pieceRatePlan('Acme')])).toMatch(/average hourly rate/);
    const en = toHtml([wtpaNotice('Acme', 'en')]); const es = toHtml([wtpaNotice('Acme', 'es')]);
    for (const s of ['Workers’ compensation carrier', 'Regular payday', '7 calendar days']) expect(en).toContain(s); expect(es).toContain('Día regular de pago');
    const r = classifyWorker({ abc: { A: true, B: false, C: true }, borello: {} });
    expect(toHtml([classificationMemo('Driver', r)])).toContain('Borello'); expect(toHtml([classNotice('Doe v. Acme')])).toContain('3.766');
  });
});
