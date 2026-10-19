// Exculpatory documents gate findings (Lock-In Addendum § 4). A signed meal waiver, on-duty meal agreement, or alternative-
// workweek election uploaded with the audit is matched to the employees it names and applied before the engine runs; the
// engine then reports the defeated conditions as SUPPRESSED, citing the document. Unsigned or revoked documents are not
// applied (suppression requires the executed artifact) — they are reported back so the user knows why.
import type { AuditInput, Employee } from '../engine/types';

export type DocKind = 'meal1' | 'meal2' | 'onduty' | 'aws';
export type Applied = { employeeId: string; name: string; kind: DocKind; doc: string };
export type NotApplied = { doc: string; kind: DocKind; why: string };

export function documentKinds(text: string): DocKind[] {
  const t = text.toLowerCase(); const k: DocKind[] = [];
  const waiver = /waiv|renuncia/.test(t);
  if (waiver && /(second|2nd|segundo) (meal|comida|periodo)|more than (?:ten|10) hours|12 hours|twelve hours/.test(t)) k.push('meal2');
  if (waiver && /(first|1st|primer) (meal|comida|periodo)|(?:six|6) hours or less|not more than (?:six|6) hours|no more than (?:six|6) hours/.test(t)) k.push('meal1');
  if (/on-?duty meal/.test(t) && /agree|acuerdo/.test(t)) k.push('onduty');
  if (/alternative work ?week/.test(t) && /(secret ballot|election|elecci)/.test(t) && /(adopt|approv|result|two-thirds|2\/3)/.test(t)) k.push('aws');
  return k;
}
const signed = (t: string) => /\bsigned\b|signature|\/s\/|firma|e-?signed|docusign|acknowledg/i.test(t);
const revoked = (t: string) => /\b(?:has|have|was|were)\s+revoked\b|revocation (?:received|effective)|revoked on\b/i.test(t);

export function applyExculpatory(input: AuditInput, docs: { name: string; text: string }[]): { applied: Applied[]; notApplied: NotApplied[] } {
  const applied: Applied[] = []; const notApplied: NotApplied[] = [];
  for (const d of docs) {
    const kinds = documentKinds(d.text); if (!kinds.length) continue;
    if (!signed(d.text)) { for (const kind of kinds) notApplied.push({ doc: d.name, kind, why: 'no signature found — an unsigned form does not defeat a finding' }); continue; }
    if (revoked(d.text)) { for (const kind of kinds) notApplied.push({ doc: d.name, kind, why: 'the document says it was revoked' }); continue; }
    const low = d.text.toLowerCase();
    const named = input.employees.filter(e => { const n = (e.name || '').trim().toLowerCase(); if (n.length < 5) return false; if (low.includes(n)) return true; const p = n.split(/\s+/); return p.length >= 2 && low.includes(`${p[p.length - 1]}, ${p[0]}`); });
    if (!named.length) { for (const kind of kinds) notApplied.push({ doc: d.name, kind, why: 'no employee in this audit is named in it' }); continue; }
    for (const e of named) for (const kind of kinds) {
      const m = e as Employee & { docsOnFile?: Record<string, string> };
      m.docsOnFile = { ...(m.docsOnFile || {}), [kind]: d.name };
      if (kind === 'meal1') m.mealWaiver1OnFile = true;
      if (kind === 'meal2') m.mealWaiver2OnFile = true;
      if (kind === 'onduty') m.onDutyMealAgreementOnFile = true;
      if (kind === 'aws') { const h = /\b4\s*\/\s*10\b|four 10-hour|4x10/i.test(d.text) ? 10 : /\b9\s*\/\s*80\b/.test(d.text) ? 9 : /\b3\s*\/\s*12\b/.test(d.text) ? 12 : 0; if (h && !m.awsDailyHours) m.awsDailyHours = h; if (!h) { notApplied.push({ doc: d.name, kind, why: 'election found, but the adopted schedule (4/10, 9/80, …) is not stated' }); continue; } }
      applied.push({ employeeId: e.id, name: e.name || e.id, kind, doc: d.name });
    }
  }
  return { applied, notApplied };
}
