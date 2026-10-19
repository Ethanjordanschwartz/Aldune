// Versioned law-update rule packs. A pack updates dated rate tables and law-library text; only items marked
// attorney_verified are applied. Dated tables already switch automatically on their effective dates; packs add new
// dates and texts as laws change, so every audit re-run reflects them.
import { CA_MIN_WAGE, LOCAL_MIN_WAGE, INDUSTRY_MIN_WAGE, COMPUTER_PRO } from '../engine/time';
import { LAW } from './kb';
type Rate = { effective: string; rate: number; note?: string };
export interface RulePackItem { kind: 'state_min_wage' | 'local_min_wage' | 'industry_min_wage' | 'computer_pro' | 'law_topic'; key?: string; effective?: string; rate?: number; hourly?: number; annual?: number; topic?: { id: string; summary?: string; points?: string[]; citations?: string[]; status?: string }; source: string; verification_status: 'attorney_verified' | 'needs_review'; verified_by?: string }
export interface RulePack { version: string; published: string; items: RulePackItem[] }
let applied: { version: string; at: string; changes: string[] }[] = [];
export const appliedPacks = () => applied.slice();
const upsert = (list: Rate[], effective: string, rate: number) => { const i = list.findIndex(r => r.effective === effective); if (i >= 0) { const before = list[i].rate; list[i] = { ...list[i], rate }; return before === rate ? null : `${effective}: ${before} → ${rate}`; } list.push({ effective, rate }); list.sort((a, b) => a.effective.localeCompare(b.effective)); return `${effective}: new rate ${rate}`; };
export function validatePack(p: unknown): string[] {
  const e: string[] = []; const x = p as RulePack;
  if (!x || typeof x !== 'object') return ['Not a rule pack.']; if (!x.version) e.push('version is required'); if (!Array.isArray(x.items)) e.push('items must be a list');
  (x.items || []).forEach((it, i) => { if (!it.source) e.push(`item ${i + 1}: source (official citation or URL) is required`); if (it.verification_status === 'attorney_verified' && !it.verified_by) e.push(`item ${i + 1}: verified_by is required for attorney_verified items`); if (['state_min_wage', 'local_min_wage', 'industry_min_wage'].includes(it.kind) && (!/^\d{4}-\d{2}-\d{2}$/.test(it.effective || '') || !(it.rate! > 0 && it.rate! < 200))) e.push(`item ${i + 1}: effective date and a plausible rate are required`); if (it.kind !== 'state_min_wage' && it.kind !== 'computer_pro' && !it.key && it.kind !== 'law_topic') e.push(`item ${i + 1}: key is required`); });
  return e;
}
/** Apply verified items; returns what changed and what was held for review. */
export function applyPack(p: RulePack) {
  const errs = validatePack(p); if (errs.length) return { ok: false, errors: errs, changes: [] as string[], held: [] as string[] };
  const changes: string[] = [], held: string[] = [];
  for (const it of p.items) {
    const label = `${it.kind}${it.key ? ` (${it.key})` : ''}`;
    if (it.verification_status !== 'attorney_verified') { held.push(`${label} — awaiting attorney verification`); continue; }
    let c: string | null = null;
    if (it.kind === 'state_min_wage') c = upsert(CA_MIN_WAGE as Rate[], it.effective!, it.rate!);
    if (it.kind === 'local_min_wage') { const k = it.key!.toLowerCase(); LOCAL_MIN_WAGE[k] = LOCAL_MIN_WAGE[k] || []; c = upsert(LOCAL_MIN_WAGE[k], it.effective!, it.rate!); }
    if (it.kind === 'industry_min_wage') { const t = INDUSTRY_MIN_WAGE[it.key!]; if (!t) { held.push(`${label} — unknown industry schedule`); continue; } c = upsert(t.schedule, it.effective!, it.rate!); }
    if (it.kind === 'computer_pro') { const i = COMPUTER_PRO.findIndex(r => r.effective === it.effective); if (i >= 0) COMPUTER_PRO[i] = { effective: it.effective!, hourly: it.hourly!, annual: it.annual! }; else { COMPUTER_PRO.push({ effective: it.effective!, hourly: it.hourly!, annual: it.annual! }); COMPUTER_PRO.sort((a, b) => a.effective.localeCompare(b.effective)); } c = `${it.effective}: $${it.hourly}/h, $${it.annual}/yr`; }
    if (it.kind === 'law_topic' && it.topic) { const t = LAW.find(x => x.id === it.topic!.id); if (!t) { held.push(`${label} — unknown topic ${it.topic.id}`); continue; } Object.assign(t, Object.fromEntries(Object.entries(it.topic).filter(([k, v]) => k !== 'id' && v !== undefined)), { verified: p.published }); c = `topic ${t.id} updated`; }
    if (c) changes.push(`${label}: ${c} [${it.source}; verified by ${it.verified_by}]`);
  }
  applied.push({ version: p.version, at: new Date().toISOString(), changes }); return { ok: true, errors: [], changes, held };
}
