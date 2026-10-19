// Worker classification (spec Vol. II Part 16): per-claim test routing (Garcia), ABC test (§ 2775), AB 5 exemptions
// routing to Borello (§§ 2776–2785), Borello weighted risk score, and § 226.8 willful-misclassification flag.
type Tri = boolean | null;
export const EXEMPTIONS: Record<string, { label: string; cite: string; conditions: string[] }> = {
  b2b: { label: 'Business-to-business (§ 2776)', cite: 'Lab. Code § 2776', conditions: ['Free from the hiring entity’s control and direction', 'Provides services directly to the contracting business, not its customers', 'Written contract specifying payment amount and due date', 'Has any required business license', 'Maintains a business location separate from the hiring entity', 'Customarily engaged in an independently established business of the same nature', 'Can contract with other businesses and does not work exclusively for this one', 'Advertises and holds itself out to the public', 'Provides its own tools, vehicles, and equipment', 'Can negotiate its own rates', 'Sets its own hours and location (consistent with the work)', 'Not performing work that requires a CSLB license'] },
  professional: { label: 'Professional services (§ 2778)', cite: 'Lab. Code § 2778', conditions: ['Service is on the enumerated professional-services list', 'Maintains a separate business location', 'Has a business license', 'Sets or negotiates its own rates', 'Sets its own hours (other than project deadlines)', 'Customarily does the same work for others or holds itself out to the public', 'Customarily exercises discretion and independent judgment'] },
  construction: { label: 'Construction subcontractor (§ 2781)', cite: 'Lab. Code §§ 2781, 2750.5', conditions: ['Written subcontract', 'Valid CSLB license covering the work', 'Business license or registration', 'Maintains a separate business location'] },
  occupation: { label: 'Listed occupation (§ 2783)', cite: 'Lab. Code § 2783', conditions: ['Worker is in a listed occupation (licensed physician, dentist, psychologist, veterinarian serving a health care entity; lawyer, architect, engineer, private investigator, accountant; insurance licensee; registered broker-dealer or investment adviser; direct sales; manufactured-housing sales)'] }
};
export const BORELLO: { key: string; label: string; weight: number }[] = [
  { key: 'control', label: 'Hiring entity controls the manner and means of the work', weight: 30 }, { key: 'regular_business', label: 'Work is part of the hiring entity’s regular business', weight: 12 }, { key: 'no_distinct_business', label: 'Worker has no distinct occupation or business', weight: 10 }, { key: 'directed', label: 'Work is usually done under direction, not by a specialist', weight: 8 },
  { key: 'low_skill', label: 'Little specialized skill required', weight: 6 }, { key: 'entity_tools', label: 'Hiring entity supplies tools and workplace', weight: 8 }, { key: 'long_term', label: 'Long or indefinite relationship', weight: 6 }, { key: 'paid_by_time', label: 'Paid by the hour or period, not by the job', weight: 6 },
  { key: 'no_profit_loss', label: 'No opportunity for profit or loss from managerial skill', weight: 6 }, { key: 'no_investment', label: 'No investment in equipment or helpers', weight: 4 }, { key: 'belief_employment', label: 'Parties understood it as employment', weight: 4 }
];
export interface ClassifyInput { abc: { A: Tri; B: Tri; C: Tri }; exemption?: keyof typeof EXEMPTIONS; exemptionMet?: boolean[]; borello: Record<string, Tri>; knowingIndicators?: { priorAdvice?: boolean; priorFinding?: boolean; feesCharged?: boolean } }
export function classifyWorker(i: ClassifyInput) {
  const ex = i.exemption ? EXEMPTIONS[i.exemption] : null;
  const exemptionApplies = !!ex && !!i.exemptionMet && ex.conditions.length > 0 && ex.conditions.every((_, k) => i.exemptionMet![k] === true);
  const missing = ex ? ex.conditions.filter((_, k) => i.exemptionMet?.[k] !== true) : [];
  const failedProngs = (['A', 'B', 'C'] as const).filter(p => i.abc[p] !== true);
  const abcEmployee = failedProngs.length > 0;
  const tot = BORELLO.reduce((t, f) => t + f.weight, 0);
  const score = Math.round(BORELLO.reduce((t, f) => t + (i.borello[f.key] === true ? f.weight : i.borello[f.key] === null || i.borello[f.key] === undefined ? f.weight / 2 : 0), 0) / tot * 100);
  const borelloRisk = score >= 60 ? 'high' : score >= 40 ? 'medium' : 'low';
  const wageOrderTest = exemptionApplies ? 'Borello' : 'ABC';
  const wageOrderEmployee = exemptionApplies ? borelloRisk !== 'low' : abcEmployee;
  const likelyEmployee = wageOrderEmployee || borelloRisk === 'high';
  const k = i.knowingIndicators || {}; const willful = likelyEmployee && !!(k.priorAdvice || k.priorFinding || k.feesCharged);
  return {
    routing: [{ claims: 'Wage-order claims: minimum and unpaid wages, meal and rest periods, wage statements', test: wageOrderTest, result: wageOrderEmployee ? 'likely employee' : 'contractor status supportable', cite: exemptionApplies ? `${ex!.cite}; Lab. Code § 2785; Borello` : 'Lab. Code § 2775; Garcia v. Border Transportation Group (2018) 28 Cal.App.5th 558' },
      { claims: 'Claims outside the wage orders (e.g., waiting-time penalties, wrongful termination)', test: 'Borello', result: borelloRisk === 'low' ? 'contractor status supportable' : borelloRisk === 'medium' ? 'uncertain' : 'likely employee', cite: 'S. G. Borello & Sons v. Dept. of Industrial Relations (1989) 48 Cal.3d 341; Garcia (2018)' }],
    abc: { failedProngs, employee: abcEmployee, note: abcEmployee ? `The hiring entity has not established prong${failedProngs.length > 1 ? 's' : ''} ${failedProngs.join(', ')}; the worker is presumed an employee.` : 'All three prongs established.' },
    exemption: ex ? { label: ex.label, applies: exemptionApplies, missing, cite: ex.cite } : null,
    borello: { score, risk: borelloRisk, factors: BORELLO.map(f => ({ ...f, answer: i.borello[f.key] ?? null })) },
    likelyEmployee, willfulMisclassificationRisk: willful,
    penalty226_8: willful ? '$5,000–$15,000 per violation ($10,000–$25,000 for a pattern or practice) if the misclassification was voluntary and knowing (Lab. Code § 226.8).' : null,
    note: 'Risk assessment for attorney review — not a determination. Default is employee status; the hiring entity bears the burden.'
  };
}

