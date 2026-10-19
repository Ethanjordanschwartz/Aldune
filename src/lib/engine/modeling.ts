// Litigation and business models built on top of deterministic findings.
// Every output is a calculation from findings plus user-chosen assumptions — never a prediction of what a court will do.
import { scorecard } from './scorecard';
import type { AuditResult } from './audit';
import type { Anomaly } from './detective';
import { CATEGORY_LABELS } from './exposure';
import { RULES } from './rules/registry';
import { round2, toDays } from './time';
import type { AuditInput, Category, Finding } from './types';

// ---------------------------------------------------------------- Scenario model ("digital twin")
export interface ScenarioInputs {
  excludeArbitration: boolean;   // remove class wage claims of employees with arbitration agreements (PAGA unaffected)
  arbitrationPct: number;        // used when the census has no arbitration column (0–100)
  validityPct: number;           // share of flagged records assumed to be true violations (0–100)
  lookbackMonths: number;        // wage/premium lookback (36 = 3-year statute, 48 = with UCL)
  rateFactor: number;            // multiply wage/premium amounts (wage assumption sensitivity)
  includeDerivative: boolean;    // derivative § 226 and § 203 penalties
  includePenalties: boolean;     // § 226, § 203, § 210, liquidated damages
  pagaMode: 'single' | 'stacked';
  pagaPenalty: number;
  pagaCap: 'none' | 'pre' | 'post';
  pagaWeeklyHalf: boolean;
  courtReductionPct: number;     // court discretion to reduce PAGA penalties (Lab. Code § 2699(e)(2)) 0–100
  pagaRegime?: 'post2024' | 'pre2024'; // which PAGA statute applies (determined by notice date)
  /** Cure status (Lab. Code § 2699(h)): 'reasonable_steps' = cured after qualifying reasonable steps → no penalty; 'cured' = other cure → at most $15 per employee per pay period. */
  pagaCure?: 'none' | 'reasonable_steps' | 'cured';
  /** Scienter shown for derivative penalties (§ 203 willful; § 204 willful; § 226 knowing and intentional). Without it, § 2699(i) bars stacking them on the underlying wage penalty. */
  derivativeScienter?: boolean;
  pre2024Subsequent200?: boolean; // pre-reform: $200 for subsequent violations (often limited by courts to after a citation)
  excludeFindingIds?: string[];  // dismissed, disputed, or remediated findings to leave out
  excludeEmployeeIds?: string[]; // workers removed from the model (e.g., remediated, released, or out of scope)
  excludeCategories?: string[];  // violation categories treated as fixed/remediated
  ws25?: boolean;                // post-2024: $25 for wage-statement violations where the employee could determine the information (Lab. Code § 2699(f)(2)(B))
  isolated50?: boolean;          // post-2024: $50 cap for isolated violations lasting ≤30 days or ≤4 consecutive pay periods
  enhanced200?: boolean;         // post-2024: $200 only after a prior finding (5 years) or malicious/fraudulent/oppressive conduct
}
/** PAGA amendments (AB 2288 / SB 92) apply to notices filed on or after June 19, 2024. */
export const PAGA_REFORM_DATE = '2024-06-19';
export const pagaRegimeFor = (noticeDate?: string) => (!noticeDate || noticeDate >= PAGA_REFORM_DATE ? 'post2024' : 'pre2024') as 'post2024' | 'pre2024';
export const PAGA_REGIMES = {
  post2024: { label: 'Amended PAGA (notices on or after June 19, 2024)', employeeShare: 0.35, caps: true, authority: 'Lab. Code § 2699 as amended by AB 2288 and SB 92 (2024)' },
  pre2024: { label: 'Prior PAGA (notices before June 19, 2024)', employeeShare: 0.25, caps: false, authority: 'Lab. Code § 2699(f)(2) (pre-2024): $100 initial, $200 subsequent per employee per pay period; 75% LWDA / 25% employees' }
} as const;
export const DEFAULT_SCENARIO: ScenarioInputs = { excludeArbitration: false, arbitrationPct: 0, validityPct: 100, lookbackMonths: 36, rateFactor: 1, includeDerivative: false, includePenalties: true, pagaMode: 'single', pagaPenalty: 100, pagaCap: 'none', pagaWeeklyHalf: true, courtReductionPct: 0 };
export const PERSPECTIVES: Record<'defense' | 'neutral' | 'plaintiff', Partial<ScenarioInputs>> = {
  defense: { excludeArbitration: true, validityPct: 70, lookbackMonths: 36, includeDerivative: false, pagaMode: 'single', courtReductionPct: 50 },
  neutral: { excludeArbitration: true, validityPct: 85, lookbackMonths: 36, includeDerivative: false, pagaMode: 'single', courtReductionPct: 25 },
  plaintiff: { excludeArbitration: false, validityPct: 100, lookbackMonths: 48, includeDerivative: true, pagaMode: 'stacked', courtReductionPct: 0 }
};

