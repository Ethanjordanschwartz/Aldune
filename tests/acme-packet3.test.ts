// Known-answer test #3 (third-party "advanced" set): 43 employees described largely in narrative (no timesheets),
// three jurisdictions (state $16.90, City of LA $17.87, fast food $20.00), layered pay structures, and seven traps.
// Answer-key total $9,156.96. Aldune reproduces every keyed figure except these documented, legally reasoned differences
// (the third-party reconciliation itself flagged the first four as answer-key defects):
//  • Marcus Webb: regular rate computed per workweek ($22.22 → $8.89 premium shortfall, key $4.44); and 90 hours were paid
//    at straight time, so at least 10 hours of weekly overtime are owed ($111.11) — the key's own 45-hour weeks imply it.
//  • Victor Alvarez: Los Angeles worksite → City of LA minimum ($17.87): $269.60 shortfall (key used the state rate, $192).
//  • Sergio Diaz: $17.00 is below the LA minimum → $6.96 in addition to the $16.10 split-shift premium.
//  • Sam Carter: stub shows $1,620 base + $600 commissions = $2,220 (key says $2,200) → regular rate $24.67 → $123.33.
//  • Priya Nair: mileage exactly $140; phone + home internet priced at the editable default ($25 + $25 per month) because the
//    record states no amount (key assumes $75 for the period).
//  • Tara Oyelaran: base below LA minimum is surfaced at low confidence (commissions may cover it) — excluded from totals.
//  • Isla Reyes: day-of-rest ($0) plus a low-confidence note that seventh-day overtime needs daily hours.
//  • Minimum-wage findings carry liquidated damages (§ 1194.2) as a separate line.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { extractDocument } from '@/lib/documents/browserExtract';
import { parseRecordsPacket } from '@/lib/ingest/packet';
import { normalize } from '@/lib/ingest/normalize';
import { runAudit } from '@/lib/engine/audit';

const id = (rows: Record<string, unknown>[]) => { const headers = [...new Set(rows.flatMap(r => Object.keys(r)))]; return { headers, rows: rows as Record<string, string>[], mapping: Object.fromEntries(headers.map(h => [h, h])) }; };
async function run() {
  const b = readFileSync('tests/fixtures/acme/acme_packet3.docx'); const pk = parseRecordsPacket(await extractDocument('a.docx', b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)))!;
  const n = normalize(pk.employer!, { employees: id(pk.tables.employees), time: id(pk.tables.time), payroll: id(pk.tables.payroll) });
  const r = runAudit(n.input, { auditDate: '2026-10-07' }, n.issues);
  const nameOf = new Map(n.input.employees.map(e => [e.id, e.name]));
  const owed = (name: string) => Math.round(r.engine.findings.filter(f => nameOf.get(f.employeeId) === name && f.confidence !== 'low' && f.amountKind !== 'liquidated').reduce((t, f) => t + f.amount, 0) * 100) / 100;
  const flagged = new Set(r.engine.findings.filter(f => f.confidence !== 'low' && (f.amount > 0 || ['CA-DAYREST', 'CA-COMMAGREE', 'CA-CLASS'].includes(f.ruleId))).map(f => nameOf.get(f.employeeId)!));
  return { pk, n, r, owed, flagged, nameOf };
}
const KEY: Record<string, number> = { 'Ana Torres': 152, 'Ben Osei': 76, 'Carla Diaz': 72, 'David Park': 13.33, 'Elena Ruiz': 75, 'Farah Khan': 49.6, 'George Lin': 120, 'Hana Suzuki': 95, 'Ivan Petrov': 84, 'Kevin Brown': 69, 'Nadia Haddad': 120, 'Omar Farouk': 162, 'Quentin Lee': 213.55, 'Rosa Jimenez': 252, 'Wendy Zhao': 180, 'Xavier Reed': 2304, 'Yara Costa': 800, 'Zane Miller': 880, 'Aisha Bello': 778.85, 'Blake Turner': 900, 'Diego Santos': 519.23, 'Emma Fisher': 166.67, 'Gina Lopez': 12.5, 'Henry Adams': 192, 'Isla Reyes': 0, 'Liam Walsh': 50, 'Mia Flores': 100, 'Noah Reed': 50, 'Pablo Ortiz': 37.8, 'Quinn Barnes': 31.67, 'Rita Mendez': 36 };
const DOCUMENTED: Record<string, number> = { 'Marcus Webb': 120, 'Victor Alvarez': 284.6, 'Sergio Diaz': 23.06, 'Sam Carter': 123.33, 'Priya Nair': 164.74 };
const CLEAN = ['Tara Oyelaran', 'Chen Wu', 'Frank Hughes', 'Olivia Grant', 'Jack Nolan', 'Tina Alvarez', 'Umar Siddiqui'];

describe('Acme set 3 — advanced (43 employees, narrative records, traps)', () => {
  it('reads all 43 employees and every pay stub', async () => {
    const { pk } = await run(); expect(pk.employees.length).toBe(43); expect(pk.tables.payroll.length).toBe(43);
  });
  it('the PDF version reads exactly the same records', async () => {
    const ld = async (f: string) => { const b = readFileSync(f); return parseRecordsPacket(await extractDocument(f, b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)))!; };
    expect((await ld('tests/fixtures/acme/acme_packet3.pdf')).tables).toEqual((await ld('tests/fixtures/acme/acme_packet3.docx')).tables);
  });
  it('every keyed figure matches to the cent', async () => {
    const { owed } = await run();
    for (const [k, v] of Object.entries(KEY)) expect(owed(k), k).toBe(v);
    for (const [k, v] of Object.entries(DOCUMENTED)) expect(owed(k), k).toBe(v);
  });
  it('36 employees flagged; the seven clean controls and traps raise nothing', async () => {
    const { flagged } = await run();
    for (const c of CLEAN) expect(flagged.has(c), c).toBe(false);
    expect(flagged.size).toBe(36);
  });
  it('traps: Zane’s timely final pay, Gina’s AWS hours, Jack’s short seven-day week, Frank’s B2B status, Olivia’s neutral rounding', async () => {
    const { r, nameOf } = await run(); const of = (n: string) => r.engine.findings.filter(f => nameOf.get(f.employeeId) === n);
    expect(of('Zane Miller').filter(f => f.ruleId === 'CA-FINALPAY' && f.confidence !== 'low')).toEqual([]);
    expect(of('Gina Lopez').reduce((t, f) => t + f.amount, 0)).toBe(12.5);
    expect(of('Jack Nolan')).toEqual([]); expect(of('Frank Hughes')).toEqual([]); expect(of('Olivia Grant')).toEqual([]);
    expect(of('Chen Wu')).toEqual([]); expect(of('Umar Siddiqui')).toEqual([]); expect(of('Tina Alvarez')).toEqual([]);
    expect(of('Sam Carter').some(f => f.ruleId === 'CA-COMMAGREE')).toBe(true);
    expect(of('Henry Adams').some(f => f.ruleId === 'CA-AWS')).toBe(true); expect(of('Gina Lopez').some(f => f.ruleId === 'CA-AWS')).toBe(false);
    expect(of('Isla Reyes').some(f => f.ruleId === 'CA-DAYREST' && f.confidence === 'medium')).toBe(true);
  });
});
