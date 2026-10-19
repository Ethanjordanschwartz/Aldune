// Synthetic replica of the QuickBooks Online Payroll “W-2 Copies B, C, & 2” text layout (labels first, then each value
// repeated once per copy). All names, numbers, and SSNs are invented (000-prefixed SSNs are never issued).
import { describe, expect, it } from 'vitest';
import { parseW2s, buildTables, classifyDataDocument, parseW2Repeated, parseW2RegisterText } from '@/lib/ingest/documents';
const LABELS = ['8 Allocated tips', '6 Medicare tax withheld', '4 Social security tax withheld', '2 Federal income tax withheld', '1 Wages, tips, other compensation', '3 Social security wages', '5 Medicare wages and tips', "a Employee's soc. sec. no", "c Employer's name, address, and ZIP code", "e Employee's first name and initial", 'Form W-2 Wage and Tax Statement Department of the Treasury-Internal Revenue Service OMB # 1545-0008'];
const rep = (v: string, n = 4) => Array(n).fill(v);
function form(ctl: string, p: { name: string; ssn4: string; street: string; city: string; box1: number }, copies = 4) {
  const ss = Math.round(p.box1 * 1.03 * 100) / 100, f = (x: number) => x.toFixed(2);
  return [ctl, "Copy C For Employee's Records", ...LABELS, ...LABELS, ...rep('2025', copies), ...rep('XX-XXXXXXX', copies), ...rep('Testco Bistro, Inc.', copies), ...rep('PO BOX 100', copies), ...rep(`000-00-${p.ssn4}`, copies), ...rep(p.street, copies),
    ...rep(f(p.box1), copies), ...rep(f(p.box1 * 0.07), copies), ...rep(f(ss), copies), ...rep(f(ss * 0.062), copies), ...rep(f(ss), copies), ...rep(f(ss * 0.0145), copies), ...rep('CA SDI', copies), ...rep('CA', copies), ...rep('000-0000-0', copies), ...rep('Sampletown CA 90000', copies), ...rep(p.name, copies), ...rep(p.city, copies), 'Rev 01/06/26 Intuit'].join('\n');
}
describe('QuickBooks-style W-2 batch (labels first, values repeated per copy)', () => {
  const people = Array.from({ length: 30 }, (_, i) => ({ name: `Testfirst${String.fromCharCode(65 + (i % 26))} Testlast${String.fromCharCode(97 + Math.floor(i / 26))}${String.fromCharCode(97 + (i % 26))}`, ssn4: String(1000 + i), street: `${100 + i} Example Ave`, city: 'Demo City CA 90001', box1: 20000 + i * 731.5 }));
  people.push({ name: 'Maria Garcia', ssn4: '7001', street: '1 Oak St', city: 'Demo City CA 90001', box1: 31000 }, { name: 'Maria Garcia', ssn4: '7002', street: '2 Elm St', city: 'Demo City CA 90001', box1: 42000 }); // same name, different people
  const forms = people.map((p, i) => form(`TST${String(i + 1).padStart(5, '0')}`, p));
  forms.push(form('TST09001', { ...people[3], box1: 5000 })); // second form (another locality) for person 3
  forms.push(form('TST09002', { ...people[5], name: `*${people[5].name.split(' ')[0]} Q. ${people[5].name.split(' ')[1]}`, street: '77 Example Ave' }, 2)); // printer mark + middle initial, 2 copies
  const text = 'QuickBooks Online Payroll\nW-2 Copies B, C, & 2 (employee)\n2025\n' + forms.join('\n');
  it('every form, every worker, correct Box 1/3/5; same names kept apart by SSN-4; variants merged', () => {
    expect(classifyDataDocument(text)).toBe('w2');
    const ws = parseW2s(text); expect(ws).toHaveLength(34);
    expect(ws.every(w => w.box3 && w.box5 && !/Ave|St$/.test(w.name || ''))).toBe(true);
    expect(ws.find(w => w.ssnLast4 === '1000')!.box1).toBe(20000);
    const t = buildTables(ws.map(w => ({ kind: 'w2' as const, data: w }))); expect(t.employees).toHaveLength(32);
    expect(ws.some(w => /\*/.test(w.name || ''))).toBe(false);
  });
});
