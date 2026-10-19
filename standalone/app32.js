/* Aldune — part 32: report depth. The remediation report, management summary, and data quality report become complete
   working documents: what is owed and to whom, what to change and by when, who owns it, which document to send, the
   authority, and what was checked — even before anyone has created tasks. */
(() => {
'use strict';
const X = window.PCX; const { PC, S } = X;
if (!X.REPORTS) return;
const DRAFT = 'DRAFT — prepared with software. Have California employment counsel review before relying on it.';
const P = t => ({ t: 'p', align: 'justify', runs: [t] }); const Hd = t => ({ t: 'heading', text: t }); const B = items => ({ t: 'bullets', items: items.map(i => [i]) });
const money = n => `$${(Math.round((n || 0) * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const iso = (d = new Date()) => d.toISOString().slice(0, 10);
const addDays = (n, from = new Date()) => { const d = new Date(from); d.setDate(d.getDate() + n); return iso(d); };
const OWNER = { meal: 'Operations / store managers', rest: 'Operations / store managers', regular_rate: 'Payroll', overtime: 'Payroll', reconciliation: 'Payroll + Operations', min_wage: 'Payroll', split_shift: 'Scheduling + Payroll', reporting_time: 'Scheduling + Payroll', wage_statement: 'Payroll provider', final_pay: 'HR + Payroll', pay_timing: 'Payroll', expenses: 'Finance', classification: 'HR + Counsel', timekeeping: 'Payroll + IT', piece_rate: 'Payroll', tips: 'Finance + Payroll', vacation: 'HR + Payroll', sick_leave: 'HR + Payroll' };
const cover = t => (X.coverBlocks ? X.coverBlocks(t) : [{ t: 'title', text: t }]);
const lim = () => (X.limitations ? X.limitations() : []);
const plays = () => { try { return PC.playbooks(S.input, S.result).filter(p => p.owed > 0 || p.findings > 0); } catch { return []; } };
const owedNow = () => S.result.engine.employees.reduce((t, e) => t + e.exposure.wagesAndPremiums + e.exposure.reimbursement + e.exposure.interest, 0);
const affected = () => S.result.engine.employees.filter(e => e.exposure.total > 0);
const catRows = () => { const m = new Map(); for (const f of S.result.engine.findings) { if (!(f.amount > 0) || f.confidence === 'low') continue; const r = m.get(f.category) || { n: 0, amt: 0, emps: new Set() }; r.n++; r.amt += f.amount; r.emps.add(f.employeeId); m.set(f.category, r); } return [...m.entries()].sort((a, b) => b[1].amt - a[1].amt); };
const label = c => (PC.CATEGORY_LABELS && PC.CATEGORY_LABELS[c]) || c;

function planBlocks() {
  const ps = plays(); if (!ps.length) return [P('No category has an amount owed in the records reviewed. Keep the monthly check running and the policies below in place.')];
  return ps.flatMap((p, i) => {
    const due = addDays(i < 3 ? 14 : 30); const owner = OWNER[p.category] || 'HR + Payroll';
    return [Hd(`${i + 1}. ${p.label}${p.owed ? ` — ${money(p.owed)} owed` : ''}`),
      P(p.why || ''),
      { t: 'table', head: ['Step', 'Action', 'Owner', 'Target date'], rows: [
        ...(p.immediate || []).map(a => ['Pay / correct now', a, owner, addDays(14)]),
        ...(p.fix || []).map(a => ['Fix the cause', a, owner, due]),
        ...(p.prevent || []).map(a => ['Prevent', a, owner, addDays(60)])] },
      ...((p.documents || []).length ? [P(`Documents to send: ${(p.documents || []).map(d => d.label).join('; ')} (Aldune → Letters and packets).`)] : []),
      ...((p.law || []).length && PC.LAW ? [P(`Authority: ${(p.law || []).map(k => (PC.LAW.find(t => t.id === k) || {}).citations?.[0]).filter(Boolean).join('; ')}`)] : [])];
  });
}

X.REPORTS.remediation = ['Remediation report', 'What to pay, what to change, owners, target dates, documents, and status.', () => {
  const tasks = (S.ws && S.ws.tasks) || []; const dec = Object.entries((S.ws && S.ws.status) || {});
  const done = tasks.filter(t => /done|complete/i.test(t.status || '')).length;
  return { title: 'Remediation report', draftBanner: DRAFT, blocks: [...cover('Remediation Report'),
    Hd('Summary'),
    P(`${affected().length} workers have amounts owed in the records reviewed, totaling ${money(owedNow())} in wages, premiums, reimbursements, and interest. The plan below pays those amounts, corrects the payroll and scheduling causes, and documents the reasonable steps that limit PAGA penalties to 15% (steps taken before a notice) or 30% (steps taken within 60 days after) under Labor Code § 2699(g)–(h).`),
    P(tasks.length ? `Task tracker: ${tasks.length} tasks, ${done} complete, ${tasks.length - done} open.` : 'No tasks have been assigned yet; the target dates below are recommended defaults — 14 days to pay, 30 days to fix the cause, 60 days to complete prevention.'),
    Hd('Plan by issue'), ...planBlocks(),
    ...(tasks.length ? [Hd('Assigned tasks'), { t: 'table', head: ['Task', 'Linked to', 'Owner', 'Due', 'Status'], rows: tasks.map(t => [t.title, t.finding || (t.category ? label(t.category) : ''), t.owner || '—', t.due || '—', t.status || 'open']) }] : []),
    ...(dec.length ? [Hd('Review decisions'), { t: 'table', head: ['Finding', 'Decision', 'Reason', 'Date'], rows: dec.slice(0, 300).map(([id, v]) => [id, v.s || '', v.reason || '', v.at ? new Date(v.at).toLocaleDateString('en-US') : '']) }] : []),
    Hd('Reasonable-steps record'),
    B(['Keep this report, the payroll configuration memo and the provider’s written confirmation, signed policy acknowledgments, supervisor training sign-in sheets, and proof of each back-pay payment together.', 'Run the audit again after the first corrected payroll and keep the before-and-after comparison.', 'Record the date each step was completed; the PAGA cap depends on when the steps were taken.']),
    ...lim()] };
}];

X.REPORTS.management = ['Management summary', 'Plain-English summary: the number, what drives it, what it costs to fix, and decisions needed.', () => {
  const lo = X.sc ? X.sc(PC.PERSPECTIVES.defense).total : S.result.exposure.low, hi = X.sc ? X.sc(PC.PERSPECTIVES.neutral).total : S.result.exposure.base;
  const rows = catRows(); const ps = plays();
  return { title: 'Management summary', draftBanner: DRAFT, blocks: [...cover('Management Summary'),
    Hd('The bottom line'),
    P(`Likely exposure is ${money(lo)} to ${money(hi)} across ${affected().length} of ${S.input.employees.length} workers. Of that, ${money(owedNow())} is money owed to workers today (wages, premiums, reimbursements, and interest); the rest is penalty exposure that grows each pay period the causes continue and that paying now and fixing the causes can reduce.`),
    Hd('What drives it'),
    { t: 'table', head: ['Issue', 'Findings', 'Workers', 'Amount'], rows: rows.slice(0, 10).map(([c, r]) => [label(c), String(r.n), String(r.emps.size), money(r.amt)]) },
    Hd('What we recommend'),
    B([`Pay the ${money(owedNow())} owed now through a special payroll with unconditional letters (no release; Lab. Code § 206.5).`,
      ...ps.slice(0, 5).map(p => `${p.label}: ${(p.fix || [])[0] || (p.immediate || [])[0] || ''}`),
      'Adopt the meal and rest, timekeeping, and expense policies; train supervisors at the locations driving the numbers.',
      'Run Aldune monthly and before each payroll change.']),
    Hd('Decisions needed from management'),
    B(['Approve the back-pay payroll and the payment date.', 'Approve the payroll configuration changes and who confirms them with the provider.', 'Decide whether counsel directs the remaining review (privilege).', 'Assign an owner for each issue in the remediation report.']),
    ...lim()] };
}];

X.REPORTS.quality = ['Data quality report', 'Issues by severity with examples and effect on confidence; every check performed.', () => {
  const q = S.q2 || PC.assessQuality(S.input);
  const n = { emp: S.input.employees.length, time: S.input.timeRecords.length, pay: S.input.payroll.length };
  return { title: 'Data quality report', draftBanner: DRAFT, blocks: [...cover('Data Quality Report'),
    Hd('Result'),
    P(`Data quality score ${q.score}% (${q.confidence} confidence) across ${n.emp} workers, ${n.time.toLocaleString()} time records, and ${n.pay.toLocaleString()} payroll rows. ${q.issues.length ? `${q.issues.length} issue type${q.issues.length === 1 ? '' : 's'} found; each is listed with examples and how it affects the results.` : 'No data problems were found, so findings rest on complete records.'}`),
    ...(q.issues.length ? [{ t: 'table', head: ['Severity', 'Issue', 'Count', 'Examples', 'Effect on results'], rows: q.issues.map(i => [i.severity.toUpperCase(), i.title, String(i.count), (i.examples || []).slice(0, 3).join('; '), i.impact]) }] : []),
    Hd('Checks performed'),
    B(['Every time record and payroll row matches a worker in the census; duplicate worker IDs.', 'Missing, reversed, zero-length, and over-16-hour punches; duplicate shifts; meal punches outside the shift.', 'Time records with no payroll for the same period, and payroll with no time records.', 'Pay rates, classifications, salary amounts, and work locations present for each worker.', 'Coverage: the share of the audit window each worker has records for.']),
    Hd('What to do'),
    B(q.issues.length ? ['Fix critical and high issues at the source and re-import before relying on totals.', 'Where records cannot be fixed, mark affected findings “insufficient evidence” rather than paying or disputing them.'] : ['No correction needed. Keep the same export settings for the monthly check.']),
    ...lim()] };
}];
})();
