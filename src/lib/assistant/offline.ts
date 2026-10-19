// Built-in Aldune investigator: answers without any AI service by routing questions to the same read-only tools,
// composing answers from deterministic templates, and validating every citation. Works in any browser.
import { executeTool, finalizeCitations, type Citation, type DataAccess, type ModelClient, type Block } from './core';
import { CATEGORY_LABELS } from '../engine/exposure';
import { lawById, searchLaw } from '../law/kb';
import { actionsFor, matchFaq, type ActionKey } from '../law/faq';
import { REQUIRED } from '../documents/handbook';
import { deadlinesFor, DEADLINE_EVENTS, type DeadlineEvent } from '../deadlines';

const usd = (n: number) => `$${Math.round(n || 0).toLocaleString('en-US')}`;
const CATS: [RegExp, string][] = [[/reporting.time|report(ed|ing)? for work|sent home early/, 'reporting_time'], [/split.shift/, 'split_shift'], [/second meal|meal|lunch/, 'meal'], [/rest|break/, 'rest'], [/regular rate|bonus|differential/, 'regular_rate'], [/overtime|hours discrepancy|unpaid hours|reconcil/, 'reconciliation'], [/minimum wage|min wage/, 'min_wage'], [/wage statement|pay ?stub/, 'wage_statement'], [/final pay|waiting|termination/, 'final_pay'], [/payday|pay timing|late pay/, 'pay_timing'], [/expense|mileage|phone|reimburs/, 'expenses'], [/misclass|exempt|contractor|classification/, 'classification'], [/rounding|timekeeping|off.the.clock/, 'timekeeping'], [/split/, 'split_shift']];
const DATA_WORDS = /\b(our|we|us|my|audit|finding|findings|worker|workers|employee|employees|location|supervisor|exposure|owe|owed|risk|risks|pattern|patterns|scenario|what if|exclude|fnd-|top|most|biggest|largest|summar|investigate|show|list|which|who)\b/i;

export interface OfflineAnswer { text: string; citations: Citation[]; intent: string; actions: ActionKey[] }

