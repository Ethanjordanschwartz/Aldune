import type { Block, DocModel } from './render';
import { mealRestPolicyFull, expensePolicyFull, timekeepingPolicyFull, payrollConfigMemoFull } from './policies';

const DRAFT = 'DRAFT TEMPLATE — prepared with software. Have California employment counsel review and adapt before use.';
const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const blank = (v: string | undefined, fallback: string) => (v && v.trim() ? v.trim() : fallback);

export interface Party { employerName: string; employerAddress?: string; signerName?: string; signerTitle?: string; contact?: string }
export interface Line { label: string; units?: number; rate?: number; amount: number; basis?: string }

// =====================================================================================
// 1. Unconditional wage payment letter (no release). Labor Code §§ 206, 206.5.
// =====================================================================================
export function wagePaymentLetter(p: Party & { employeeName: string; date: string; lines: Line[]; interest: number; wagesTotal: number; reimbursementTotal: number }): DocModel {
  const total = p.wagesTotal + p.reimbursementTotal + p.interest;
  const blocks: Block[] = [
    { t: 'p', runs: [{ text: p.employerName, bold: true }] },
    { t: 'p', runs: [(p.employerAddress || '').trim()] },
    { t: 'p', runs: [p.date] },
    { t: 'p', runs: [p.employeeName, ...((p as { employeeAddress?: string }).employeeAddress ? ['\n', (p as { employeeAddress?: string }).employeeAddress!] : [])] },
    { t: 'p', runs: [{ text: 'Re: Payment of additional wages', bold: true }] },
    { t: 'p', runs: [`Dear ${p.employeeName.split(' ')[0]}:`] },
    { t: 'p', align: 'justify', runs: [`${p.employerName} recently reviewed its timekeeping and payroll records. Based on that review, the company is paying you additional amounts for work you performed. Enclosed is a payment of `, { text: money(total), bold: true }, `: ${money(p.wagesTotal)} in wages and premiums (less required payroll taxes and withholdings)${p.reimbursementTotal ? `, ${money(p.reimbursementTotal)} in business expense reimbursement` : ''}${p.interest ? `, and ${money(p.interest)} in interest` : ''}. Exhibit A shows how each amount was calculated.`] },
    { t: 'notice', runs: ['This payment is yours to keep. It is not conditioned on signing any document, and accepting or cashing it does not waive any of your rights (Lab. Code § 206.5).'] },
    { t: 'p', align: 'justify', runs: [`${p.employerName} makes this payment voluntarily and in good faith as a result of its own review. The payment is not an admission that ${p.employerName} violated any law, regulation, or policy, or that any additional amount is owed, and it may not be used as evidence of liability. It covers only the wages, premiums${p.reimbursementTotal ? ', reimbursements,' : ''} and interest shown in Exhibit A for the periods listed; it does not include or resolve any civil penalties.`] },
    { t: 'p', align: 'justify', runs: [`If you believe the amount is incorrect or you have questions, contact ${blank(p.contact, `Human Resources at ${p.employerName}`)}. You may also consult an attorney of your choice or contact the California Labor Commissioner’s Office.`] },
    { t: 'p', align: 'justify', runs: [`${p.employerName} will not retaliate against you for receiving this payment, asking questions, or raising concerns about your pay.`] },
    { t: 'p', runs: ['Sincerely,'] },
    { t: 'p', runs: [blank(p.signerName, 'Human Resources'), '\n', blank(p.signerTitle, p.employerName)] },
    { t: 'pagebreak' },
    { t: 'title', text: 'Exhibit A — Calculation of Payment' },
    { t: 'table', head: ['Item', 'Basis', 'Amount'], rows: [...p.lines.map(l => [l.label, l.basis || '', money(l.amount)]), ...(p.interest ? [[`Interest at ${Math.round(((p as { interestRate?: number }).interestRate ?? 0.1) * 100)}% per year`, ((p as { interestRate?: number }).interestRate ?? 0.1) < 0.1 ? 'Lab. Code § 2699(h) (cure rate)' : 'Lab. Code § 218.6; Civ. Code § 3289', money(p.interest)]] : []), ['Total', '', money(total)]] },
    { t: 'p', runs: [{ text: 'Wages and premiums are reported on Form W-2 with required withholdings. Expense reimbursements are not income. Consult a tax advisor about interest.', italic: true }] }
  ];
  return { title: `Wage payment letter — ${p.employeeName}`, blocks, draftBanner: DRAFT };
}

