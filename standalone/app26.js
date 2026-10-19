/* Aldune — part 26: logo, sidebar tone, simpler navigation, clear privilege answer, colorful public pages */
(() => {
'use strict';
const X = window.PCX; const { S, $, esc, VIEWS } = X;

// ---------- logo: a flowing “S” drawn as a data line, amber start point, mint end point, on a round emerald badge
const MARK = '<svg class="sp-mark" data-v="4" width="30" height="30" viewBox="0 0 30 30" aria-hidden="true" style="display:block"><circle cx="15" cy="15" r="15" fill="#1F5A47"/><circle cx="15" cy="15" r="13.6" fill="none" stroke="#3E8A6E" stroke-width="1"/><path d="M20 9.6C18.4 7.4 9.6 7.6 10 11.9c.4 3.7 9.6 1.5 9.6 6 0 4.1-8.5 3.7-10.1 1.4" fill="none" stroke="#F4FBF7" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round"/><circle cx="20" cy="9.6" r="2" fill="#F2B66D"/><circle cx="9.5" cy="19.3" r="2" fill="#7FE0B5"/></svg>';
const swapLogo = () => document.querySelectorAll('.brand').forEach(b => { const svg = b.querySelector('svg:not([data-v="4"]):not(.al-mark)'); if (svg) svg.outerHTML = MARK; });
new MutationObserver(swapLogo).observe(document.body, { childList: true, subtree: true }); swapLogo();
const favicon = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30"><circle cx="15" cy="15" r="15" fill="#1F5A47"/><path d="M20 9.6C18.4 7.4 9.6 7.6 10 11.9c.4 3.7 9.6 1.5 9.6 6 0 4.1-8.5 3.7-10.1 1.4" fill="none" stroke="#fff" stroke-width="2.7" stroke-linecap="round"/><circle cx="20" cy="9.6" r="2" fill="#F2B66D"/><circle cx="9.5" cy="19.3" r="2" fill="#7FE0B5"/></svg>');
void favicon; // superseded by the Aldune favicon in head.html

// ---------- styles: lighter sidebar, slower scan, colorful public pages
document.head.insertAdjacentHTML('beforeend', `<style>
.rail{background:linear-gradient(180deg,#E6D6C6 0%,#DDCAB8 100%)!important}
.nav button{color:#3A2F28!important}
.nav-group{color:#6E5646!important}
.rail > small,.rail .foot{color:#4A3A2F!important}
.preview .sp-scan{animation-duration:7.5s!important;animation-timing-function:ease-in-out!important;opacity:.7}
.pub-hero{background:radial-gradient(900px 480px at 88% 0%,rgba(31,107,82,.20),transparent 70%),radial-gradient(700px 420px at 0% 100%,rgba(199,125,90,.16),transparent 70%),linear-gradient(180deg,#FBF8F3,#F1EADF)!important}
.pub-sec:nth-of-type(even){background:linear-gradient(180deg,#F6F1E8,#EFE8DC)}
.pub-card{position:relative;background:#fff;border:1px solid var(--line);border-radius:16px;transition:transform .25s ease,box-shadow .25s ease;box-shadow:0 1px 2px rgba(22,33,28,.05),0 10px 30px rgba(22,33,28,.06)}
.pub-card::before{content:"";position:absolute;left:0;right:0;top:0;height:4px;border-radius:16px 16px 0 0;background:linear-gradient(90deg,#1F6B52,#4E9C7F 55%,#C77D5A)}
.pub-card:hover{transform:translateY(-4px);box-shadow:0 18px 40px rgba(22,33,28,.12)}
.pub-card h3{color:#123227;font-family:var(--head)!important;font-weight:800!important;letter-spacing:-0.02em}.pub-card h2,.pub-sec h3{font-family:var(--head)!important}
.pub-sec h2{background:linear-gradient(90deg,#123227,#1F6B52);-webkit-background-clip:text;background-clip:text;color:transparent}
.pub-plan-pop,.pub-card.popular{border:2px solid #1F6B52;box-shadow:0 20px 50px rgba(31,107,82,.22)}
.pub-hero h1{letter-spacing:-0.035em}
</style>`);
function orbs() {
  const hero = document.querySelector('.pub-hero'); if (!hero || hero.querySelector('.sp-orb')) return;
  hero.insertAdjacentHTML('afterbegin', '<span class="sp-orb" style="width:380px;height:380px;right:-60px;top:-140px;background:radial-gradient(circle,rgba(31,107,82,.42),transparent 70%)"></span><span class="sp-orb" style="width:320px;height:320px;left:-120px;bottom:-160px;background:radial-gradient(circle,rgba(199,125,90,.32),transparent 70%);animation-delay:-6s"></span>');
}
// highlight the recommended plan on Pricing
function popular() { document.querySelectorAll('.pub-card').forEach(c => { if (/Professional/.test(c.querySelector('h3')?.textContent || '') && !c.classList.contains('popular')) { c.classList.add('popular'); c.insertAdjacentHTML('afterbegin', '<span class="chip ok" style="position:absolute;top:12px;right:12px">Most popular</span>'); } }); }

// ---------- clear privilege answer: attorney-directed → privileged; not → not privileged
const basePriv = VIEWS.privilege;
VIEWS.privilege = el => {
  basePriv(el); const on = S.priv.mode === 'privileged';
  const grid = el.querySelector('.grid.g2'); if (!grid) return;
  const verdict = on
    ? `<div class="panel" style="border-left:5px solid var(--ledger);margin-bottom:12px"><h3 style="margin-top:0">Attorney-directed audit — privileged</h3><p class="small">Because your attorney directs this audit to give you legal advice, the audit, its analysis, and Aldune’s reports are protected by the attorney-client privilege and attorney work-product doctrine, provided they stay within your legal team and control group. Reports are watermarked automatically. The underlying payroll and time records themselves are never privileged.</p></div>`
    : `<div class="panel" style="border-left:5px solid var(--warn);margin-bottom:12px"><h3 style="margin-top:0">Standard audit — not privileged</h3><p class="small">Without an attorney directing it, this audit is an ordinary business record. In a lawsuit or agency investigation, the findings and reports can generally be requested and used as evidence. Choose <b>Yes</b> above if your attorney is directing the audit.</p><p class="small muted" style="margin:0">No attorney yet? You can still fix what the audit finds — the fixes themselves are evidence of “reasonable steps” that can lower PAGA penalties.</p></div>`;
  grid.insertAdjacentHTML('beforebegin', verdict);
  if (!on) grid.style.display = 'none'; // standard audits don’t ask for counsel
  else grid.querySelector('h3')?.replaceChildren(document.createTextNode('Your attorney'));
};

// ---------- Home: export steps for one chosen system (no long list)
document.addEventListener('change', e => {
  if (e.target.id !== 'home-sys') return; const k = e.target.value; const box = $('#home-sys-steps'); if (!box) return;
  const row = (X.EXPORTS || [])[+k]; box.innerHTML = k === '' || !row ? '' : `<div class="muted-box" style="text-align:left;padding:12px"><b>${esc(row[0])}:</b> ${esc(row[1])}</div>`;
});

// ---------- navigation: “More tools” starts collapsed (once), Fix queue button exists in the static nav
try { if (!localStorage.getItem('paycure:navCollapsed')) { setTimeout(() => { const g = [...document.querySelectorAll('#nav .nav-group')].find(x => /More tools/.test(x.textContent)); g?.click(); }, 0); } } catch { /* ignore */ }

const baseRender = X.render; X.render = () => { baseRender(); if (/^public$|^p-/.test(S.view) || ['login', 'signup'].includes(S.view)) setTimeout(() => { orbs(); popular(); }, 0); };
X.render();
})();

