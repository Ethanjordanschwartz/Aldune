/* ---------- Ready-to-send documents: before Aldune builds a letter, agreement, or court paper, it asks once for the
   facts that document needs and does not have (company address, signer, case caption, mediator, dates…). Answers are
   saved and reused, so documents come out complete instead of full of [brackets]. */
(() => {
const X = window.PCX; const { S, esc, toast } = X;
S.sep = S.sep || {}; S.lit = S.lit || { side: 'defense', docs: [], facts: null, inputs: null, gross: 0, ctx: {} };
const litFacts = () => { if (!S.lit.facts) S.lit.facts = { claims: (S.lit.inputs || X.PC.LIT_DEFAULTS || {}).claims || [], plaintiffs: [], sources: [], arbitration: false }; return S.lit.facts; };
const today = () => new Date().toISOString().slice(0, 10);
// key → [label, read, write, input type, hint]
const F = {
  employerAddress: ['Company address', () => S.party.employerAddress, v => { S.party.employerAddress = v; delete S.party._demo; }, 'text', '1450 Harvest Way, Fresno, CA 93721'],
  signerName: ['Who signs (name)', () => S.party.signerName, v => { S.party.signerName = v; delete S.party._demo; }, 'text', 'Dana Whitfield'],
  signerTitle: ['Signer’s title', () => S.party.signerTitle, v => { S.party.signerTitle = v; delete S.party._demo; }, 'text', 'Director of Human Resources'],
  contact: ['Contact for employee questions (name, phone, email)', () => S.party.contact, v => { S.party.contact = v; delete S.party._demo; }, 'text', 'Human Resources, (559) 555-0142, hr@company.com'],
  arbProvider: ['Arbitration provider', () => S.party.arbProvider, v => { S.party.arbProvider = v; }, 'select:JAMS|AAA', ''],
  caption: ['Case caption', () => S.lit.facts?.caption, v => { litFacts().caption = v; }, 'text', 'Garcia v. Acme Foods, Inc.'],
  plaintiffs: ['Named plaintiff(s)', () => (S.lit.facts?.plaintiffs || []).join(', '), v => { litFacts().plaintiffs = v.split(/\s*(?:,|;| and )\s*/).filter(Boolean); }, 'text', 'Maria Garcia'],
  caseNumber: ['Case number', () => S.lit.facts?.caseNumber, v => { litFacts().caseNumber = v; }, 'text', '24CV01234'],
  court: ['Court', () => S.lit.facts?.court, v => { litFacts().court = v; }, 'text', 'Superior Court of California, County of Fresno'],
  firm: ['Your law firm', () => S.lit.ctx?.firm, v => { S.lit.ctx.firm = v; }, 'text', ''],
  attorney: ['Attorney name', () => S.lit.ctx?.attorney, v => { S.lit.ctx.attorney = v; }, 'text', ''],
  mediator: ['Mediator', () => S.lit.ctx?.mediator || S.lit.facts?.mediator, v => { S.lit.ctx.mediator = v; }, 'text', 'Hon. Jane Smith (Ret.)'],
  mediationDate: ['Mediation date', () => S.lit.ctx?.mediationDate, v => { S.lit.ctx.mediationDate = v; }, 'date', ''],
  classStart: ['Class period starts', () => S.lit.ctx?.classStart, v => { S.lit.ctx.classStart = v; }, 'date', ''],
  classEnd: ['Class period ends', () => S.lit.ctx?.classEnd, v => { S.lit.ctx.classEnd = v; }, 'date', ''],
  noticeDate: ['PAGA notice date', () => S.lit.facts?.pagaNoticeDate || S.readiness?.noticeDate, v => { litFacts().pagaNoticeDate = v; S.readiness = S.readiness || {}; if (!S.readiness.noticeDate) S.readiness.noticeDate = v; }, 'date', ''],
  employeeName: ['Employee name', () => S.sep.employeeName, v => { S.sep.employeeName = v; }, 'text', ''],
  separationDate: ['Separation date', () => S.sep.separationDate, v => { S.sep.separationDate = v; }, 'date', ''],
  severance: ['Severance amount ($)', () => S.sep.severance, v => { S.sep.severance = v; }, 'number', ''],
  phoneStipend: ['Monthly phone reimbursement for employees who use a personal phone for work ($)', () => S.party.phoneStipend, v => { S.party.phoneStipend = v; }, 'number', '25'],
  commissionPlan: ['Commission plan (rate and what it is paid on)', () => S.party.commissionPlan, v => { S.party.commissionPlan = v; }, 'text', '5% of net collected revenue on all products sold'],
  pieceRate: ['Piece rate (amount per unit and task)', () => S.party.pieceRate, v => { S.party.pieceRate = v; }, 'text', '$0.45 per tray of strawberries picked'],
  paymentDate: ['Payment date', () => S.sep.paymentDate || S.cure?.paymentDate, v => { S.cure = S.cure || {}; S.cure.paymentDate = v; }, 'date', '']
};
const LETTER = ['employerAddress', 'signerName', 'signerTitle'];
function needs(a) {
  const act = a.dataset.act, k = a.dataset.k || a.dataset.kind || '';
  if (['bp-one', 'dg-docx', 'sol-all-docs', 'onboard-packet'].includes(act)) return LETTER;
  if (act === 'sol-doc' && k === 'expense_policy') return ['phoneStipend'];
  if (act === 'sol-doc') return k === 'paga_cure' ? [...LETTER, 'noticeDate', 'paymentDate'] : k === 'eec' ? ['caption', 'caseNumber', 'court'] : /letter|waiting|reclass|corrected/.test(k) ? LETTER : [];
  if (act === 'tpl2' && k === 'commission') return ['commissionPlan', 'signerName', 'signerTitle'];
  if (act === 'tpl2' && k === 'piece') return ['pieceRate', 'contact'];
  if (act === 'tpl2') return k === 'arb' ? ['employerAddress', 'contact', 'arbProvider'] : /^wtpa/.test(k) ? ['employerAddress', 'contact'] : k === 'notice' ? ['caption', 'caseNumber', 'court', 'classStart', 'classEnd'] : [];
  if (act === 'sep-agree') return [...(S.dg?.sel?.size ? [] : ['employeeName']), 'separationDate', 'severance', 'signerName', 'signerTitle'];
  if (act === 'lit-doc') return ({ brief: ['caption', 'plaintiffs', 'firm', 'attorney', 'mediator', 'mediationDate'], response: ['firm', 'attorney', 'noticeDate'], term: ['caption', 'plaintiffs', 'firm'], demand: ['plaintiffs', 'firm', 'attorney'], notice: ['plaintiffs', 'firm', 'attorney'] })[k] || [];
  if (act === 'lit-doc2') return k === 'agreement' ? ['caption', 'plaintiffs', 'caseNumber', 'court', 'mediator', 'mediationDate', 'classStart', 'classEnd', 'noticeDate'] : ['caption', 'plaintiffs'];
  return [];
}
const missing = keys => keys.filter(k => { const v = F[k][1](); return v === undefined || v === null || String(v).trim() === ''; });
X.missingFacts = a => missing(needs(a));
X.fact = k => F[k] && F[k][1]();

function ask(keys, title, done) {
  document.getElementById('facts-modal')?.remove();
  const field = k => { const [label, read, , type, hint] = F[k]; const v = read() || ''; const dflt = k === 'classEnd' ? today() : '';
    if (type.startsWith('select:')) return `<label class="field">${label}<select data-fact="${k}">${type.slice(7).split('|').map(o => `<option ${o === v ? 'selected' : ''}>${o}</option>`).join('')}</select></label>`;
    return `<label class="field">${label}<input data-fact="${k}" type="${type}" value="${esc(String(v || dflt))}" placeholder="${esc(hint || '')}"></label>`; };
  document.body.insertAdjacentHTML('beforeend', `<div id="facts-modal" role="dialog" aria-modal="true" aria-labelledby="facts-h" style="position:fixed;inset:0;z-index:80;background:rgba(32,24,18,.45);display:flex;align-items:center;justify-content:center;padding:16px">
    <div class="panel" style="max-width:560px;width:100%;max-height:90vh;overflow:auto"><h3 id="facts-h" style="margin-top:0">${esc(title)}</h3>
    <p class="small muted" style="margin-top:-4px">Aldune fills these into the document so it’s ready to send. You’ll only be asked once.</p>
    <div class="grid g2">${keys.map(field).join('')}</div>
    <div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn" data-fx="cancel">Cancel</button><button class="btn primary" data-fx="save">Save and create document</button></div></div></div>`);
  const m = document.getElementById('facts-modal'); m.querySelector('[data-fact]')?.focus();
  m.addEventListener('click', e => {
    const b = e.target.closest('[data-fx]'); if (!b && e.target !== m) return;
    if (!b || b.dataset.fx === 'cancel') { m.remove(); return; }
    const vals = [...m.querySelectorAll('[data-fact]')].map(i => [i.dataset.fact, i.value.trim()]);
    const empty = vals.filter(([, v]) => !v); if (empty.length) { toast(`Fill in: ${empty.map(([k]) => F[k][0].toLowerCase()).join(', ')}`); m.querySelector(`[data-fact="${empty[0][0]}"]`)?.focus(); return; }
    vals.forEach(([k, v]) => F[k][2](v)); X.persist && X.persist(); m.remove(); done();
  });
  m.addEventListener('keydown', e => { if (e.key === 'Escape') m.remove(); if (e.key === 'Enter' && e.target.tagName === 'INPUT') m.querySelector('[data-fx="save"]').click(); });
}
// runs before the document handlers (capture phase): ask for what's missing, then click again
document.addEventListener('click', e => {
  const a = e.target.closest('[data-act]'); if (!a || a.dataset.factsOk) return;
  const need = X.missingFacts(a); if (!need.length) return;
  e.preventDefault(); e.stopImmediatePropagation();
  ask(need, `A few details for “${(a.textContent || 'this document').trim().slice(0, 60)}”`, () => { a.dataset.factsOk = '1'; a.click(); delete a.dataset.factsOk; });
}, true);
})();
