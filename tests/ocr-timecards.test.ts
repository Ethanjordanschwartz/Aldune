// Scanned and handwritten timecards, as OCR returns them: look-alike characters, missing colons, bare hours with a/p,
// ranges, "noon", shift range written before the lunch, overnight shifts, hour totals that must not become punches.
import { describe, it, expect } from 'vitest';
import { parseTimesheet, lineTimes } from '@/lib/ingest/documents';

describe('OCR and handwriting-style timecards', () => {
  it('reads one-line punches the way a person would', () => {
    const cases: [string, string[]][] = [
      ['in 7:O2a  lunch 11:58-12:31  out 3:3Op', ['7:02 AM', '11:58 AM', '12:31 PM', '3:30 PM']],
      ['in 7.00am lunch 12-12:30 out 4pm', ['7:00 AM', '12:00 PM', '12:30 PM', '4:00 PM']],
      ['7a - 3:30p  lunch 12:00-12:30', ['7:00 AM', '12:00 PM', '12:30 PM', '3:30 PM']],
      ['in 7:15 lnch out 1215 in 1245 out 345p', ['7:15 AM', '12:15 PM', '12:45 PM', '3:45 PM']],
      ['in 6:45 out 12:00 in 12:30 out 3:15', ['6:45 AM', '12:00 PM', '12:30 PM', '3:15 PM']],
      ['7:00 - 11:00 / 11:30 - 3:30', ['7:00 AM', '11:00 AM', '11:30 AM', '3:30 PM']],
      ['8a-4:3Op lunch noon-12:30', ['8:00 AM', '12:00 PM', '12:30 PM', '4:30 PM']],
      ['l0:15p - 6:3Oa', ['10:15 PM', '6:30 AM']],
      ['IN 7;05 AM OUT 3;35 PM', ['7:05 AM', '3:35 PM']],
      ['7.00  12.00  12.30  3.30', ['7:00 AM', '12:00 PM', '12:30 PM', '3:30 PM']],
      ['in 7:00 out 3:30 total 8.0', ['7:00 AM', '3:30 PM']],
      ['in 7:00 out 3:30  8.50 hrs', ['7:00 AM', '3:30 PM']],
      ['IN 6:58 AM  OUT 3:31 PM  (no lunch)', ['6:58 AM', '3:31 PM']],
      ['in 9 am out 5:30 pm', ['9:00 AM', '5:30 PM']]
    ];
    for (const [line, want] of cases) expect(lineTimes(line), line).toEqual(want);
  });
  it('a scanned weekly card: every worked day read, days off skipped, ID not mistaken for a time', () => {
    const T = `TIME CARD   Employee: J0SE MART1NEZ   ID# 1O42\nWeek ending 6/7/26\nMon 6/1   in 7:O2a  lunch 11:58-12:31  out 3:3Op\nTue 6/2   in 7.00am lunch 12-12:30 out 4pm\nWed 6/3   IN 6:58 AM  OUT 3:31 PM  (no lunch)\nThu 6/4   7a - 3:30p  lunch 12:00-12:30\nFri 6/5   in 7:15 lnch out 1215 in 1245 out 345p\nSat 6/6   OFF\nSun 6/7   —`;
    const r = parseTimesheet(T, 'scan.pdf');
    expect(r.entries.map(e => [e.date, e.clockIn, e.meal1Out || '', e.meal1In || '', e.clockOut])).toEqual([
      ['2026-06-01', '7:02 AM', '11:58 AM', '12:31 PM', '3:30 PM'], ['2026-06-02', '7:00 AM', '12:00 PM', '12:30 PM', '4:00 PM'], ['2026-06-03', '6:58 AM', '', '', '3:31 PM'],
      ['2026-06-04', '7:00 AM', '12:00 PM', '12:30 PM', '3:30 PM'], ['2026-06-05', '7:15 AM', '12:15 PM', '12:45 PM', '3:45 PM']]);
    expect(r.entries.some(e => e.flagged)).toBe(false);
  });
});
