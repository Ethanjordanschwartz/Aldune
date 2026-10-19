/* Aldune standalone — part 13: industry rules, data coverage, one Home page, handbook redlines, chat attachments, evidence binder */
(() => {
'use strict';
const X = window.PCX; const { PC, S, $, esc, money, approx, toast, VIEWS } = X;
const iso = () => new Date().toISOString().slice(0, 10);
const prof = () => PC.industryProfile(S.assumptions?.industry || S.imp?.industry || 'general');
const dl = (blob, name) => X.save(name, blob);
const likely = () => PC.runScenario(S.input, S.result, { ...PC.DEFAULT_SCENARIO, ...PC.PERSPECTIVES.neutral }).total;

// ======================================================= industry selector on Import
const baseImport = VIEWS.import;
VIEWS.import = el => {
  baseImport(el); const sel = $('#im-ind'); if (!sel) return;
  sel.innerHTML = PC.INDUSTRIES.map(i => `<option value="${i.id}" ${(S.imp.industry || 'general') === i.id ? 'selected' : ''}>${esc(i.name)}</option>`).join('');
  const p = PC.industryProfile(S.imp.industry || 'general');
  sel.closest('.field').insertAdjacentHTML('afterend', `<div class="small" style="grid-column:1/-1;margin-top:-4px">${esc(p.short)}${p.options?.includes('healthcareMealWaivers') ? ` <label class="check" style="display:inline-flex;margin-left:10px"><input type="checkbox" id="im-hcw" ${S.imp.hcWaivers ? 'checked' : ''}> Signed second-meal waivers on file (§ 516(b))</label>` : ''}${p.options?.includes('h2aEmployer') ? ` <label class="check" style="display:inline-flex;margin-left:10px"><input type="checkbox" id="im-h2a" ${S.imp.h2a ? 'checked' : ''}> We employ H-2A workers (Lab. Code § 1208: $19.75 from 2027)</label>` : ''}${p.options?.includes('cbaMealExempt') ? ` <label class="check" style="display:inline-flex;margin-left:10px"><input type="checkbox" id="im-cba" ${S.imp.cba ? 'checked' : ''}> Qualifying union agreement covers meal periods (§ 512(e)–(f))</label>` : ''} <button class="btn" style="padding:2px 8px" data-act="ind-rules">What changes?</button></div>`);
  sel.label = 'Industry'; sel.addEventListener('change', e => { S.imp.industry = e.target.value; X.render(); });
  const hc = $('#im-hcw'); if (hc) hc.addEventListener('change', e => { S.imp.hcWaivers = e.target.checked; });
  const cb = $('#im-cba'); if (cb) cb.addEventListener('change', e => { S.imp.cba = e.target.checked; });
  const h2 = $('#im-h2a'); if (h2) h2.addEventListener('change', e => { S.imp.h2a = e.target.checked; });
};
function industryPanel(p) {
  return `<div class="panel"><div class="row" style="justify-content:space-between"><b>Industry rules applied: ${esc(p.name)}</b><span class="chip">${esc(p.wageOrder)}</span></div><p class="small" style="margin:6px 0">${esc(p.short)}</p>${p.checks.length ? `<table><tbody>${p.checks.map(([c, cite]) => `<tr><td class="small">${esc(c)}</td><td class="cite">${esc(cite)}</td></tr>`).join('')}</tbody></table>` : ''}<p class="small">${p.law.map(id => { const t = PC.lawById(id); return t ? `<span class="lawchip" data-act="law-open" data-id="${id}">§ ${esc(t.title)}</span>` : ''; }).join('')}</p></div>`;
}

function whatChanges(p) {
  const rows = (PC.INDUSTRY_CHANGES || {})[p.id] || [];
  const std = PC.STANDARD_RULES || [];
  const opts = (p.options || []).map(o => ({ healthcareMealWaivers: 'Check “Signed second-meal waivers on file” on the Import page if your employees signed § 516(b) waivers.', cbaMealExempt: 'Check “Qualifying union agreement” if a CBA meeting Labor Code § 512(e) covers your crews.', h2aEmployer: 'Check “We employ H-2A workers” to apply the H-2A minimum wage from 2027.' })[o]).filter(Boolean);
  return `<p>${esc(p.short)} Aldune applies <b>${esc(p.wageOrder)}</b> and adjusts its calculations as shown. Anything not listed follows the standard California rules below.</p>
    ${rows.length ? `<h3>What is different for ${esc(p.name.toLowerCase())}</h3><div class="tablewrap"><table><thead><tr><th>Rule</th><th>For this industry</th><th>Authority</th></tr></thead><tbody>${rows.map(([t, here, cite]) => `<tr><td><b>${esc(t)}</b></td><td class="small">${esc(here)}</td><td class="cite">${esc(cite)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="note">No industry-specific changes — the standard rules below apply in full.</p>'}
    ${opts.length ? `<h3>Options to confirm</h3><ul class="small">${opts.map(o => `<li>${esc(o)}</li>`).join('')}</ul>` : ''}
    <h3>Standard California rules (baseline)</h3><table><tbody>${std.map(([t, r]) => `<tr><td><b>${esc(t)}</b></td><td class="small">${esc(r)}</td></tr>`).join('')}</tbody></table>
    ${p.checks.length ? `<h3>Also review</h3><ul class="small">${p.checks.map(([c, cite]) => `<li>${esc(c)} <span class="cite">${esc(cite)}</span></li>`).join('')}</ul>` : ''}
    <p class="cite">General information, not legal advice. Wage Order coverage depends on the employer’s main business; confirm with counsel.</p>`;
}
X.whatChanges = whatChanges;

// ======================================================= coverage panel (dashboard, data quality)
function coveragePanel(full) {
  if (!S.input) return '';
  const c = PC.coverage(S.input, S.result, S.assumptions?.industry); const icon = { tested: '✓', partial: '◐', not_tested: '✕' }; const color = { tested: 'var(--ledger)', partial: 'var(--warn)', not_tested: 'var(--flag)' };
  const gaps = c.items.filter(i => i.status !== 'tested'); const rows = full ? c.items : gaps.slice(0, 3);
  return `<div class="panel" style="border-left:5px solid ${c.score >= 80 ? 'var(--ledger)' : 'var(--warn)'}"><div class="row" style="justify-content:space-between"><b>What Aldune could check with your records</b><span class="chip">${c.score}% coverage</span></div><p class="small" style="margin:6px 0">${esc(c.headline)}</p>
    ${rows.length ? `<table><tbody>${rows.map(i => `<tr><td style="width:24px;color:${color[i.status]};font-weight:700">${icon[i.status]}</td><td><b>${esc(i.area)}</b><div class="small">${esc(i.why)}</div>${i.risk && full ? `<div class="small" style="color:var(--warn)">${esc(i.risk)}</div>` : ''}${i.fix ? `<div class="small"><b>Fix:</b> ${esc(i.fix)}</div>` : ''}</td><td class="cite">${esc(i.law)}</td></tr>`).join('')}</tbody></table>` : ''}${gaps.some(g => /Meal periods|Rest breaks/.test(g.area)) ? '<button class="btn primary" data-act="go" data-to="pos">Fix in your POS</button> ' : ''}${!full ? `<button class="btn" data-act="go" data-to="quality">${gaps.length > 3 ? `See all ${gaps.length} gaps and fixes` : 'See every area checked'}</button>` : ''}</div>`;
}
const baseExec = VIEWS.exec;
VIEWS.exec = el => { baseExec(el); if (!S.result) return; const h = el.querySelector('header, h1')?.closest('header') || el.querySelector('h1'); const host = el.querySelector('.kpis') || h; if (host) host.insertAdjacentHTML('beforebegin', `<div class="grid g2" style="margin-bottom:14px">${coveragePanel(false)}${industryPanel(prof())}</div>`); };
const baseQuality = VIEWS.quality;
VIEWS.quality = el => { baseQuality(el); if (!S.input) return; const h = el.querySelector('.panel, .kpis, table'); if (h) h.insertAdjacentHTML('beforebegin', `<div style="margin-bottom:14px">${coveragePanel(true)}</div>`); };

// ======================================================= one Home: next step + progress + calendar (+ snapshot when an audit exists)
const CAL = [['January 1, 2027', 'State minimum wage $17.40; exempt salary floor $72,384; stay-or-pay agreements must comply (AB 1697)', 'Lab. Code §§ 515, 1182.12'], ['February 1', 'Give every employee the annual Workplace Know Your Rights notice', 'Lab. Code §§ 1550–1559'], ['July 1', 'Many city minimum wages rise (Los Angeles, San Francisco, Berkeley, others) and the LA hotel wage', 'Local ordinances'], ['Every payroll', 'Pay meal/rest premiums owed; stubs show every § 226(a) item and sick-leave balance', 'Lab. Code §§ 226, 226.7'], ['Every year', 'Workplace violence prevention training; review the written plan', 'Lab. Code § 6401.9'], ['Every 2 years', 'Harassment prevention training (2 h supervisors, 1 h others; 5+ employees)', 'Gov. Code § 12950.1'], ['Within 33 days of a PAGA notice', 'Cure, or submit a cure proposal (fewer than 100 employees)', 'Lab. Code § 2699.3']];
VIEWS.home = el => {
  VIEWS.guide(el);
  const h = el.querySelector('h1'); if (h) h.textContent = S.profile?.company ? `Welcome back${S.account?.name ? `, ${S.account.name.split(' ')[0]}` : ''}` : 'Home';
  const lede = el.querySelector('.lede'); if (lede) lede.textContent = 'Your next step, your progress, and what’s coming up.';
  const first = el.querySelector('.panel');
  if (!S.result && first) first.insertAdjacentHTML('beforebegin', `<div class="panel" style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px"><div><b>Start with your records — or explore first</b><div class="small muted">See every feature on a realistic 200-worker demo company, or add your own files.</div></div><div class="row"><button class="btn primary" data-act="go" data-to="import">Add your files</button><button class="btn" data-act="demo">Load demo company</button></div></div>`);
  if (S.result && first) { first.insertAdjacentHTML('afterend', `<div class="kpis" style="margin-top:14px"><div class="kpi risk"><div class="v">${approx(likely())}</div><div class="k">Likely exposure</div></div><div class="kpi"><div class="v">${S.result.engine.findings.length.toLocaleString()}</div><div class="k">Findings</div></div><div class="kpi"><div class="v">${S.result.engine.employees.length.toLocaleString()}</div><div class="k">Workers</div></div><div class="kpi"><div class="v">${PC.coverage(S.input, S.result, S.assumptions?.industry).score}%</div><div class="k">Data coverage</div></div></div><div class="row" style="margin-top:10px"><button class="btn primary" data-act="go" data-to="exec">Open dashboard</button><button class="btn" data-act="go" data-to="solutions">Solutions</button><button class="btn" data-act="go" data-to="backpay">Back pay</button><button class="btn" data-act="go" data-to="import">Add files</button></div>`); }
  el.insertAdjacentHTML('beforeend', `<h2>Compliance calendar</h2><div class="tablewrap"><table><tbody>${CAL.map(([w, t, c]) => `<tr><td style="white-space:nowrap"><b>${w}</b></td><td class="small">${esc(t)}</td><td class="cite">${esc(c)}</td></tr>`).join('')}</tbody></table></div>`);
};
VIEWS.guide && (VIEWS.guide.isGuide = true);

// ======================================================= document review with redline, clean version, and memo
// original .docx bytes are kept (in memory only) so the redline can be applied to the user's own file
X.DOC_BYTES = X.DOC_BYTES || new Map();
{ const ex = PC.extractDocument; PC.extractDocument = async (name, buf) => { const t = await ex(name, buf); if (/\.(docx|docm)$/i.test(name)) X.DOC_BYTES.set(String(name).split(/[\\/]/).pop(), buf.slice(0)); return t; }; }
X.docBytes = doc => X.DOC_BYTES.get(String(doc.name).split(/[\\/]/).pop());
const planCache = new WeakMap();
X.docPlan = doc => { let p = planCache.get(doc); if (!p || p.text !== doc.text) { p = { text: doc.text, plan: PC.reviewParagraphs(doc.text.split('\n'), { employer: S.input?.employerName || S.profile?.company || undefined }) }; planCache.set(doc, p); } return p.plan; };
const baseReview = VIEWS.review;
VIEWS.review = el => {
  baseReview(el);
  const cands = S.docs.map((d, i) => ({ d, i })).filter(x => ['handbook', 'other', 'waiver'].includes(x.d.type) && x.d.text.length > 150);
  if (!cands.length) return;
  el.insertAdjacentHTML('afterbegin', cands.map(({ d, i }) => { const r = X.docPlan(d); const req = r.findings.filter(f => f.level === 'required').length, rec = r.findings.length - req;
    return `<div class="sol" style="border-left:5px solid ${req ? 'var(--warn)' : 'var(--ledger)'}"><div class="row" style="justify-content:space-between;align-items:baseline"><h3 style="margin:0">${esc(d.name)}</h3><span class="chip">${esc(r.label)}</span></div>
      <p class="small" style="margin:8px 0">${r.findings.length ? `<b>${req} required change${req === 1 ? '' : 's'}</b>${rec ? ` and ${rec} recommended` : ''}. Every change is a tracked change in Word with a comment giving the reason and the law.` : '<b>No changes needed</b> under the rules Aldune applies to this kind of document.'}${r.notes.length ? ` ${esc(r.notes.join(' '))}` : ''}</p>
      ${r.findings.length ? `<div class="row"><button class="btn primary" data-act="hb-redline" data-i="${i}">Redline (Word, tracked changes)</button><button class="btn" data-act="hb-clean" data-i="${i}">Clean revised version (Word)</button><button class="btn" data-act="hb-memo" data-i="${i}">Review memo (Word)</button></div>
      <details style="margin-top:10px"><summary><b>See the changes</b></summary><table><tbody>${r.findings.map(f => `<tr><td><b>${esc(f.title)}</b> <span class="chip ${f.level === 'required' ? 'warn' : ''}" style="font-size:11px">${f.level}</span>${f.quote ? `<div class="small" style="text-decoration:line-through;color:var(--flag)">“${esc(f.quote.slice(0, 220))}”</div>` : ''}</td><td class="small">${esc(f.why)}<div class="cite">${esc(f.cite)}</div></td></tr>`).join('')}</tbody></table></details>` : ''}</div>`; }).join(''));
};

// ======================================================= evidence binder (reasonable-steps record)
async function evidenceBinder() {
  if (!S.result) { toast('Run an audit first.'); return; }
  const files = []; const add = async (name, content) => { const u8 = content instanceof Blob ? new Uint8Array(await content.arrayBuffer()) : new TextEncoder().encode(content); files.push([name, u8]); };
  const p = { employerName: S.input.employerName || S.profile?.company || 'Employer' };
  const cov = PC.coverage(S.input, S.result, S.assumptions?.industry);
  await add('00-README.txt', `Aldune evidence binder — ${p.employerName}\nGenerated ${new Date().toLocaleString()}\n\nThis binder documents the employer’s periodic payroll audit and the actions taken on its results — the “reasonable steps” that can cap PAGA penalties at 15% (before a notice) or 30% (within 60 days after) under Labor Code § 2699(g).\n\nContents:\n01 audit summary and coverage\n02 findings (CSV)\n03 back pay plan (CSV)\n04 remediation tasks (CSV)\n05 policies and training (Word)\n06 audit trail (CSV)\n`);
  await add('01-audit-summary.txt', `Audit window: ${S.result.engine.meta.windowStart} – ${S.result.engine.meta.windowEnd}\nIndustry rules: ${prof().name} (${prof().wageOrder})\nWorkers: ${S.result.engine.employees.length}\nFindings: ${S.result.engine.findings.length}\nRule versions: ${Object.entries(S.result.engine.meta.ruleVersions).map(([k, v]) => `${k} ${v}`).join(', ')}\nInput hash: ${S.result.engine.meta.inputHash}\n\nData coverage (${cov.score}%):\n${cov.items.map(i => `- ${i.area}: ${i.status.replace('_', ' ')} — ${i.why}${i.fix ? ` Fix: ${i.fix}` : ''}`).join('\n')}\n`);
  const q = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  await add('02-findings.csv', ['id,employee_id,category,title,date,period_end,amount,kind,confidence,status,rule,authority', ...S.result.engine.findings.map(f => [f.id, f.employeeId, f.category, f.title, f.date || '', f.periodEnd || '', f.amount.toFixed(2), f.amountKind, f.confidence, (S.ws?.status?.[f.id]?.s) || 'open', `${f.ruleId} ${f.ruleVersion}`, f.authorities[0] || ''].map(q).join(','))].join('\n'));
  const bp = PC.backPay(S.input, S.result, { interestRate: 0.1, includeLiquidated: false, through: S.result.engine.meta.assumptions.auditDate });
  await add('03-back-pay.csv', ['employee_id,name,code,description,amount,tax_treatment', ...bp.lines.map(l => [l.employeeId, l.name, l.code, l.description, l.amount.toFixed(2), l.taxTreatment].map(q).join(','))].join('\n'));
  await add('04-remediation-tasks.csv', ['title,status,priority,owner,due,created', ...(S.ws?.tasks || []).map(t => [t.title, t.status, t.priority, t.owner || '', t.due || '', t.createdAt || ''].map(q).join(','))].join('\n'));
  if (X.genDoc) { const models = ['meal_rest_policy', 'timekeeping_policy', 'expense_policy', 'training_memo', 'payroll_memo'].flatMap(k => X.genDoc(k)); await add('05-policies-and-training.docx', await PC.toDocxBlob(models)); }
  await add('06-audit-trail.csv', ['when,action,details', ...(S.events || []).map(e => [e.at || e.ts || '', e.action, JSON.stringify(e.data || e.meta || {})].map(q).join(','))].join('\n'));
  const zip = PC.XLSX.CFB.utils.cfb_new(); files.forEach(([n, u8]) => PC.XLSX.CFB.utils.cfb_add(zip, `/${n}`, u8));
  const out = PC.XLSX.CFB.write(zip, { fileType: 'zip', type: 'array' });
  await dl(new Blob([out], { type: 'application/zip' }), `aldune-evidence-binder-${iso()}.zip`); X.log && X.log('report.generated', { report: 'Evidence binder' });
}
const baseReports = VIEWS.reports;
VIEWS.reports = el => { baseReports(el); if (!S.result) return; const h = el.querySelector('.panel, .grid'); if (h) h.insertAdjacentHTML('beforebegin', `<div class="sol" style="border-left:5px solid var(--marker);margin-top:0"><div class="row" style="justify-content:space-between;align-items:center"><div><h3>Evidence binder</h3><p class="small" style="margin:4px 0 0">One ZIP documenting your audit, findings, back pay, tasks, policies, training, and audit trail — the “reasonable steps” record that can cap PAGA penalties.</p></div><button class="btn primary" data-act="binder">Download evidence binder</button></div></div>`); };

// ======================================================= separation agreement in Letters and packets
const baseDocs = VIEWS.documents;
VIEWS.documents = el => { baseDocs(el); const host = el.querySelector('.panel'); if (host) host.insertAdjacentHTML('beforeend', `<div style="padding:8px;border:1px solid var(--line);border-radius:6px;margin-top:6px;display:flex;justify-content:space-between;gap:10px;align-items:center"><span><b>Separation agreement and general release</b><br><span class="small muted">Gov. Code § 12964.5 notice and carve-out, § 1542 waiver, OWBPA terms for workers 40+, §§ 1001/1002.5, § 206.5.</span></span><button class="btn" data-act="sep-agree">Word</button> <button class="btn" data-act="sep-agree" data-age="40">Word (age 40+ version)</button></div>`); };

// ======================================================= chat attachments: analyze data, review policies, test PAGA notices — right in the chat
X.chatAttach = async files => {
  const say = (content, actions = [], extra = {}) => { S.conv = S.conv || { id: `c${Date.now().toString(36)}`, title: 'Attached files', messages: [] }; S.conv.messages.push({ role: 'assistant', content, citations: [], actions, ...extra }); X.refreshChat(); if (X.saveConv) X.saveConv(S.conv); };
  S.conv = S.conv || { id: `c${Date.now().toString(36)}`, title: `Files: ${files[0].name}`, messages: [] };
  S.conv.messages.push({ role: 'user', content: `📎 ${files.length} file${files.length > 1 ? 's' : ''}: ${files.slice(0, 4).map(f => f.name).join(', ')}${files.length > 4 ? '…' : ''}` }); X.refreshChat();
  const beforeDocs = S.docs.length, beforeItems = S.bulk?.items?.length || 0;
  await X.processFiles(files, null);
  const items = (S.bulk?.items || []).slice(beforeItems); const newDocs = S.docs.slice(beforeDocs);
  const panel = $('#as-panel'); if (panel && !panel.classList.contains('open')) document.getElementById('as-fab')?.click();
  const dataFiles = items.filter(i => ['paystub', 'timesheet', 'w2', 'roster', 'employees', 'time', 'payroll'].includes(i.kind) && i.status === 'ok').length;
  const bad = items.filter(i => i.status !== 'ok');
  if (bad.length) say(`${bad.length} file${bad.length > 1 ? 's' : ''} need attention:\n${bad.slice(0, 5).map(b => `• ${b.name}: ${b.note}`).join('\n')}`, ['import']);
  for (const d of newDocs) {
    if (d.type === 'paga_notice') { const n = PC.analyzeNotice(d.text, S.result); say(`**${d.name}** is a PAGA notice${n.noticeDate ? ` dated ${n.noticeDate}` : ''}.${n.deadlines ? ` Cure deadline: **${n.deadlines.cure}**; earliest lawsuit: ${n.deadlines.suit}.` : ''}\n${n.allegations.map(a => `• § ${a.section} ${a.title} — ${a.assessment}`).join('\n')}`, ['paga_cure', 'eec', 'backpay', 'review_docs']); continue; }
    const r = X.docPlan(d);
    if (d.text.length > 150 && r.findings.length) { const idx = S.docs.indexOf(d); const req = r.findings.filter(f => f.level === 'required');
      say(`**${d.name}** — reviewed as a ${r.label.toLowerCase()}: **${req.length} required change${req.length === 1 ? '' : 's'}**${r.findings.length - req.length ? `, ${r.findings.length - req.length} recommended` : ''}.\n${r.findings.slice(0, 6).map(f => `• ${f.title} (${f.cite.split(';')[0]})`).join('\n')}${r.findings.length > 6 ? `\n• …and ${r.findings.length - 6} more` : ''}\nThe redline puts each change in your document as a tracked change with a comment explaining why.`, ['review_docs'], { hb: idx }); }
    else say(`**${d.name}** was added to Review documents (${PC.DOC_LABELS[d.type] || 'document'}).`, ['review_docs']);
  }
  if (dataFiles) {
    const r0 = X.readiness();
    if (r0.canRun && !['employees', 'time', 'payroll'].some(ds => r0[ds].state === 'mapping')) {
      await X.analyzeNow(); X.setView('exec'); if (panel && !panel.classList.contains('open')) document.getElementById('as-fab')?.click();
      const res = S.result; const cats = res.categories.filter(c => c.findings).sort((a, b) => b.base - a.base).slice(0, 4); const cov = PC.coverage(S.input, res, S.assumptions?.industry);
      say(`I analyzed ${dataFiles} file${dataFiles > 1 ? 's' : ''}: **${res.engine.employees.length} workers**, **${res.engine.findings.length.toLocaleString()} findings**, likely exposure **${approx(likely())}** (neutral model).\nBiggest areas:\n${cats.map(c => `• ${PC.CATEGORY_LABELS[c.category]}: ${c.findings.toLocaleString()} findings, ${money(c.base)}`).join('\n')}\n${cov.items.filter(i => i.status !== 'tested').slice(0, 3).map(i => `• Couldn’t fully check ${i.area.toLowerCase()}: ${i.why}${i.fix ? ` Fix: ${i.fix}` : ''}`).join('\n')}`, ['solutions', 'backpay', 'explorer', 'board_brief']);
    } else say(`I read ${dataFiles} data file${dataFiles > 1 ? 's' : ''}. One section needs its columns matched before I can analyze — open Import to finish.`, ['import']);
  }
};
// chat: render download buttons for handbook reviews
const baseRefresh = X.refreshChat; X.refreshChat = () => { baseRefresh(); document.querySelectorAll('#as-chat .a').forEach((n, k) => { const msgs = (S.conv?.messages || []).filter(m => m.role === 'assistant'); const m = msgs[k]; if (m && m.hb !== undefined && !n.querySelector('[data-act="hb-redline"]')) n.insertAdjacentHTML('beforeend', `<div class="row" style="margin-top:8px"><button class="btn primary" data-act="hb-redline" data-i="${m.hb}">Redline (Word)</button><button class="btn" data-act="hb-clean" data-i="${m.hb}">Clean version (Word)</button><button class="btn" data-act="hb-memo" data-i="${m.hb}">Memo</button></div>`); }); };

// ======================================================= events
document.addEventListener('click', async e => {
  const a = e.target.closest('[data-act]'); if (!a) return; const d = a.dataset;
  try {
    if (d.act === 'ind-rules') { const p = PC.industryProfile(S.imp.industry || S.assumptions?.industry || 'general'); X.openDrawer(`${p.name} — what changes`, p.wageOrder, whatChanges(p)); }
    if (d.act === 'hb-redline' || d.act === 'hb-clean') { const doc = S.docs[+d.i]; const base = doc.name.replace(/\.[a-z0-9]+$/i, '').split(/[\\/]/).pop();
      const r = await PC.reviseDocument({ name: doc.name, text: doc.text, bytes: X.docBytes(doc) }, d.act === 'hb-redline' ? 'redline' : 'clean', { employer: S.input?.employerName || S.profile?.company || undefined });
      await dl(new Blob([r.bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), `${base}-${d.act === 'hb-redline' ? 'redline' : 'revised'}.docx`); X.log && X.log('report.generated', { report: d.act === 'hb-redline' ? 'Document redline' : 'Revised document' }); }
    if (d.act === 'hb-memo') { const doc = S.docs[+d.i]; const base = doc.name.replace(/\.[a-z0-9]+$/i, '').split(/[\\/]/).pop(); await dl(await PC.reviewMemoDocx(X.docPlan(doc), base, 'blob', { preparedFor: S.input?.employerName || S.profile?.company || undefined }), `${base}-review-memo.docx`); }
    if (d.act === 'binder') await evidenceBinder();
    if (d.act === 'sep-agree') { const sel = S.dg?.sel?.size ? [...S.dg.sel] : []; const names = sel.length ? sel.map(id => S.empIndex.get(id)?.name || id) : [S.sep?.employeeName || 'the Employee']; const fmtD = x => x ? new Date(x + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : ''; const m = names.map(n => PC.templates.separationAgreement({ ...S.party, employerName: S.party?.employerName || S.input?.employerName || S.profile?.company || 'the Company', employeeName: n, separationDate: fmtD(S.sep?.separationDate), severance: Number(S.sep?.severance) || null, paymentDays: 10, age40: d.age === '40', nonDisparagement: false, returnProperty: true, date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) })); await X.saveDocx(m, `separation-agreement${d.age === '40' ? '-40plus' : ''}-${iso()}.docx`); }
  } catch (err) { toast(err.message || 'Something went wrong.'); }
});
})();