export interface ScenarioResult {
  inputs: ScenarioInputs;
  byCategory: { category: Category; label: string; amount: number }[];
  wages: number; penalties: number; paga: number; total: number;
  employeesIncluded: number; employeesExcluded: number;
  notes: string[];
}
const isDerivative = (f: Finding) => f.evidence.derivative === true;

export function runScenario(input: AuditInput, a: AuditResult, s: ScenarioInputs): ScenarioResult {
  const r = a.engine; const weeks = Math.max(1, r.meta.windowWeeks);
  const arb = new Set(input.employees.filter(e => e.arbitration).map(e => e.id));
  const excluded = new Set(s.excludeFindingIds || []); const regime = s.pagaRegime || 'post2024';
  const exEmp = new Set(s.excludeEmployeeIds || []); const exCat = new Set(s.excludeCategories || []);
  const skip = (f: Finding) => excluded.has(f.id) || exEmp.has(f.employeeId) || exCat.has(f.category);
  const hasArbColumn = input.employees.some(e => e.arbitration !== undefined);
  const arbFactor = s.excludeArbitration && !hasArbColumn ? 1 - s.arbitrationPct / 100 : 1;
  const valid = s.validityPct / 100;
  const cats = new Map<Category, number>();
  for (const f of r.findings) {
    if (f.confidence === 'low' || f.premiumIndicated || f.amount <= 0 || skip(f)) continue;
    if (!s.includeDerivative && isDerivative(f)) continue;
    const penaltyLike = f.amountKind === 'penalty' || f.amountKind === 'liquidated';
    if (penaltyLike && !s.includePenalties) continue;
    if (s.excludeArbitration && hasArbColumn && arb.has(f.employeeId)) continue;
    const sol = penaltyLike ? (RULES[f.ruleId]?.solYears ?? 1) * 12 : s.lookbackMonths;
    const eventBased = f.category === 'final_pay' || f.category === 'pay_timing';
    let amt = f.amount * (penaltyLike ? 1 : s.rateFactor) * valid * (s.excludeArbitration && !hasArbColumn ? arbFactor : 1);
    if (!eventBased) amt *= (52 * sol / 12) / weeks; // extend the reviewed window to the lookback period
    cats.set(f.category, (cats.get(f.category) || 0) + amt);
  }
  // § 226(e) is capped per employee; approximate by capping the category at $4,000 × affected employees
  const wsEmps = new Set(r.findings.filter(f => f.category === 'wage_statement' && f.confidence !== 'low').map(f => f.employeeId)).size;
  if (cats.has('wage_statement')) cats.set('wage_statement', Math.min(cats.get('wage_statement')!, 4000 * wsEmps));
  // PAGA — not affected by arbitration agreements (representative claims can't be waived; Iskanian / Adolph)
  const freq = new Map(input.employees.map(e => [e.id, e.payFrequency]));
  const units = new Map<string, Set<Category>>(); const start = toDays(r.meta.assumptions.auditDate) - 365;
  for (const f of r.findings) {
    if (f.confidence === 'low' || f.premiumIndicated || skip(f)) continue; if (!s.includeDerivative && isDerivative(f)) continue;
    const end = f.periodEnd || f.date; if (!end || toDays(end) < start) continue;
    const k = `${f.employeeId}|${f.periodStart || f.date}`; if (!units.has(k)) units.set(k, new Set()); units.get(k)!.add(f.category);
  }
  // periods per employee × category (for the post-2024 isolated-violation cap)
  const periodsBy = new Map<string, number>();
  for (const k of units.keys()) for (const c of units.get(k)!) { const key = `${k.split('|')[0]}|${c}`; periodsBy.set(key, (periodsBy.get(key) || 0) + 1); }
  const post = regime === 'post2024';
  const ws25 = s.ws25 ?? true, iso50 = s.isolated50 ?? true;
  let paga = 0; const seenEmp = new Set<string>();
  for (const [k, c] of [...units.entries()].sort((x, y) => x[0].localeCompare(y[0]))) {
    const emp = k.split('|')[0];
    // § 2699(i) anti-stacking: no separate PAGA penalty for §§ 201–203, non-willful § 204, or non-knowing § 226 on top of the underlying unpaid-wage penalty
    const WAGE = ['meal', 'rest', 'overtime', 'regular_rate', 'min_wage', 'split_shift', 'unpaid_wages', 'off_clock', 'reporting_time', 'piece_rate', 'tips'];
    const hasWage = [...c].some(x => WAGE.includes(x));
    const unitCats = post && hasWage && !s.derivativeScienter ? [...c].filter(x => !['final_pay', 'pay_timing', 'wage_statement'].includes(x)) : [...c];
    const amounts = (unitCats.length ? unitCats : [...c]).map(cat => {
      let amt = s.pagaPenalty;
      if (post) {
        if (s.enhanced200) amt = 200;
        else { if (cat === 'wage_statement' && ws25) amt = Math.min(amt, 25); if (iso50 && (periodsBy.get(`${emp}|${cat}`) || 0) <= 4) amt = Math.min(amt, 50); }
        if (freq.get(emp) === 'weekly' && s.pagaWeeklyHalf) amt /= 2;
      } else if (seenEmp.has(emp) && s.pre2024Subsequent200) amt = 200; // initial $100, subsequent $200
      return amt;
    });
    seenEmp.add(emp);
    paga += s.pagaMode === 'stacked' ? amounts.reduce((t, x) => t + x, 0) : Math.max(...amounts);
  }
  // caps do not apply to the heightened $200 penalty (§ 2699(f)(2)(B)); cure: none after reasonable steps, else ≤ $15 per employee per pay period (§ 2699(h))
  const cap = regime === 'post2024' && !s.enhanced200 ? (s.pagaCap === 'pre' ? 0.15 : s.pagaCap === 'post' ? 0.3 : 1) : 1;
  if (post && s.pagaCure === 'reasonable_steps') paga = 0;
  else if (post && s.pagaCure === 'cured') paga = Math.min(paga, units.size * 15);
  paga *= (weeks >= 52 ? 1 : 52 / weeks) * valid * cap * (1 - s.courtReductionPct / 100);
  const byCategory = [...cats.entries()].map(([category, amount]) => ({ category, label: CATEGORY_LABELS[category], amount: Math.round(amount) })).sort((x, y) => y.amount - x.amount);
  const penalties = byCategory.filter(c => ['wage_statement', 'final_pay', 'pay_timing'].includes(c.category)).reduce((t, c) => t + c.amount, 0);
  const wages = byCategory.reduce((t, c) => t + c.amount, 0) - penalties;
  const notes = [
    s.excludeArbitration ? (hasArbColumn ? `${arb.size} employees with arbitration agreements removed from class wage claims; their PAGA penalties remain (representative PAGA claims can’t be waived).` : `${s.arbitrationPct}% of class wage exposure removed for assumed arbitration coverage; PAGA unaffected.`) : 'Arbitration agreements not applied.',
    `Wage and premium claims extended to a ${s.lookbackMonths}-month lookback${s.lookbackMonths > 36 ? ' (four years requires a Bus. & Prof. Code § 17200 claim)' : ''}.`,
    `${s.validityPct}% of flagged records treated as violations.`,
    `${PAGA_REGIMES[regime].label}. Employees receive ${PAGA_REGIMES[regime].employeeShare * 100}% of penalties.`,
    ...(excluded.size ? [`${excluded.size} findings excluded (dismissed, disputed, or remediated).`] : []),
    ...(exEmp.size ? [`${exEmp.size} workers excluded from the model.`] : []),
    ...(exCat.size ? [`Treated as remediated: ${[...exCat].map(c => CATEGORY_LABELS[c as Category] || c).join(', ')}.`] : []),
    ...(regime === 'post2024' ? [s.enhanced200 ? 'Enhanced $200 PAGA penalty applied (requires a prior finding within 5 years or malicious, fraudulent, or oppressive conduct).' : `Post-2024 penalty limits: ${(s.ws25 ?? true) ? '$25 for wage-statement violations where the information could be determined' : 'no $25 wage-statement limit'}; ${(s.isolated50 ?? true) ? '$50 cap for violations limited to 4 or fewer pay periods' : 'no isolated-violation cap'}.`] : []),
    `PAGA: ${s.pagaMode === 'stacked' ? 'one penalty per violation type per pay period' : 'one penalty per employee per pay period'}${s.pagaCap !== 'none' && regime === 'post2024' ? `, ${s.pagaCap === 'pre' ? '15%' : '30%'} reasonable-steps cap` : s.pagaCap !== 'none' ? ' (reasonable-steps caps do not apply to pre-reform notices)' : ''}${s.courtReductionPct ? `, ${s.courtReductionPct}% discretionary reduction` : ''}.`
  ];
  return { inputs: s, byCategory, wages: Math.round(wages), penalties: Math.round(penalties), paga: Math.round(paga), total: Math.round(wages + penalties + paga), employeesIncluded: input.employees.length - (s.excludeArbitration && hasArbColumn ? arb.size : 0), employeesExcluded: s.excludeArbitration && hasArbColumn ? arb.size : 0, notes };
}

