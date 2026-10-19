// Scanned / OCR'd pay stubs: look-alike letters in numbers, split money, "@" earnings lines, and no column header.
import { describe, it, expect } from 'vitest';
import { parsePayStub, ocrDigits } from '@/lib/ingest/documents';

describe('OCR digit clean-up', () => {
  it('fixes look-alikes only inside numbers', () => {
    expect(ocrDigits('Regular 2O.OO 8O.OO 1,6OO.OO')).toBe('Regular 20.00 80.00 1,600.00');
    expect(ocrDigits('Period O3/01/2026 - 03/14/2O26')).toBe('Period 03/01/2026 - 03/14/2026');
    expect(ocrDigits('Gross $1 ,755.OO  net 1, 204.50  hrs 80. 00')).toBe('Gross $1,755.00  net 1,204.50  hrs 80.00');
    expect(ocrDigits('OVERTIME Oct OIL lO:3O ID E10422')).toBe('OVERTIME Oct OIL 10:30 ID E10422');
  });
});
describe('scanned pay stubs', () => {
  it('table stub with OCR noise: hours, rates, premium, gross, period, pay date', () => {
    const s = parsePayStub(`ACME PACKING INC          EARNINGS STATEMENT
Employee: Rosa Diaz      ID: 10422
Pay Period: O3/01/2026 - 03/14/2O26     Pay Date: 03/20/2026
Earnings        Rate      Hours     This Period    YTD
Regular         2O.OO     8O.OO     1,6OO.OO       9,6OO.OO
Overtime        3O.OO     4.5O      135.0O         4O5.OO
Meal Premium    2O.OO     1.OO      2O.OO
Gross Pay                           $1 ,755.OO`);
    expect([s.periodStart, s.periodEnd, s.payDate, s.regHours, s.regRate, s.otHours, s.otRate, s.premiumHours, s.premiumRate, s.gross]).toEqual(['2026-03-01', '2026-03-14', '2026-03-20', 80, 20, 4.5, 30, 1, 20, 1755]);
  });
  it('"80 @ $20.00 = $1,600.00" lines with no header', () => {
    const s = parsePayStub(`Rosa Diaz  Check Date 3/20/26  Period 3/1/26 to 3/14/26
Reg Hrs 80 @ $20.00 = $1,600.00
OT 4.5 hrs @ 30.00 = 135.00
GROSS 1,735.00`);
    expect([s.regHours, s.regRate, s.otHours, s.otRate, s.gross]).toEqual([80, 20, 4.5, 30, 1735]);
  });
  it('no header, hours written first: the rate is the value with cents', () => {
    const s = parsePayStub('Pay period 03/01/2026 - 03/14/2026\nRegular 80 18.50 1,480.00\nGross 1,480.00');
    expect([s.regHours, s.regRate]).toEqual([80, 18.5]);
  });
});
