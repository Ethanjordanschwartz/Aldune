/* Aldune — part 44: "Go to…" that actually finds pages.
   The old quick filter hid non-matching pages with inline display:none, which the shell's `display:flex !important` overrode —
   so typing did nothing visible. Now: as you type, the best matches appear in a results list directly under the box (top of the
   sidebar), ranked (starts-with > word-start > contains > keyword > in-order letters), the rest of the menu steps aside, ↑/↓ moves,
   Enter opens the highlighted page, Esc clears. Keywords cover the words people actually type ("lawsuit", "back pay", "PAGA"). */
(() => {
'use strict';
const X = window.PCX; const { S, esc } = X;
const nav = document.getElementById('nav'); if (!nav) return;
const KEYWORDS = {
  home: 'start dashboard begin', import: 'upload files data payroll timecards records add', connect: 'adp paychex gusto quickbooks integration sync link',
  exec: 'dashboard overview summary exposure', findings: 'violations issues problems list', scorecard: 'grade score compliance',
  paga: 'penalties private attorneys general act exposure', fixqueue: 'fix to do tasks owed', solutions: 'fixes remedies policy handbook',
  backpay: 'back pay owed wages payments checks', readiness: 'paga notice cure reasonable steps', documents: 'letters packets templates settlement word',
  litigation: 'lawsuit complaint case court papers mediation notice lwda', settlement: 'valuation mediation offer', diligence: 'm&a acquisition merger deal buyer',
  agency: 'records request dlse labor commissioner 226 1198.5', privilege: 'kovel attorney client privileged counsel', monitor: 'alerts monthly re-audit',
  calendar: 'deadlines dates postings', portfolio: 'employers clients multi', explorer: 'risk drill', detective: 'patterns anomalies paga',
  payequity: 'equal pay sex gender gap 1197.5', classify: 'contractor independent abc borello misclassification', workers: 'employees timecards people',
  scenarios: 'what if model', prevent: 'pre-payroll schedule check', handbook2: 'handbook policies', pos: 'timekeeping clock toast square',
  notices: 'postings posters notices wtpa', quality: 'data quality errors', remediation: 'tasks assign', reports: 'pdf export report',
  review: 'review documents waiver agreement arbitration redline', attest: 'attestation kiosk breaks', steps: 'reasonable steps 2699',
  trail: 'audit trail reproduce history', rules: 'rule registry law', method: 'methodology settings assumptions', law: 'law library statutes cases',
  ask: 'penny ai assistant chat question', account: 'profile password', plans: 'billing pricing subscription'
};
const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9& ]+/g, ' ').replace(/\s+/g, ' ').trim();
function label(b) { return (b.cloneNode(true).textContent || '').replace(/[\d,]+\s*$/, '').replace(/🪙/g, '').trim(); }
function groupOf(b) { let n = b.previousElementSibling; while (n && !n.classList.contains('nav-group')) n = n.previousElementSibling; return n ? n.textContent.replace(/[▾▸]/g, '').trim() : ''; }
function score(b, q) {
  const l = norm(label(b)); const words = l.split(' '); const kw = norm(KEYWORDS[b.dataset.view] || '');
  if (l === q) return 120; if (l.startsWith(q)) return 100; if (words.some(w => w.startsWith(q))) return 85; if (l.includes(q)) return 70;
  if (q.split(' ').every(t => kw.split(' ').some(w => w.startsWith(t)))) return 50;
  let i = 0; for (const ch of l.replace(/ /g, '')) if (ch === q.replace(/ /g, '')[i]) i++; return i === q.replace(/ /g, '').length && q.length >= 2 ? 25 : 0;
}
const visible = b => !b.hidden && !(b.dataset.view === 'admin' && !S.isOwner);
let sel = 0, hits = [];
document.head.insertAdjacentHTML('beforeend', `<style id="al-navq">
#nav.nav-searching > button[data-view],#nav.nav-searching > .nav-group{display:none!important}
#navq-results{margin:4px 0 8px;display:none}#nav.nav-searching #navq-results{display:block}
#navq-results button{display:flex!important;align-items:center;gap:10px;width:100%;text-align:left;border:0;background:transparent;padding:7px 10px;border-radius:8px;cursor:pointer;font:inherit;font-size:13.5px;color:#221A15;font-weight:600}
#navq-results button small{margin-left:auto;font-weight:500;font-size:11px;color:#4A392E;letter-spacing:.04em;text-transform:uppercase}
#navq-results button.on,#navq-results button:hover{background:#FBF6EE!important;box-shadow:inset 3px 0 0 #C4693F,0 1px 3px rgba(34,26,21,.1)!important}
#navq-results .none{font-size:12.5px;color:#4A392E;padding:6px 10px}
#navq-results svg{width:16px;height:16px;flex:none;color:#3E3027}
.nav button[hidden]{display:none!important}
</style>`);
function draw() {
  const qi = document.getElementById('nav-q'); let box = document.getElementById('navq-results');
  if (!qi) return; if (!box) { qi.insertAdjacentHTML('afterend', '<div id="navq-results" role="listbox" aria-label="Matching pages"></div>'); box = document.getElementById('navq-results'); }
  const q = norm(qi.value);
  if (!q) { nav.classList.remove('nav-searching'); box.innerHTML = ''; hits = []; return; }
  const all = [...nav.querySelectorAll(':scope > button[data-view]')].filter(visible);
  hits = all.map(b => ({ b, s: score(b, q) })).filter(x => x.s > 0).sort((a, c) => c.s - a.s || label(a.b).localeCompare(label(c.b))).slice(0, 8);
  sel = Math.min(sel, Math.max(0, hits.length - 1)); nav.classList.add('nav-searching');
  box.innerHTML = hits.length ? hits.map((h, k) => { const ico = h.b.querySelector('svg'); return `<button type="button" role="option" data-navq="${k}" class="${k === sel ? 'on' : ''}" aria-selected="${k === sel}">${ico ? ico.outerHTML : ''}<span>${esc(label(h.b))}</span><small>${esc(groupOf(h.b))}</small></button>`; }).join('') : `<div class="none">No page matches “${esc(qi.value)}”.</div>`;
}
function go(k) { const h = hits[k]; if (!h) return; const qi = document.getElementById('nav-q'); h.b.click(); if (qi) { qi.value = ''; qi.blur(); } sel = 0; draw(); }
function wire() {
  const old = document.getElementById('nav-q'); if (!old || old.dataset.v2) return;
  const qi = old.cloneNode(true); qi.dataset.v2 = '1'; qi.setAttribute('style', 'width:100%;box-sizing:border-box'); old.replaceWith(qi);  // drops the old listeners
  qi.addEventListener('input', () => { sel = 0; draw(); });
  qi.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(sel + 1, hits.length - 1); draw(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(sel - 1, 0); draw(); }
    else if (e.key === 'Enter') { e.preventDefault(); go(sel); }
    else if (e.key === 'Escape') { qi.value = ''; draw(); }
  });
}
nav.addEventListener('click', e => { const b = e.target.closest('[data-navq]'); if (b) { e.preventDefault(); go(+b.dataset.navq); } });
const base = X.render; X.render = (...a) => { const r = base(...a); try { wire(); draw(); } catch (err) { console.warn(err); } return r; };
wire(); draw();
X.navSearch = q => { const qi = document.getElementById('nav-q'); if (qi) { qi.value = q; sel = 0; draw(); } return hits.map(h => h.b.dataset.view); };
})();
