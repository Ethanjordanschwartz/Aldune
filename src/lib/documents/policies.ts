// Complete, adoptable California workplace policies and the payroll configuration memo.
// Each policy is written to be issued as-is once counsel signs off: purpose and scope, definitions, the rule, how to
// comply, pay consequences, recordkeeping, complaint path, non-retaliation, and an acknowledgment. Authorities are the
// statutes, Wage Order sections, and California Supreme Court decisions that control each rule.
import type { Block, DocModel } from './render';

const DRAFT = 'DRAFT — prepared with software. Have California employment counsel review before adopting.';
export interface PolicyParty { employerName: string; employerAddress?: string; signerName?: string; signerTitle?: string; contact?: string; effectiveDate?: string; phoneStipend?: number | string }

const fmtDate = (s?: string) => { if (!s) return ''; const d = new Date(s + 'T12:00:00Z'); return isNaN(+d) ? s : d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }); };
const contactOf = (p: PolicyParty) => (p.contact && p.contact.trim()) || `Human Resources at ${p.employerName}`;
const P = (text: string): Block => ({ t: 'p', align: 'justify', runs: [text] });
const H = (text: string): Block => ({ t: 'heading', text });
const L = (...items: string[]): Block => ({ t: 'bullets', items: items.map(i => [i]) });

function frame(p: PolicyParty, title: string, authority: string, body: Block[], ackTopic: string): DocModel {
  const eff = p.effectiveDate ? fmtDate(p.effectiveDate) : 'the date this policy is distributed to employees';
  return { title, draftBanner: DRAFT, blocks: [
    { t: 'title', text: title },
    { t: 'p', align: 'center', runs: [{ text: p.employerName, bold: true }] },
    { t: 'p', align: 'center', runs: [{ text: `Effective ${eff}`, italic: true }] },
    { t: 'p', runs: [{ text: `Authority: ${authority}`, italic: true }] },
    ...body,
    H('Questions and complaints'),
    P(`Direct questions about this policy, or any concern that it is not being followed, to ${contactOf(p)}. You may raise a concern with any manager, and you are never required to raise it with the supervisor involved. The Company will look into every concern promptly and correct any pay that is owed. You also have the right to contact the California Labor Commissioner (Division of Labor Standards Enforcement).`),
    H('No retaliation'),
    P(`${p.employerName} prohibits retaliation against anyone who asks about pay, reports a missed or interrupted break, reports unrecorded work, files a complaint, or participates in an investigation (Lab. Code §§ 98.6, 232.5, 1102.5). A supervisor who retaliates, or who discourages an employee from following this policy, is subject to discipline up to and including termination.`),
    H('Changes to this policy'),
    P('The Company may revise this policy to keep it current with the law. Where this policy and a more protective law, regulation, Wage Order, or local ordinance differ, the more protective rule applies.'),
    { t: 'pagebreak' },
    { t: 'title', text: 'Employee Acknowledgment' },
    P(`I received and read ${p.employerName}’s ${ackTopic}. I understand it, I had the opportunity to ask questions, and I know whom to contact if I have a concern. I understand that I am expected to follow the policy and that I will be paid for all time worked and for any premium owed under it.`),
    { t: 'signature', lines: [{ label: 'Employee signature' }, { label: 'Printed name' }, { label: 'Date' }] },
    P('A copy of this signed acknowledgment is kept in the employee’s personnel file. The employee receives a copy of the policy.')
  ] };
}

