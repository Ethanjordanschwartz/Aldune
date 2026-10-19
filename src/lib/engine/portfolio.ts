// Portfolio view (spec Vol. III Part 38): latest audit per employer, trend vs the prior audit, staleness, and ranking.
import type { Snapshot } from './modeling';
export function portfolio(snaps: Snapshot[], today: string) {
  const by = new Map<string, Snapshot[]>(); for (const s of snaps) { const k = (s.employer || 'Unnamed employer').trim(); if (!by.has(k)) by.set(k, []); by.get(k)!.push(s); }
  const rows = [...by.entries()].map(([employer, list]) => {
    list.sort((a, b) => (a.windowEnd + a.createdAt).localeCompare(b.windowEnd + b.createdAt)); const cur = list[list.length - 1], prev = list.length > 1 ? list[list.length - 2] : null;
    const age = Math.round((Date.parse(today) - Date.parse(cur.createdAt.slice(0, 10))) / 864e5);
    return { employer, audits: list.length, latest: cur, score: cur.score, level: cur.level, exposure: cur.exposureBase, paga: cur.paga, deltaExposure: prev ? cur.exposureBase - prev.exposureBase : null, deltaScore: prev ? cur.score - prev.score : null, daysSinceAudit: age, stale: age > 90 };
  }).sort((a, b) => b.score - a.score || b.exposure - a.exposure);
  return { rows, totals: { employers: rows.length, exposure: rows.reduce((t, r) => t + r.exposure, 0), paga: rows.reduce((t, r) => t + r.paga, 0), stale: rows.filter(r => r.stale).length, high: rows.filter(r => /high|critical/i.test(r.level)).length } };
}