export async function answerOffline(question: string, data: DataAccess, opts: { auditId?: string } = {}): Promise<OfflineAnswer> {
  const q = question.trim(); const ql = q.toLowerCase();
  const allowed = new Map<string, Citation>(); const out: string[] = [];
  const call = async (name: string, input: Record<string, unknown>) => { const r = await executeTool(name, input, data); r.sources.forEach(c => allowed.set(`${c.type}:${c.id}`, c)); return r.result as any; }; // eslint-disable-line @typescript-eslint/no-explicit-any
  const audits = await data.listAudits(); const auditId = opts.auditId || audits[0]?.id; const hasAudit = !!(auditId && await data.source(auditId));
  let acts: ActionKey[] = [];
  const finish = (intent: string) => { const f = finalizeCitations(out.join('\n'), allowed); const actions = acts.length ? acts : actionsFor(q, f.citations.filter(c => c.type === 'law').map(c => c.id), intent); return { text: f.text, citations: f.citations, intent, actions }; };

  // ---------- deadlines: exact dates from the deadline engine when a question names an event and a date
  {
    const EV: [RegExp, DeadlineEvent][] = [[/paga notice|lwda notice|cure (?:proposal|deadline)/, 'paga_notice'], [/berman (?:award|decision)|oda |appeal (?:the )?(?:labor commissioner|award)/, 'berman_award'], [/berman|labor commissioner (?:claim|complaint)|wage claim filed/, 'berman_complaint'], [/fair chance|conviction|background check notice|preliminary decision/, 'fair_chance'], [/layoff|warn|plant closure|closing/, 'layoff'], [/(?:fired|discharged|terminated|let go)/, 'separation_discharge'], [/quit|resign/, 'separation_quit'], [/records request|personnel file|copy of (?:my|their) (?:pay|time)/, 'records_request'], [/pay (?:rate )?change|raise|change in pay/, 'pay_change'], [/look-?back|statute of limitations|how far back/, 'limitations']];
    const MON = 'january|february|march|april|may|june|july|august|september|october|november|december';
    const dm = q.match(new RegExp(`(${MON})\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s*(\\d{4})?`, 'i')) || q.match(/(\d{4})-(\d{2})-(\d{2})/) || q.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    const ev = EV.find(([re]) => re.test(ql));
    if (ev && dm && /deadline|when|due|date|how long|by when|last day|look-?back|how far back/.test(ql)) {
      let date: string | null = null; const thisYear = new Date().getFullYear();
      if (/^\d{4}$/.test(dm[1])) date = `${dm[1]}-${dm[2]}-${dm[3]}`;
      else if (/^\d/.test(dm[1])) { const y = dm[3].length === 2 ? 2000 + Number(dm[3]) : Number(dm[3]); date = `${y}-${String(dm[1]).padStart(2, '0')}-${String(dm[2]).padStart(2, '0')}`; }
      else { const m = MON.split('|').indexOf(dm[1].toLowerCase()) + 1; date = `${dm[3] || thisYear}-${String(m).padStart(2, '0')}-${String(dm[2]).padStart(2, '0')}`; }
      if (date && !isNaN(Date.parse(date))) {
        const list = deadlinesFor(ev[1], date, { smallEmployer: !/100 or more|over 100|more than 100|large employer/.test(ql), disputed: /disput/.test(ql) });
        const fmt = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' });
        out.push(`**${DEADLINE_EVENTS[ev[1]]} on ${fmt(date)}** — here are the dates:`);
        out.push(`| Date | What | Rule |\n|---|---|---|\n${list.map(x => `| ${fmt(x.date)} | ${x.label} | ${x.rule} (${x.cite}) |`).join('\n')}`);
        out.push('Deadlines that land on a weekend or federal holiday move to the next business day (Code Civ. Proc. § 12a); waiting periods don’t. Add them to your calendar from the Compliance calendar page.');
        acts = ['calendar' as ActionKey].filter(k => k) as ActionKey[]; return finish('deadlines');
      }
    }
  }

  // ---------- drafting: produce real documents from Aldune's cited policy library and route to document generators
  if (/^(please\s+)?(can you\s+|could you\s+)?(draft|write|prepare|create|generate|make|compose)\b|\bdraft (?:a|an|the|me|our)\b/.test(ql)) {
    const pick = REQUIRED.filter(r => ql.includes(r.title.toLowerCase().split(' ')[0]) || r.title.toLowerCase().split(/[^a-z]+/).filter(w => w.length > 4).some(w => ql.includes(w)));
    const ROUTE: [RegExp, ActionKey[], string][] = [
      [/separation|severance|release agreement/, ['separation'], 'a separation agreement and general release (with the Gov. Code § 12964.5 notice and carve-out, § 1542 waiver, and OWBPA terms for workers 40+)'],
      [/settlement (?:agreement|packet)|pick ?up stix/, ['settlement_packet'], 'individual settlement packets (notice letter, agreement, calculation exhibit)'],
      [/mediation brief|mediation statement|demand letter|term sheet|mou/, ['litigation'], 'litigation documents (mediation brief, demand letter, PAGA notice or response, term sheet)'],
      [/cure proposal|paga response|response to (?:the )?paga/, ['paga_cure', 'eec', 'litigation'], 'a PAGA cure proposal or early evaluation statement'],
      [/wage (?:payment )?letter|back pay letter/, ['wage_letter', 'wage_letter_es'], 'wage payment letters in English and Spanish'],
      [/training memo|supervisor training/, ['training_memo'], 'a supervisor training memo built from your audit'],
      [/payroll (?:configuration|memo)|pos (?:memo|configuration)|time ?clock/, ['payroll_memo', 'pos'], 'a payroll or POS configuration request']
    ];
    const route = ROUTE.find(([re]) => re.test(ql));
    const wantsHandbook = /handbook|manual|all (?:required )?policies/.test(ql);
    const policies = wantsHandbook ? REQUIRED : pick;
    if (policies.length) {
      out.push(`Here’s a draft${policies.length > 1 ? ` with ${policies.length} California policies` : ''}. Each section cites its authority; have counsel tailor it to your practices.`);
      out.push(`<<<DRAFT\n${wantsHandbook ? 'California Employee Policies' : policies[0].title + ' Policy'}\n\n${policies.map(r => `## ${r.title}\n${r.text}\nAuthority: ${r.cite}. Applies to: ${r.appliesTo}.`).join('\n\n')}\n\nDraft for attorney review.\nDRAFT>>>`);
      acts = ['review_docs', ...(route ? route[1] : [])].slice(0, 4) as ActionKey[];
      return finish('draft');
    }
    if (route) { out.push(`I can generate ${route[2]} from your data — use the button below. For a fully custom draft in your own words, turn on Aldune AI and ask me again.`); acts = route[1]; return finish('draft'); }
    const fq = matchFaq(ql, 1)[0];
    const topic = ql.replace(/^(please\s+)?(can you\s+|could you\s+)?(draft|write|prepare|create|generate|make|compose)\s+(?:a|an|the|me|our)?\s*/, '').replace(/[?.!]+$/, '');
    out.push(`Here’s a starting draft. For a fully custom version, turn on Aldune AI and ask again.`);
    out.push(`<<<DRAFT\n${topic.charAt(0).toUpperCase() + topic.slice(1)}\n\nDate: [date]\nTo: [recipient]\nFrom: [name, title]\n\n[Opening — state the purpose in one sentence.]\n\n${fq ? `Key points:\n${[fq.faq.answer, ...fq.faq.points].map(x => `- ${x}`).join('\n')}\n\nAuthority: ${fq.faq.cites.join('; ')}.` : '[Main points.]'}\n\n[Closing — next steps, deadline, and contact person.]\n\n[Signature]\nDRAFT>>>`);
    if (fq) acts = fq.faq.actions.slice(0, 3);
    return finish('draft');
  }

  if (/^(hi|hello|hey|help|what can you do)\b/.test(ql) || ql.length < 3) {
    out.push(`I can answer questions about ${hasAudit ? 'this audit — exposure, findings, workers, locations, patterns, and “what if” scenarios — and about ' : ''}California wage-and-hour law from Aldune’s cited knowledge base. Try: “What are our biggest risks?”, “Show meal findings at Oxnard”, “Why was FND-000123 flagged?”, “What if we exclude workers with arbitration agreements?”, or “When is a second meal period required?”`);
    return finish('help');
  }

  const lawHits = searchLaw(q, 2);
  const looksData = hasAudit && DATA_WORDS.test(q);

  // ---- specific finding
  const fid = q.match(/FND-\d{6}/i)?.[0]?.toUpperCase();
  if (fid && hasAudit) {
    try { const f = await call('get_finding', { audit_id: auditId, finding_id: fid });
      out.push(`${f.title} [[finding:${f.id}]] for ${f.employeeName} [[employee:${f.employeeId}]] on ${f.date || f.periodStart}. ${f.explanation}`);
      out.push(`Estimated amount: ${usd(f.amount)} (${f.amountKind}); confidence ${f.confidence}${f.premiumIndicated ? '; payroll indicates a premium may already have been paid' : ''}. Rule ${f.ruleVersion}: ${f.authorities.slice(0, 2).join('; ')}.`);
      const law = lawHits[0] || searchLaw(f.category.replace('_', ' '), 1)[0]; if (law) { await call('get_law_topic', { topic_id: law.topic.id }); out.push(`Background: ${law.topic.summary} [[law:${law.topic.id}]]`); }
    } catch { out.push(`I couldn’t find ${fid} in this audit.`); }
    return finish('finding');
  }

  // ---- legal question (closed universe)
  const faqFirst = matchFaq(q, 1)[0];
  if (!looksData || (faqFirst && faqFirst.score >= 13) || (lawHits.length && /\b(law|legal|required|require|rule|statute|allowed|can an employer|must|when is|what is|how many|penalt|deadline|due)\b/.test(ql) && !/\b(our|we|us|my)\b/.test(ql))) {
    const faqs = matchFaq(q, 2);
    if (faqs.length) {
      const f = faqs[0].faq;
      for (const id of f.topics) { try { await call('get_law_topic', { topic_id: id }); } catch { /* ignore */ } }
      out.push(`${f.answer} ${f.topics.map(id => `[[law:${id}]]`).join(' ')}`);
      out.push(f.points.map(p => `• ${p}`).join('\n'));
      out.push(`Authorities: ${f.cites.join('; ')}.`);
      if (faqs[1] && faqs[1].score >= faqs[0].score * 0.75) out.push(`Related: ${faqs[1].faq.q}`);
      out.push('This is general legal information from Aldune’s verified knowledge base, not legal advice for your specific situation. Have California employment counsel review before acting.');
      acts = f.actions.slice(0, 5);
      return finish('law');
    }
    if (!lawHits.length) {
      // Never a dead end: answer from the closest topics and answers, then point to the right tool.
      const words = q.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 3);
      const near = new Map<string, number>(); for (const w of words) for (const h of searchLaw(w, 3)) near.set(h.topic.id, (near.get(h.topic.id) || 0) + h.score);
      const top = [...near.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([id]) => lawById(id)).filter(Boolean) as NonNullable<ReturnType<typeof lawById>>[];
      const fq = matchFaq(words.join(' '), 1)[0];
      if (fq) { out.push(`Here’s the closest answer I have: ${fq.faq.answer} ${fq.faq.topics.map(id => `[[law:${id}]]`).join(' ')}`); for (const id of fq.faq.topics) { try { await call('get_law_topic', { topic_id: id }); } catch { /* ignore */ } } acts = fq.faq.actions.slice(0, 4); }
      else if (top.length) { for (const t of top) { await call('get_law_topic', { topic_id: t.id }); out.push(`**${t.title}.** ${t.summary} [[law:${t.id}]]`); } }
      else out.push('That’s outside Aldune’s built-in library, which covers California wage-and-hour law, your audit, documents, POS and timekeeping, and litigation. Penny’s full AI answers any question — see the note above the chat to turn it on in this view.');
      out.push('General information, not legal advice.');
      return finish('law');
    }
    for (const h of lawHits.slice(0, lawHits[1] && lawHits[1].score >= lawHits[0].score * 0.7 ? 2 : 1)) {
      const t = await call('get_law_topic', { topic_id: h.topic.id });
      out.push(`**${t.title}.** ${t.summary} [[law:${t.id}]]`); out.push(t.points.slice(0, 6).map((p: string) => `• ${p}`).join('\n'));
      if (t.status) out.push(`Note: ${t.status}`);
      out.push(`Authorities: ${t.citations.join('; ')}. Last verified ${t.verified}.`);
    }
    out.push('This is general legal information from Aldune’s knowledge base, not legal advice.');
    return finish('law');
  }
  if (!hasAudit) { out.push('Run or load an audit first, and I can answer questions about your data. I can still answer California wage-and-hour law questions.'); return finish('no-audit'); }

  const sum = await call('get_audit_summary', { audit_id: auditId });
  const locs: string[] = (sum.byLocation || []).map((l: { name: string }) => l.name);
  const loc = locs.find(l => ql.includes(l.toLowerCase()));
  const cat = CATS.find(([re]) => re.test(ql))?.[1];

  // ---- scenario
  if (/what if|scenario|exclude|without|remediat|fix(ed)?|reasonable steps|if we (pay|fix)|lookback|stack/.test(ql)) {
    const input: Record<string, unknown> = { audit_id: auditId }; const changes: string[] = [];
    if (/arbitration/.test(ql)) { input.excludeArbitration = true; changes.push('workers with arbitration agreements removed from class claims'); }
    if (/reasonable steps|before (the )?notice|15%/.test(ql)) { input.pagaCap = 'pre'; changes.push('15% PAGA cap'); } else if (/60 days|after (the )?notice|30%/.test(ql)) { input.pagaCap = 'post'; changes.push('30% PAGA cap'); }
    const pct = ql.match(/(\d{1,3})\s*%/); if (pct && !/15%|30%/.test(pct[0])) { input.validityPct = Number(pct[1]); changes.push(`${pct[1]}% of flagged records valid`); }
    if (/four.year|4.year|48/.test(ql)) { input.lookbackMonths = 48; changes.push('4-year lookback'); }
    if (/stack/.test(ql)) { input.pagaMode = 'stacked'; changes.push('stacked PAGA'); }
    if (cat && /fix|remediat|correct/.test(ql)) { input.excludeCategories = [cat]; changes.push(`${CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS]} treated as remediated`); }
    const base = await call('run_scenario', { audit_id: auditId }); const sc = await call('run_scenario', input);
    const ids = [...allowed.keys()].filter(k => k.startsWith('scenario:')); const [bId, sId] = [ids[0]?.slice(9), ids[ids.length - 1]?.slice(9)];
    out.push(`Baseline model: ${usd(base.total)} [[scenario:${bId}]]. With ${changes.join(', ') || 'your change'}: ${usd(sc.total)} [[scenario:${sId}]] — a change of ${sc.total - base.total >= 0 ? '+' : ''}${usd(sc.total - base.total)} (wages ${usd(sc.wages)}, penalties ${usd(sc.penalties)}, PAGA ${usd(sc.paga)}).`);
    if (!changes.length) out.push('Tip: name a change, e.g. “exclude arbitration”, “fix meal periods”, “reasonable steps before notice”, or “only 70% valid”.');
    out.push(`Assumptions: ${sc.notes.slice(0, 4).join(' ')}`);
    return finish('scenario');
  }
  // ---- patterns
  if (/pattern|concentrat|supervisor|detective|why .*(high|so many)|root cause|driv/.test(ql) && !/worker|employee/.test(ql)) {
    const p = await call('get_patterns', { audit_id: auditId });
    if (!p.length) { out.push('No statistically significant concentrations were found; problems are spread across the workforce.'); return finish('patterns'); }
    out.push('Statistically significant concentrations (z ≥ 3, at least 1.5× the company rate):');
    p.slice(0, 4).forEach((x: { cite: string; pattern: string; explanation: string; investigate: string }, i: number) => out.push(`${i + 1}. ${x.pattern} ${x.cite}. ${x.explanation} Investigate: ${x.investigate}`));
    return finish('patterns');
  }
  // ---- top workers
  if (/(worker|employee|people|who)/.test(ql) && /(most|top|highest|largest|biggest|owed|exposure|create)/.test(ql)) {
    const rows = await call('top_employees', { audit_id: auditId, sort: /finding|flag/.test(ql) ? 'findings' : 'exposure', location: loc });
    out.push(`Workers ${loc ? `at ${loc} ` : ''}with the most ${/finding|flag/.test(ql) ? 'findings' : 'estimated exposure'}:`);
    rows.slice(0, 8).forEach((r: { cite: string; name: string; location: string; findings: number; exposureTotal: number }, i: number) => out.push(`${i + 1}. ${r.name} ${r.cite} — ${r.location}, ${r.findings} findings, ${usd(r.exposureTotal)}`));
    out.push('Amounts include wages, premiums, penalties, and interest from the calculation engine; open a worker to see the ledger.');
    return finish('workers');
  }
  // ---- category findings
  if (cat || /finding|show|list/.test(ql)) {
    const r = await call('search_findings', { audit_id: auditId, category: cat, location: loc, sort: 'exposure' });
    out.push(`${r.total.toLocaleString()} ${cat ? CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS].toLowerCase() : ''} findings${loc ? ` at ${loc}` : ''}. Highest-value examples:`);
    r.rows.slice(0, 6).forEach((f: { cite: string; worker: string; workerCite: string; date: string; title: string; amount: number }) => out.push(`• ${f.title} ${f.cite} — ${f.worker} ${f.workerCite}, ${f.date}, ${usd(f.amount)}`));
    const law = cat ? searchLaw(CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS], 1)[0] : null; if (law) { await call('get_law_topic', { topic_id: law.topic.id }); out.push(`Rule: ${law.topic.summary} [[law:${law.topic.id}]]`); }
    return finish('findings');
  }
  // ---- named worker
  const nameHit = (await call('top_employees', { audit_id: auditId, sort: 'exposure' }) as { cite: string; name: string }[]).find(r => ql.includes(r.name.toLowerCase()));
  if (nameHit) { const id = nameHit.cite.slice(11, -2); const e = await call('get_employee', { audit_id: auditId, employee_id: id }); out.push(`${e.name} [[employee:${id}]] — ${e.location}, ${e.classification}${e.misclassified ? ' (possible misclassification)' : ''}. Estimated total ${usd(e.exposure.total)}: wages and premiums ${usd(e.exposure.wagesAndPremiums)}, penalties ${usd(e.exposure.penalties)}, interest ${usd(e.exposure.interest)}.`); e.findings.slice(0, 5).forEach((f: { cite: string; title: string; date: string; amount: number }) => out.push(`• ${f.title} ${f.cite} (${f.date}, ${usd(f.amount)})`)); return finish('worker'); }

  // ---- summary / biggest risks / investigate first (default for data questions)
  const cats = (sum.categories as { label: string; findings: number; workers: number; base: number }[]).filter(c => c.base > 0).slice(0, 3);
  out.push(`${sum.employer}: compliance grade ${sum.compliance ? (sum.compliance.score === null ? `Incomplete (${sum.compliance.coverage}% of areas testable)` : `${sum.compliance.grade} (${sum.compliance.score}/100)`) : '—'}, ${sum.risk.level} risk [[audit:${auditId}]]. Estimated potential exposure in the records reviewed is ${usd(sum.exposure.low)}–${usd(sum.exposure.high)}; extended to limitations periods ${usd(sum.exposure.lookbackLow)}–${usd(sum.exposure.lookbackHigh)}; PAGA one-year range ${usd(sum.paga.annualLow)}–${usd(sum.paga.annualHigh)}.`);
  out.push(`Largest areas: ${cats.map(c => `${c.label} (${usd(c.base)}, ${c.findings.toLocaleString()} records, ${c.workers} workers)`).join('; ')}.`);
  if (/investigate|first|priorit|next|summar|management|board/.test(ql)) {
    const p = await call('get_patterns', { audit_id: auditId }); if (p[0]) out.push(`Start with ${p[0].pattern} ${p[0].cite}: ${p[0].investigate}`);
    const top = await call('search_findings', { audit_id: auditId, sort: 'exposure' }); if (top.rows[0]) out.push(`Highest single finding: ${top.rows[0].title} ${top.rows[0].cite} (${usd(top.rows[0].amount)}).`);
    out.push('Then pay amounts owed, document corrective steps (supports the PAGA reasonable-steps caps), and re-run next month.');
  }
  if (sum.qualityIssues?.length) out.push(`Data caveats: ${sum.qualityIssues.slice(0, 2).join('; ')}.`);
  return finish('summary');
}

