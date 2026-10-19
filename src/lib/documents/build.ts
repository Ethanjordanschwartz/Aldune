import 'server-only';
import { z } from 'zod';
import type { AuditSource } from '../store/types';
import { CATEGORY_LABELS } from '../engine/exposure';
import { attestationPolicy, auditRecord, mealWaiver, settlementPacket, wagePaymentLetter, type Line } from './templates';
import type { DocModel } from './render';

export const DocRequest = z.object({
  template: z.enum(['wage_letter', 'settlement', 'meal_waiver', 'attestation_policy', 'audit_record']),
  format: z.enum(['docx', 'html']).default('docx'),
  employeeIds: z.array(z.string().max(80)).max(500).default([]),
  party: z.object({ employerName: z.string().max(200).optional(), employerAddress: z.string().max(300).optional(), signerName: z.string().max(120).optional(), signerTitle: z.string().max(120).optional(), contact: z.string().max(300).optional() }).default({}),
  settlement: z.object({
    caseCaption: z.string().max(300), court: z.string().max(200), caseNumber: z.string().max(80), plaintiffs: z.string().max(300), plaintiffCounsel: z.string().max(500),
    classPeriodStart: z.string().max(40), claimsSummary: z.string().max(800), complaintLocation: z.string().max(300),
    ratePerWorkweek: z.number().min(0).max(1000).default(0), ratePerFlaggedShift: z.number().min(0).max(1000).default(0), ratePerMonthPhone: z.number().min(0).max(1000).default(0), flatAmount: z.number().min(0).max(100000).default(0),
    wagePct: z.number().min(0).max(100).default(33), considerDays: z.number().min(1).max(60).default(14), paymentDays: z.number().min(1).max(60).default(10),
    includeUndisputed: z.boolean().default(true), spanishAvailable: z.boolean().default(true)
  }).optional(),
  record: z.object({ conductedBy: z.string().max(200).default('Aldune automated audit, reviewed by the employer'), policies: z.string().max(2000).default('No written policies were uploaded for review with this audit'), training: z.string().max(1000).default('No supervisor training date is recorded yet'), statuses: z.record(z.string()).default({}) }).optional()
});
export type DocRequestT = z.infer<typeof DocRequest>;

const today = () => new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
const ACTIONS: Record<string, string> = {
  meal: 'Timeclock warns at 4½ hours and requires a meal punch by the end of the 5th hour; premiums paid automatically from punches.',
  rest: 'End-of-shift attestation; premium paid for every reported missed or interrupted break.',
  regular_rate: 'Payroll configured to include differentials, nondiscretionary bonuses, and commissions in overtime and premium rates.',
  reconciliation: 'Punched hours reconciled to paid hours each period; time edits require employee acknowledgment.',
  min_wage: 'Rate tables updated for state and local minimum wages on effective dates.',
  wage_statement: 'Pay stub template corrected to show all § 226(a) items and sick leave balance.',
  final_pay: 'Final-pay checklist: discharge same day; quit without notice within 72 hours.',
  pay_timing: 'Payroll calendar set so paydays fall within 7 days of period close.',
  expenses: 'Mileage and phone reimbursement policy adopted; back reimbursement paid.',
  classification: 'Affected workers reclassified; overtime and premiums paid back.',
  timekeeping: 'Rounding discontinued; actual punch times paid.'
};