// ---------------------------------------------------------------- Named PAGA / exposure scenarios
export const NAMED_SCENARIOS: { id: string; name: string; description: string; inputs: Partial<ScenarioInputs> }[] = [
  { id: 'A', name: 'Baseline', description: 'Neutral assumptions: arbitration applied, 85% of flagged records valid, 3-year lookback, one PAGA penalty per pay period, 25% discretionary reduction.', inputs: { ...PERSPECTIVES.neutral } },
  { id: 'B', name: 'Reasonable steps before notice', description: 'Baseline with the 15% PAGA cap for an employer that took all reasonable steps before receiving a notice.', inputs: { ...PERSPECTIVES.neutral, pagaCap: 'pre' } },
  { id: 'C', name: 'Prospective correction after notice', description: 'Baseline with the 30% PAGA cap for reasonable steps taken within 60 days after a notice.', inputs: { ...PERSPECTIVES.neutral, pagaCap: 'post' } },
  { id: 'D', name: 'Alternative violation assumptions', description: 'Only 60% of flagged records treated as violations (for example, many late meals were voluntary).', inputs: { ...PERSPECTIVES.neutral, validityPct: 60 } },
  { id: 'E', name: 'Conservative (defense) exposure', description: 'Defense-favorable assumptions: 70% validity, no derivative claims, 50% discretionary reduction.', inputs: { ...PERSPECTIVES.defense } },
  { id: 'F', name: 'High (plaintiff) exposure', description: 'Plaintiff-favorable assumptions: no arbitration exclusion, 4-year UCL lookback, derivative claims, stacked PAGA, no reduction.', inputs: { ...PERSPECTIVES.plaintiff } }
];
export function compareScenarios(a: ScenarioResult, b: ScenarioResult) {
  const cats = new Set([...a.byCategory, ...b.byCategory].map(c => c.category));
  const get = (r: ScenarioResult, c: string) => r.byCategory.find(x => x.category === c)?.amount || 0;
  return { total: b.total - a.total, wages: b.wages - a.wages, penalties: b.penalties - a.penalties, paga: b.paga - a.paga, byCategory: [...cats].map(c => ({ category: c, label: CATEGORY_LABELS[c as Category], original: get(a, c), scenario: get(b, c), delta: get(b, c) - get(a, c) })).sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta)) };
}

