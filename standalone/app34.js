/* Aldune — part 34: professional app shell and "start fresh".
   • Dark, quiet sidebar with line icons, a branded tile, workspace block, and a primary "New audit" action
   • Sticky top bar with breadcrumb, search, and actions
   • New audit: one click clears the current files, results, and review decisions (company profile, settings, and
     saved monitoring history stay unless the user chooses to clear them too) */
(() => {
'use strict';
const X = window.PCX; const { S, esc, toast } = X;

// ---------- icons (1.6px line icons, 16px)
const P = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  import: 'M12 3v12m0 0-4-4m4 4 4-4M4 17v3h16v-3',
  connect: 'M9 7H7a5 5 0 0 0 0 10h2m6-10h2a5 5 0 0 1 0 10h-2M8 12h8',
  exec: 'M4 20V10m6 10V4m6 16v-7m4 7H2',
  findings: 'M4 6h16M4 12h10M4 18h6m9-3 2 2 3-4',
  scorecard: 'M12 3l2.6 5.3 5.9.9-4.2 4.1 1 5.8L12 16.4 6.7 19.1l1-5.8L3.5 9.2l5.9-.9z',
  paga: 'M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6z',
  fixqueue: 'M4 6h12M4 12h12M4 18h8m9-11-3 3-1.5-1.5',
  solutions: 'M9 18h6m-5 3h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z',
  backpay: 'M3 7h18v10H3zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM6 10v4m12-4v4',
  readiness: 'M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  documents: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6m-6 4h6',
  litigation: 'M12 3v18M5 8h14M7 8l-3 6a3 3 0 0 0 6 0zM17 8l-3 6a3 3 0 0 0 6 0z',
  settlement: 'M8 12l2.5 2.5L16 9M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0z',
  diligence: 'M10 17a7 7 0 1 1 0-14 7 7 0 0 1 0 14zm5-2 6 6',
  agency: 'M3 21h18M5 21V9l7-5 7 5v12M9 21v-6h6v6',
  privilege: 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4',
  monitor: 'M3 12h4l3-8 4 16 3-8h4',
  calendar: 'M4 5h16v16H4zM4 10h16M8 3v4m8-4v4',
  portfolio: 'M3 7h18v13H3zM8 7V4h8v3',
  explorer: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm3.5-12.5-2 5-5 2 2-5z',
  detective: 'M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14zm9 3-4.3-4.3M8 11h6',
  payequity: 'M12 3v18M5 7h14M5 7l-2 6h4zM19 7l-2 6h4z',
  classify: 'M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0zM4 21a8 8 0 0 1 16 0',
  workers: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zm8 0a3 3 0 1 0 0-6M2 21a7 7 0 0 1 14 0m2 0a5 5 0 0 0-3-4.6',
  scenarios: 'M4 19l5-7 4 4 7-10',
  prevent: 'M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6zM9 12l2 2 4-4',
  handbook2: 'M4 4h11a3 3 0 0 1 3 3v14H7a3 3 0 0 1-3-3zM4 18a3 3 0 0 1 3-3h11',
  pos: 'M4 4h16v12H4zM8 20h8M12 16v4',
  notices: 'M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 0 0 4 0',
  quality: 'M4 12l5 5L20 6',
  remediation: 'M14 7l3-3 3 3-3 3M17 4v6M4 20l9-9',
  reports: 'M6 3h9l5 5v13H6zM9 17v-4m3 4V10m3 7v-2',
  review: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4',
  attest: 'M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9',
  steps: 'M4 6h2m4 0h10M4 12h2m4 0h10M4 18h2m4 0h10',
  trail: 'M12 8v4l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  rules: 'M5 4h14v16H5zM9 8h6M9 12h6M9 16h4',
  method: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm7.4-3a7.4 7.4 0 0 0-.1-1.3l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2.2-1.3L14.4 3h-4l-.4 2.4a7 7 0 0 0-2.2 1.3l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.6l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2.2 1.3l.4 2.4h4l.4-2.4a7 7 0 0 0 2.2-1.3l2.4 1 2-3.4-2-1.6c.1-.4.1-.9.1-1.3z',
  law: 'M4 19V5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2zm0 0a2 2 0 0 1 2-2h12',
  ask: 'M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z',
  account: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-8 9a8 8 0 0 1 16 0',
  plans: 'M3 6h18v12H3zM3 10h18',
  aiset: 'M12 3l1.8 4.7L18.5 9l-4.7 1.8L12 15.5l-1.8-4.7L5.5 9l4.7-1.3zM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z',
  admin: 'M4 6h16M4 12h16M4 18h16'
};
const icon = v => `<svg class="al-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="${P[v] || P.reports}"/></svg>`;

document.head.insertAdjacentHTML('beforeend', `<style id="al-shell">
:root{--rail-bg:#F3F0E9;--rail-ink:var(--ink);--rail-ink2:#57514A;--rail-ink3:#958D81;--rail-line:var(--line);--rail-hover:#EAE6DD;--rail-active:var(--surface)}
:root[data-theme="dark"]{--rail-bg:#171613;--rail-ink2:#B5AEA3;--rail-ink3:#7A7368;--rail-hover:#211F1B;--rail-active:#26231F}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--rail-bg:#171613;--rail-ink2:#B5AEA3;--rail-ink3:#7A7368;--rail-hover:#211F1B;--rail-active:#26231F}}
@media (min-width:861px){body:not(.locked) .app{grid-template-columns:256px 1fr!important}}
.locked .app{grid-template-columns:1fr!important}
/* sidebar: same warm paper, ink type, and mark as the public site */
.rail{background:var(--rail-bg)!important;color:var(--rail-ink)!important;border-right:1px solid var(--rail-line)!important;padding:18px 14px 14px!important;gap:14px!important;scrollbar-width:thin;scrollbar-color:var(--line2) transparent;box-shadow:none!important}
.rail .brand{padding:2px 8px 6px!important;gap:9px!important;align-items:center!important}
.rail .brand .al-tile{display:inline-grid!important;place-items:center;flex:none;width:30px;height:30px;border-radius:8px;background:var(--ink)!important;color:var(--paper)!important;box-shadow:0 1px 2px rgba(25,23,20,.18)}
.rail .brand .al-tile svg{width:22px;height:22px;display:block}
.rail .brand .al-tile svg path{fill:var(--paper)!important}
.rail .brand .al-tile svg circle{fill:var(--clay,#C4693F)!important}
.rail .brand b{color:var(--ink)!important;font-family:var(--serif)!important;font-size:24px!important;font-weight:600!important;letter-spacing:-.02em}
.rail > small{display:none!important}
.rail .al-new{display:none!important}
.al-ws{display:flex;align-items:center;gap:10px;margin-bottom:4px;padding:9px 10px;border-radius:10px;background:var(--surface);border:1px solid var(--rail-line);box-shadow:0 1px 2px rgba(25,23,20,.04)}
.al-ws .av{width:28px;height:28px;border-radius:8px;background:var(--ink);color:var(--paper);display:grid;place-items:center;font:600 12.5px/1 var(--font);flex:none}
.al-ws b{display:block;font:560 13px/1.25 var(--font);color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px}
.al-ws span{display:block;font-size:11.5px;color:var(--rail-ink3);margin-top:1px}
#nav-q{background:var(--surface)!important;border:1px solid var(--rail-line)!important;color:var(--ink)!important;border-radius:9px!important;font-size:13px!important;padding:8px 10px 8px 32px!important;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23958D81' stroke-width='2'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cpath d='m20 20-3.5-3.5'/%3E%3C/svg%3E")!important;background-repeat:no-repeat!important;background-position:10px center!important;background-size:14px!important}
#nav-q::placeholder{color:var(--rail-ink3)!important}
.nav{gap:1px!important}
.nav-group{color:var(--rail-ink3)!important;font:600 10.5px/1 var(--font)!important;letter-spacing:.12em!important;padding:18px 10px 7px!important;text-transform:uppercase}
.nav button{color:var(--rail-ink2)!important;font:460 13.5px/1.2 var(--font)!important;padding:7px 10px!important;margin:0!important;width:auto!important;box-sizing:border-box!important;border-radius:8px!important;display:flex!important;align-items:center!important;gap:10px!important;justify-content:flex-start!important;box-shadow:none!important;background:transparent!important;transition:background .12s,color .12s}
.nav button:hover{background:var(--rail-hover)!important;color:var(--ink)!important}
.nav button[aria-current="page"]{background:var(--rail-active)!important;color:var(--ink)!important;font-weight:560!important;box-shadow:0 0 0 1px var(--rail-line),0 1px 2px rgba(25,23,20,.05)!important}
.nav button .al-ico{width:16px;height:16px;flex:none;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round;opacity:.8}
.nav button[aria-current="page"] .al-ico{opacity:1;color:var(--clay)}
.nav button .count{margin-left:auto;font-size:11px!important;color:var(--rail-ink3)!important;background:transparent;border:1px solid var(--rail-line);border-radius:999px;padding:0 7px}
.rail .foot{color:var(--rail-ink3)!important;border-top:1px solid var(--rail-line);padding:12px 8px 0!important;font-size:11.5px!important}
.rail .foot button{color:var(--rail-ink2)!important}
.rail .foot b{color:var(--ink)!important}
.rail .foot .chip{background:var(--surface)!important;color:var(--clay)!important;border:1px solid var(--rail-line)}
#cite-toggle{color:var(--rail-ink3)!important;margin:12px 10px 0!important;font-size:12px}

/* top bar */
body:not(.locked) main{max-width:none!important;padding-top:0!important}
body:not(.locked) #views,body:not(.locked) main > .disclaimer{max-width:1240px;margin-left:auto;margin-right:auto}
.al-top{position:sticky;top:0;z-index:15;display:flex;align-items:center;gap:12px;height:58px;margin:0 calc(-1 * clamp(16px,3vw,40px)) 22px;padding:0 clamp(16px,3vw,40px);background:color-mix(in srgb,var(--paper) 82%,transparent);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-bottom:1px solid var(--line)}
.al-crumb{font-size:13px;color:var(--ink3);display:flex;align-items:center;gap:8px;min-width:0}
.al-crumb b{color:var(--ink);font-weight:550;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.al-crumb i{font-style:normal;opacity:.6}
.al-top .sp{flex:1}
.al-kbd{display:flex;align-items:center;gap:8px;min-width:220px;padding:7px 10px;border:1px solid var(--line);border-radius:9px;background:var(--surface);color:var(--ink3);font-size:13px;cursor:pointer;transition:border-color .15s}
.al-kbd:hover{border-color:var(--line2)}
.al-kbd kbd{margin-left:auto;font:500 11px/1 var(--font);border:1px solid var(--line);border-radius:5px;padding:2px 5px;color:var(--ink3)}
.al-top .btn{padding:7px 12px!important;font-size:13px!important}
.al-top .al-sep{width:1px;height:22px;background:var(--line);margin:0 4px}
.al-top .al-newbtn{display:inline-flex!important;align-items:center;gap:7px;background:var(--ink)!important;color:var(--paper)!important;border-color:var(--ink)!important;border-radius:9px!important;padding:8px 14px!important}
.al-top .al-newbtn svg{width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2}
.al-status{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--ink2);padding:4px 10px;border-radius:999px;background:var(--sunk);border:1px solid var(--line);white-space:nowrap}
.al-status i{width:7px;height:7px;border-radius:50%;background:#3E9B66;display:inline-block}
.al-status.none i{background:var(--ink3)}
@media (max-width:860px){.al-kbd{display:none}.al-status{display:none}.al-top .al-sep{display:none}.rail .al-ws{display:none!important}.rail #nav-q{min-width:120px}}

/* new-audit dialog */
#al-new-modal{position:fixed;inset:0;z-index:90;background:rgba(20,19,17,.5);display:flex;align-items:center;justify-content:center;padding:16px;animation:alFade .15s ease}
#al-new-modal .box{background:var(--surface);border:1px solid var(--line);border-radius:16px;max-width:480px;width:100%;padding:22px 22px 18px;box-shadow:0 30px 80px -30px rgba(0,0,0,.5)}
#al-new-modal h3{margin:0 0 6px;font-family:var(--serif)!important;font-size:24px!important;font-weight:550!important}
#al-new-modal ul{margin:10px 0 12px;padding-left:18px;font-size:13.5px;color:var(--ink2)}
@keyframes alFade{from{opacity:0}to{opacity:1}}
</style>`);

// ---------- start fresh
X.newAudit = ({ history = false } = {}) => {
  Object.assign(S, { input: null, result: null, patterns: null, label: '', source: '', findingsBy: null, recordsBy: null, q2: null, scenario: null, imp: { files: {}, step: 0 }, bulk: { items: [], docs: [], running: false }, status: {}, notes: {}, aiCache: {}, docs: [] });
  if (S.empIndex && S.empIndex.clear) S.empIndex.clear(); if (S.sumIndex && S.sumIndex.clear) S.sumIndex.clear();
  if (S.ws) S.ws = { ...S.ws, status: {}, tasks: [] };
  if (S.dg && S.dg.sel) S.dg.sel.clear(); if (S.fq) Object.assign(S.fq, { emp: '', dim: '', val: '' });
  if (S.lit) S.lit = { side: S.lit.side || 'defense', docs: [], facts: null, inputs: null, gross: 0, ctx: S.lit.ctx || {} };
  if (history) { S.snapshots = []; S.events = []; }
  X.DOC_BYTES = null; X.docPlan = null;
  try { X.clearSavedAudit && X.clearSavedAudit(); } catch { /* ignore */ }
  X.persist && X.persist(); X.log && X.log('audit.cleared', { history });
  X.setView('import'); toast(history ? 'Cleared — workspace and history are empty. Add files to start.' : 'Cleared — add files to start a new audit.');
};
function askNew() {
  document.getElementById('al-new-modal')?.remove();
  const has = !!(S.result || (S.bulk && S.bulk.items && S.bulk.items.length) || Object.keys((S.imp && S.imp.files) || {}).length);
  document.body.insertAdjacentHTML('beforeend', `<div id="al-new-modal" role="dialog" aria-modal="true" aria-labelledby="al-new-h"><div class="box">
    <h3 id="al-new-h">Start a new audit?</h3>
    <p class="small muted" style="margin:0">${has ? 'This clears the current audit from this workspace:' : 'Nothing is loaded yet — you can add files right away.'}</p>
    ${has ? `<ul><li>uploaded files and the records read from them</li><li>findings, review decisions, notes, and tasks</li><li>the saved copy of this audit</li></ul><p class="small muted" style="margin:0 0 10px">Your account, company profile, settings, and templates stay.</p>
    <label class="check small"><input type="checkbox" id="al-new-hist"> Also clear saved monitoring history (${(S.snapshots || []).length} snapshot${(S.snapshots || []).length === 1 ? '' : 's'})</label>` : ''}
    <div class="row" style="justify-content:flex-end;margin-top:16px;gap:8px"><button class="btn" data-x="cancel">Cancel</button><button class="btn primary" data-x="go">${has ? 'Clear and start fresh' : 'Add files'}</button></div></div></div>`);
  const m = document.getElementById('al-new-modal'); m.querySelector('[data-x="go"]').focus();
  m.addEventListener('click', e => { const b = e.target.closest('[data-x]'); if (!b && e.target !== m) return; const go = b && b.dataset.x === 'go'; const hist = !!m.querySelector('#al-new-hist')?.checked; m.remove(); if (go) has ? X.newAudit({ history: hist }) : X.setView('import'); });
  m.addEventListener('keydown', e => { if (e.key === 'Escape') m.remove(); });
}
X.askNewAudit = askNew;
// Import page: say plainly what is loaded and offer a clean start
const VIEWS = X.VIEWS;
const prevImport = VIEWS.import;
VIEWS.import = el => {
  prevImport(el);
  if (!S.result) return;
  const h = el.querySelector('h1'); if (!h || el.querySelector('.al-loaded')) return;
  const sub = h.nextElementSibling && h.nextElementSibling.classList.contains('seg') ? h.nextElementSibling : h;
  sub.insertAdjacentHTML('afterend', `<div class="panel al-loaded" style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin:12px 0;padding:14px 16px;border-left:3px solid var(--clay)!important"><div style="flex:1;min-width:240px"><b>An audit is loaded: ${esc(S.input?.employerName || 'current audit')}</b><div class="small muted">${(S.input?.employees?.length || 0).toLocaleString()} workers · ${(S.result.engine.findings.length || 0).toLocaleString()} findings. Files you add now are combined with it. To audit a different company or data set, start fresh.</div></div><button class="btn" data-act="go" data-to="exec">View results</button><button class="btn primary" data-act="new-audit">Start a new audit</button></div>`);
};

// ---------- sidebar decoration
const MARK = '<svg class="al-mark" data-v="5" viewBox="0 0 32 32" aria-hidden="true"><path d="M3 25C9.5 25 12 13.5 18.5 13.5C23.5 13.5 25 19.5 29 19.5V25Z" fill="currentColor"/><circle cx="23.5" cy="8.5" r="3" fill="var(--clay,#C4693F)"/></svg>';
function decorate() {
  const rail = document.querySelector('.rail'); if (!rail) return;
  const brand = rail.querySelector('.brand');
  if (brand && !brand.querySelector('.al-tile')) { brand.querySelectorAll('svg').forEach(s => s.remove()); brand.insertAdjacentHTML('afterbegin', `<span class="al-tile">${MARK}</span>`); }
  const co = (S.profile && S.profile.company) || (S.account && S.account.company) || (S.input && S.input.employerName) || 'Your workspace';
  const plan = S.isOwner ? 'Owner · full access' : S.account?.plan ? `${String(S.account.plan).replace(/^./, c => c.toUpperCase())} plan` : 'Workspace';
  let ws = rail.querySelector('.al-ws'); const html = `<span class="av">${esc(co.trim().slice(0, 1).toUpperCase() || 'A')}</span><div><b title="${esc(co)}">${esc(co)}</b><span>${esc(plan)}</span></div>`;
  if (!ws) { rail.querySelector('#nav-q')?.insertAdjacentHTML('beforebegin', `<div class="al-ws">${html}</div>`); } else if (ws.dataset.h !== html) { ws.innerHTML = html; ws.dataset.h = html; }
  rail.querySelectorAll('.nav button[data-view]').forEach(b => { if (!b.querySelector('.al-ico')) b.insertAdjacentHTML('afterbegin', icon(b.dataset.view)); });
}
// ---------- top bar
function crumbs() {
  const cur = document.querySelector(`.nav button[data-view="${S.view}"]`); if (!cur) return null;
  let g = cur.previousElementSibling; while (g && !g.classList.contains('nav-group')) g = g.previousElementSibling;
  return [g ? g.textContent.replace(/[▾▸]/g, '').trim() : 'Aldune', cur.textContent.replace(/\d[\d,]*$/, '').trim()];
}
function topbar() {
  const main = document.getElementById('main'); if (!main || document.body.classList.contains('locked')) { document.querySelector('.al-top')?.remove(); return; }
  const c = crumbs() || ['Aldune', ''];
  let bar = main.querySelector('.al-top');
  const status = S.result ? `<span class="al-status" title="Current audit"><i></i>${esc(S.input?.employerName || 'Audit')} · ${S.input?.employees?.length || 0} workers</span>` : '<span class="al-status none"><i></i>No audit loaded</span>';
  const html = `<div class="al-crumb"><span>${esc(c[0])}</span><i>/</i><b>${esc(c[1])}</b></div><div class="sp"></div>${status}<button class="al-kbd" data-act="al-search" type="button"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>Search pages and tools<kbd>/</kbd></button><span class="al-sep" aria-hidden="true"></span><button class="btn al-newbtn" data-act="new-audit" type="button"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>New audit</button>`;
  if (!bar) { main.insertAdjacentHTML('afterbegin', `<div class="al-top">${html}</div>`); return; }
  if (bar.dataset.h !== html) { bar.innerHTML = html; bar.dataset.h = html; }
}
const baseRender = X.render;
X.render = (...args) => { const r = baseRender(...args); try { decorate(); topbar(); } catch (e) { console.warn(e); } return r; };
decorate(); topbar();
new MutationObserver(() => { if (!document.querySelector('.rail .al-ws') || document.querySelector('.nav button[data-view]:not(:has(.al-ico))')) decorate(); }).observe(document.getElementById('nav') || document.body, { childList: true, subtree: true });

document.addEventListener('click', e => {
  const a = e.target.closest('[data-act]'); if (!a) return;
  if (a.dataset.act === 'new-audit') { e.preventDefault(); askNew(); }
  if (a.dataset.act === 'al-search') { const q = document.getElementById('nav-q'); if (q) { q.focus(); q.select && q.select(); } }
});
document.addEventListener('keydown', e => { if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement?.tagName || '') && !document.body.classList.contains('locked')) { const q = document.getElementById('nav-q'); if (q) { e.preventDefault(); q.focus(); } } });
})();
