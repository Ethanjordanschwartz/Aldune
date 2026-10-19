// “All reasonable steps” readiness (Lab. Code § 2699(g)–(h)) and the pick-up-sticks remediation sequencer.
import type { AuditInput } from '../engine/types';
import type { AuditResult } from '../engine/audit';
import { runScenario, DEFAULT_SCENARIO, PERSPECTIVES, type ScenarioInputs } from '../engine/modeling';
import { CATEGORY_LABELS } from '../engine/exposure';

export interface StepsEvidence { auditsRun: number; lastAuditDate?: string; policyScore?: number; policiesReviewed: boolean; trainingDocumented: boolean; owedWorkers: number; paidWorkers: number; tasksOpen: number; tasksDone: number; noticeDate?: string; today: string }
export interface StepsCategory { key: 'audits' | 'policies' | 'training' | 'corrective'; label: string; status: 'met' | 'partial' | 'missing'; evidence: string; missing: string[] }
const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

/** Scores the four non-exclusive “all reasonable steps” categories and estimates the likely PAGA cap. */
export function reasonableSteps(e: StepsEvidence) {
  const cats: StepsCategory[] = [];
  const recent = e.lastAuditDate ? days(e.lastAuditDate, e.today) <= 365 : false;
  cats.push({ key: 'audits', label: 'Periodic payroll audits with responsive action', status: e.auditsRun >= 2 && recent ? 'met' : e.auditsRun >= 1 ? 'partial' : 'missing', evidence: `${e.auditsRun} saved audit${e.auditsRun === 1 ? '' : 's'}${e.lastAuditDate ? `, last ${e.lastAuditDate}` : ''}`, missing: [...(e.auditsRun < 2 ? ['Run and save audits on a regular schedule (monthly monitoring)'] : []), ...(!recent ? ['Audit within the last 12 months'] : [])] });
  const ps = e.policyScore ?? 0;
  cats.push({ key: 'policies', label: 'Lawful written policies, disseminated', status: e.policiesReviewed && ps >= 85 ? 'met' : e.policiesReviewed ? 'partial' : 'missing', evidence: e.policiesReviewed ? `Handbook reviewed — score ${ps}/100` : 'No policy review on file', missing: [...(!e.policiesReviewed ? ['Review your handbook against California law'] : []), ...(e.policiesReviewed && ps < 85 ? ['Adopt the redlined, compliant policies and record employee acknowledgments'] : [])] });
  cats.push({ key: 'training', label: 'Supervisor training', status: e.trainingDocumented ? 'met' : 'missing', evidence: e.trainingDocumented ? 'Training memo/log generated' : 'No training record', missing: e.trainingDocumented ? [] : ['Train supervisors on breaks, timekeeping, and pay rules; keep sign-in sheets'] });
  const paidShare = e.owedWorkers ? e.paidWorkers / e.owedWorkers : 1;
  cats.push({ key: 'corrective', label: 'Corrective action (pay what’s owed; fix practices)', status: paidShare >= 0.95 && e.tasksOpen === 0 ? 'met' : paidShare > 0 || e.tasksDone > 0 ? 'partial' : 'missing', evidence: `${e.paidWorkers} of ${e.owedWorkers} owed workers paid; ${e.tasksDone} tasks done, ${e.tasksOpen} open`, missing: [...(paidShare < 0.95 ? ['Pay back wages and premiums owed (Back-pay planner)'] : []), ...(e.tasksOpen ? [`Close ${e.tasksOpen} open remediation task${e.tasksOpen === 1 ? '' : 's'}`] : [])] });
  const met = cats.filter(c => c.status === 'met').length; const score = Math.round(cats.reduce((t, c) => t + (c.status === 'met' ? 25 : c.status === 'partial' ? 12 : 0), 0));
  const afterNotice = e.noticeDate ? days(e.noticeDate, e.today) : null;
  const cap = met === 4 && afterNotice === null ? '15%' : met === 4 && afterNotice !== null && afterNotice <= 60 ? '30%' : 'none';
  return { score, categories: cats, likelyCap: cap as '15%' | '30%' | 'none',
    explanation: cap === '15%' ? 'All four categories are documented before any notice — the 15% cap is likely available (§ 2699(g)(1)).' : cap === '30%' ? 'All four categories documented within 60 days of the notice — the 30% cap is likely available (§ 2699(g)(2)).' : afterNotice !== null && afterNotice > 60 ? 'More than 60 days have passed since the notice; the caps are likely unavailable, but documented steps still support a reduced award.' : 'Complete the missing evidence below to qualify for the 15% cap (before any notice) or the 30% cap (within 60 days after a notice).',
    note: 'Judged by the totality of the circumstances and the employer’s size and resources; the existence of a violation does not by itself prove steps were unreasonable (Lab. Code § 2699(g)). The caps do not apply to $200 heightened penalties.' };
}

const EFFORT: Record<string, number> = { meal: 1, rest: 1, wage_statement: 1, recordkeeping: 1, split_shift: 1.5, pay_timing: 1.5, final_pay: 1.5, expenses: 2, regular_rate: 2, overtime: 2, min_wage: 1.5, unpaid_wages: 2.5, classification: 3 };
/** Pick-up-sticks: order fixes by exposure removed per unit of effort and show projected exposure after each step. */
export function pickUpSticks(input: AuditInput, a: AuditResult, base: Partial<ScenarioInputs> = PERSPECTIVES.neutral) {
  const s0: ScenarioInputs = { ...DEFAULT_SCENARIO, ...base }; const start = runScenario(input, a, s0);
  const cats = start.byCategory.filter(c => c.amount > 0);
  const ranked = cats.map(c => ({ category: c.category, label: c.label || CATEGORY_LABELS[c.category as keyof typeof CATEGORY_LABELS], amount: c.amount, effort: EFFORT[c.category] ?? 2 })).sort((x, y) => y.amount / y.effort - x.amount / x.effort);
  const excluded: string[] = []; let prev = start.total; const steps = [];
  for (const r of ranked) {
    for (const f of a.engine.findings) if (f.category === r.category) excluded.push(f.id);
    const now = runScenario(input, a, { ...s0, excludeFindingIds: [...excluded] });
    steps.push({ ...r, removes: prev - now.total, remaining: now.total, paga: now.paga }); prev = now.total;
  }
  return { start: start.total, steps };
}