// ---------------------------------------------------------------------------------------------------------------
export function mealRestPolicyFull(p: PolicyParty): DocModel {
  return frame(p, 'Meal and Rest Period Policy', 'Labor Code §§ 226.7, 512, 516; IWC Wage Orders §§ 11–12; Brinker Restaurant Corp. v. Superior Court (2012) 53 Cal.4th 1004; Augustus v. ABM Security Services (2016) 2 Cal.5th 257; Donohue v. AMN Services (2021) 11 Cal.5th 58; Ferra v. Loews Hollywood Hotel (2021) 11 Cal.5th 858; Naranjo v. Spectrum Security Services (2022) 13 Cal.5th 93', [
    H('1. Purpose and scope'),
    P(`This policy explains how ${p.employerName} provides meal periods and authorizes and permits rest periods for every non-exempt (hourly or salaried non-exempt) employee working in California, and how premium pay is paid when a compliant break is not provided. It applies at every location, on every shift, including remote work and travel days.`),
    H('2. Meal periods'),
    L('First meal period. If you work more than five hours in a workday, you will be provided an uninterrupted, duty-free meal period of at least 30 minutes that begins no later than the end of your fifth hour of work. Plan to start your meal before you reach 5 hours on the clock — at 4 hours 59 minutes at the latest.',
      'Second meal period. If you work more than ten hours in a workday, you will be provided a second uninterrupted, duty-free meal period of at least 30 minutes that begins no later than the end of your tenth hour of work.',
      'Duty-free means duty-free. During a meal period you are relieved of all duty and all control by the Company. You may leave the premises, you are not on call, and you will not be asked to answer phones, watch a register, monitor a radio, or stay available. If you are interrupted for any reason, tell your supervisor; the meal period must be restarted or a premium is owed.',
      'Clock out and back in for every meal period. Meal punches are never rounded, and no meal period is ever deducted automatically. If you forget to punch, report the actual times the same day using the time-correction process in the Timekeeping Policy.',
      'Meal periods are unpaid unless an on-duty meal period has been agreed to in writing (section 4).')
    ,
    H('3. Meal period waivers'),
    L('First meal. If your total workday is no more than six hours, you and the Company may agree in writing to waive the first meal period.',
      'Second meal. If your total workday is no more than twelve hours, you and the Company may agree in writing to waive the second meal period, but only if you took the first meal period that day.',
      'Waivers are voluntary. You will never be required to sign a waiver as a condition of hire, scheduling, or continued employment, and you may revoke a waiver at any time by telling Human Resources or your supervisor in writing. A waiver on file never permits a workday longer than the limits above without a meal period.',
      'The Company keeps signed waivers with your personnel file and gives you a copy.'),
    H('4. On-duty meal periods'),
    P('An on-duty meal period is permitted only when the nature of the work prevents you from being relieved of all duty (for example, a single employee who must remain at a site), the Company and you agree to it in a written agreement that states you may revoke it in writing at any time, and the on-duty meal period is paid as time worked (Wage Order § 11). The Company does not use on-duty meal periods unless a separate written agreement is in place for your position.'),
    H('5. Rest periods'),
    P('You are authorized and permitted to take a paid, duty-free 10-minute rest period for every four hours worked or major fraction of four hours. A rest period is not required if your total daily work time is less than three and one-half hours.'),
    { t: 'table', head: ['Hours worked in the day', 'Paid 10-minute rest periods'], rows: [['Less than 3½', '0'], ['3½ up to 6', '1'], ['More than 6 up to 10', '2'], ['More than 10 up to 14', '3'], ['More than 14 up to 18', '4']] },
    L('Timing. Take rest periods in the middle of each work period as far as practicable — one before and one after the meal period on a typical eight-hour shift. Rest periods may not be combined with a meal period or used to start late or leave early.',
      'Rest periods are paid and are not recorded as time off the clock. You do not clock out for a rest period.',
      'Relieved of all duty. During a rest period you are not on call, are not required to carry or monitor a radio or phone for work, and may leave your work area (Augustus v. ABM Security Services).',
      'Rest periods cannot be waived or traded for pay. If a rest period is not authorized and permitted, a premium is owed (section 7).'),
    H('6. Cool-down recovery periods and lactation breaks'),
    L('Employees working outdoors, or indoors where heat-illness rules apply, may take a preventative cool-down recovery period in the shade or a cool area whenever they feel the need to protect themselves from overheating (Cal. Code Regs., tit. 8, §§ 3395, 3396). Recovery periods are paid, and a premium is owed if one is not provided (Lab. Code § 226.7).',
      'Employees who need to express breast milk receive reasonable break time each time they need it, and a private lactation space other than a restroom (Lab. Code §§ 1030–1034). Lactation time runs concurrently with rest periods where possible; additional time may be unpaid if you are relieved of duty.'),
    H('7. Premium pay when a break is not provided'),
    L('If a compliant meal period is not provided — missed, shorter than 30 minutes, started after the deadline, or interrupted — you will be paid one additional hour of pay at your regular rate of compensation for that workday.',
      'If a compliant rest or recovery period is not authorized and permitted, you will be paid one additional hour of pay at your regular rate of compensation for that workday.',
      'At most one meal premium and one rest premium are paid per workday (Lab. Code § 226.7(c)).',
      '“Regular rate of compensation” includes your hourly rate plus shift differentials, nondiscretionary bonuses, commissions, and other nondiscretionary pay, the same rate used for overtime (Ferra v. Loews Hollywood Hotel).',
      'Premiums are wages. They are paid on the payday for the period in which the workday falls, shown as a separate line on your wage statement, and included in final pay (Naranjo v. Spectrum Security Services).'),
    H('8. End-of-shift attestation'),
    P('At the end of each shift the timekeeping system asks whether you were provided every meal and rest period you were entitled to that day. Answer honestly. If you answer “no,” or if your punches show a late, short, or missed meal, the premium is paid automatically on the next payroll; you do not need to request it. If you chose to take a later or shorter meal than the Company provided, you may record that choice in the attestation, and payroll will review it before deciding whether a premium is owed (Donohue v. AMN Services).'),
    H('9. Supervisor responsibilities'),
    L('Schedule each employee’s first meal to begin before the end of the fifth hour, and rest periods near the middle of each work period, and post or communicate the schedule each shift.',
      'Arrange relief coverage so breaks can actually be taken, including on closing shifts, weekends, and short-staffed days.',
      'Never discourage, delay, interrupt, or shorten a break, and never ask an employee to skip a break to finish a task.',
      'Never edit a meal punch except to correct an actual recording error with the employee’s written acknowledgment.',
      'Report any pattern of missed or late breaks to Human Resources so staffing can be corrected.'),
    H('10. Records'),
    P('The Company records the start and end of each meal period and keeps time records, waivers, attestations, and premium payments for at least four years — longer than the three years required by Labor Code § 1174(d) and Wage Order § 7(C). You may inspect or receive a copy of your time and payroll records on request (Lab. Code §§ 226(b), 1198.5).')
  ], 'Meal and Rest Period Policy');
}

