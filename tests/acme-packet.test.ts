// Known-answer test: a multi-employee records packet (Word) written by a third party, with an independent answer key.
// Answer key: Maria $144 · James $136 · Linda $72 + $72 liquidated · Robert $726.92 · Ashley $24.33 · David $1,680 (§ 203) ·
// Jennifer $0 (clean control) · Carlos $83.75. Two documented, deliberate differences:
//  • Ashley: her 13 unrecorded minutes on 06/01 come after 8 hours that day, so they are daily overtime: 0.2167 h × $30 = $6.50
//    (the key prices them at straight time, $4.33). Aldune: $26.50.
//  • Carlos § 2802: the key "models $50"; Aldune applies its stated assumptions (phone $25 + home internet $25 per month, prorated to 2 weeks = $23.09).
//  • Worksite Los Angeles: the city minimum wage was $17.87 in June 2026 (the key assumes $16.90 statewide). With the location
//    kept, Linda and James are measured against $17.87; with locations removed the key's statewide figures are reproduced.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { extractDocument } from '@/lib/documents/browserExtract';
import { parseRecordsPacket, looksLikeRecordsPacket } from '@/lib/ingest/packet';
import { classifyDataDocument } from '@/lib/ingest/documents';
import { normalize } from '@/lib/ingest/normalize';
import { runAudit } from '@/lib/engine/audit';