// =====================================================================================
// 2. Individual settlement packet for a pending class or representative action
//    (Chindarah v. Pick Up Stix, Inc. (2009) 171 Cal.App.4th 796).
// =====================================================================================
export interface SettlementInput extends Party {
  age40?: boolean;
  employeeName: string;
  date: string;
  caseCaption: string;          // e.g., "Garcia v. Mesa Verde Packing Co."
  court: string;                // e.g., "Santa Barbara County Superior Court"
  caseNumber: string;
  plaintiffs: string;           // named plaintiffs
  plaintiffCounsel: string;     // firm, address, phone
  classPeriodStart: string;
  claimsSummary: string;        // e.g., "unpaid overtime, meal and rest period premiums, ..."
  lines: Line[];                // payment schedule rows
  wagePct: number;              // portion allocated to wages (W-2), 0–100
  considerDays: number;         // days to consider before signing
  paymentDays: number;          // days after signature to pay
  complaintLocation: string;    // where to obtain a copy
  undisputedPaid?: { amount: number; date: string } | null;
  spanishAvailable: boolean;
}
export function settlementPacket(s: SettlementInput): DocModel[] {
  const total = s.lines.reduce((t, l) => t + l.amount, 0);
  const wages = Math.round(total * s.wagePct) / 100;
  const nonWage = Math.round((total - wages) * 100) / 100;
  const E = 'Employee', C = s.employerName;

  const letter: DocModel = {
    title: 'Notice letter', draftBanner: DRAFT, blocks: [
      { t: 'p', runs: [{ text: C, bold: true }, '\n', (s.employerAddress || '').trim()] },
      { t: 'p', runs: [s.date] },
      { t: 'p', runs: [`Dear ${s.employeeName}:`] },
      { t: 'p', align: 'justify', runs: [`We are writing about a lawsuit, ${s.caseCaption}, ${s.court} Case No. ${s.caseNumber}, filed by ${s.plaintiffs}. The lawsuit claims that ${C} owes current and former employees ${s.claimsSummary}. It was filed as a proposed class action, which means the plaintiffs seek to represent other employees, including you. The court has not decided whether the claims have merit or whether the case can proceed as a class action.`] },
      { t: 'p', align: 'justify', runs: [`${C} disputes the claims. To resolve them, ${C} is offering you the enclosed individual settlement of `, { text: money(total), bold: true }, '. Exhibit A shows how the amount was calculated from your work records.'] },
      { t: 'heading', text: 'Your choice' },
      { t: 'bullets', items: [
        ['Whether to accept is entirely your decision. If you sign, you give up the right to recover money in the lawsuit for the claims described in the agreement. If you do not sign, nothing changes for you, and you keep whatever rights you have in the lawsuit.'],
        [`Your decision will not affect your job, schedule, pay, or treatment in any way. ${C} will not retaliate against anyone for signing, not signing, or asking questions.`],
        [`You have at least ${s.considerDays} days to decide. You are encouraged to talk with an attorney of your choice. You may also contact the plaintiffs’ attorneys: ${s.plaintiffCounsel}.`],
        [`A copy of the complaint is available ${s.complaintLocation}. On request, we will give you copies of your time and payroll records before you decide.`],
        ...(s.undisputedPaid ? [[`Separately, on ${s.undisputedPaid.date} ${C} paid you ${money(s.undisputedPaid.amount)} for amounts its own review found were owed. That payment was not conditioned on anything and is not part of this offer.`]] : [])
      ] },
      ...(s.spanishAvailable ? [{ t: 'notice' as const, runs: ['Este aviso y el acuerdo están disponibles en español. Pida una copia en español antes de firmar. Spanish versions are available on request.'] }] : []),
      { t: 'p', runs: [`Questions: ${blank(s.contact, `Human Resources at ${s.employerName}`)}`] },
      { t: 'p', runs: ['Sincerely,\n', blank(s.signerName, 'Human Resources'), ', ', blank(s.signerTitle, C)] }
    ]
  };

  const agreement: DocModel = {
    title: 'Settlement Agreement and Release of Disputed Wage-and-Hour Claims', draftBanner: DRAFT, blocks: [
      { t: 'title', text: 'Settlement Agreement and Release of Disputed Wage-and-Hour Claims' },
      { t: 'p', align: 'justify', runs: [`This Agreement is between ${s.employeeName} (“${E}”) and ${C} (the “Company”).`] },
      { t: 'numbered', n: '1', heading: 'The lawsuit', runs: [`${s.plaintiffs} filed ${s.caseCaption}, ${s.court} Case No. ${s.caseNumber} (the “Lawsuit”), as a proposed class action on behalf of certain current and former Company employees, which may include ${E}, for the period beginning ${s.classPeriodStart}. The Lawsuit alleges ${s.claimsSummary}. This is a summary only. ${E} may obtain a copy of the complaint ${s.complaintLocation}, or from the plaintiffs’ attorneys: ${s.plaintiffCounsel}. No class has been certified.`] },
      { t: 'numbered', n: '2', heading: 'Disputed claims', runs: [`The Company denies the claims in the Lawsuit and contends that it has paid its employees correctly. ${E} and the Company agree that a bona fide dispute exists about whether any additional amounts are owed to ${E} for the matters alleged in the Lawsuit, and they enter into this Agreement to resolve that dispute without the delay and uncertainty of litigation.`] },
      { t: 'numbered', n: '3', heading: 'Wages that are not in dispute', runs: [s.undisputedPaid ? `On ${s.undisputedPaid.date}, the Company paid ${E} ${money(s.undisputedPaid.amount)} for amounts its own review identified as owed. That payment was made without condition. ` : '', `Nothing in this Agreement is given in exchange for wages the Company concedes are due, and no wages concededly due are being withheld pending signature (Lab. Code § 206.5). If ${E} believes other undisputed wages are owed, ${E} may raise them with the Company or the Labor Commissioner, and this Agreement does not release them.`] },
      { t: 'numbered', n: '4', heading: 'Settlement payment', runs: [`Within ${s.paymentDays} days after this Agreement becomes effective, the Company will pay ${E} a total of `, { text: money(total), bold: true }, `, calculated as shown in Exhibit A. ${money(wages)} (${s.wagePct}%) is allocated to alleged unpaid wages and premiums and will be reported on Form W-2 with applicable withholdings; ${money(nonWage)} is allocated to alleged penalties and interest and will be reported on Form 1099 without withholding. ${E} is responsible for any taxes owed on the Form 1099 portion. The Company makes no representation about tax consequences.`] },
      { t: 'numbered', n: '5', heading: 'Released claims', runs: [`In exchange, ${E} releases the Company, its parents, subsidiaries, affiliates, and their officers, directors, employees, and agents from all claims for unpaid wages, overtime, minimum wages, meal and rest period premiums, unreimbursed business expenses, wage-statement and waiting-time penalties, liquidated damages, restitution under Business and Professions Code section 17200, interest, and related attorney’s fees and costs, that were alleged in the Lawsuit or arise from the facts alleged in it, for work performed from ${s.classPeriodStart} through the date ${E} signs this Agreement (the “Released Claims”). ${E} waives the protection of California Civil Code section 1542 only as to the Released Claims. Section 1542 reads: “A general release does not extend to claims that the creditor or releasing party does not know or suspect to exist in his or her favor at the time of executing the release and that, if known by him or her, would have materially affected his or her settlement with the debtor or released party.”`] },
      { t: 'numbered', n: '6', heading: 'What is not released', runs: [`This Agreement does not release: (a) any claim for civil penalties under the Private Attorneys General Act (Lab. Code § 2698 et seq.), which belongs to the State of California and may be pursued on behalf of the State and other aggrieved employees; (b) claims for workers’ compensation or unemployment insurance benefits; (c) claims arising after ${E} signs; (d) the right to enforce this Agreement; or (e) any other claim that cannot be released by private agreement as a matter of law. Nothing in this Agreement limits ${E}’s right to file a charge or complaint with, communicate with, or participate in an investigation by any government agency.`] },
      { t: 'numbered', n: '7', heading: 'Effect on the Lawsuit', runs: [`If a class is later certified or the Lawsuit is settled on a class basis, ${E} will not receive a further recovery for the Released Claims, except as the court may order. This Agreement does not prevent ${E} from being a witness or communicating with any party or attorney in the Lawsuit.`] },
      { t: 'numbered', n: '8', heading: 'Voluntary decision; time to consider', runs: [`${E} has been given at least ${s.considerDays} days to consider this Agreement and may sign sooner by choice. ${E} has been advised in writing to consult an attorney of ${E}’s choosing, may contact the plaintiffs’ attorneys, and has been offered copies of ${E}’s time and payroll records. The Company will not retaliate against ${E} for signing, declining to sign, or asking questions, and ${E}’s decision will not affect the terms or conditions of ${E}’s employment (Lab. Code § 98.6).`] },
      { t: 'numbered', n: '9', heading: 'Right to speak', runs: ['Nothing in this agreement prevents you from discussing or disclosing information about unlawful acts in the workplace, such as harassment or discrimination or any other conduct that you have reason to believe is unlawful. (Gov. Code § 12964.5.) Nothing in this Agreement restricts discussing wages or working conditions.'] },
      { t: 'numbered', n: '10', heading: 'No admission', runs: ['This Agreement is a compromise of disputed claims. It is not an admission of liability by the Company, and the amount paid does not reflect a determination that any amount was owed.'] },
      { t: 'numbered', n: '11', heading: 'Language', runs: [`${E} confirms that this Agreement was provided in a language ${E} reads and understands${s.spanishAvailable ? ', and that a Spanish translation was offered' : ''}.`] },
      { t: 'numbered', n: '12', heading: 'General terms', runs: ['California law governs this Agreement. It is the entire agreement on its subject and supersedes prior discussions on that subject. If any provision is held unenforceable, the rest remains in effect. It may be signed in counterparts and electronically. It becomes effective when signed by both parties.'] },
      { t: 'numbered', n: '13', heading: 'Taxes', runs: [`The Company will report the payment as shown in Exhibit A (wages on Form W-2 with required withholdings; penalties and interest on Form 1099). The Company makes no representation about tax consequences, and ${E} is responsible for any taxes owed on the non-wage portion.`] },
      { t: 'numbered', n: '14', heading: 'Medicare', runs: [`${E} represents that ${E} is not a Medicare beneficiary and that no conditional payments have been made by Medicare relating to the Released Claims. The Released Claims do not include any claim for personal injury.`] },
      { t: 'numbered', n: '15', heading: 'Fees and costs', runs: [`Each party bears its own attorneys’ fees and costs, except as stated in this Agreement. Nothing in this Agreement limits ${E}’s right to consult or retain counsel.`] },
      ...(s.age40 ? [{ t: 'numbered' as const, n: '16', heading: 'Age discrimination claims (OWBPA)', runs: [`${E} is releasing rights or claims under the Age Discrimination in Employment Act of 1967 (29 U.S.C. § 621 et seq.). ${E} is advised in writing to consult an attorney before signing; has at least 21 days to consider this Agreement (45 days if offered as part of a group program); and may revoke it within 7 days after signing by written notice to ${blank(s.contact, `${blank(s.signerName, 'Human Resources')}, ${s.employerName}${s.employerAddress ? `, ${s.employerAddress}` : ''}`)}. This Agreement does not become effective until the revocation period ends. ${E} does not waive rights or claims that arise after signing (29 U.S.C. § 626(f)).`] }] : []),
      { t: 'numbered', n: s.age40 ? '17' : '16', heading: 'Construction', runs: ['Both parties had the opportunity to review this Agreement with counsel; it will not be construed against either party as its drafter. It may be signed in counterparts and by electronic signature, each of which is an original. It contains no provision restricting reemployment (Code Civ. Proc. § 1002.5) and does not restrict disclosure of factual information about any claim of sexual assault, sexual harassment, or workplace harassment, discrimination, or retaliation based on sex (Code Civ. Proc. § 1001).'] },
      { t: 'notice', runs: ['I have read this Agreement, understand it, and sign it voluntarily. I understand I may decline to sign without any consequence to my employment.'] },
      { t: 'p', runs: ['Employee initials: ________    Company initials: ________'] },
      { t: 'signature', lines: [{ label: 'EMPLOYEE:', name: s.employeeName }, { label: `${C.toUpperCase()}:`, name: s.signerName ? `By ${s.signerName}, ${blank(s.signerTitle, 'Authorized Representative')}` : 'By: ______________________, Authorized Representative' }] }
    ]
  };

  const schedule: DocModel = {
    title: 'Exhibit A — Settlement Calculation', draftBanner: DRAFT, blocks: [
      { t: 'title', text: 'Exhibit A — Settlement Calculation' },
      { t: 'p', runs: [`Employee: ${s.employeeName}`] },
      { t: 'table', head: ['Item', 'Units', 'Rate', 'Amount'], rows: [...s.lines.map(l => [l.label, l.units !== undefined ? String(l.units) : '', l.rate !== undefined ? money(l.rate) : '', money(l.amount)]), ['Total settlement payment', '', '', money(total)]] },
      { t: 'table', head: ['Tax allocation', 'Reporting', 'Amount'], rows: [['Alleged wages and premiums', 'Form W-2, with withholdings', money(wages)], ['Alleged penalties and interest', 'Form 1099', money(nonWage)]] },
      { t: 'p', runs: [{ text: 'Units are drawn from the Company’s time and payroll records for the covered period. Ask for a copy of the records used.', italic: true }] }
    ]
  };
  return [letter, agreement, schedule];
}

