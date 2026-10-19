// Review rules that turn a California employment document into a concrete edit plan.
// Forms (meal waivers, on-duty meal agreements) are reviewed against the rules for that form — never scored as a
// handbook or padded with unrelated policies. Handbooks and single policies use the policy rules in ../handbook.ts.
import { PROBLEMS, REQUIRED } from '../handbook';
import { toBlocks, type Block, type DocKind, type Edit, type EditNote, type ReviewPlan } from './engine';

const LAW = {
  meal: 'Lab. Code § 512(a); IWC Wage Orders § 11(A)–(B); Brinker Restaurant Corp. v. Superior Court (2012) 53 Cal.4th 1004',
  premium: 'Lab. Code § 226.7(c); Naranjo v. Spectrum Security Services, Inc. (2022) 13 Cal.5th 93',
  rest: 'IWC Wage Orders § 12; Augustus v. ABM Security Services, Inc. (2016) 2 Cal.5th 257',
  second: 'Lab. Code § 512(a) (second meal waivable only if total hours ≤ 12 and the first meal was not waived)',
  consent: 'Lab. Code § 512(a) (waiver by “mutual consent”); Brinker, 53 Cal.4th at 1040–1041',
  retaliation: 'Lab. Code §§ 98.6, 1102.5',
  bilingual: 'Civ. Code § 1654 (ambiguity construed against the drafter); Lab. Code § 2810.5 (notice in the language used for hiring)',
  onDuty: 'IWC Wage Orders § 11 (on-duty meal period: nature of the work, written agreement, revocable by the employee at any time); Abdullah v. U.S. Security Associates, Inc. (9th Cir. 2013) 731 F.3d 952',
  records: 'IWC Wage Orders § 7(A)(3) (meal periods must be recorded)'
};

export function detectKind(text: string): DocKind {
  const t = text.toLowerCase();
  if (/on[- ]duty meal/.test(t) && /agree/.test(t)) return 'on_duty_meal';
  if (/(waive|waiver|renuncia)/.test(t) && /(meal|comida)/.test(t) && t.length < 12000) return 'meal_waiver';
  const topics = REQUIRED.filter(r => r.detect.test(text)).length;
  if (/\b(employee )?handbook\b/i.test(text.slice(0, 400)) || (text.length > 3000 && topics >= 4) || topics >= 6) return 'handbook';
  if (topics >= 1 || PROBLEMS.some(p => p.re.test(text)) || /\b(policy|employee|employer|company)\b/.test(t)) return 'policy';
  return 'other';
}
const LABEL: Record<DocKind, string> = { meal_waiver: 'Meal period waiver', on_duty_meal: 'On-duty meal period agreement', handbook: 'Employee handbook', policy: 'Workplace policy', other: 'Document' };