// ---------------------------------------------------------------------------------------------------------------
export function timekeepingPolicyFull(p: PolicyParty): DocModel {
  return frame(p, 'Timekeeping, Hours Worked, and Off-the-Clock Work Policy', 'Labor Code §§ 204, 226, 510, 511, 1174, 1194, 1198; IWC Wage Orders §§ 2(K), 3, 4(C), 5, 7; Morillion v. Royal Packing Co. (2000) 22 Cal.4th 575; Troester v. Starbucks Corp. (2018) 5 Cal.5th 829; Frlekin v. Apple Inc. (2020) 8 Cal.5th 1038; Donohue v. AMN Services (2021) 11 Cal.5th 58; Huerta v. CSI Electrical Contractors (2024) 15 Cal.5th 908', [
    H('1. Purpose and scope'),
    P(`${p.employerName} pays every non-exempt employee for all time worked. This policy explains what counts as time worked, how to record it accurately, how overtime is paid, and how errors are corrected. It applies to every non-exempt employee in California, including remote and traveling employees.`),
    H('2. What counts as hours worked'),
    P('Hours worked means any time you are subject to the Company’s control, and any time you are suffered or permitted to work, whether or not you are required to work (Wage Order § 2(K)). California has no “de minimis” exception: short periods of work are paid (Troester v. Starbucks). Hours worked includes, for example:'),
    L('Opening and closing tasks, setting up or shutting down equipment, counting a drawer, and logging into or out of computers, phones, and apps used for work.',
      'Required security, bag, or badge screenings and time waiting to pass through them (Frlekin v. Apple; Huerta v. CSI Electrical Contractors).',
      'Putting on and taking off required protective gear or uniforms that must be changed at work.',
      'Required meetings, training, orientation, and safety briefings, wherever held.',
      'Travel between work sites during the day, and required travel in Company-provided transportation (Morillion v. Royal Packing).',
      'Answering work calls, texts, emails, or messaging apps outside your scheduled shift.',
      'Waiting for work when the Company requires you to be present, and on-call time that restricts your personal activities.',
      'Paid rest periods.'),
    H('3. How to record time'),
    L('Clock in when you begin any work and clock out when all work is finished. Clock out and in for each meal period.',
      'Record only your own time. Clocking in or out for another employee, or asking someone to do so for you, is prohibited.',
      'If you forget to punch or the system fails, submit a time-correction request with the actual times no later than your next shift. Your supervisor approves the correction; your pay is never delayed beyond the next regular payday because of a missed punch.',
      'Review your hours each pay period and report any error immediately.'),
    H('4. Pay to the minute — no rounding, no automatic deductions'),
    P('The Company pays all time to the minute. Punch times are not rounded, and no meal period or other time is deducted automatically. Every edit to a time record keeps the original punch, the reason, the person who made the edit, and the employee’s acknowledgment. A supervisor may not change your time without your acknowledgment.'),
    H('5. Off-the-clock work is prohibited'),
    P('Do not perform any work before clocking in, after clocking out, or during an unpaid meal period — even if you volunteer or the task is brief. No supervisor may ask, encourage, or allow you to work off the clock. If you are asked to, or if you work time that is not recorded, report it to Human Resources; the time will be paid on the next payroll, and the request will be investigated.'),
    H('6. Overtime and double time'),
    { t: 'table', head: ['Hours', 'Rate'], rows: [['Over 8 in a workday, up to 12', '1.5 × regular rate'], ['Over 40 in a workweek (not already paid as daily overtime)', '1.5 × regular rate'], ['First 8 hours on the seventh consecutive workday in a workweek', '1.5 × regular rate'], ['Over 12 in a workday', '2 × regular rate'], ['Over 8 on the seventh consecutive workday', '2 × regular rate']] },
    L('The workweek begins at 12:00 a.m. Sunday and ends at 11:59 p.m. Saturday unless the Company notifies you in writing of a different fixed workweek.',
      'Your regular rate includes shift differentials, nondiscretionary bonuses, commissions, and other nondiscretionary pay, not just your base hourly rate (Lab. Code § 510).',
      'Overtime must be approved in advance by your supervisor. All overtime worked is paid whether or not it was approved; working unapproved overtime is addressed through coaching, never by withholding pay.',
      'An alternative workweek schedule applies only if adopted by secret-ballot election and reported to the Division of Labor Statistics and Research under Labor Code § 511.'),
    H('7. Reporting-time and split-shift pay'),
    L('Reporting-time pay. If you report to work as scheduled and are given less than half of your scheduled shift, you are paid for half the scheduled shift (at least two hours and no more than four), at your regular rate (Wage Order § 5).',
      'Split shifts. If your workday has an unpaid break of more than one hour that is not a bona fide meal period, you receive one additional hour at the minimum wage, reduced only by the amount your pay that day exceeds the minimum wage for all hours worked (Wage Order § 4(C)).'),
    H('8. Paydays and wage statements'),
    P('Wages are paid on regular paydays no later than the deadlines in Labor Code section 204. Each payday you receive an itemized wage statement showing gross and net wages, total hours, every hourly rate and the hours at each rate, piece-rate units and rates if any, all deductions, the pay period dates, your name and employee ID, the Company’s legal name and address, and your paid sick leave balance (Lab. Code §§ 226(a), 246(i)).'),
    H('9. Remote work'),
    P('If you work remotely, record all work time the same way, including time spent logging in, on calls, and responding to messages. Keep to your scheduled meal and rest periods. Necessary remote-work expenses are reimbursed under the Business Expense Reimbursement Policy.'),
    H('10. Records'),
    P('The Company keeps accurate time records for every non-exempt employee, including the start and end of each work period and meal period and total daily hours, for at least four years — longer than the three years required by Labor Code § 1174(d) and Wage Order § 7(C). You may request to inspect or copy your payroll records; the Company responds within 21 days (Lab. Code § 226(b)–(c)), and personnel files within 30 days (Lab. Code § 1198.5).')
  ], 'Timekeeping, Hours Worked, and Off-the-Clock Work Policy');
}