// =====================================================================================
// 3. Meal period waiver (bilingual). Lab. Code § 512(a); Wage Orders § 11.
//    Rest periods cannot be waived; the form says so.
// =====================================================================================
export function mealWaiver(p: Party): DocModel {
  return { title: 'Meal Period Waiver', draftBanner: DRAFT, blocks: [
    { t: 'title', text: 'Meal Period Waiver / Renuncia al Periodo de Comida' },
    { t: 'p', runs: [`Employer: ${p.employerName}        Employee name: ______________________________`] },
    { t: 'p', align: 'justify', runs: ['I understand that I am entitled to an unpaid, duty-free meal period of at least 30 minutes that begins no later than the end of my fifth hour of work, and a second meal period that begins no later than the end of my tenth hour of work.'] },
    { t: 'p', runs: [{ text: 'Check each waiver you choose to give:', bold: true }] },
    { t: 'bullets', items: [
      ['☐  First meal period: I choose to waive my first meal period on any workday when my total work time will be ', { text: 'no more than 6 hours', bold: true }, '. If I work more than 6 hours, this waiver does not apply and I must receive a meal period.'],
      ['☐  Second meal period: I choose to waive my second meal period on any workday when my total work time will be ', { text: 'no more than 12 hours', bold: true }, ', but only if I did not waive my first meal period that day.']
    ] },
    { t: 'p', align: 'justify', runs: ['This waiver is voluntary. I was not required to sign it as a condition of employment. I may revoke it at any time by telling my supervisor or Human Resources in writing, and revocation will take effect immediately. ', { text: 'Rest breaks cannot be waived', bold: true }, ': I will continue to receive a paid 10-minute rest break for every 4 hours worked or major fraction.'] },
    { t: 'p', align: 'justify', runs: [{ text: 'Español: ', bold: true }, 'Entiendo que tengo derecho a un periodo de comida de por lo menos 30 minutos, sin trabajar, que empiece a más tardar al final de mi quinta hora de trabajo, y a un segundo periodo de comida antes del final de mi décima hora. Puedo renunciar al primer periodo solo cuando trabaje 6 horas o menos en el día, y al segundo solo cuando trabaje 12 horas o menos y no haya renunciado al primero. Esta renuncia es voluntaria y puedo revocarla en cualquier momento por escrito. Los descansos de 10 minutos no se pueden renunciar.'] },
    { t: 'signature', lines: [{ label: 'Employee signature / Firma del empleado' }, { label: 'Received by employer' }] },
    { t: 'p', runs: [{ text: 'Revocation: I revoke this waiver effective ____________.   Signature: ______________________', italic: true }] }
  ] };
}