export async function buildDocs(source: AuditSource, req: DocRequestT): Promise<DocModel[]> {
  const summary = await source.summary();
  const party = { ...req.party, employerName: req.party.employerName || summary.employerName };
  if (req.template === 'meal_waiver') return [mealWaiver(party)];
  if (req.template === 'attestation_policy') return [attestationPolicy(party)];
  if (req.template === 'audit_record') {
    const r = req.record || { conductedBy: 'Aldune automated audit, reviewed by the employer', policies: 'No written policies were uploaded for review with this audit', training: 'No supervisor training date is recorded yet', statuses: {} };
    return [auditRecord({ ...party, auditDate: summary.meta.assumptions.auditDate, window: `${summary.meta.windowStart} to ${summary.meta.windowEnd}`, workers: summary.counts.employees, conductedBy: r.conductedBy, policies: r.policies, training: r.training,
      backPay: `${summary.counts.affectedEmployees} workers have findings with estimated amounts. Payment dates: ____________.`,
      findings: summary.categories.map(c => ({ area: CATEGORY_LABELS[c.category], count: c.findings, workers: c.employees, amount: `$${Math.round(c.base).toLocaleString()}`, action: ACTIONS[c.category] || '', status: r.statuses[c.category] || 'Open' })) })];
  }
  const out: DocModel[] = [];
  for (const id of req.employeeIds) {
    const d = await source.employee(id); if (!d) continue;
    const payable = d.findings.filter(f => f.confidence !== 'low' && !f.premiumIndicated && f.amount > 0 && ['wages', 'premium', 'reimbursement'].includes(f.amountKind) && f.status !== 'dismissed');
    const byCat = new Map<string, { amount: number; n: number; kind: string; cite: string }>();
    payable.forEach(f => { const g = byCat.get(f.category) || { amount: 0, n: 0, kind: f.amountKind, cite: f.authorities[0] || '' }; g.amount += f.amount; g.n++; byCat.set(f.category, g); });
    const lines: Line[] = [...byCat.entries()].map(([c, g]) => ({ label: `${CATEGORY_LABELS[c as keyof typeof CATEGORY_LABELS]} (${g.n} item${g.n === 1 ? '' : 's'})`, amount: Math.round(g.amount * 100) / 100, basis: g.cite }));
    const wagesTotal = payable.filter(f => f.amountKind !== 'reimbursement').reduce((t, f) => t + f.amount, 0);
    const reimbursementTotal = payable.filter(f => f.amountKind === 'reimbursement').reduce((t, f) => t + f.amount, 0);
    const undisputed = Math.round((wagesTotal + reimbursementTotal + d.employee.exposure.interest) * 100) / 100;
    if (req.template === 'wage_letter') {
      if (undisputed <= 0) continue;
      out.push(wagePaymentLetter({ ...party, employeeName: d.employee.name, date: today(), lines, interest: d.employee.exposure.interest, wagesTotal: Math.round(wagesTotal * 100) / 100, reimbursementTotal: Math.round(reimbursementTotal * 100) / 100 }));
    } else if (req.template === 'settlement' && req.settlement) {
      const s = req.settlement;
      const weeks = new Set(d.shifts.map(x => { const dt = new Date(`${x.date}T00:00:00Z`); dt.setUTCDate(dt.getUTCDate() - dt.getUTCDay()); return dt.toISOString().slice(0, 10); })).size;
      const flagged = new Set(d.findings.filter(f => (f.category === 'meal' || f.category === 'rest') && f.date).map(f => f.date)).size;
      const months = new Set(d.shifts.map(x => x.date.slice(0, 7))).size;
      const sl: Line[] = [];
      if (s.ratePerWorkweek) sl.push({ label: 'Workweeks worked in the covered period', units: weeks, rate: s.ratePerWorkweek, amount: weeks * s.ratePerWorkweek });
      if (s.ratePerFlaggedShift) sl.push({ label: 'Shifts with disputed meal or rest period records', units: flagged, rate: s.ratePerFlaggedShift, amount: flagged * s.ratePerFlaggedShift });
      if (s.ratePerMonthPhone && d.findings.some(f => f.title.startsWith('Personal phone'))) sl.push({ label: 'Months of disputed personal phone use', units: months, rate: s.ratePerMonthPhone, amount: months * s.ratePerMonthPhone });
      if (s.flatAmount) sl.push({ label: 'Additional settlement amount', amount: s.flatAmount });
      if (!sl.length) continue;
      out.push(...settlementPacket({ ...party, employeeName: d.employee.name, date: today(), ...s, lines: sl, undisputedPaid: s.includeUndisputed && undisputed > 0 ? { amount: undisputed, date: '[date paid]' } : null }));
    }
  }
  return out;
}
