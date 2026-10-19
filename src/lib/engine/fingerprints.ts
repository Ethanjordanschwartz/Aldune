// Violation fingerprints (spec Vol. IV §§ 47, 51–52): system-level signatures — a misconfigured payroll or time
// system produces thousands of findings. Each fingerprint is deterministic, explains its evidence, and maps to authority.
import type { AuditInput } from './types';
import type { AuditResult } from './audit';
export interface Fingerprint { id: string; title: string; evidence: string; meaning: string; fix: string; cite: string; strength: 'strong' | 'moderate'; affected: number }
export function fingerprints(input: AuditInput, r: AuditResult): Fingerprint[] {
  const out: Fingerprint[] = []; const shifts = r.engine.shifts; const pay = input.payroll;
  // 1) weekly-only overtime: daily OT required in weeks of 40 hours or less, but payroll shows no OT for the period
  if (pay.length && shifts.length) {
    const wk = new Map<string, { worked: number; dailyOT: number }>();
    for (const s of shifts) { const k = `${s.employeeId}|${s.weekStart}`; const w = wk.get(k) || { worked: 0, dailyOT: 0 }; w.worked += s.workedMin / 60; w.dailyOT += s.reqOT + s.reqDT; wk.set(k, w); }
    let periods = 0, unpaid = 0; const emps = new Set<string>();
    // index weeks by employee once (was O(pay periods × all weeks) — minutes on large payrolls)
    const byEmp = new Map<string, { ws: string; worked: number; dailyOT: number }[]>();
    for (const [k, w] of wk) { const [id, ws] = k.split('|'); if (!byEmp.has(id)) byEmp.set(id, []); byEmp.get(id)!.push({ ws, ...w }); }
    for (const p of pay) {
      const weeks = (byEmp.get(p.employeeId) || []).filter(w => w.ws >= p.periodStart && w.ws <= p.periodEnd);
      const daily = weeks.filter(w => w.worked <= 40 && w.dailyOT > 0.25).reduce((t, w) => t + w.dailyOT, 0);
      if (daily > 0.25) { periods++; if ((p.otHours || 0) + (p.dtHours || 0) < 0.05) { unpaid++; emps.add(p.employeeId); } }
    }
    if (periods >= 3 && unpaid / periods >= 0.7) out.push({ id: 'weekly_only_ot', title: 'Payroll appears to pay overtime only after 40 hours a week', evidence: `In ${unpaid} of ${periods} pay periods where shifts exceeded 8 hours in weeks of 40 hours or less, no overtime was paid.`, meaning: 'A weekly-only overtime rule (common in multistate payroll setups) misses California’s daily overtime and double time — the error repeats every long shift.', fix: 'Configure daily overtime (1.5× after 8 hours, 2× after 12) and seventh-day rules; back-pay the differential.', cite: 'Lab. Code § 510', strength: unpaid / periods >= 0.9 ? 'strong' : 'moderate', affected: emps.size });
  }
  // 2) premiums at base rate while the regular rate is higher (Ferra)
  const prem = pay.filter(p => (p.premiumHours || 0) > 0 && p.premiumRate && p.regRate && (p.shiftDiffPay + p.commission + (p.bonusType === 'discretionary' ? 0 : p.bonus)) > 0);
  const atBase = prem.filter(p => Math.abs((p.premiumRate || 0) - (p.regRate || 0)) < 0.01);
  if (prem.length >= 3 && atBase.length / prem.length >= 0.7) out.push({ id: 'base_rate_premiums', title: 'Meal/rest premiums are paid at the base rate', evidence: `${atBase.length} of ${prem.length} pay periods with premiums and other nondiscretionary pay used the base hourly rate for premiums.`, meaning: 'Premiums must be paid at the regular rate of compensation, which includes differentials, commissions, and nondiscretionary bonuses; the shortfall recurs in every such period.', fix: 'Compute premiums at the regular rate and back-pay the difference (retroactive).', cite: 'Lab. Code § 226.7; Ferra v. Loews Hollywood Hotel (2021) 11 Cal.5th 858', strength: 'strong', affected: new Set(atBase.map(p => p.employeeId)).size });
  // 3) premium pay not configured: many meal issues, zero premiums anywhere in payroll
  const mealIssues = r.engine.findings.filter(f => f.category === 'meal' && f.confidence !== 'low').length;
  const anyPremium = pay.some(p => (p.premiumHours || 0) > 0 || (p.premiumPay || 0) > 0);
  if (pay.length && mealIssues >= 10 && !anyPremium) out.push({ id: 'no_premium_pay', title: 'No meal or rest premiums are ever paid', evidence: `${mealIssues.toLocaleString()} potential meal issues, and no premium pay appears anywhere in payroll.`, meaning: 'Premium pay is not configured — every noncompliant meal becomes unpaid wages plus derivative wage-statement and waiting-time exposure.', fix: 'Set up an automatic premium earnings code (one hour at the regular rate per day) triggered by late, short, or missed meals.', cite: 'Lab. Code § 226.7; Naranjo (2022) 13 Cal.5th 93', strength: 'strong', affected: new Set(r.engine.findings.filter(f => f.category === 'meal').map(f => f.employeeId)).size });
  // 4) rounding: punches cluster on quarter hours
  const punches = input.timeRecords.flatMap(t => [t.clockIn, t.clockOut]).filter((x): x is number => x !== null);
  const q = punches.filter(p => p % 15 === 0).length;
  if (punches.length >= 40 && q / punches.length >= 0.85) out.push({ id: 'rounded_punches', title: 'Punches are rounded to the quarter hour', evidence: `${Math.round(q / punches.length * 100)}% of ${punches.length.toLocaleString()} punches fall exactly on :00, :15, :30, or :45 (about 27% would by chance at 5-minute granularity).`, meaning: 'Rounding where actual minutes can be captured is high-risk (Camp, review granted); rounding meal punches is unlawful (Donohue).', fix: 'Pay to the minute; stop rounding meal punches.', cite: 'Donohue v. AMN Services (2021) 11 Cal.5th 58; Camp v. Home Depot (2022) 84 Cal.App.5th 638 (review granted)', strength: 'moderate', affected: new Set(input.timeRecords.filter(t => t.clockIn !== null && t.clockIn % 15 === 0).map(t => t.employeeId)).size });
  // 5) auto-deducted meals: nearly every recorded meal is exactly 30 minutes
  const meals = input.timeRecords.flatMap(t => t.meals.filter(m => m.out !== null && m.in !== null).map(m => ({ len: (m.in! - m.out! + 1440) % 1440, id: t.employeeId })));
  const thirty = meals.filter(m => m.len === 30).length;
  if (meals.length >= 30 && thirty / meals.length >= 0.9) out.push({ id: 'auto_deducted_meals', title: 'Meal periods look automatically deducted', evidence: `${Math.round(thirty / meals.length * 100)}% of ${meals.length.toLocaleString()} recorded meals are exactly 30 minutes.`, meaning: 'Auto-deducted meals hide missed, short, and late meals and are a common class theory.', fix: 'Require actual meal punches; turn off automatic deductions.', cite: 'Donohue (2021) 11 Cal.5th 58; IWC Wage Orders § 7(A)(3)', strength: 'moderate', affected: new Set(meals.map(m => m.id)).size });
  return out;
}