// =====================================================================================
// 4. Shift attestation policy and acknowledgment (bilingual summary).
// =====================================================================================
export function attestationPolicy(p: Party): DocModel {
  return { title: 'Meal and Rest Break Attestation Policy', draftBanner: DRAFT, blocks: [
    { t: 'title', text: 'Meal and Rest Break Attestation Policy' },
    { t: 'p', align: 'justify', runs: [`${p.employerName} provides meal and rest breaks as required by California law. To make sure every break is actually provided, and that you are paid a premium whenever one is not, you will be asked three questions when you clock out at the end of each shift.`] },
    { t: 'bullets', items: [
      ['Did you receive a full, uninterrupted 30-minute meal break, starting before the end of your 5th hour of work (and a second one before the end of your 10th hour, if you worked that long)?'],
      ['Did you receive every 10-minute rest break you were entitled to, free from all work and not on call?'],
      ['Did you do any work today that is not reflected on your time record? If yes, how many minutes?']
    ] },
    { t: 'heading', text: 'Our commitments to you' },
    { t: 'bullets', items: [
      [{ text: 'Answer honestly. ', bold: true }, 'There is no right or wrong answer. You will never be disciplined, criticized, or treated differently for reporting a missed or interrupted break or unrecorded work.'],
      [{ text: 'You will be paid. ', bold: true }, 'Each “no” to the meal question earns one additional hour of pay at your regular rate of compensation, and each “no” to the rest question earns another, on your next paycheck (Lab. Code § 226.7). Reported unrecorded work will be reviewed and paid.'],
      [{ text: 'No one may answer for you. ', bold: true }, 'Supervisors may not complete, change, or pressure you about your answers. Report any pressure to Human Resources or to the Labor Commissioner.'],
      [{ text: 'Changing an answer. ', bold: true }, 'If you made a mistake, tell Human Resources within 3 business days.']
    ] },
    { t: 'p', align: 'justify', runs: [{ text: 'Resumen en español: ', bold: true }, 'Al registrar su salida cada día, se le preguntará si recibió su periodo de comida y sus descansos completos, y si trabajó tiempo que no aparece en su registro. Conteste con honestidad. Nunca habrá represalias. Cada “no” sobre la comida o los descansos le da una hora adicional de pago en su próximo cheque.'] },
    { t: 'signature', lines: [{ label: 'Employee acknowledgment / Acuse de recibo' }] }
  ] };
}

// =====================================================================================
// 5. Reasonable steps audit record (PAGA, Lab. Code § 2699 as amended 2024).
// =====================================================================================
export function auditRecord(p: Party & { auditDate: string; window: string; workers: number; findings: { area: string; count: number; workers: number; amount: string; action: string; status: string }[]; backPay: string; policies: string; training: string; conductedBy: string }): DocModel {
  return { title: 'Payroll Compliance Audit Record', blocks: [
    { t: 'title', text: 'Payroll Compliance Audit Record' },
    { t: 'p', runs: [`Employer: ${p.employerName}\nAudit date: ${p.auditDate}\nConducted by: ${p.conductedBy}\nRecords reviewed: ${p.workers} workers, ${p.window}`] },
    { t: 'heading', text: 'Scope and method' },
    { t: 'p', align: 'justify', runs: ['Time punches, payroll registers, wage statement contents, separation records, and worker classifications were tested against Labor Code sections 201–204, 226, 226.7, 510, 512, 515, 1194, 1194.2, 1197, 2775, and 2802 and the applicable Industrial Welfare Commission Wage Order using deterministic, versioned rules.'] },
    { t: 'heading', text: 'Findings and corrective action' },
    { t: 'table', head: ['Area', 'Instances', 'Workers', 'Estimated amount', 'Corrective action', 'Status'], rows: p.findings.map(f => [f.area, String(f.count), String(f.workers), f.amount, f.action, f.status]) },
    { t: 'heading', text: 'Back pay' }, { t: 'p', runs: [p.backPay] },
    { t: 'heading', text: 'Written policies and training' }, { t: 'p', runs: [p.policies], }, { t: 'p', runs: [p.training] },
    { t: 'p', runs: ['Next scheduled audit: ____________'] },
    { t: 'signature', lines: [{ label: 'Reviewed by' }] }
  ] };
}