// ---------------------------------------------------------------------------------------------------------------
export function expensePolicyFull(p: PolicyParty): DocModel {
  const stip = p.phoneStipend !== undefined && p.phoneStipend !== '' && Number(p.phoneStipend) > 0 ? `$${Number(p.phoneStipend).toFixed(2)}` : '';
  return frame(p, 'Business Expense Reimbursement Policy', 'Labor Code §§ 2802, 2804; IWC Wage Orders §§ 8, 9; Gattuso v. Harte-Hanks Shoppers, Inc. (2007) 42 Cal.4th 554; Cochran v. Schwan’s Home Service, Inc. (2014) 228 Cal.App.4th 1137', [
    H('1. Purpose and scope'),
    P(`${p.employerName} reimburses employees for all necessary expenditures and losses they incur in direct consequence of their work or in following the Company’s directions (Lab. Code § 2802(a)). This policy applies to every employee in California, exempt and non-exempt. The right to reimbursement cannot be waived (Lab. Code § 2804).`),
    H('2. What is reimbursed'),
    L('Business mileage. Driving your personal vehicle for work — between work sites, to customer or vendor locations, to the bank or post office for the Company, or from home to a temporary work location beyond your normal commute — is reimbursed at the IRS standard business mileage rate in effect on the date of travel. Your regular commute between home and your usual work location is not reimbursed.',
      `Personal cell phone. If you use a personal cell phone for work calls, texts, apps, or email, the Company reimburses a reasonable percentage of your monthly bill, even if you have an unlimited plan and your bill does not increase (Cochran v. Schwan’s Home Service). ${stip ? `The Company pays a fixed reimbursement of ${stip} per month to each employee who uses a personal phone for work.` : 'The Company pays a fixed monthly phone reimbursement set out in your reimbursement election form.'} If your actual work-related share is higher, submit your bill and the Company pays the difference.`,
      'Home internet and remote-work costs. If you are required or approved to work from home, the Company reimburses a reasonable share of internet service and any equipment or supplies it requires you to use.',
      'Uniforms. If the Company requires a uniform (clothing of a distinctive design or color), the Company provides and maintains it at no cost to you (Wage Order § 9(A)).',
      'Tools and equipment. The Company provides the tools and equipment your job requires. Employees paid at least twice the state minimum wage may be asked to provide hand tools customary to their trade; all other tools are provided by the Company (Wage Order § 9(B)).',
      'Travel. Airfare, lodging, meals, rideshare, parking, and tolls for approved business travel.',
      'Required licenses, certifications, and training the Company requires for your position, and work-related supplies you purchase at the Company’s direction.'),
    H('3. How reimbursement is calculated'),
    P('The Company may reimburse actual costs, a mileage rate, or a fixed allowance (Gattuso v. Harte-Hanks). A fixed allowance is a minimum, not a cap: if your actual necessary expenses are higher than the allowance, submit documentation and the Company pays the difference.'),
    H('4. How to submit'),
    L('Submit an expense report with receipts (or a mileage log showing date, purpose, start and end points, and miles) within 30 days after the expense, or as soon as you can.',
      'The 30-day timeline keeps records accurate. A late request is still reimbursed; the Company never forfeits a necessary business expense because it was submitted late.',
      'Approved expenses are reimbursed no later than the next regular payday after the report is submitted. If documentation is missing, Human Resources will help you reconstruct it; lack of a receipt is not, by itself, a reason to deny a necessary expense.',
      'Reimbursements are shown separately from wages and are not taxable income when paid under this policy.'),
    H('5. No deductions for losses or breakage'),
    P('The Company does not deduct from wages, or require you to pay, for cash shortages, breakage, or loss of equipment unless the loss was caused by a dishonest or willful act or by your gross negligence, as permitted by Wage Order § 8.'),
    H('6. Interest'),
    P('Necessary expenses not reimbursed when due carry interest from the date the expense was incurred at the rate for civil judgments (Lab. Code § 2802(b)).')
  ], 'Business Expense Reimbursement Policy');
}

