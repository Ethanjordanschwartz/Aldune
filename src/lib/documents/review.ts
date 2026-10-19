// Deterministic document checklists (California employment documents). Shared by the web app and standalone app.
export type DocType = 'arbitration' | 'separation' | 'settlement' | 'waiver' | 'handbook' | 'paga_notice' | 'mediation_brief' | 'complaint' | 'other';
type Item = [RegExp, string, string];
export const CHECKS: Record<string, { label: string; items: Item[] }> = {
  mediation_brief: { label: 'Mediation brief', items: [
    [/damages|exposure|calculat/i, 'Quantifies damages or exposure', 'Mediators expect a claim-by-claim exposure analysis with the assumptions stated.'],
    [/certif|predominan|typical/i, 'Addresses class certification', 'Certification risk is a core settlement discount (Code Civ. Proc. § 382; Brinker; Duran).'],
    [/paga|2699/i, 'Addresses PAGA separately', 'PAGA penalties are not subject to certification and require separate valuation (Lab. Code § 2699; Adolph v. Uber).'],
    [/arbitrat/i, 'Addresses arbitration agreements', 'Arbitration and class waivers shrink the class but not non-individual PAGA claims (Viking River; Adolph).'],
    [/settlement position|settle|resolve/i, 'States a settlement position', 'A clear opening position frames negotiation.']] },
  complaint: { label: 'Complaint', items: [
    [/cause of action|causes of action/i, 'Lists causes of action', 'Map each claim to the records needed to test it.'],
    [/all (?:current and former|persons|individuals)|class (?:is defined|definition)/i, 'Defines the class', 'The class definition sets the period and population for exposure modeling.'],
    [/2699|paga/i, 'Pleads PAGA', 'Confirm the PAGA notice preceded filing by 65 days and covers each alleged violation (Lab. Code § 2699.3).']] },
  arbitration: { label: 'Arbitration agreement', items: [
    [/representative|private attorneys general|paga/i, 'Addresses PAGA claims', 'A wholesale waiver of representative PAGA claims is unenforceable (Iskanian, 2014; Viking River, 2022). Individual PAGA claims may be compelled to arbitration, and the plaintiff keeps standing for the rest (Adolph v. Uber, 2023). Make sure an invalid waiver is severable.'],
    [/sexual harassment|sexual assault|ending forced arbitration|4445|EFAA/i, 'Carves out sexual harassment/assault (EFAA)', 'The Ending Forced Arbitration of Sexual Assault and Sexual Harassment Act (2022) lets employees choose court for those disputes.'],
    [/neutral|discovery|written (decision|award)|all (remedies|relief)|employer (shall|will) (pay|bear)/i, 'Armendariz protections', 'California requires a neutral arbitrator, adequate discovery, a written decision, all statutory remedies, and employer payment of costs unique to arbitration (Armendariz, 2000).'],
    [/1281\.9[78]|fees.{0,40}(30|thirty) days/i, 'Arbitration fee deadlines', 'Employers must pay arbitration fees within 30 days of the due date or risk waiving arbitration (Code Civ. Proc. §§ 1281.97–1281.98).'],
    [/labor commissioner|berman|administrative (charge|complaint)|agency/i, 'Preserves agency rights', 'Agreements may not bar Labor Commissioner claims or agency charges.'],
    [/class action/i, 'Class action waiver', 'Class waivers in employment arbitration agreements are generally enforceable (Epic Systems, 2018).']] },
  separation: { label: 'Severance or separation agreement', items: [
    [/12964\.5|nothing in this agreement prevents you from discussing/i, 'Gov. Code § 12964.5 disclosure language', 'Separation agreements that restrict disclosure must state that nothing prevents discussing or disclosing information about unlawful acts in the workplace; non-disparagement clauses need the carve-out.'],
    [/age discrimination in employment|ADEA|older workers benefit|twenty-one|21 days/i, 'ADEA / OWBPA (age 40+)', 'Releasing federal age claims requires written advice to consult an attorney, 21 days to consider (45 for group programs), and 7 days to revoke.'],
    [/1542/i, 'Civil Code § 1542 waiver', 'Needed to release unknown claims.'],
    [/workers'? compensation|unemployment|cannot be waived|not waivable|as a matter of law/i, 'Excludes non-waivable claims', 'Unpaid wages due (Lab. Code § 206.5), workers’ compensation, unemployment, and agency charge rights can’t be released by private agreement. FLSA releases generally require court or DOL approval.'],
    [/not (file|bring).{0,60}(agency|government)|governmental agency/i, 'Covenant not to file with agencies (risk)', 'Promises not to file with or cooperate with government agencies are unenforceable and can taint the agreement.'],
    [/rehire|re-employ/i, 'No-rehire clause (check)', 'Settlements of employment disputes generally can’t bar re-employment (Code Civ. Proc. § 1002.5).']] },
  settlement: { label: 'Wage settlement / Pick-Up Stix packet', items: [
    [/206\.5|undisputed wages/i, 'Separates undisputed wages (§ 206.5)', 'Wages concededly due must be paid without requiring a release.'],
    [/private attorneys general|paga/i, 'Addresses PAGA', 'Individuals can’t release the State’s representative PAGA claims; an explicit carve-out avoids overreach.'],
    [/12964\.5|nothing in this agreement prevents/i, '§ 12964.5 language', 'Required where the agreement restricts disclosure.'],
    [/attorney|counsel/i, 'Right to counsel; plaintiffs’ counsel contact', 'Accurate, non-coercive communication with putative class members, including plaintiffs’ counsel contact, supports enforceability (Chindarah v. Pick Up Stix).'],
    [/retaliat/i, 'Non-retaliation', 'Assure employees their choice won’t affect employment (Lab. Code § 98.6).'],
    [/w-2|1099|withhold/i, 'Tax treatment', 'Amounts for wage claims are generally wages; allocating everything to a 1099 penalty is risky.']] },
  waiver: { label: 'Meal or rest waiver', items: [
    [/six|6 hours/i, 'First-meal waiver limited to 6-hour days', 'Lab. Code § 512(a).'],
    [/twelve|12 hours/i, 'Second-meal waiver limited to 12-hour days', 'Only if the first meal wasn’t waived.'],
    [/revoke|revocable|revocation/i, 'Revocable', 'Waivers must be revocable.'],
    [/rest (break|period).{0,40}(waive|renunci)|renunciar.{0,40}descanso|descanso.{0,60}renunci/i, 'Purports to waive rest breaks (risk)', 'Rest breaks cannot be waived. Remove any language suggesting otherwise, including translations.']] },
  paga_notice: { label: 'PAGA notice / demand letter', items: [
    [/labor code|§\s*\d{3}/i, 'Identifies specific Labor Code provisions', 'Lab. Code § 2699.3(a)(1)(A) requires the specific provisions alleged to have been violated.'],
    [/because|failed to|did not|were not|was not/i, 'States facts and theories', 'Notice must include the facts and theories supporting each alleged violation; conclusory notices may be challenged.'],
    [/lwda|labor (and|&) workforce development agency/i, 'Filed with the LWDA', 'Notice must be filed online with the LWDA and sent to the employer by certified mail.'],
    [/certified mail/i, 'Served by certified mail', 'Service on the employer is by certified mail.'],
    [/personally|plaintiff (worked|was employed)|aggrieved employee who/i, 'Plaintiff personally suffered the violations (2024 standing rule)', 'For notices on or after June 19, 2024, the aggrieved employee must personally have suffered each violation alleged within the period.']] },
  handbook: { label: 'Handbook / policies', items: [
    [/meal/i, 'Meal period policy', 'Lab. Code § 512; premium at the regular rate of compensation.'], [/rest (break|period)/i, 'Rest period policy', 'Wage Order § 12; off duty, not on call.'],
    [/sick/i, 'Paid sick leave', 'Lab. Code §§ 245–249: 40 hours/5 days; cap ≥ 80 hours/10 days.'], [/reimburs/i, 'Expense reimbursement', 'Lab. Code § 2802, including mileage and personal phones.'],
    [/off[\s-]*the[\s-]*clock/i, 'Prohibits off-the-clock work', 'Record and pay all time.'], [/lactation/i, 'Lactation accommodation', 'Lab. Code § 1034 written policy.'],
    [/workplace violence/i, 'Workplace violence prevention plan', 'Lab. Code § 6401.9.'], [/overtime.{0,80}(approv|authoriz)/i, 'Overtime approval rule (check wording)', 'Unapproved overtime must still be paid; discipline is the remedy, not nonpayment.']] }
};

export function classifyDocument(text: string): DocType { const t = text.toLowerCase(); if (/mediation brief|mediation statement|in advance of the mediation|brief in support of mediation/.test(t)) return 'mediation_brief'; if (/(class (?:and representative )?action complaint|complaint for (?:damages|violations|civil penalties))/.test(t.slice(0, 4000)) && /superior court|united states district court/.test(t) && !/settlement agreement|agreement to arbitrate|arbitration agreement/.test(t)) return 'complaint'; if (/gift card|cardholder|terms of use govern your use/.test(t) && !/employee/.test(t.slice(0, 2000))) return 'other'; if (/private attorneys? general|\bpaga\b/.test(t) && /labor (and|&) workforce development agency|\blwda\b|2699/.test(t) && !/settlement agreement and (?:general |mutual )?release/.test(t) && !/agreement to arbitrate|arbitration agreement/.test(t.slice(0, 600))) return 'paga_notice'; if (/arbitrat/.test(t)) return 'arbitration'; if (/pick up stix|class action|lawsuit.{0,200}settle|settlement agreement and (?:general |mutual )?release/.test(t)) return 'settlement'; if (/severance|separation|termination of employment/.test(t)) return 'separation'; if (/waive.{0,40}meal|meal period.{0,40}waiv|renuncia/.test(t)) return 'waiver'; return 'handbook'; }
export interface CheckResult { label: string; why: string; found: boolean; risk: boolean }
export function quickCheckDocument(type: DocType, text: string): CheckResult[] {
  const set = (CHECKS as Record<string, { label: string; items: Item[] }>)[type === 'other' ? 'handbook' : type];
  return set.items.map(([re, label, why]) => ({ label, why, found: re.test(text), risk: /\(risk\)|\(check/i.test(label) }));
}
export const DOC_LABELS: Record<DocType, string> = { paga_notice: 'PAGA notice / demand letter', mediation_brief: 'Mediation brief', complaint: 'Complaint', arbitration: 'Arbitration agreement', separation: 'Severance or separation agreement', settlement: 'Wage settlement / Pick-Up Stix packet', waiver: 'Meal or rest waiver', handbook: 'Handbook / policies', other: 'Other' };