// =====================================================================================
// Remediation templates (Phase 10). Each cites its authority; all are drafts for counsel.
// =====================================================================================
const head = (p: Party, date: string, to: string, re: string): Block[] => [
  { t: 'p', runs: [{ text: p.employerName, bold: true }] }, { t: 'p', runs: [(p.employerAddress || '').trim()] }, { t: 'p', runs: [date] },
  { t: 'p', runs: [to] }, { t: 'p', runs: [{ text: `Re: ${re}`, bold: true }] }
];
const sign = (p: Party): Block[] => [{ t: 'p', runs: ['Sincerely,'] }, { t: 'p', runs: [blank(p.signerName, 'Human Resources'), '\n', blank(p.signerTitle, p.employerName)] }];

/** Spanish version of the unconditional wage payment letter (Lab. Code §§ 206, 206.5). */
export function wagePaymentLetterEs(p: Party & { employeeName: string; date: string; lines: Line[]; interest: number; wagesTotal: number; reimbursementTotal: number }): DocModel {
  const total = p.wagesTotal + p.reimbursementTotal + p.interest;
  return { title: `Carta de pago de salarios — ${p.employeeName}`, draftBanner: 'BORRADOR — revise con un abogado laboral de California antes de usar.', blocks: [
    ...head(p, p.date, `${p.employeeName}\n[Dirección]`, 'Pago de salarios adicionales'),
    { t: 'p', runs: [`Estimado(a) ${p.employeeName.split(' ')[0]}:`] },
    { t: 'p', align: 'justify', runs: [`${p.employerName} revisó recientemente sus registros de horas y de nómina. Con base en esa revisión, la compañía le está pagando cantidades adicionales por su trabajo. El total es ${money(total)}, que incluye salarios y primas por ${money(p.wagesTotal)}, reembolso de gastos por ${money(p.reimbursementTotal)} e intereses por ${money(p.interest)}. El detalle aparece en el Anexo A.`] },
    { t: 'notice', runs: ['Este pago es suyo. No depende de que firme ningún documento, y aceptarlo o cobrarlo no renuncia a ninguno de sus derechos.'] },
    { t: 'p', align: 'justify', runs: [`${p.employerName} realiza este pago de manera voluntaria y de buena fe como resultado de su propia revisión. El pago no constituye una admisión de que ${p.employerName} haya violado alguna ley, reglamento o política, ni de que se deba alguna cantidad adicional, y no puede usarse como prueba de responsabilidad. Cubre únicamente los salarios, primas e intereses indicados en el Anexo A; no incluye ni resuelve sanciones civiles. (Código Laboral § 206.5)`] },
    { t: 'p', align: 'justify', runs: [`Si cree que la cantidad es incorrecta o tiene preguntas, comuníquese con ${blank(p.contact, `Recursos Humanos de ${p.employerName}`)}. También puede consultar con un abogado de su elección o con la Oficina del Comisionado Laboral de California.`] },
    { t: 'p', align: 'justify', runs: [`${p.employerName} no tomará represalias contra usted por recibir este pago, hacer preguntas o presentar inquietudes sobre su pago.`] },
    { t: 'p', runs: ['Atentamente,'] }, { t: 'p', runs: [blank(p.signerName, 'Recursos Humanos'), '\n', blank(p.signerTitle, p.employerName)] },
    { t: 'pagebreak' }, { t: 'title', text: 'Anexo A — Cálculo del pago' },
    { t: 'table', head: ['Concepto', 'Base', 'Cantidad'], rows: [...p.lines.map(l => [l.label, l.basis || '', money(l.amount)]), ...(p.interest ? [['Intereses al 10% anual', 'Lab. Code § 218.6; Civ. Code § 3289', money(p.interest)]] : []), ['Total', '', money(total)]] }
  ] };
}

/** Confidential proposal to cure (employers with fewer than 100 employees). Lab. Code § 2699.3 (SB 92, 2024). */
export function pagaCureProposal(p: Party & { noticeDate: string; lwdaCase: string; claimant: string; employees: number; items: { violation: string; section: string; cure: string; amount: number; workers: number }[]; totalWages: number; interest7: number }): DocModel {
  return { title: 'PAGA confidential proposal to cure', draftBanner: 'CONFIDENTIAL SETTLEMENT COMMUNICATION — DRAFT FOR COUNSEL. Submit through the LWDA online filing system within 33 days of receiving the PAGA notice.', blocks: [
    { t: 'title', text: 'Confidential Proposal to Cure — Labor Code § 2699.3' },
    { t: 'table', head: ['Item', 'Detail'], rows: [['Employer', p.employerName], ['PAGA notice received', p.noticeDate], ['LWDA case number', p.lwdaCase || 'Not yet assigned'], ['Aggrieved employee', p.claimant || 'As identified in the notice'], ['Employees during notice period', `${p.employees} (fewer than 100 — eligible for the LWDA cure process)`]] },
    { t: 'heading', text: '1. Proposed cure' },
    { t: 'p', align: 'justify', runs: [`${p.employerName} proposes to cure the alleged violations listed below by correcting the practices at issue and making each aggrieved employee whole: paying unpaid wages for the three years before the notice, interest at 7%, any liquidated damages required by statute, and reasonable attorney’s fees and costs as determined by the Agency.`] },
    { t: 'table', head: ['Alleged violation', 'Labor Code', 'Corrective action', 'Workers', 'Payment'], rows: [...p.items.map(i => [i.violation, i.section, i.cure, String(i.workers), money(i.amount)]), ['Interest at 7%', '§ 2699(d)(2)', 'Added to each payment', '', money(p.interest7)], ['Total proposed payments', '', '', '', money(p.totalWages + p.interest7)]] },
    { t: 'heading', text: '2. Timeline' },
    { t: 'bullets', items: [['Proposal submitted within 33 days of receipt of the notice.'], ['Conference with the LWDA, if set, within 14 days.'], ['Cure completed no later than 45 days after the conference, followed by a sworn notification of completion to the employee and the LWDA, with a payroll audit and check register for payments.']] },
    { t: 'heading', text: '3. Supporting information' },
    { t: 'bullets', items: [['Payroll audit methodology and calculation detail (Aldune audit record and calculation ledger, attached).'], ['Revised policies and payroll configuration changes (attached).'], ['Wage statement corrections, if applicable: compliant statements for each affected pay period in the prior three years.']] },
    { t: 'p', runs: [{ text: 'Nothing in this proposal is an admission of liability.', italic: true }] }, ...sign(p)
  ] };
}

