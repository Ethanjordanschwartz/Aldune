// M&A wage-and-hour diligence: pre-close exposure by limitations window, successor-liability posture by deal type,
// special-indemnity / escrow sizing, and survival periods. Decision support for deal counsel.
import type { AuditResult } from '../engine/audit';
export type DealType = 'stock' | 'merger' | 'asset';
export interface MaInput { dealType: DealType; closeDate: string; pendingNotices: number; probability?: number; defenseCostPerMatter?: number; continuity?: { sameWorkforce?: boolean; sameManagers?: boolean; sameOwnersFamily?: boolean; sameFacilities?: boolean } }
const yearsBefore = (d: string, y: number) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCFullYear(x.getUTCFullYear() - y); return x.toISOString().slice(0, 10); };
export function maDiligence(r: AuditResult, i: MaInput) {
  const fs = r.engine.findings.filter(f => f.amount > 0 && f.confidence !== 'low' && (f.date || f.periodEnd || '') <= i.closeDate);
  const inWin = (y: number) => fs.filter(f => (f.date || f.periodEnd || '') >= yearsBefore(i.closeDate, y));
  const sum = (a: typeof fs) => Math.round(a.reduce((t, f) => t + f.amount, 0));
  const wageKinds = ['wages', 'premium', 'reimbursement', 'liquidated'];
  const windows = { paga1: sum(inWin(1)), wages3: sum(inWin(3).filter(f => wageKinds.includes(f.amountKind))), ucl4: sum(inWin(4).filter(f => wageKinds.includes(f.amountKind))), penalties: sum(inWin(3).filter(f => f.amountKind === 'penalty')) };
  const pagaPenalties = Math.round(r.paga?.annualLow ?? 0); // unstacked, conservative annual PAGA estimate
  const continuityHits = Object.values(i.continuity || {}).filter(Boolean).length;
  const inherits = i.dealType !== 'asset' ? 'all' : continuityHits >= 1 ? 'likely' : 'limited';
  const p = i.probability ?? 0.5; const defense = (i.defenseCostPerMatter ?? 150000) * Math.max(1, i.pendingNotices);
  const realistic = windows.ucl4 + windows.penalties + pagaPenalties; const indemnity = Math.round(realistic * p + (i.pendingNotices ? defense : defense * 0.25));
  const escrow = Math.round(indemnity * (inherits === 'all' ? 1 : inherits === 'likely' ? 0.75 : 0.4));
  const lastViolation = fs.reduce((m, f) => ((f.date || f.periodEnd || '') > m ? (f.date || f.periodEnd || '') : m), '');
  const survival = lastViolation ? (() => { const x = new Date(lastViolation + 'T12:00:00Z'); x.setUTCFullYear(x.getUTCFullYear() + 4); return x.toISOString().slice(0, 10); })() : null;
  return { windows, pagaPenalties, realistic, inherits, indemnity, escrow, survival, continuityHits,
    posture: i.dealType === 'asset' ? (continuityHits ? 'Asset deal with continuity indicators: a successor can be liable for the seller’s wage judgments where it uses substantially the same facilities or workforce, has the same owners or managers controlling labor relations, or a family-member owner in the same industry.' : 'Asset deal without continuity indicators: wage liabilities generally stay with the seller, but confirm no judgment exposure and keep the indemnity.') : 'Stock purchase or merger: the target’s wage-and-hour liabilities stay with the acquired entity.',
    recommendations: ['Special (line-item) indemnity for pre-close wage-and-hour and PAGA liabilities, not subject to the general basket or cap.', 'Escrow or holdback sized to the risk-adjusted figure above; release in stages as limitations periods run.', `Survival for wage-and-hour claims through at least ${survival || 'four years after the last violation'} (Bus. & Prof. Code § 17208 four-year UCL period).`, 'Representations and warranties insurance typically excludes known wage-and-hour issues found in diligence — price them into the indemnity or escrow.', 'Pre-close remediation (pay back wages, fix configurations) reduces exposure and supports the 15%/30% PAGA caps after closing.', i.pendingNotices ? `Pending PAGA notices (${i.pendingNotices}): require seller to manage, fund, and resolve them; review cure deadlines.` : 'Require a representation that no PAGA notices or wage claims are pending or threatened.'],
    authorities: ['Lab. Code § 200.3', 'Code Civ. Proc. §§ 338, 340', 'Bus. & Prof. Code § 17208', 'Lab. Code § 2699'] };
}