/* ---------- proactive: “Aldune noticed” on Home; troubleshooting lives on Data quality */
(() => {
const X = window.PCX; const { PC, S, esc, VIEWS } = X; const iso = () => new Date().toISOString().slice(0, 10);
const baseHome = VIEWS.home;
VIEWS.home = el => {
  baseHome(el); if (!S.input) return;
  const a = PC.proactiveAlerts(S.input, S.result, iso(), { noticeDate: S.readiness?.noticeDate || undefined }); if (!a.length) return;
  const tone = { high: 'flag', medium: 'warn', info: '' };
  el.querySelector('h1')?.insertAdjacentHTML('afterend', `<div class="panel" style="border-left:5px solid var(--ledger);margin:0 0 14px"><h3 style="margin-top:0">Aldune noticed</h3><p class="small muted" style="margin-top:-6px">Coming up, based on your own data and the dated rules.</p>${a.slice(0, 5).map(x => `<div class="row" style="justify-content:space-between;align-items:center;gap:10px;padding:8px 0;border-top:1px solid var(--line)"><div><span class="chip ${tone[x.severity]}">${x.severity === 'high' ? 'act now' : x.severity === 'medium' ? 'soon' : 'tip'}</span> <b>${esc(x.title)}</b><div class="small">${esc(x.detail)}</div><div class="cite">${esc(x.cite)}</div></div><button class="btn" data-act="go" data-to="${esc(x.view)}">Open</button></div>`).join('')}</div>`);
};
const baseQ = VIEWS.quality;
VIEWS.quality = el => { baseQ(el); const T = X.TROUBLE || []; if (!T.length) return; el.insertAdjacentHTML('beforeend', `<h2>Troubleshooting</h2>${T.map(([q, a]) => `<details class="law"><summary>${esc(q)}</summary><p class="small">${esc(a)}</p></details>`).join('')}`); };
X.render();
})();