// ---------------------------------------------------------------------------------------------------------------
export interface ConfigCtx { date: string; categories?: string[]; locations?: { name: string; rate: number; source?: string }[]; items?: string[]; payFrequency?: string }
const CFG: Record<string, [string, string, string]> = {
  meal: ['Meal premium earnings code', 'Create a separate earnings code “Meal premium.” Pay one hour at the regular rate of compensation automatically for any workday with a missing meal punch, a meal under 30 minutes, a meal starting after 5:00 hours worked (or a second meal after 10:00 hours on days over 10 hours), unless a valid written waiver applies to that day or the employee’s attestation records a voluntary choice that payroll has reviewed. Never auto-deduct meal time.', 'Lab. Code §§ 226.7, 512; Donohue (2021) 11 Cal.5th 58'],
  rest: ['Rest premium earnings code', 'Create a separate earnings code “Rest premium.” Pay one hour at the regular rate of compensation for any workday the end-of-shift attestation reports a missed or interrupted rest period. Limit: one rest premium per workday.', 'Lab. Code § 226.7; Wage Order § 12'],
  regular_rate: ['Regular rate of compensation', 'Compute the regular rate each workweek as (straight-time pay + shift differentials + nondiscretionary bonuses + commissions + other nondiscretionary pay) ÷ total hours worked. For flat-sum bonuses, divide the bonus by straight-time hours only (Alvarado). Use this rate for overtime, double time, meal/rest premiums, and paid sick leave. Allocate bonuses earned over multiple weeks to those weeks and pay the overtime true-up.', 'Lab. Code §§ 510, 226.7, 246(l); Alvarado (2018) 4 Cal.5th 542; Ferra (2021) 11 Cal.5th 858'],
  overtime: ['Daily, weekly, and seventh-day overtime', 'Pay 1.5× the regular rate over 8 hours a day and 40 a week and for the first 8 hours of the seventh consecutive day; 2× over 12 hours a day and over 8 on the seventh consecutive day. Set the workweek to the employer’s fixed workweek. Apply an alternative workweek threshold only for employees covered by a valid § 511 election.', 'Lab. Code §§ 510, 511'],
  reconciliation: ['Pay all recorded time', 'Pay from actual punches to the minute. Turn off rounding rules and any automatic adjustments. Reconcile hours paid to hours recorded every payroll and require an approver note plus employee acknowledgment for each time edit; keep the original punch in the audit log.', 'Lab. Code §§ 1174, 1194, 1198; Troester (2018) 5 Cal.5th 829'],
  timekeeping: ['Rounding and automatic deductions off', 'Disable punch rounding and automatic meal deductions in every timekeeping system and device. Record badge/security entry times where available and pay from the first compensable activity.', 'Donohue (2021) 11 Cal.5th 58; Frlekin (2020) 8 Cal.5th 1038'],
  min_wage: ['Minimum wage by work location', 'Load effective-dated state, city/county, and industry minimum wages by work location (table below) and block any rate below the applicable minimum. Update January 1 and July 1 each year; re-check the exempt salary floor (2 × state minimum × 2,080) each January.', 'Lab. Code §§ 1182.12, 1197, 515(a); local ordinances'],
  split_shift: ['Split-shift premium', 'When a workday has an unpaid gap of more than one hour that is not a meal period, add one hour at the state minimum wage, reduced only by the amount the day’s pay exceeds the minimum wage for all hours worked.', 'Wage Order § 4(C); Cal. Code Regs., tit. 8, § 11040 et seq.'],
  reporting_time: ['Reporting-time pay', 'When an employee reports for a scheduled shift and is furnished less than half of it, pay half the scheduled shift (minimum 2, maximum 4 hours) at the regular rate.', 'Wage Order § 5'],
  wage_statement: ['Wage statement template', 'Show on every statement: gross wages; total hours worked; piece-rate units and rates; every deduction; net wages; pay period start and end dates; employee name and last four digits of SSN or employee ID; employer legal name and address; every hourly rate in effect with the hours at each rate; meal and rest premiums as separate lines; paid sick leave balance. For piece-rate workers also show rest/recovery and nonproductive hours, rates, and pay.', 'Lab. Code §§ 226(a), 226.2, 246(i)'],
  pay_timing: ['Paydays', 'Set paydays within 7 calendar days after the end of each weekly or biweekly period (semimonthly: by the 26th for the 1st–15th and by the 10th of the next month for the 16th–end). Post the payday notice.', 'Lab. Code §§ 204, 207'],
  final_pay: ['Final pay', 'Involuntary terminations: pay all wages, including accrued unused vacation/PTO, at the time of termination. Resignations with 72+ hours’ notice: on the last day; otherwise within 72 hours. Include all premiums and commissions earned.', 'Lab. Code §§ 201, 202, 203, 227.3'],
  vacation: ['Vacation/PTO payout', 'Treat vested vacation/PTO as wages; disable any “use it or lose it” forfeiture; pay out all accrued unused balance at the final rate on separation. A reasonable accrual cap is permitted.', 'Lab. Code § 227.3; Suastez v. Plastic Dress-Up Co. (1982) 31 Cal.3d 774'],
  sick_leave: ['Paid sick leave', 'Accrue at least 1 hour per 30 hours worked (or front-load 40 hours/5 days each year); allow use of at least 40 hours/5 days per year; cap accrual no lower than 80 hours/10 days; pay at the regular rate (non-exempt) and show the balance on wage statements.', 'Lab. Code §§ 245–249'],
  expenses: ['Reimbursement codes', 'Add non-taxable reimbursement codes for mileage (IRS standard rate), personal phone (monthly), and remote-work costs; pay on the next regular payday after submission.', 'Lab. Code § 2802'],
  classification: ['Exempt status checks', 'Flag every exempt employee whose annual salary falls below the exempt floor or whose duties do not meet the exemption; convert reclassified employees to hourly with overtime and premiums from the effective date, and issue a § 2810.5 notice.', 'Lab. Code §§ 515, 515.5, 2810.5'],
  piece_rate: ['Piece-rate rest/recovery and nonproductive time', 'Pay rest and recovery periods separately at the higher of the workweek average hourly rate (piece earnings ÷ hours excluding rest/recovery) or minimum wage, and nonproductive time at no less than minimum wage; show both on wage statements.', 'Lab. Code § 226.2'],
  tips: ['Tips and gratuities', 'Pass through 100% of tips (card tips in full, with no deduction for card processing fees, no later than the next regular payday); pay at least the full minimum wage with no tip credit; allow tip pooling only among non-managerial employees.', 'Lab. Code §§ 350, 351, 353'],
};
export function payrollConfigMemoFull(p: PolicyParty, c: ConfigCtx): DocModel {
  const base = ['regular_rate', 'overtime', 'meal', 'rest', 'reconciliation', 'wage_statement', 'min_wage', 'sick_leave'];
  const keys = [...new Set([...(c.categories || []).filter(k => CFG[k]), ...base])];
  const flagged = new Set(c.categories || []);
  const rows = keys.map((k, i) => [String(i + 1), CFG[k][0] + (flagged.has(k) ? ' (found in audit)' : ''), CFG[k][1], CFG[k][2]]);
  const blocks: Block[] = [
    { t: 'title', text: 'Payroll and Timekeeping Configuration Changes' },
    { t: 'p', runs: [{ text: `To: Payroll provider and payroll administrator\nFrom: ${p.employerName}${p.signerName ? ` — ${p.signerName}${p.signerTitle ? `, ${p.signerTitle}` : ''}` : ''}\nDate: ${fmtDate(c.date) || c.date}\nRe: Required configuration for California compliance`, bold: false }] },
    P(`${p.employerName} completed a review of its California time and payroll records. Please implement each change below in every payroll and timekeeping system used for California employees, effective with the first pay period that begins after you receive this memo, and confirm in writing using the confirmation at the end. Items marked “found in audit” correspond to issues the review identified; the others are standing California requirements to verify.`),
    { t: 'table', head: ['#', 'Setting', 'Required configuration', 'Authority'], rows, widths: [5, 20, 55, 20] },
  ];
  if (c.locations && c.locations.length) blocks.push(H('Minimum wage table by work location'), { t: 'table', head: ['Work location', 'Minimum hourly rate', 'Source'], rows: c.locations.map(l => [l.name, `$${l.rate.toFixed(2)}`, l.source || '']) }, P('Rates shown are those in effect on the memo date. Load future effective dates as each jurisdiction publishes them (most change January 1; some, such as Los Angeles City and County, July 1).'));
  if (c.items && c.items.length) blocks.push(H('Additional items'), L(...c.items));
  blocks.push(
    H('Testing before go-live'),
    L('Run a parallel payroll for one pay period and compare to the current system: overtime at the regular rate, meal and rest premium lines, and minimum wage by location.',
      'Send a sample wage statement for one hourly, one salaried non-exempt, and (if applicable) one piece-rate or tipped employee for review against Labor Code § 226(a).',
      'Confirm that rounding and automatic meal deductions are disabled on every timeclock and mobile app.'),
    H('Confirmation'),
    P('The undersigned confirms that each change above has been implemented as described, effective for the pay period beginning on the date stated.'),
    { t: 'signature', lines: [{ label: 'Payroll provider / administrator (name and title)' }, { label: 'Effective pay period begins' }, { label: 'Date' }] }
  );
  return { title: 'Payroll configuration change memo', draftBanner: DRAFT, blocks };
}
