// PAGA notice / demand letter analyzer: extracts alleged Labor Code sections and dates, maps them to Aldune rules and
// knowledge-base topics, and measures how the employer's own data bears on each allegation. Deterministic.
import type { AuditResult } from '../engine/audit';
import type { Category } from '../engine/types';
import { round2, addDays } from '../engine/time';

interface SectionInfo { title: string; categories: Category[]; topic: string; curable: boolean; tested: boolean }
export const SECTIONS: Record<string, SectionInfo> = {
  '201': { title: 'Final wages on discharge', categories: ['final_pay'], topic: 'final-pay', curable: false, tested: true },
  '202': { title: 'Final wages on resignation', categories: ['final_pay'], topic: 'final-pay', curable: false, tested: true },
  '203': { title: 'Waiting-time penalties', categories: ['final_pay'], topic: 'final-pay', curable: false, tested: true },
  '204': { title: 'Timely payment of wages', categories: ['pay_timing'], topic: 'pay-timing', curable: false, tested: true },
  '210': { title: 'Penalties for late wages', categories: ['pay_timing'], topic: 'pay-timing', curable: false, tested: true },
  '221': { title: 'Unlawful deductions', categories: [], topic: 'deductions', curable: false, tested: false },
  '223': { title: 'Secret underpayment', categories: [], topic: 'deductions', curable: false, tested: false },
  '226': { title: 'Accurate itemized wage statements', categories: ['wage_statement'], topic: 'wage-statements', curable: true, tested: true },
  '226.2': { title: 'Piece-rate compensation', categories: [], topic: 'piece-rate', curable: false, tested: false },
  '226.3': { title: 'Wage statement civil penalties', categories: ['wage_statement'], topic: 'wage-statements', curable: true, tested: true },
  '226.7': { title: 'Meal and rest period premiums', categories: ['meal', 'rest'], topic: 'premiums', curable: true, tested: true },
  '227.3': { title: 'Vacation pay at separation', categories: [], topic: 'vacation', curable: false, tested: false },
  '246': { title: 'Paid sick leave', categories: ['sick_leave'], topic: 'sick-leave', curable: true, tested: true },
  '351': { title: 'Gratuities', categories: [], topic: 'tips', curable: false, tested: false },
  '432': { title: 'Copies of signed documents', categories: [], topic: 'records-requests', curable: false, tested: false },
  '510': { title: 'Overtime', categories: ['reconciliation', 'regular_rate', 'classification'], topic: 'overtime', curable: true, tested: true },
  '512': { title: 'Meal periods', categories: ['meal'], topic: 'meal-periods', curable: true, tested: true },
  '515': { title: 'Exemptions', categories: ['classification'], topic: 'exemptions', curable: false, tested: true },
  '558': { title: 'Civil penalties for wage order violations', categories: ['meal', 'rest', 'reconciliation', 'regular_rate'], topic: 'fees-interest', curable: false, tested: true },
  '1174': { title: 'Recordkeeping', categories: [], topic: 'records-requests', curable: false, tested: false },
  '1174.5': { title: 'Willful failure to keep records', categories: [], topic: 'records-requests', curable: false, tested: false },
  '1182.12': { title: 'State minimum wage', categories: ['min_wage'], topic: 'minimum-wage', curable: true, tested: true },
  '1194': { title: 'Unpaid minimum wage and overtime', categories: ['min_wage', 'reconciliation', 'regular_rate'], topic: 'overtime', curable: true, tested: true },
  '1194.2': { title: 'Liquidated damages', categories: ['min_wage'], topic: 'minimum-wage', curable: true, tested: true },
  '1197': { title: 'Payment of minimum wage', categories: ['min_wage'], topic: 'minimum-wage', curable: true, tested: true },
  '1197.1': { title: 'Minimum wage civil penalties', categories: ['min_wage'], topic: 'labor-commissioner', curable: false, tested: true },
  '1198': { title: 'Wage order compliance', categories: ['meal', 'rest', 'split_shift', 'reporting_time', 'reconciliation', 'piece_rate'], topic: 'hours-worked', curable: false, tested: true },
  '1198.5': { title: 'Personnel files', categories: [], topic: 'records-requests', curable: false, tested: false },
  '2751': { title: 'Written commission agreements', categories: [], topic: 'commissions', curable: false, tested: false },
  '2802': { title: 'Business expense reimbursement', categories: ['expenses'], topic: 'expenses', curable: true, tested: true },
  '2810.5': { title: 'Wage notice to employees', categories: [], topic: 'wage-notice', curable: false, tested: false },
  '226.8': { title: 'Willful misclassification', categories: ['classification'], topic: 'contractors', curable: false, tested: true },
  '2775': { title: 'ABC test', categories: ['classification'], topic: 'contractors', curable: false, tested: true }
};
const MONTHS = 'January|February|March|April|May|June|July|August|September|October|November|December';
export interface NoticeAllegation { section: string; title: string; topic: string; curable: boolean; tested: boolean; findings: number; workers: number; amount: number; assessment: string }
export interface NoticeAnalysis { isNotice: boolean; kind: 'paga_notice' | 'demand' | 'complaint' | 'unknown'; noticeDate: string | null; claimant: string | null; allegations: NoticeAllegation[]; deadlines: { cure: string; suit: string } | null; specificity: string }

