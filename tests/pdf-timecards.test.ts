// PDF timecards (three layouts) through the real PDF path: text extraction → classification → timesheet parser.
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { extractDocument } from '@/lib/documents/browserExtract';
import { classifyDataDocument, parseTimesheet } from '@/lib/ingest/documents';
import { parseTime } from '@/lib/engine/time';
const T = JSON.parse(readFileSync('tests/fixtures/messy/truth.json', 'utf8'));
const D = 'tests/fixtures/messy/pdf/';
async function read(f: string) { const b = readFileSync(D + f); return extractDocument(f, b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); }
const canon = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const who = (id?: string, name?: string) => T.people.find((p: any) => (id && id.replace(/^0+/, '') === p.id.replace(/^0+/, '')) || (name && [canon(p.first + p.last), canon(p.last + p.first)].includes(canon(name))));
describe('PDF timecards', () => {
  it('per-employee PDFs, a multi-employee report, and a 24-hour shift list read accurately', async () => {
    const results: Record<string, number> = {};
    for (const [label, files, meals] of [['per-employee', readdirSync(D).filter(f => f.startsWith('timecard_')), true], ['multi-employee report', ['time_detail_all.pdf'], true], ['24-hour list', ['shift_list_24h.pdf'], false]] as [string, string[], boolean][]) {
      let ok = 0; const recs: { id?: string; name?: string; date: string; in: number | null; out: number | null; meals: { out: number | null; in: number | null }[] }[] = [];
      for (const f of files) { const text = await read(f); const kind = classifyDataDocument(text); const ts = parseTimesheet(text, f); if (kind !== 'timesheet') console.log(label, f, 'classified as', kind);
        for (const e of ts.entries) recs.push({ id: e.employeeId || ts.employeeId, name: e.name || ts.name, date: e.date, in: parseTime(e.clockIn), out: parseTime(e.clockOut), meals: e.meal1Out ? [{ out: parseTime(e.meal1Out), in: parseTime(e.meal1In) }] : [] }); }
      for (const t of T.truth) { const hit = recs.find(r => who(r.id, r.name)?.id === t.id && r.date === t.date && r.in === t.in % 1440 && r.out === t.out % 1440 && (!meals || (t.mo === undefined ? !r.meals.some(m => m.out !== null) : r.meals[0]?.out === t.mo % 1440 && r.meals[0]?.in === t.mi % 1440))); if (hit) ok++; }
      results[label] = ok / T.truth.length;
    }
    console.log('PDF ACCURACY', JSON.stringify(results));
    for (const v of Object.values(results)) expect(v).toBeGreaterThanOrEqual(0.95);
  }, 60000);
});