// ---------------------------------------------------------------- Settlement valuation
export interface SettlementInputs { liabilityPct: number; certificationPct: number; pagaSuccessPct: number; plaintiffFeePct: number; defenseCostToTrial: number; defenseCostToMediation: number }
export const DEFAULT_SETTLEMENT: SettlementInputs = { liabilityPct: 60, certificationPct: 50, pagaSuccessPct: 60, plaintiffFeePct: 33, defenseCostToTrial: 350000, defenseCostToMediation: 60000 };
export interface SettlementResult { classEV: number; pagaEV: number; expectedJudgment: number; defenseSavings: number; walkaway: number; target: number; opening: number; demandAnchor: number; perEmployeeNet: number; explanation: string[] }
export function valueSettlement(sc: ScenarioResult, plaintiffView: ScenarioResult, s: SettlementInputs, classMembers: number): SettlementResult {
  const classEV = (sc.wages + sc.penalties) * (s.liabilityPct / 100) * (s.certificationPct / 100);
  const pagaEV = sc.paga * (s.pagaSuccessPct / 100);
  const expected = classEV + pagaEV;
  const defenseSavings = Math.max(0, s.defenseCostToTrial - s.defenseCostToMediation);
  const walkaway = expected + defenseSavings;           // above this, trying the case is cheaper on expected value
  const target = expected;                              // risk-adjusted value
  const opening = expected * 0.5;
  const net = expected * (1 - s.plaintiffFeePct / 100);
  return {
    classEV: Math.round(classEV), pagaEV: Math.round(pagaEV), expectedJudgment: Math.round(expected), defenseSavings: Math.round(defenseSavings),
    walkaway: Math.round(walkaway), target: Math.round(target), opening: Math.round(opening), demandAnchor: plaintiffView.total, perEmployeeNet: Math.round(classMembers ? net / classMembers : 0),
    explanation: [
      `Class claims: ${money(sc.wages + sc.penalties)} modeled × ${s.liabilityPct}% liability × ${s.certificationPct}% certification = ${money(classEV)}.`,
      `PAGA: ${money(sc.paga)} modeled × ${s.pagaSuccessPct}% success = ${money(pagaEV)}.`,
      `Risk-adjusted value ${money(expected)}. Saving ${money(defenseSavings)} in defense costs by resolving at mediation instead of trial puts the economic walkaway near ${money(walkaway)}.`,
      `The plaintiff-side model (no arbitration exclusions, 4-year lookback, stacked PAGA, derivative claims) is ${money(plaintiffView.total)}; expect an opening demand anchored near that figure.`,
      `After a ${s.plaintiffFeePct}% fee award, the risk-adjusted value is about ${money(classMembers ? net / classMembers : 0)} per class member.`
    ]
  };
}
const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

