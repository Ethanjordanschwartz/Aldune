// OCR repairs: only impossible values are corrected; plausible readings are left alone and low-confidence lines are marked.
import { describe, it, expect } from 'vitest';
import { repairOcrText, markLowConfidence, LOW_CONF } from '@/lib/ingest/ocrFix';
import { parseTimesheet } from '@/lib/ingest/documents';

const OCR = `WEEKLY TIME CARD
Employee: Luis Ortega Emp # 20417
week of 03/09/2026
93/09/2626 5:00 AM 12:15 PM 12:45 PM 2:30 PH
93/10/2026 6:00 AW 19:20 AM 11:00 AM 2:30 PM
©3/11/2026 6:90 AM 10:00 AM 10:20 AM 2:30 PM
03/12/2020 6:00 AM 4:45 PM
03/13/2026 6:00 MM 11:08 AM 11:30 AM 2:30 PM`;

describe('OCR repairs', () => {
  const t = repairOcrText(OCR);
  it('impossible months and stray glyphs before dates', () => { expect(t).toContain('03/09/2026'); expect(t).toContain('03/10/2026'); expect(t).toContain('03/11/2026'); });
  it('a year one digit off the document year', () => { expect(t).toContain('03/12/2026'); expect(t).not.toMatch(/2626|2020/); });
  it('AM/PM look-alikes', () => { expect(t).toMatch(/2:30 PM\n93|2:30 PM/); expect(t).not.toMatch(/\b(?:AW|MM|PH)\b/); });
  it('impossible clock readings only', () => { expect(t).toContain('10:20 AM 11:00 AM'); expect(t).toContain('6:00 AM 10:00 AM 10:20 AM'); expect(t).toContain('11:08 AM'); expect(t).toContain('5:00 AM'); });
  it('the repaired text reads as a five-day card', () => { const ts = parseTimesheet(t); expect(ts.entries.map(e => e.date)).toEqual(['2026-03-09', '2026-03-10', '2026-03-11', '2026-03-12', '2026-03-13']); });
});
describe('low-confidence lines', () => {
  it('are marked and flagged for review without losing their times', () => {
    const text = markLowConfidence([{ text: 'Timecard 2026', confidence: 95 }, { text: '3/9 6:00 AM 11:00 AM 11:30 AM 2:30 PM', confidence: 92 }, { text: '3/10 5:00 AM 11:08 AM 11:30 AM 2:30 PM', confidence: 58 }]);
    expect(text.split('\n')[2]).toContain(LOW_CONF);
    const ts = parseTimesheet(text); const low = ts.entries.find(e => e.date.endsWith('03-10'))!;
    expect(low.meal1Out).toBe('11:08 AM'); expect(low.flagged).toMatch(/verify/i); expect(ts.entries.find(e => e.date.endsWith('03-09'))!.flagged).toBeUndefined();
  });
});

import { buildTables } from '@/lib/ingest/documents';
import { normalize } from '@/lib/ingest/normalize';
import { runAudit } from '@/lib/engine/audit';
describe('low-confidence punches in the audit', () => {
  it('findings on a low-confidence day are POTENTIAL until the punches are confirmed', () => {
    const text = 'Employee: Luis Ortega\nTimecard 2026\n' + markLowConfidence([{ text: '3/9/2026 6:00 AM 12:15 PM 12:45 PM 2:30 PM', confidence: 60 }, { text: '3/10/2026 6:00 AM 12:15 PM 12:45 PM 2:30 PM', confidence: 95 }]);
    const ts = parseTimesheet(text); const tables = buildTables([{ kind: 'timesheet', data: ts }] as never);
    const id = (rows: Record<string, unknown>[]) => { const headers = [...new Set(rows.flatMap(r => Object.keys(r)))]; return { headers, rows: rows as Record<string, string>[], mapping: Object.fromEntries(headers.map(h => [h, h])) }; };
    const n = normalize('Sample Co.', { employees: id(tables.employees.map(e => ({ ...e, hourly_rate: '20', classification: 'nonexempt' }))), time: id(tables.time) });
    const r = runAudit(n.input, { auditDate: '2026-04-01' }); const late = r.engine.findings.filter(f => f.category === 'meal');
    expect(late.find(f => f.date === '2026-03-09')!.state).toBe('POTENTIAL'); expect(late.find(f => f.date === '2026-03-09')!.missingInput).toMatch(/low confidence/);
    expect(late.find(f => f.date === '2026-03-10')!.state).toBe('VIOLATION');
  });
});