/** Employer name as written in the document (“… by me or by Acme Pizza, Inc. at any time”). */
export function employerIn(text: string): string | undefined {
  const m = text.match(/\b(?:by (?:either )?me or (?:by )?|between [^,]{2,60} and |employer:?\s*)([A-Z][A-Za-z0-9&'’.,\- ]{2,60}?(?:,? (?:Inc|LLC|L\.L\.C|Corp|Corporation|Co|Company|LP|LLP)\.?)+)(?=[\s,.;)]|$)/);
  return m?.[1]?.trim().replace(/\s+/g, ' ');
}

type Ctx = { blocks: Block[]; edits: Edit[]; findings: ReviewPlan['findings']; notes: string[]; employer: string; today: string };
const add = (c: Ctx, e: Edit, quote?: string) => { c.edits.push(e); c.findings.push({ title: e.title, why: e.why, cite: e.cite, level: e.level, quote }); };
const n = (title: string, why: string, cite: string, level: EditNote['level'] = 'required'): EditNote => ({ title, why, cite, level });

// ---------------------------------------------------------------- meal period waiver
function mealWaiver(c: Ctx) {
  const { blocks } = c; const en = blocks.filter(b => b.lang === 'en'), es = blocks.filter(b => b.lang === 'es');
  const enText = en.map(b => b.text).join('\n');
  const E = c.employer;
  const find = (re: RegExp, pool = en) => pool.find(b => re.test(b.text));

  const title = find(/waiver/i); const restInTitle = title && /break|rest/i.test(title.text) && title.text.length < 90;
  if (title && restInTitle) add(c, { op: 'replace', block: title.i, text: 'MEAL PERIOD WAIVER', ...n('Title promises a “break” waiver', 'Rest breaks cannot be waived in advance by a signed form — the employer must authorize and permit them. Calling the form a meal and break waiver invites the argument that rest breaks were discouraged.', LAW.rest) }, title.text);

  const ent = find(/entitled to/i);
  const entOk = ent && /fifth|5th/i.test(ent.text) && /(tenth|10th|second meal)/i.test(ent.text) && /more than (five|5)/i.test(ent.text);
  const entText = 'I understand that, as a non-exempt employee, I am entitled to an unpaid, duty-free meal period of at least 30 minutes that begins no later than the end of my fifth hour of work whenever I work more than five (5) hours in a workday, and to a second unpaid, duty-free meal period of at least 30 minutes that begins no later than the end of my tenth hour of work whenever I work more than ten (10) hours in a workday. I also understand that my first meal period may be waived by mutual consent only when my total work period for the day is no more than six (6) hours.';
  if (ent && !entOk) add(c, { op: 'replace', block: ent.i, text: entText, ...n('Meal period entitlement misstated', `The form says the meal break is owed “${(ent.text.match(/for every [^.]{0,40}|per [^.]{0,30}hour[^.]{0,20}/i)?.[0] || 'on a different schedule').trim()}”. California requires a 30-minute duty-free meal period beginning no later than the end of the fifth hour when the work period exceeds five hours, and a second beginning no later than the end of the tenth hour when it exceeds ten hours — not one per five-hour block. A misstatement of the right undermines the knowing, voluntary consent a waiver depends on.`, LAW.meal) }, ent.text);
  if (!ent) add(c, { op: 'insert', after: (find(/agree to waive/i) || en[0])?.i ?? -1, texts: [entText], ...n('Form does not state the employee’s meal period rights', 'A waiver is only defensible if the employee knowingly gives up a known right. State the right being waived.', LAW.consent) });

  const agree = en.find(b => /agree to waive/i.test(b.text) && /\b(six|6|seven|eight|7|8|hours?)\b/i.test(b.text)) || find(/agree to waive/i);
  if (agree) {
    const tooLong = /(?:more than|exceed\w*|up to|within)[^.]{0,40}\b(seven|eight|nine|ten|7|8|9|10)\b\s*(?:\(\d+\)\s*)?hours?/i.test(agree.text);
    let t = agree.text.replace(/\b(waive) (?:the|a|my) meal (period|break)s?\b/i, '$1 my first meal period');
    if (tooLong) t = 'Accordingly, I agree to waive my first meal period on any workday when my total work period will be no more than six (6) hours.';
    if (t !== agree.text) add(c, { op: 'replace', block: agree.i, text: t, ...(tooLong ? n('Waiver reaches shifts longer than six hours', 'A first meal period can be waived only when the total work period for the day is no more than six hours. Any waiver beyond that is void, and every such shift carries a premium.', LAW.meal) : n('Specify which meal period is waived', 'The waiver may cover only the first meal period, and only on six-hour days. Saying “the meal period” leaves it open to reading as a broader waiver.', LAW.meal, 'recommended')) }, agree.text);
    if (!/does not apply|only on days|no meal waiver applies/i.test(enText))
      add(c, { op: 'insert', after: agree.i, texts: ['This waiver does not apply on any day I work more than six (6) hours; on those days I will be provided a meal period. Even on days covered by this waiver, I may ask for and take a meal period.'], ...n('Limit the waiver to six-hour days and preserve the choice to eat', 'Spell out that the waiver stops at six hours and that the employee can still take a meal period on any day; this keeps the waiver a mutual choice rather than a schedule the employee cannot opt out of.', LAW.consent, 'recommended') });
    if (!/second meal/i.test(enText))
      add(c, { op: 'insert', after: agree.i, texts: ['Second Meal Period (optional)', '☐ I also agree to waive my second meal period on any workday when my total hours worked are no more than twelve (12) and I have taken my first meal period that day. I understand that I cannot waive both meal periods on the same day.'], heading: [true, false], ...n('Add the optional second-meal waiver', 'Employees who work more than ten hours are owed a second meal period. It may be waived only if the day is no more than twelve hours and the first meal was not waived. Including the option, with that condition, avoids premium exposure on 10–12 hour shifts.', LAW.second, 'recommended') });
    if (!/(additional|extra) hour of pay|226\.7|premium/i.test(enText))
      add(c, { op: 'insert', after: agree.i, texts: ['If I am not provided a meal period that complies with California law and that I have not validly waived, I will receive one additional hour of pay at my regular rate of compensation for that workday, as required by Labor Code section 226.7.'], ...n('State the meal period premium', 'Employees are owed one additional hour of pay at the regular rate of compensation for each workday a compliant meal period is not provided. Stating it shows the waiver is not used to avoid premiums.', LAW.premium, 'recommended') });
  }

  const restWaive = /(rest (?:break|period)s?[^.]{0,50}waiv|waiv[^.]{0,50}rest (?:break|period)|\bbreak waiver\b|renunciar[^.]{0,80}descanso|periodo de descanso)/i;
  const restBlocks = blocks.filter(b => restWaive.test(b.text) && b !== title);
  const enRest = restBlocks.filter(b => b.lang === 'en');
  for (const b of enRest) add(c, { op: 'delete', block: b.i, ...n('Remove the rest-break waiver', 'An advance, signed waiver of rest breaks is not a defense: the employer must authorize and permit a paid, duty-free 10-minute rest period for every four hours worked or major fraction thereof, and owes a premium when it does not.', LAW.rest) }, b.text);
  if (restInTitle || restBlocks.length || /\b(rest|break)\b/i.test(enText.replace(/meal break/gi, '')))
    add(c, { op: 'insert', after: (agree || en[en.length - 1]).i, texts: ['This form does not waive rest periods. I am authorized and permitted to take a paid, duty-free 10-minute rest period for every four hours worked or major fraction thereof, and the Company will not ask me to give them up.'], ...n('Confirm rest periods are not waived', 'Because the original form addressed breaks, say expressly that rest periods are not affected and remain authorized and permitted.', LAW.rest, restBlocks.length ? 'required' : 'recommended') });

  const vol = find(/freely and voluntarily|voluntar/i);
  if (!/condition of employment|retaliat/i.test(enText)) {
    const s = 'Signing this waiver is not a condition of employment, and I will not be disciplined or retaliated against for declining to sign it or for revoking it.';
    if (vol) add(c, { op: 'replace', block: vol.i, text: vol.text.replace(/(freely and voluntarily\.?)/i, m => `${m.endsWith('.') ? m : m + '.'} ${s}`), ...n('State that the waiver is voluntary and not required for the job', 'A meal waiver must reflect mutual consent. Confirming that signing is optional and that declining or revoking carries no consequence protects the waiver against a coercion challenge.', LAW.consent + '; ' + LAW.retaliation, 'recommended') }, vol.text);
    else add(c, { op: 'insert', after: (agree || en[en.length - 1]).i, texts: [`I enter into this agreement freely and voluntarily. ${s}`], ...n('State that the waiver is voluntary and not required for the job', 'A meal waiver must reflect mutual consent.', LAW.consent, 'required') });
  }
  if (!/revok|revocation|withdraw/i.test(enText))
    add(c, { op: 'insert', after: (vol || agree || en[en.length - 1]).i, texts: [`I may revoke this waiver at any time by notifying my manager in writing. ${E.replace(/\.$/, '')} may also end this waiver in writing.`], ...n('Add a revocation right', 'Because a waiver rests on mutual consent, either side should be able to end it; a waiver the employee cannot withdraw looks like a condition of employment.', LAW.consent, 'recommended') });

  const sigLine = en.find(b => /^\s*(employee\s+)?signature\s*:/i.test(b.text) && !/_{4,}/.test(b.text));
  if (sigLine) {
    add(c, { op: 'replace', block: sigLine.i, text: 'Employee signature: ______________________     Approved by: ______________________', ...n('Add signature lines', 'The signature block has labels but no lines to sign on; the employee’s signature and the manager’s approval are what make the waiver a mutual agreement.', LAW.consent, 'recommended') }, sigLine.text);
    const cap = en.find(b => b.i === sigLine.i + 1 && /\((employee|manager)[^)]*signature\)/i.test(b.text));
    if (cap) add(c, { op: 'delete', block: cap.i, ...n('Captions folded into the signature lines', 'The captions are now part of the labeled signature lines above.', 'Form clarity', 'recommended') }, cap.text);
  }
  const sig = [...en].reverse().find(b => /signature|signed/i.test(b.text));
  if (sig && !/\bdate\b/i.test(enText)) add(c, { op: 'insert', after: sig.i, texts: ['Date: ____________________     Store / Location: ____________________'], ...n('Add a date line', 'The waiver should show when it was signed so it can be matched to the shifts it covers; the Spanish version already asks for a date.', LAW.records, 'recommended') });

  const rev = blocks.find(b => /^rev(?:ised|\.)?\s*\d{1,2}\/\d{2,4}$/i.test(b.text.trim()));
  if (rev) add(c, { op: 'replace', block: rev.i, text: `Rev. ${+c.today.slice(5, 7)}/${c.today.slice(0, 4)}`, ...n('Update the revision date', 'The form was revised to current law; update its revision date so the current version can be identified.', 'Recordkeeping best practice', 'recommended') }, rev.text);

  if (es.length) {
    const esText = es.map(b => b.text).join(' ');
    const why = [/descanso/i.test(esText) ? 'offers a waiver of rest periods' : '', !/revoc/i.test(esText) ? 'omits the revocation right' : '', !/(quinta|5)/i.test(esText) ? 'does not state the meal period rules' : '', /sugerente/i.test(esText) ? 'contains a typo (“sugerente” for “su gerente”)' : ''].filter(Boolean);
    es.forEach((b, k) => add(c, { op: 'delete', block: b.i, ...(k === 0 ? n('Spanish version does not match the English', `The Spanish text ${why.join(', ') || 'differs from the English'}. Two versions that say different things are construed against the employer, and a Spanish-speaking employee cannot knowingly consent to terms they were not given. Replaced with a translation of the revised English form.`, LAW.bilingual + '; ' + LAW.rest) : n('Spanish version replaced', 'Replaced by the corrected Spanish translation below.', LAW.bilingual)) }, b.text));
    const T = spanishWaiver(E);
    add(c, { op: 'insert', after: es[es.length - 1].i, texts: T.texts, heading: T.heading, ...n('Corrected Spanish translation', 'Spanish translation of the revised English form, with the same rights, limits, and signature lines.', LAW.bilingual, 'required') });
  }
}
function spanishWaiver(E: string) {
  const texts = [
    'RENUNCIA AL PERIODO DE COMIDA',
    'Nombre del empleado (en letra de molde): ______________________________     Tienda: ______________     Fecha: ______________',
    'Entiendo que, como empleado no exento, tengo derecho a un periodo de comida no pagado, libre de toda obligación laboral, de al menos 30 minutos, que comience a más tardar al final de mi quinta hora de trabajo cuando trabajo más de cinco (5) horas en un día, y a un segundo periodo de comida no pagado de al menos 30 minutos que comience a más tardar al final de mi décima hora de trabajo cuando trabajo más de diez (10) horas en un día. También entiendo que solo puedo renunciar a mi primer periodo de comida, de mutuo acuerdo, cuando mi jornada total del día no sea de más de seis (6) horas.',
    'Por lo tanto, acepto renunciar a mi primer periodo de comida en cualquier día en que mi jornada total no sea de más de seis (6) horas. Esta renuncia no aplica en ningún día en que trabaje más de seis (6) horas; esos días se me dará un periodo de comida. Aun en los días cubiertos por esta renuncia, puedo pedir y tomar un periodo de comida.',
    '☐ (Opcional) También acepto renunciar a mi segundo periodo de comida en cualquier día en que mis horas totales trabajadas no sean más de doce (12) y haya tomado mi primer periodo de comida ese día. Entiendo que no puedo renunciar a ambos periodos de comida el mismo día.',
    'Si no se me da un periodo de comida que cumpla con la ley de California y al que no haya renunciado válidamente, recibiré una hora adicional de pago a mi tarifa regular de compensación por ese día, como lo exige la sección 226.7 del Código Laboral.',
    'Este formulario no es una renuncia a los periodos de descanso. Estoy autorizado y se me permite tomar un periodo de descanso pagado de 10 minutos, libre de toda obligación laboral, por cada cuatro horas trabajadas o fracción mayor, y la Compañía no me pedirá que renuncie a ellos.',
    `Firmo este acuerdo libre y voluntariamente. Firmar esta renuncia no es una condición de empleo, y no seré disciplinado ni sufriré represalias por negarme a firmarla o por revocarla. Entiendo que este acuerdo puede ser revocado por escrito, en cualquier momento, por mí o por ${E.replace(/\.$/, '')}.`,
    'Firma del empleado: ______________________________     Aprobado por (gerente o supervisor): ______________________________',
    'Complete este formulario y entréguelo a su gerente. Se le dará una copia firmada.'
  ];
  return { texts, heading: texts.map((_, k) => k === 0) };
}

// ---------------------------------------------------------------- on-duty meal period agreement
function onDutyMeal(c: Ctx) {
  const t = c.blocks.map(b => b.text).join('\n'); const last = c.blocks[c.blocks.length - 1]?.i ?? -1;
  const anchor = (c.blocks.find(b => /on[- ]duty meal/i.test(b.text)) || c.blocks[0])?.i ?? -1;
  if (!/nature of (?:the |my )?(?:work|job|duties)/i.test(t)) add(c, { op: 'insert', after: anchor, texts: ['An on-duty meal period is permitted only because the nature of my work prevents me from being relieved of all duty. If my position changes so that I can be relieved, I will receive off-duty meal periods.'], ...n('State why an on-duty meal is necessary', 'On-duty meals are lawful only when the nature of the work prevents relief from all duty — an objective test, not convenience. The agreement should record why.', LAW.onDuty) });
  const revoke = c.blocks.find(b => /revok|revocation|withdraw/i.test(b.text));
  if (!revoke) add(c, { op: 'insert', after: anchor, texts: ['I may revoke this agreement at any time by notifying my manager in writing.'], ...n('Add the employee’s right to revoke at any time', 'The wage orders require that the written on-duty agreement state the employee may revoke it in writing at any time.', LAW.onDuty) });
  else if (/(\d+|thirty|sixty|fourteen|seven)\s*(?:\(\d+\)\s*)?days?['’]?\s*(?:advance |prior |written )?notice|only (?:by|with) (?:the )?(?:company|employer)/i.test(revoke.text)) add(c, { op: 'replace', block: revoke.i, text: 'I may revoke this agreement at any time by notifying my manager in writing.', ...n('Revocation cannot be restricted', 'The employee must be able to revoke an on-duty meal agreement at any time; notice periods or employer-only revocation are not allowed.', LAW.onDuty) }, revoke.text);
  if (!/(paid|compensat|hours worked|time worked)/i.test(t)) add(c, { op: 'insert', after: anchor, texts: ['The on-duty meal period is paid at my regular rate and counted as time worked for all purposes, including overtime.'], ...n('On-duty meal periods are paid time', 'An on-duty meal period is counted as time worked and must be paid.', LAW.onDuty) });
  if (!/226\.7|additional hour|premium/i.test(t)) add(c, { op: 'insert', after: last, texts: ['If I am not provided a compliant meal period (on-duty or off-duty) on any workday, I will receive one additional hour of pay at my regular rate of compensation for that day.'], ...n('State the meal period premium', 'A premium is owed when a compliant meal period (including a valid on-duty meal) is not provided.', LAW.premium, 'recommended') });
}

// ---------------------------------------------------------------- handbooks and single policies
const sentences = (p: string) => p.split(/(?<=[.!?])\s+(?=[A-Z“"(])/);
function policies(c: Ctx, kind: DocKind) {
  const text = c.blocks.map(b => b.text).join('\n');
  for (const pr of PROBLEMS) for (const b of c.blocks) {
    const hits = sentences(b.text).filter(x => pr.re.test(x)); const s = hits[0]; if (!s) continue;
    const prior = c.edits.find(e => e.op === 'replace' && e.block === b.i) as Extract<Edit, { op: 'replace' }> | undefined;
    // the replacement covers the whole topic: drop further sentences in the same paragraph that the same rule flags
    const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim().replace(/ (in advance|first)$/, '');
    const dupes = sentences(b.text).filter(x => x !== s && !hits.includes(x) && norm(x).length > 12 && norm(pr.replacement).includes(norm(x)));
    const strip = (t: string) => [...hits.slice(1), ...dupes].reduce((acc, h) => acc.replace(h, '').replace(/\s{2,}/g, ' ').trim(), t);
    if (prior) { prior.text = strip(prior.text.replace(s, pr.replacement)); prior.why += ` Also: ${pr.problem}`; prior.cite += `; ${pr.cite}`; c.findings.push({ title: pr.title, why: pr.problem, cite: pr.cite, level: 'required', quote: s }); }
    else add(c, { op: 'replace', block: b.i, text: strip(b.text.replace(s, pr.replacement)), ...n(pr.title, pr.problem, pr.cite) }, hits.join(' '));
    break;
  }
  // harassment policy must let employees bypass their own supervisor (Cal. Code Regs., tit. 2, § 11023(b)(5))
  const har = c.blocks.find(b => /harass/i.test(b.text));
  if (har && !/human resources|\bhr\b|any (?:manager|supervisor)|other than|bypass|alternat|hotline|civil rights department|\bcrd\b/i.test(har.text)) {
    const s2 = sentences(har.text).find(x => /report/i.test(x));
    const better = 'Report concerns to your supervisor, Human Resources, or any manager you are comfortable with — you do not have to report to the person involved or to your own supervisor. The Company investigates every complaint promptly and impartially, keeps it as confidential as possible, takes appropriate corrective action, and prohibits retaliation. You may also contact the California Civil Rights Department.';
    add(c, { op: 'replace', block: har.i, text: s2 ? har.text.replace(s2, better) : `${har.text} ${better}`, ...n('Harassment complaint process is incomplete', 'A compliant policy must let employees complain to someone other than their immediate supervisor, describe a prompt and impartial investigation, and prohibit retaliation.', 'Gov. Code § 12950.1; Cal. Code Regs., tit. 2, § 11023(b)') }, s2 || har.text);
  }
  const revised = c.blocks.map(b => (c.edits.find(e => e.op === 'replace' && e.block === b.i) as Extract<Edit, { op: 'replace' }> | undefined)?.text ?? b.text).join('\n');
  const last = c.blocks[c.blocks.length - 1]?.i ?? -1;
  if (kind === 'handbook') {
    for (const r of REQUIRED.filter(r => !r.detect.test(revised)))
      add(c, { op: 'insert', after: last, texts: [r.title, r.text], heading: [true, false], ...n(`Add required policy: ${r.title}`, `Applies to: ${r.appliesTo}. The handbook has no policy on this topic.`, r.cite, /^All employers/.test(r.appliesTo) ? 'required' : 'recommended') });
  } else if (/meal (?:period|break)|lunch/i.test(text) && kind === 'policy') {
    // a meal/rest policy on its own: make sure the core rules are all stated
    const need: [RegExp, string, string][] = [
      [/(fifth|5th) hour/i, 'Non-exempt employees receive an uninterrupted, duty-free meal period of at least 30 minutes that begins no later than the end of the fifth hour of work, and a second one that begins no later than the end of the tenth hour.', LAW.meal],
      [/(10|ten)[- ]minute/i, 'Non-exempt employees are authorized and permitted to take a paid, duty-free 10-minute rest period for every four hours worked or major fraction thereof, taken near the middle of each work period when practicable.', LAW.rest],
      [/(additional|extra) hour of pay|premium|226\.7/i, 'If a compliant meal or rest period is not provided, the employee receives one additional hour of pay at the regular rate of compensation for each workday a meal period is missed and for each workday a rest period is missed.', LAW.premium],
      [/(record|clock (?:out|in)|punch)/i, 'Employees clock out and back in for every meal period; meal periods are never deducted automatically.', LAW.records]
    ];
    for (const [re, s, cite] of need) if (!re.test(text)) add(c, { op: 'insert', after: last, texts: [s], ...n('Meal and rest policy is missing a required rule', s, cite) });
    c.notes.push('This looks like a single policy, so Aldune reviewed it against the rules for its topic. Upload the full handbook to check for missing required policies.');
  } else if (kind === 'policy') c.notes.push('This looks like a single policy, so Aldune reviewed it against the rules for its topic. Upload the full handbook to check for missing required policies.');
}

export function reviewParagraphs(paras: string[], opts: { employer?: string; today?: string; kind?: DocKind } = {}): ReviewPlan {
  const blocks = toBlocks(paras); const text = blocks.map(b => b.text).join('\n');
  const kind = opts.kind || detectKind(text);
  const c: Ctx = { blocks, edits: [], findings: [], notes: [], employer: employerIn(text) || opts.employer || 'the Company', today: opts.today || new Date().toISOString().slice(0, 10) };
  if (kind === 'meal_waiver') mealWaiver(c);
  else if (kind === 'on_duty_meal') onDutyMeal(c);
  else if (kind === 'handbook' || kind === 'policy') policies(c, kind);
  else c.notes.push('This document isn’t an employment policy or form Aldune reviews, so no changes were proposed.');
  return { kind, label: LABEL[kind], employer: c.employer === 'the Company' ? undefined : c.employer, blocks, edits: c.edits, findings: c.findings, notes: c.notes };
}