// ---------------------------------------------------------------- Monitoring
export interface Snapshot {
  id: string; label: string; createdAt: string; windowStart: string; windowEnd: string; employer: string;
  score: number; level: string; grade?: string; compliance?: number | null; exposureBase: number; exposureLow: number; exposureHigh: number; paga: number;
  employees: number; affected: number; findings: number; shifts: number;
  categories: Record<string, { base: number; findings: number; ratePerShift: number }>;
  locations: Record<string, { exposure: number; findings: number }>;
  topAnomalies: { headline: string; lift: number }[];
}
export function snapshot(label: string, input: AuditInput, a: AuditResult, anomalies: Anomaly[]): Snapshot {
  const emp = new Map(input.employees.map(e => [e.id, e])); const shifts = Math.max(1, a.engine.shifts.length);
  const locations: Snapshot['locations'] = {};
  for (const f of a.engine.findings) { if (f.confidence === 'low' || f.premiumIndicated) continue; const l = emp.get(f.employeeId)?.location || 'Unassigned'; locations[l] = locations[l] || { exposure: 0, findings: 0 }; locations[l].exposure += f.amount; locations[l].findings++; }
  Object.values(locations).forEach(v => { v.exposure = Math.round(v.exposure); });
  return {
    id: `${a.engine.meta.windowEnd}-${a.engine.meta.inputHash}`, label, createdAt: new Date().toISOString(), windowStart: a.engine.meta.windowStart, windowEnd: a.engine.meta.windowEnd, employer: input.employerName,
    score: a.risk.score, level: a.risk.level, ...(() => { const sc = scorecard(input, a); return { grade: sc.grade, compliance: sc.overall }; })(), exposureBase: Math.round(a.exposure.base), exposureLow: Math.round(a.exposure.low), exposureHigh: Math.round(a.exposure.high), paga: Math.round(a.paga.annualLow),
    employees: input.employees.length, affected: new Set(a.engine.findings.filter(f => f.confidence !== 'low').map(f => f.employeeId)).size, findings: a.engine.findings.length, shifts,
    categories: Object.fromEntries(a.categories.map(c => [c.category, { base: Math.round(c.base), findings: c.findings, ratePerShift: round2((c.findings / shifts) * 1000) / 1000 }])),
    locations, topAnomalies: anomalies.slice(0, 5).map(x => ({ headline: x.headline, lift: x.lift }))
  };
}
export interface Alert { severity: 'high' | 'medium' | 'info'; title: string; detail: string; action: string }
export function compareSnapshots(prev: Snapshot | null, cur: Snapshot, t: { exposureMax?: number; categoryIncreasePct?: number; scoreMax?: number } = {}): Alert[] {
  const alerts: Alert[] = []; const inc = t.categoryIncreasePct ?? 15;
  if (t.exposureMax && cur.exposureBase > t.exposureMax) alerts.push({ severity: 'high', title: `Exposure above your $${t.exposureMax.toLocaleString()} threshold`, detail: `Base estimate is $${cur.exposureBase.toLocaleString()} for ${cur.windowStart} to ${cur.windowEnd}.`, action: 'Review the top categories and pay amounts owed.' });
  if (t.scoreMax !== undefined && cur.compliance != null && cur.compliance < t.scoreMax) alerts.push({ severity: 'medium', title: `Compliance grade ${cur.grade} (${cur.compliance}/100) is below your threshold of ${t.scoreMax}`, detail: 'One or more areas slipped since your last run.', action: 'Open the scorecard and fix the lowest-graded areas first.' } as never);
  if (!prev) { alerts.push({ severity: 'info', title: 'Baseline saved', detail: 'Future runs will be compared to this one.', action: 'Run the next audit after the next pay period closes.' }); return alerts; }
  for (const [cat, v] of Object.entries(cur.categories)) {
    const p = prev.categories[cat]; if (!p || !p.ratePerShift) { if (v.base > 1000) alerts.push({ severity: 'medium', title: `New risk: ${CATEGORY_LABELS[cat as Category]}`, detail: `$${v.base.toLocaleString()} estimated; not present in the prior run.`, action: 'Investigate the records behind this category.' }); continue; }
    const ch = (v.ratePerShift - p.ratePerShift) / p.ratePerShift * 100;
    if (ch >= inc) alerts.push({ severity: ch >= 2 * inc ? 'high' : 'medium', title: `${CATEGORY_LABELS[cat as Category]} up ${Math.round(ch)}% per shift`, detail: `${p.findings.toLocaleString()} → ${v.findings.toLocaleString()} findings; $${p.base.toLocaleString()} → $${v.base.toLocaleString()}.`, action: 'Check the Detective for the location, supervisor, or shift pattern behind the increase.' });
    if (ch <= -inc) alerts.push({ severity: 'info', title: `${CATEGORY_LABELS[cat as Category]} down ${Math.round(-ch)}% per shift`, detail: 'Improvement since the prior run.', action: 'Record the corrective action in the reasonable-steps record.' });
  }
  for (const [loc, v] of Object.entries(cur.locations)) { const p = prev.locations[loc]; if (p && p.exposure > 0 && v.exposure > p.exposure * 1.25 && v.exposure - p.exposure > 2000) alerts.push({ severity: 'medium', title: `${loc}: exposure up ${Math.round((v.exposure / p.exposure - 1) * 100)}%`, detail: `$${p.exposure.toLocaleString()} → $${v.exposure.toLocaleString()}.`, action: `Review scheduling and break coverage at ${loc}.` }); }
  if (cur.compliance != null && prev.compliance != null) { const ds = cur.compliance - prev.compliance; if (Math.abs(ds) >= 5) alerts.push({ severity: ds < 0 ? 'medium' : 'info', title: `Compliance ${ds < 0 ? 'fell' : 'improved'} ${Math.abs(ds)} points (${prev.grade} → ${cur.grade})`, detail: 'Compared with your previous run.', action: ds < 0 ? 'See which areas declined on the scorecard.' : 'Keep the fixes in place and save monthly runs.' } as never); }
  return alerts.sort((x, y) => ['high', 'medium', 'info'].indexOf(x.severity) - ['high', 'medium', 'info'].indexOf(y.severity));
}