/** Outline of an employer's early evaluation conference statement (employers with 100+ employees). Lab. Code § 2699.3. */
export function earlyEvaluationStatement(p: Party & { caseCaption: string; caseNumber: string; cure: string[]; disputed: string[]; claimant?: string }): DocModel {
  return { title: 'Early evaluation conference statement (outline)', draftBanner: 'DRAFT OUTLINE FOR COUNSEL — confidential. Confirm local court procedures and deadlines.', blocks: [
    { t: 'title', text: `Defendant’s Early Evaluation Conference Statement — ${blank(p.caseCaption, `${p.claimant || 'Plaintiff'} v. ${p.employerName}`)}, ${p.caseNumber ? `Case No. ${p.caseNumber}` : 'Case No. pending'}` },
    { t: 'p', align: 'justify', runs: [`Defendant ${p.employerName} requests an early evaluation conference and a stay of proceedings under Labor Code § 2699.3 and submits this statement identifying the alleged violations it intends to cure, those it disputes, and its proposed cure plan.`] },
    { t: 'heading', text: 'A. Violations defendant intends to cure' }, { t: 'bullets', items: (p.cure.length ? p.cure : ['None identified at this time; defendant will supplement after reviewing its records.']).map(x => [x]) },
    { t: 'heading', text: 'B. Allegations disputed and basis' }, { t: 'bullets', items: (p.disputed.length ? p.disputed : ['Defendant disputes the allegations to the extent its records show compliant meal periods, rest periods, and pay, and reserves all defenses.']).map(x => [x]) },
    { t: 'heading', text: 'C. Proposed cure plan' }, { t: 'bullets', items: [['Corrective changes to policies, timekeeping, and payroll.'], ['Payments of unpaid wages for three years, 7% interest, statutory liquidated damages, and reasonable attorney’s fees as determined.'], ['Timeline for completion and sworn verification.']] },
    { t: 'heading', text: 'D. Reasonable steps already taken' }, { t: 'bullets', items: [['Periodic payroll audits and action on results (Aldune audit record attached).'], ['Written policies, supervisor training, and corrective action with supervisors.']] },
    { t: 'p', runs: [{ text: 'Reasonable steps support the 15% (pre-notice) or 30% (post-notice) caps on PAGA penalties under Labor Code § 2699(g).', italic: true }] }
  ] };
}

/** Cover notice for corrected wage statements (Lab. Code § 226; § 2699.3 cure of wage-statement violations). */
export function correctedWageStatementNotice(p: Party & { employeeName: string; date: string; periods: string; corrections: string[] }): DocModel {
  return { title: `Corrected wage statements — ${p.employeeName}`, draftBanner: DRAFT, blocks: [
    ...head(p, p.date, `${p.employeeName}${(p as { employeeAddress?: string }).employeeAddress ? `\n${(p as { employeeAddress?: string }).employeeAddress}` : ''}`, 'Corrected wage statements'),
    { t: 'p', align: 'justify', runs: [`Enclosed are corrected wage statements for the pay periods ${p.periods}. We are providing them because our review found the following items were missing or inaccurate on the original statements:`] },
    { t: 'bullets', items: (p.corrections.length ? p.corrections : ['Each enclosed statement now shows every item required by Labor Code section 226(a).']).map(c => [c]) },
    { t: 'p', align: 'justify', runs: ['Labor Code section 226(a) lists the information every wage statement must show. If any additional wages are owed for these periods, they are being paid separately and are shown on the corrected statements.'] },
    { t: 'p', runs: [`Questions: ${blank(p.contact, `Human Resources at ${p.employerName}`)}. We will not retaliate against you for asking questions about your pay.`] }, ...sign(p)
  ] };
}

/** Notice of reclassification to non-exempt (Lab. Code §§ 515, 515.5; §§ 2775–2787). */
export function reclassificationNotice(p: Party & { employeeName: string; date: string; effective: string; newRate: string; reason: string }): DocModel {
  return { title: `Reclassification notice — ${p.employeeName}`, draftBanner: DRAFT, blocks: [
    ...head(p, p.date, p.employeeName, 'Change in pay classification'),
    { t: 'p', align: 'justify', runs: [`Effective ${blank(p.effective, 'the start of the next pay period')}, your position will be classified as non-exempt (hourly). This means you will record all time worked, receive overtime for hours over 8 in a day and 40 in a week, and be provided meal and rest periods.`] },
    { t: 'p', align: 'justify', runs: [`Your hourly rate will be ${blank(p.newRate, 'the hourly equivalent of your current salary (annual salary ÷ 2,080)')}. ${p.reason ? `This change follows a review of ${p.reason}.` : ''} It does not reflect on your performance.`] },
    { t: 'bullets', items: [['Clock in and out for every shift and meal period.'], ['Take a 30-minute meal period before the end of your fifth hour of work, and 10-minute rest breaks.'], ['Do not work off the clock. Report any unrecorded work to Human Resources.']] },
    { t: 'p', align: 'justify', runs: ['The company is separately reviewing whether any additional amounts are owed for the period before this change and will contact you about any payment. A Labor Code § 2810.5 notice reflecting your new rate is enclosed.'] }, ...sign(p)
  ] };
}

