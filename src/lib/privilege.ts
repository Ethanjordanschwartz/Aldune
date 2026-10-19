// Privileged self-audit support. Aldune supports — it cannot guarantee — attorney-client privilege and work-product
// protection. Framework: Evid. Code §§ 952, 954 (communications, including to those reasonably necessary to accomplish
// counsel’s purpose); Code Civ. Proc. § 2018.030 (work product); cf. United States v. Kovel (2d Cir. 1961) 296 F.2d 918.
export interface PrivilegeState { mode: 'privileged' | 'operational'; counsel?: { name: string; firm: string; email: string; bar?: string; engagedOn?: string }; controlGroup: string[]; directedBy?: string; purpose?: string }
export const privilegeLabel = (p: PrivilegeState) => `PRIVILEGED & CONFIDENTIAL — ATTORNEY-CLIENT COMMUNICATION / ATTORNEY WORK PRODUCT. Prepared at the direction of counsel${p.counsel?.name ? ` (${p.counsel.name}${p.counsel.firm ? `, ${p.counsel.firm}` : ''})` : ''} for the purpose of providing legal advice. Do not forward outside the control group.`;
export const NON_PRIVILEGED_LABEL = 'NOT PRIVILEGED — compliance record prepared for possible disclosure to support “all reasonable steps” under Lab. Code § 2699(g). Contains facts and actions taken, not legal analysis.';
export function privilegeReadiness(p: PrivilegeState) {
  const items = [
    { ok: p.mode === 'privileged', label: 'Audit designated as privileged' },
    { ok: !!(p.counsel?.name && p.counsel?.firm && p.counsel?.email), label: 'Counsel of record identified (name, firm, email)' },
    { ok: !!p.counsel?.engagedOn, label: 'Engagement letter signed — counsel retains Aldune to assist in rendering legal advice' },
    { ok: !!p.directedBy, label: 'Audit requested and directed by counsel (documented)' },
    { ok: p.controlGroup.length > 0 && p.controlGroup.length <= 15, label: 'Access limited to the legal team and a small control group' },
    { ok: !!p.purpose && /legal advice|litigation|anticipat/i.test(p.purpose), label: 'Purpose recorded as obtaining legal advice or in anticipation of litigation' }
  ];
  return { score: items.filter(i => i.ok).length, of: items.length, items,
    cautions: ['Underlying facts — payroll and time records — are not privileged and remain discoverable.', 'Privilege can be waived by sharing outside the control group or by relying on the analysis to claim a defense; keep the non-privileged “reasonable steps” record separate.', 'Business-purpose audits (operations, HR) are generally not privileged; run those in operational mode.', 'Confirm the privilege structure with counsel before relying on it.'],
    authorities: ['Evid. Code §§ 952, 954', 'Code Civ. Proc. § 2018.030', 'United States v. Kovel (2d Cir. 1961) 296 F.2d 918'] };
}