// ---------- Joint employer (Martinez v. Combs three alternatives; § 2810.3 client-employer liability)
export interface JointInput { controlsWages?: boolean; controlsHours?: boolean; controlsConditions?: boolean; knewOfWorkAndCouldPrevent?: boolean; commonLawEngagement?: boolean; laborContractor?: boolean; usualCourse?: boolean; atClientPremises?: boolean; clientWorkers?: number }
export function jointEmployer(i: JointInput) {
  const control = !!(i.controlsWages || i.controlsHours || i.controlsConditions);
  const alts = [{ test: 'Exercises control over wages, hours, or working conditions', met: control }, { test: 'Suffers or permits the work (knew of it and could have prevented it)', met: !!i.knewOfWorkAndCouldPrevent }, { test: 'Engages the worker (common-law employment)', met: !!i.commonLawEngagement }];
  const isEmployer = alts.some(a => a.met);
  const s2810 = !!(i.laborContractor && i.usualCourse && i.atClientPremises && (i.clientWorkers ?? 0) >= 25);
  return { likelyJointEmployer: isEmployer, alternatives: alts, clientEmployerLiability: s2810,
    explanation: isEmployer ? 'Meets at least one Martinez definition of “employ” — likely a joint employer for wage claims.' : 'None of the Martinez definitions is established on these facts.',
    note2810: s2810 ? 'Client employer shares civil liability for the labor contractor’s failure to pay wages and to secure workers’ compensation (Lab. Code § 2810.3) — 25+ workers, work within the usual course of business, on the client’s premises.' : null,
    cites: ['Martinez v. Combs (2010) 49 Cal.4th 35', 'Henderson v. Equilon Enterprises (2019) 40 Cal.App.5th 1111 (ABC test does not apply to joint-employer claims)', 'Lab. Code § 2810.3'] };
}