/** Payment of waiting-time penalties / final wages (Lab. Code §§ 201–203). */
export function waitingTimeLetter(p: Party & { employeeName: string; date: string; separation: string; wages: number; penalty: number; days: number; dailyWage: number }): DocModel {
  return { title: `Final wages payment — ${p.employeeName}`, draftBanner: DRAFT, blocks: [
    ...head(p, p.date, `${p.employeeName}${(p as { employeeAddress?: string }).employeeAddress ? `\n${(p as { employeeAddress?: string }).employeeAddress}` : ''}`, 'Payment of final wages'),
    { t: 'p', align: 'justify', runs: [`Our review found that your final wages after your separation on ${p.separation} were not paid within the time required by Labor Code sections 201 and 202. We are enclosing ${money(p.wages + p.penalty)}: ${money(p.wages)} in wages and ${money(p.penalty)} representing ${p.days} days of your daily wage of ${money(p.dailyWage)} under Labor Code section 203.`] },
    { t: 'notice', runs: ['This payment is not conditioned on signing anything and does not waive any rights.'] },
    { t: 'p', runs: [`Questions: ${blank(p.contact, `Human Resources at ${p.employerName}`)}.`] }, ...sign(p)
  ] };
}

const policy = (p: Party, title: string, cite: string, sections: [string, string[]][]): DocModel => ({ title, draftBanner: DRAFT, blocks: [
  { t: 'title', text: `${p.employerName} — ${title}` }, { t: 'p', runs: [{ text: cite, italic: true }] },
  ...sections.flatMap(([h, items]) => [{ t: 'heading', text: h } as Block, { t: 'bullets', items: items.map(i => [i]) } as Block]),
  { t: 'p', runs: ['Questions about this policy may be directed to Human Resources. The company prohibits retaliation against any employee who asks about pay, reports a missed break, or raises a concern.'] },
  { t: 'signature', lines: [{ label: 'Employee acknowledgment' }, { label: 'Date' }] }
] });
export const mealRestPolicy = (p: Party & { effectiveDate?: string }) => mealRestPolicyFull(p);
export const expensePolicy = (p: Party & { effectiveDate?: string; phoneStipend?: number | string }) => expensePolicyFull(p);
export const timekeepingPolicy = (p: Party & { effectiveDate?: string }) => timekeepingPolicyFull(p);
export function supervisorTrainingMemo(p: Party & { date: string; patterns: string[] }): DocModel {
  return { title: 'Supervisor training memo — meal and rest periods', draftBanner: DRAFT, blocks: [
    { t: 'title', text: 'Supervisor Training: Meal Periods, Rest Breaks, and Accurate Time' }, { t: 'p', runs: [`${p.employerName} · ${p.date}`] },
    { t: 'p', align: 'justify', runs: ['Our recent payroll audit found patterns that we must correct. This training is part of the company’s reasonable steps to comply with California law (Labor Code § 2699(g)).'] },
    ...(p.patterns.length ? [{ t: 'heading', text: 'What the audit found' } as Block, { t: 'bullets', items: p.patterns.map(x => [x]) } as Block] : []),
    { t: 'heading', text: 'Your responsibilities' },
    { t: 'bullets', items: [['Schedule each meal to start before the end of the fifth hour; schedule rest breaks near the middle of each work period.'], ['Provide relief coverage so employees can actually take breaks, especially on closing shifts and weekends.'], ['Never ask or allow anyone to work off the clock, and never edit time without the employee’s acknowledgment.'], ['If a break is missed or late, make sure the employee answers the end-of-shift attestation honestly; the premium is paid automatically.'], ['Never discourage or retaliate against anyone for reporting a missed break or unpaid time (Labor Code § 98.6).']] },
    { t: 'signature', lines: [{ label: 'Supervisor' }, { label: 'Date trained' }, { label: 'Trainer' }] }
  ] };
}
export function payrollConfigMemo(p: Party & { date: string; items: string[]; categories?: string[]; locations?: { name: string; rate: number; source?: string }[] }): DocModel {
  return payrollConfigMemoFull(p, { date: p.date, items: p.items, categories: p.categories, locations: p.locations });
}