// ---------------------------------------------------------------- Due diligence (M&A)
export interface DiligenceInputs { targetName: string; dealValue: number; processRemediationCost: number; probabilityPct: number }
export interface DiligenceReport {
  headline: { likelyLow: number; likelyHigh: number; maximum: number; paga: number; remediation: number };
  highRiskLocations: { name: string; exposure: number; share: number }[];
  highRiskPopulations: { label: string; employees: number; detail: string }[];
  materialIssues: { label: string; amount: number; detail: string }[];
  adjustment: { low: number; high: number; pctOfDeal: number };
  insurance: string[];
  requests: string[];
}
export function buildDiligence(input: AuditInput, a: AuditResult, defense: ScenarioResult, neutral: ScenarioResult, plaintiff: ScenarioResult, anomalies: Anomaly[], d: DiligenceInputs): DiligenceReport {
  const emp = new Map(input.employees.map(e => [e.id, e]));
  const locs = new Map<string, number>(); let total = 0;
  for (const f of a.engine.findings) { if (f.confidence === 'low' || f.premiumIndicated) continue; const l = emp.get(f.employeeId)?.location || 'Unassigned'; locs.set(l, (locs.get(l) || 0) + f.amount); total += f.amount; }
  const highRiskLocations = [...locs.entries()].map(([name, x]) => ({ name, exposure: Math.round(x), share: total ? round2(x / total) : 0 })).sort((x, y) => y.exposure - x.exposure).filter(l => l.share >= 0.15).slice(0, 8);
  const mis = a.engine.employees.filter(e => e.misclassified);
  const heavy = a.engine.employees.filter(e => e.flaggedShifts >= 20);
  const highRiskPopulations = [
    ...(mis.length ? [{ label: 'Workers who may be misclassified', employees: mis.length, detail: mis.map(e => `${e.employee.jobTitle || e.employee.id} (${e.employee.classification})`).slice(0, 5).join('; ') }] : []),
    { label: 'Workers with 20+ flagged shifts', employees: heavy.length, detail: 'Concentrated meal/rest exposure; likely class representatives or PAGA plaintiffs.' },
    ...anomalies.slice(0, 3).map(x => ({ label: `${x.dimension}: ${x.value}`, employees: x.employees, detail: `${x.lift.toFixed(1)}× company rate of ${x.metricLabel}` }))
  ];
  const materialIssues = neutral.byCategory.filter(c => c.amount >= neutral.total * 0.1 || c.category === 'classification').map(c => ({ label: c.label, amount: c.amount, detail: RULES[Object.keys(RULES).find(k => RULES[k].category === c.category) || '']?.description || '' }));
  const owedNow = a.engine.employees.reduce((t, e) => t + e.exposure.wagesAndPremiums + e.exposure.reimbursement + e.exposure.interest, 0);
  const remediation = Math.round(owedNow + d.processRemediationCost);
  const p = d.probabilityPct / 100;
  return {
    headline: { likelyLow: defense.total, likelyHigh: neutral.total, maximum: plaintiff.total, paga: neutral.paga, remediation },
    highRiskLocations, highRiskPopulations, materialIssues,
    adjustment: { low: Math.round(defense.total * p + remediation), high: Math.round(neutral.total * p + remediation), pctOfDeal: d.dealValue ? round2(((neutral.total * p + remediation) / d.dealValue) * 100) : 0 },
    insurance: [
      'Representations-and-warranties insurers commonly treat wage-and-hour as an enhanced-diligence area and may exclude known or California wage-and-hour exposure; confirm with the broker before relying on RWI.',
      'Employment practices liability policies commonly exclude or sublimit wage-and-hour claims, though some courts read those exclusions narrowly (for example, expense-reimbursement claims).',
      'Consider a special indemnity or escrow sized to the modeled range for pre-closing wage-and-hour liabilities, and a covenant to pay identified amounts before closing.'
    ],
    requests: [
      'Three to four years of time punches and payroll registers for all California non-exempt employees',
      'Sample wage statements from each payroll system and each year',
      'Employee handbooks, meal/rest, sick leave, and reimbursement policies; signed meal waivers',
      'Arbitration agreements with class/representative waivers and roll-out dates',
      'PAGA notices, LWDA filings, demand letters, and pending or settled wage-and-hour matters',
      'Independent contractor agreements and 1099 vendor list',
      'Exempt-classified roster with salaries and job descriptions'
    ]
  };
}