/* ---------- troubleshooting where it is needed most: on Import (collapsed), even before any data exists */
(() => {
const X = window.PCX; const { esc, VIEWS } = X;
const baseImp = VIEWS.import;
VIEWS.import = el => { baseImp(el); const T = X.TROUBLE || []; if (!T.length) return; el.insertAdjacentHTML('beforeend', `<details class="panel" style="margin-top:16px"><summary><b>Having trouble with a file?</b></summary>${T.map(([q, a]) => `<details class="law" style="margin-top:6px"><summary>${esc(q)}</summary><p class="small">${esc(a)}</p></details>`).join('')}</details>`); };
X.render();
})();

/* ---------- scanned / handwritten files are never silently ignored: a clear notice with next steps */
(() => {
const X = window.PCX; const { S, esc, VIEWS } = X;
const baseImp = VIEWS.import;
VIEWS.import = el => {
  baseImp(el); const scans = (S.bulk?.items || []).filter(i => i.status === 'scan'); if (!scans.length) return;
  el.querySelector('h1')?.insertAdjacentHTML('afterend', `<div class="panel" style="border-left:5px solid var(--warn);margin:0 0 14px"><h3 style="margin-top:0">${scans.length} scanned or handwritten file${scans.length === 1 ? '' : 's'} need${scans.length === 1 ? 's' : ''} Aldune AI to read</h3>
    <p class="small" style="margin:4px 0">${scans.slice(0, 5).map(i => esc(i.name)).join(', ')}${scans.length > 5 ? ` and ${scans.length - 5} more` : ''}</p>
    <p class="small" style="margin:4px 0">Aldune reads photos and handwritten timecards with AI and asks you to confirm anything it isn’t sure about. Choose one:</p>
    <div class="row"><button class="btn primary" data-act="go" data-to="aiset">Connect Penny AI</button><button class="btn" data-act="go" data-to="connect">Upload a typed export instead</button></div>
    <p class="cite" style="margin-top:6px">Or open Aldune inside Claude, where AI reading works automatically. Nothing from these files was used in your audit.</p></div>`);
};
X.render();
})();