// =====================================================================================
// Separation Agreement and General Release (California). Gov. Code § 12964.5; Civ. Code § 1542; Lab. Code §§ 201–203, 206.5;
// Code Civ. Proc. §§ 1001, 1002.5; OWBPA, 29 U.S.C. § 626(f).
// =====================================================================================
export function separationAgreement(p: Party & { employeeName: string; separationDate: string; severance: number | null; paymentDays: number; age40: boolean; group?: boolean; nonDisparagement: boolean; returnProperty: boolean; date: string }): DocModel {
  const E = 'Employee', C = p.employerName; const consider = p.age40 ? (p.group ? 45 : 21) : 5;
  const n = (() => { let i = 0; return () => String(++i); })();
  return { title: `Separation Agreement and General Release — ${p.employeeName}`, draftBanner: DRAFT, blocks: [
    { t: 'title', text: 'Separation Agreement and General Release' },
    { t: 'p', align: 'justify', runs: [`This Separation Agreement and General Release (“Agreement”) is between ${p.employeeName} (“${E}”) and ${C} (the “Company”).`] },
    { t: 'notice', runs: [`You have the right to consult an attorney about this Agreement, and the Company advises you to do so. You have ${p.age40 ? `${consider} days` : 'at least five (5) business days'} to consider it${p.age40 ? ', and you may revoke it within seven (7) days after signing' : ''}. You may sign sooner if you choose. (Gov. Code § 12964.5(b)(4)${p.age40 ? '; 29 U.S.C. § 626(f)' : ''}.)`] },
    { t: 'numbered', n: n(), heading: 'Separation', runs: [`${E}’s employment ends on ${p.separationDate} (the “Separation Date”).`] },
    { t: 'numbered', n: n(), heading: 'Final wages are not conditioned on this Agreement', runs: [`Whether or not ${E} signs, the Company has paid or will pay all final wages, including accrued unused vacation or PTO, by the deadlines in Labor Code sections 201–203, and will reimburse all business expenses submitted under Labor Code section 2802. No release is required for wages concededly due (Lab. Code § 206.5).`] },
    { t: 'numbered', n: n(), heading: 'Severance', runs: [`In exchange for ${E}’s promises in this Agreement, and provided ${E} signs${p.age40 ? ' and does not revoke' : ''} it, the Company will pay ${E} ${p.severance ? money(p.severance) : '$______'}, less required withholdings, within ${p.paymentDays} days after the Effective Date. ${E} agrees this is consideration ${E} is not otherwise entitled to receive.`] },
    { t: 'numbered', n: n(), heading: 'General release', runs: [`${E} releases the Company and its parents, subsidiaries, affiliates, and their officers, directors, employees, agents, insurers, successors, and assigns from all claims, known or unknown, arising on or before the date ${E} signs, including claims arising from ${E}’s employment or its end, and claims under Title VII, the Americans with Disabilities Act, ${p.age40 ? 'the Age Discrimination in Employment Act, ' : ''}the Family and Medical Leave Act, the California Fair Employment and Housing Act, the California Family Rights Act, the California Labor Code (to the extent waivable), and common law, to the fullest extent permitted by law.`] },
    { t: 'numbered', n: n(), heading: 'Waiver of Civil Code section 1542', runs: [`${E} understands and waives the protections of California Civil Code section 1542, which states: “A general release does not extend to claims that the creditor or releasing party does not know or suspect to exist in his or her favor at the time of executing the release and that, if known by him or her, would have materially affected his or her settlement with the debtor or released party.”`] },
    { t: 'numbered', n: n(), heading: 'Claims not released', runs: [`This Agreement does not release or waive: (a) claims that cannot be released by private agreement, including claims for unemployment insurance or workers’ compensation benefits and claims for unpaid wages that are not in dispute; (b) vested benefits under any employee benefit plan; (c) rights to indemnification under Labor Code section 2802 or any indemnification agreement or insurance policy; (d) rights under this Agreement; (e) claims arising after ${E} signs; or (f) the right to file a charge with, communicate with, or participate in an investigation by the EEOC, the California Civil Rights Department, the NLRB, the SEC, the Labor Commissioner, or any other government agency, although ${E} waives any right to recover money from the Company in a charge or action brought by ${E} or on ${E}’s behalf, except where such a waiver is prohibited (including any SEC whistleblower award).`] },
    { t: 'numbered', n: n(), heading: 'Protected disclosures', runs: ['Nothing in this agreement prevents you from discussing or disclosing information about unlawful acts in the workplace, such as harassment or discrimination or any other conduct that you have reason to believe is unlawful. (Gov. Code § 12964.5.) Nothing in this Agreement prevents disclosure of factual information about a claim of sexual assault, sexual harassment, or workplace harassment, discrimination, or retaliation based on sex (Code Civ. Proc. § 1001), or limits rights under Labor Code section 232.5 or section 1102.5 or Section 7 of the National Labor Relations Act.'] },
    ...(p.nonDisparagement ? [{ t: 'numbered' as const, n: n(), heading: 'Mutual non-disparagement', runs: [`Subject to the Protected Disclosures section, ${E} will not make statements that are maliciously false about the Company, and the Company will instruct [named individuals] not to make statements that are maliciously false about ${E}.`] }] : []),
    ...(p.returnProperty ? [{ t: 'numbered' as const, n: n(), heading: 'Company property', runs: [`${E} has returned all Company property and confidential information. The Company will not withhold any wages because of unreturned property.`] }] : []),
    { t: 'numbered', n: n(), heading: 'No admission; no rehire restriction', runs: ['This Agreement is not an admission of wrongdoing by anyone. It contains no provision restricting future employment with the Company (Code Civ. Proc. § 1002.5).'] },
    ...(p.age40 ? [{ t: 'numbered' as const, n: n(), heading: 'Age claims (OWBPA)', runs: [`${E} is waiving rights and claims under the Age Discrimination in Employment Act. ${E} has been advised in writing to consult an attorney; has ${consider} days to consider this Agreement${p.group ? ' and has received the information required for group programs (29 U.S.C. § 626(f)(1)(H))' : ''}; and may revoke it within 7 days after signing by written notice to ${blank(p.contact, `${blank(p.signerName, 'Human Resources')}, ${p.employerName}${p.employerAddress ? `, ${p.employerAddress}` : ''}`)}. ${E} does not waive rights or claims that arise after signing.`] }] : []),
    { t: 'numbered', n: n(), heading: 'Effective Date', runs: [p.age40 ? 'This Agreement becomes effective on the eighth day after Employee signs it without revoking it.' : 'This Agreement becomes effective when both parties have signed it.'] },
    { t: 'numbered', n: n(), heading: 'General terms', runs: ['California law governs. This is the entire agreement on its subject. If any provision is unenforceable, the rest remains in effect. It will not be construed against either party as drafter, and it may be signed in counterparts and electronically. Each party bears its own attorneys’ fees and costs.'] },
    { t: 'notice', runs: ['I have read this Agreement, understand it, have had the opportunity to consult an attorney, and sign it knowingly and voluntarily.'] },
    { t: 'signature', lines: [{ label: 'EMPLOYEE:', name: p.employeeName }, { label: 'Date' }, { label: `${C.toUpperCase()}:`, name: p.signerName ? `By ${p.signerName}, ${blank(p.signerTitle, 'Authorized Representative')}` : 'By: ______________________, Authorized Representative' }, { label: 'Date' }] }
  ] };
}