const load = async () => { const b = readFileSync('tests/fixtures/acme/acme_packet.docx'); return extractDocument('acme.docx', b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
const id = (rows: Record<string, unknown>[]) => { const headers = [...new Set(rows.flatMap(r => Object.keys(r)))]; return { headers, rows: rows as Record<string, string>[], mapping: Object.fromEntries(headers.map(h => [h, h])) }; };
async function audit(statewide: boolean) {
  const pk = parseRecordsPacket(await load())!;
  const emps = pk.tables.employees.map(e => (statewide ? { ...e, location: '' } : e));
  const n = normalize(pk.employer!, { employees: id(emps), time: id(pk.tables.time), payroll: id(pk.tables.payroll) });
  const r = runAudit(n.input, { auditDate: '2026-10-07' }, n.issues);
  const sum = (emp: string, pred: (k: string, rule: string) => boolean) => Math.round(r.engine.findings.filter(f => f.employeeId === emp && f.confidence !== 'low' && pred(f.amountKind, f.ruleId)).reduce((t, f) => t + f.amount, 0) * 100) / 100;
  const wages = (emp: string) => sum(emp, k => k === 'wages' || k === 'premium');
  return { pk, n, r, sum, wages };
}

describe('Acme records packet (8 employees in one Word document)', () => {
  it('is recognized as a packet, not a single W-2', async () => {
    const t = await load();
    expect(looksLikeRecordsPacket(t)).toBe(true);
    expect(classifyDataDocument(t)).toBe('w2'); // why the old import showed "1 employee"; the packet reader now runs first
  });
  it('reads the same records from the PDF version and from a plain-text (pipe table) version', async () => {
    const docx = parseRecordsPacket(await load())!;
    const b = readFileSync('tests/fixtures/acme/acme_packet.pdf');
    const pdf = parseRecordsPacket(await extractDocument('acme.pdf', b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)))!;
    expect(pdf.tables).toEqual(docx.tables);
    const txt = parseRecordsPacket((await load()).split('\n').map(l => (l.includes('\t') ? `| ${l.split('\t').join(' | ')} |` : l)).join('\n'))!;
    expect(txt.tables).toEqual(docx.tables);
  });
  it('reads every employee, stub, and timesheet', async () => {
    const { pk } = await audit(true);
    expect(pk.employees.map(e => e.name)).toEqual(['Maria Gonzalez', 'James Carter', 'Linda Nguyen', 'Robert Smith', 'Ashley Brown', 'David Lee', 'Jennifer White', 'Carlos Ramirez']);
    expect(pk.periodStart).toBe('2026-06-01'); expect(pk.periodEnd).toBe('2026-06-14'); expect(pk.payDate).toBe('2026-06-19'); expect(pk.payFrequency).toBe('biweekly');
    const shifts = (id: string) => pk.tables.time.filter(t => t.employee_id === id).length;
    expect([shifts('E-1001'), shifts('E-1002'), shifts('E-1003'), shifts('E-1004'), shifts('E-1005'), shifts('E-1006'), shifts('E-1007'), shifts('E-1008')]).toEqual([8, 12, 10, 10, 10, 0, 10, 10]);
    expect(pk.tables.payroll.map(p => p.employee_id)).toEqual(['E-1001', 'E-1002', 'E-1003', 'E-1004', 'E-1005', 'E-1007', 'E-1008']);
    const emp = (id: string) => pk.tables.employees.find(e => e.employee_id === id)!;
    expect(emp('E-1004')).toMatchObject({ classification: 'exempt', annual_salary: 50400 });
    expect(emp('E-1006')).toMatchObject({ separation_type: 'discharge', termination_date: '2026-06-15', final_pay_date: '2026-06-25', hourly_rate: 21 });
    expect(emp('E-1008')).toMatchObject({ uses_personal_phone: 'Y', phone_reimbursed: 'N' });
    // Ashley's raw meal "12:04-12:25 PM (21 min)" and the range row "Mon 06/08-Fri 06/12"
    const a1 = pk.tables.time.find(t => t.employee_id === 'E-1005' && t.date === '2026-06-01')!;
    expect([a1.clock_in, a1.meal1_out, a1.meal1_in, a1.clock_out]).toEqual(['7:58 AM', '12:04 PM', '12:25 PM', '4:32 PM']);
    expect(pk.tables.time.filter(t => t.employee_id === 'E-1007' && t.date >= '2026-06-08').map(t => t.date)).toEqual(['2026-06-08', '2026-06-09', '2026-06-10', '2026-06-11', '2026-06-12']);
    // no SSN digits carried into the tables
    expect(JSON.stringify(pk.tables)).not.toMatch(/\d{4}\b.*ssn|xxx-xx/i);
  });
  it('statewide minimum wage: matches the answer key (with the two documented differences)', async () => {
    const { r, sum, wages } = await audit(true);
    expect(wages('E-1001')).toBe(144);
    expect(wages('E-1002')).toBe(136);
    expect(wages('E-1003')).toBe(72); expect(sum('E-1003', k => k === 'liquidated')).toBe(72);
    expect(wages('E-1004')).toBe(726.92);
    expect(wages('E-1005')).toBe(26.5);
    expect(sum('E-1006', (k, rule) => rule === 'CA-FINALPAY')).toBe(1680);
    expect(r.engine.findings.filter(f => f.employeeId === 'E-1007')).toEqual([]); // clean control
    expect(wages('E-1008')).toBe(33.75); expect(sum('E-1008', k => k === 'reimbursement')).toBe(23.09);
    const flagged = new Set(r.engine.findings.map(f => f.employeeId)); expect(flagged.size).toBe(7); expect(flagged.has('E-1007')).toBe(false);
    // § 226: Linda's stub omits the employer's legal name/address; Robert (reclassified) received no compliant itemized statement
    expect(sum('E-1003', (_k, rule) => rule === 'CA-WS-226')).toBe(50);
    // Robert's missing hours/rates follow from treating him as exempt: shown at low confidence (good-faith defense, Naranjo (2024) 15 Cal.5th 1056)
    expect(r.engine.findings.some(f => f.employeeId === 'E-1004' && f.ruleId === 'CA-WS-226' && f.confidence === 'low')).toBe(true);
    // Robert: hours rebuilt from weekly totals → no meal violations asserted (insufficient evidence only, high end)
    expect(r.engine.findings.filter(f => f.employeeId === 'E-1004' && f.category === 'meal').every(f => f.confidence === 'low')).toBe(true);
    // wages + premiums across the workforce: key $1,137.00 excluding its $50 expense model, + Ashley's $2.17 overtime correction
    const total = ['E-1001', 'E-1002', 'E-1003', 'E-1004', 'E-1005', 'E-1006', 'E-1007', 'E-1008'].reduce((t, e) => t + wages(e), 0);
    expect(Math.round(total * 100) / 100).toBe(1139.17);
  });
  it('Los Angeles worksite: city minimum wage ($17.87) applies to Linda and James, overtime and premiums at the higher rate', async () => {
    const { wages, sum } = await audit(false);
    expect(wages('E-1003')).toBe(149.6); expect(sum('E-1003', k => k === 'liquidated')).toBe(149.6);
    // James: 70 straight + 10 OT + 1 DT hours at $17.87 = $1,554.69 + 2 premiums × $17.87 − paid $1,377 = $213.43
    expect(wages('E-1002')).toBe(213.43);
    expect(wages('E-1001')).toBe(144); expect(wages('E-1004')).toBe(726.92);
  });
});