export function analyzeNotice(text: string, r?: AuditResult | null): NoticeAnalysis {
  const t = text.replace(/\s+/g, ' ');
  const isPaga = /private attorneys? general|\bPAGA\b/i.test(t) && /labor (and|&) workforce development agency|\bLWDA\b|2699/i.test(t);
  const kind: NoticeAnalysis['kind'] = isPaga ? 'paga_notice' : /complaint for|superior court of california|plaintiff[s]? allege/i.test(t) ? 'complaint' : /demand|unpaid wages|wage claim/i.test(t) ? 'demand' : 'unknown';
  const found = new Set<string>();
  const re = /(?:§§?|sections?|labor code)\s*((?:\d{3,4}(?:\.\d+)?(?:\([a-z0-9]+\))*(?:(?:\s*(?:,|and|or|&|through|–|-)\s*)+)?)+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) for (const n of m[1].match(/\d{3,4}(?:\.\d+)?/g) || []) if (SECTIONS[n]) found.add(n);
  const dm = t.match(new RegExp(`(?:Date|Dated|on)?:?\\s*((?:${MONTHS})\\s+\\d{1,2},\\s+20\\d{2})`)) || t.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  let noticeDate: string | null = null;
  if (dm) { const d = new Date(dm[1]); if (!isNaN(d.getTime())) noticeDate = d.toISOString().slice(0, 10); }
  const cm = t.match(/(?:on behalf of|client,?|employee,?|Re:?|aggrieved employee,?)\s+([A-Z][a-z]+(?:\s+[A-Z]\.)?\s+[A-Z][a-z]+(?:-[A-Z][a-z]+)?)/);
  const allegations = [...found].sort((a, b) => parseFloat(a) - parseFloat(b)).map(sec => {
    const info = SECTIONS[sec];
    const fs = r ? r.engine.findings.filter(f => info.categories.includes(f.category) && f.confidence !== 'low' && !f.premiumIndicated) : [];
    const amount = round2(fs.reduce((x, f) => x + f.amount, 0)); const workers = new Set(fs.map(f => f.employeeId)).size;
    const assessment = !info.tested ? 'Not tested by Aldune — gather records (policies, notices, deductions) and review with counsel.' : !r ? 'Load payroll and time data to measure this allegation.' : fs.length ? `Your data shows ${fs.length.toLocaleString()} potential issues for ${workers} workers (${'$' + Math.round(amount).toLocaleString()} before interest). ${info.curable ? 'Potentially curable — see the cure plan.' : 'Address through payment and corrective action.'}` : 'No supporting issues found in the records analyzed — a potential defense; confirm data coverage for the notice period.';
    return { section: sec, title: info.title, topic: info.topic, curable: info.curable, tested: info.tested, findings: fs.length, workers, amount, assessment };
  });
  const specificity = allegations.length === 0 ? 'No Labor Code sections were identified.' : /because|failed to|did not|were not|was not|required to/i.test(t) ? 'The notice appears to describe facts and theories, not just code sections.' : 'The notice may list code sections without facts and theories; § 2699.3(a)(1)(A) requires both — discuss with counsel.';
  return { isNotice: kind !== 'unknown', kind, noticeDate, claimant: cm ? cm[1] : null, allegations, deadlines: noticeDate && kind === 'paga_notice' ? { cure: addDays(noticeDate, 33), suit: addDays(noticeDate, 65) } : null, specificity };
}