/** Browser/server HTTP model client: Anthropic Messages API directly (user key) or a proxy endpoint that holds the key. */
export function httpModel(cfg: { endpoint: string; apiKey?: string; model: string; maxTokens?: number }): ModelClient {
  return {
    async turn({ system, messages, tools }, onText, signal) {
      const headers: Record<string, string> = { 'content-type': 'application/json' };
      if (cfg.apiKey) { headers['x-api-key'] = cfg.apiKey; headers['anthropic-version'] = '2023-06-01'; headers['anthropic-dangerous-direct-browser-access'] = 'true'; }
      const res = await fetch(cfg.endpoint, { method: 'POST', headers, signal, body: JSON.stringify({ model: cfg.model, max_tokens: cfg.maxTokens || 4000, system, messages, ...(tools.length ? { tools } : {}) }) });
      if (!res.ok) { let msg = `HTTP ${res.status}`; try { const j = await res.json(); msg = j.error?.message || j.error || msg; } catch { /* ignore */ } throw Object.assign(new Error(msg), { code: res.status }); }
      const j = await res.json();
      const content = (j.content || []) as Block[]; const text = content.filter(b => b.type === 'text').map(b => (b as { text: string }).text).join('');
      if (text) onText(text);
      return { content, stopReason: j.stop_reason || null, usage: { input: j.usage?.input_tokens || 0, output: j.usage?.output_tokens || 0 } };
    }
  };
}