// ---------------- Class / PAGA settlement allocation
export interface AllocationInput { gross: number; feesPct: number; costs: number; admin: number; serviceAwards: number; pagaAmount: number; regime: 'post2024' | 'pre2024'; excludeArbitration: boolean; periodStart?: string; periodEnd?: string }
export interface AllocationRow { employeeId: string; name: string; workweeks: number; classShare: number; pagaPeriods: number; pagaShare: number; total: number }
export function allocateSettlement(input: import('../engine/types').AuditInput, r: AuditResult, a: AllocationInput) {
  const fees = round2(a.gross * a.feesPct / 100); const empShare = a.regime === 'post2024' ? 0.35 : 0.25;
  const lwda = round2(a.pagaAmount * (1 - empShare)); const pagaEmp = round2(a.pagaAmount * empShare);
  const net = round2(Math.max(0, a.gross - fees - a.costs - a.admin - a.serviceAwards - a.pagaAmount));
  const emp = input.employees.filter(e => (e.classification === 'nonexempt' || r.engine.employees.find(x => x.employee.id === e.id)?.misclassified) && !(a.excludeArbitration && e.arbitration));
  const ids = new Set(emp.map(e => e.id));
  const weeks = new Map<string, Set<string>>(); const periods = new Map<string, Set<string>>();
  const end = a.periodEnd || r.engine.meta.windowEnd; const pagaStart = addDays(end, -365);
  for (const tr of input.timeRecords) { if (!ids.has(tr.employeeId) || (a.periodStart && tr.date < a.periodStart) || tr.date > end) continue; const d = new Date(tr.date + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - d.getUTCDay()); const k = d.toISOString().slice(0, 10); (weeks.get(tr.employeeId) || weeks.set(tr.employeeId, new Set()).get(tr.employeeId)!).add(k); }
  for (const p of input.payroll) { if (!ids.has(p.employeeId) || p.periodEnd < pagaStart || p.periodStart > end) continue; (periods.get(p.employeeId) || periods.set(p.employeeId, new Set()).get(p.employeeId)!).add(p.periodStart); }
  const totW = [...weeks.values()].reduce((t, s) => t + s.size, 0) || 1; const totP = [...periods.values()].reduce((t, s) => t + s.size, 0) || 1;
  const rows: AllocationRow[] = emp.map(e => { const w = weeks.get(e.id)?.size || 0, pp = periods.get(e.id)?.size || 0; const cs = round2(net * w / totW), ps = round2(pagaEmp * pp / totP); return { employeeId: e.id, name: e.name, workweeks: w, classShare: cs, pagaPeriods: pp, pagaShare: ps, total: round2(cs + ps) }; }).filter(x => x.total > 0).sort((x, y) => y.total - x.total);
  return { summary: { gross: a.gross, fees, costs: a.costs, admin: a.admin, serviceAwards: a.serviceAwards, paga: a.pagaAmount, lwda, pagaEmployees: pagaEmp, netClass: net, members: rows.length, avg: rows.length ? round2((net + pagaEmp) / rows.length) : 0, employeeSharePct: empShare * 100 }, rows,
    notes: ['Net class fund distributed pro rata by workweeks worked in the class period; PAGA employee share by pay periods in the one-year PAGA period.', `PAGA penalties split ${Math.round((1 - empShare) * 100)}% LWDA / ${Math.round(empShare * 100)}% aggrieved employees (Lab. Code § 2699(m)${a.regime === 'post2024' ? ', as amended 2024' : ''}).`, 'Courts review fee awards (often benchmarked at 25%–33⅓% of the common fund), service awards, and the PAGA allocation; PAGA settlements must be submitted to the LWDA and approved by the court.', 'Employer-side payroll taxes on the wage portion are typically paid in addition to the gross unless the agreement says otherwise.'] };
}
