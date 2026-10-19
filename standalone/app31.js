/* Aldune — part 31: brand and design system (final layer).
   Minimal, warm, quiet: bone paper, ink type, one terracotta accent, Instrument Serif display over Inter.
   Loaded last so it overrides the earlier theme layers without touching their logic. */
(() => {
'use strict';
const X = window.PCX; const { S, VIEWS } = X;

X.BRAND = { name: 'Aldune', tagline: 'California wage and hour, solved.' };
X.logo = (size = 24) => `<svg class="al-mark" width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true"><path d="M3 25C9.5 25 12 13.5 18.5 13.5C23.5 13.5 25 19.5 29 19.5V25Z" fill="currentColor"/><circle cx="23.5" cy="8.5" r="3" fill="#C4693F"/></svg>`;

document.head.insertAdjacentHTML('beforeend', `<style id="al-theme">
:root{
  --paper:#F8F6F1; --surface:#FFFFFF; --sunk:#F2EFE8; --line:#E7E2D8; --line2:#D9D3C7;
  --ink:#191714; --ink2:#6E675D; --ink3:#9A9286;
  --ledger:#191714; --ledger-ink:#FFFFFF; --ledger-tint:#EFECE5;
  --clay:#C4693F; --clay-tint:#F6E7DE;
  --flag:#B5482A; --flag-tint:#F7E4DC; --warn:#9A6516; --warn-tint:#F5EBD8; --ok:#3E6B4E; --ok-tint:#E6EEE7;
  --marker:#C4693F; --sand:#EFE9DD;
  --font:"Inter",system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  --head:"Inter",system-ui,sans-serif; --serif:"Instrument Serif",Georgia,"Times New Roman",serif;
}
:root[data-theme="dark"]{
  --paper:#131210; --surface:#1B1916; --sunk:#221F1B; --line:#2F2B26; --line2:#3B362F;
  --ink:#F2EEE6; --ink2:#AAA297; --ink3:#7E776D; --ledger:#F2EEE6; --ledger-ink:#131210; --ledger-tint:#26231F;
  --clay:#E08A5F; --clay-tint:#3A251B; --flag:#E58466; --flag-tint:#3A211A; --warn:#E0B062; --warn-tint:#352A17; --ok:#8FBF9C; --ok-tint:#1F2B22; --marker:#E08A5F;
}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){
  --paper:#131210; --surface:#1B1916; --sunk:#221F1B; --line:#2F2B26; --line2:#3B362F;
  --ink:#F2EEE6; --ink2:#AAA297; --ink3:#7E776D; --ledger:#F2EEE6; --ledger-ink:#131210; --ledger-tint:#26231F;
  --clay:#E08A5F; --clay-tint:#3A251B; --flag:#E58466; --flag-tint:#3A211A; --warn:#E0B062; --warn-tint:#352A17; --ok:#8FBF9C; --ok-tint:#1F2B22; --marker:#E08A5F;
}}
html,body{background:var(--paper)!important}
body{font-family:var(--font);font-size:15px;letter-spacing:-0.003em;color:var(--ink);font-feature-settings:"cv11","ss01","tnum"}
a{color:var(--ink);text-underline-offset:3px;text-decoration-color:var(--line2)}
a:hover{text-decoration-color:var(--ink)}
::selection{background:var(--clay-tint);color:var(--ink)}
:focus-visible{outline:2px solid var(--clay)!important;outline-offset:2px}
h1,h2,.doc-title,.countdown{font-family:var(--serif)!important;font-weight:400!important;letter-spacing:-0.01em!important;color:var(--ink)!important}
h1{font-size:clamp(30px,3.2vw,40px);line-height:1.08}
h2{font-size:clamp(22px,2.2vw,28px);line-height:1.15}
h3,.sol h3,.anom h3{font-family:var(--font)!important;font-weight:600!important;letter-spacing:-0.01em!important}
[style*="Fraunces"]{font-family:var(--serif)!important;font-weight:400!important}
.muted,.small.muted,.cite{color:var(--ink2)}

/* sidebar: light, hairline, quiet */
.rail{background:var(--paper)!important;color:var(--ink)!important;border-right:1px solid var(--line)!important;box-shadow:none!important}
.rail .brand{align-items:center;gap:9px;color:var(--ink)}
.rail .brand b,.brand b{font-family:var(--serif)!important;font-weight:400!important;font-size:27px!important;letter-spacing:-0.01em!important;color:var(--ink)!important}
.rail > small{color:var(--ink2)!important;font-weight:400!important;margin-top:-12px}
.nav-group{color:var(--ink3)!important;font-weight:500!important;font-size:11px!important;letter-spacing:.09em!important;text-transform:uppercase}
.nav button{color:var(--ink2)!important;font-weight:450!important;border-radius:8px!important;padding:7px 10px!important}
.nav button:hover{background:var(--sunk)!important;color:var(--ink)!important}
.nav button[aria-current="page"]{background:var(--surface)!important;color:var(--ink)!important;font-weight:550!important;box-shadow:0 0 0 1px var(--line),0 1px 2px rgba(25,23,20,.04)!important}
.nav button .count,.nav button small{color:var(--ink3)!important}
.rail .foot{color:var(--ink2)!important}
#nav-q{background:var(--surface)!important;border:1px solid var(--line)!important;color:var(--ink)!important;border-radius:8px!important}
#nav-q::placeholder{color:var(--ink3)}
:root[data-theme="dark"] .rail{background:var(--paper)!important;color:var(--ink)!important}
:root[data-theme="dark"] .nav button{color:var(--ink2)!important}

/* surfaces */
.panel,.kpi,.sol,.pub-card,.auth,.preview{background:var(--surface)!important;border:1px solid var(--line)!important;box-shadow:none!important;border-radius:14px!important}
.kpi{border-top:1px solid var(--line)!important}
.kpi .v{font-family:var(--serif)!important;font-weight:400!important;font-size:36px!important;letter-spacing:-0.01em}
.kpi.risk .v{color:var(--clay)}
.btn{border-radius:10px!important;border:1px solid var(--line2);background:var(--surface);color:var(--ink);font-weight:500;box-shadow:none!important;transition:background .15s,border-color .15s}
.btn:hover{border-color:var(--ink3);background:var(--sunk)}
.btn.primary{background:var(--ink)!important;border-color:var(--ink)!important;color:var(--paper)!important}
.btn.primary:hover{opacity:.88}
.chip{border-radius:999px}
.chip.ok{background:var(--ok-tint)!important;color:var(--ok)!important}
.drop{border:1.5px dashed var(--line2)!important;background:var(--surface)!important;border-radius:14px!important}
.drop:hover{border-color:var(--ink3)!important;box-shadow:none!important}
.drop svg{color:var(--clay)!important}
#as-fab{background:var(--ink)!important;border-color:var(--ink)!important;color:var(--paper)!important;box-shadow:0 10px 30px -10px rgba(25,23,20,.45)!important}
input,select,textarea{border-radius:8px}
table th{color:var(--ink2);font-weight:500}

/* public site */
.pub{max-width:1160px}
.pub-top{background:color-mix(in srgb,var(--paper) 86%,transparent)!important;border-bottom:1px solid var(--line)!important}
.pub-top .brand{color:var(--ink)!important}
.pub-top .brand b{font-size:26px!important}
.pubnav .link{color:var(--ink2)!important;font-size:14.5px!important}
.pubnav .link:hover,.pubnav .link.on{background:transparent!important;color:var(--ink)!important}
.pub-hero{background:var(--paper)!important;border-bottom:1px solid var(--line)!important}
.pub-hero h1{font-size:clamp(38px,5vw,64px)!important;line-height:1.02!important;max-width:18ch}
.pub-hero p{color:var(--ink2)!important}
.pub-sec{border-bottom:1px solid var(--line)!important;padding:80px 0!important}
.pub-sec h2{font-size:clamp(28px,3.4vw,44px)!important;max-width:24ch}
.pub-stat{background:transparent!important;border:0!important;border-top:1px solid var(--line2)!important;border-radius:0!important;padding:16px 0 0!important}
.pub-stat .n{font-family:var(--serif)!important;font-weight:400!important;color:var(--ink)!important;font-size:44px!important}
.pv-bars span{background:var(--ink)!important;opacity:.85}
.pv-bars span:first-child{background:var(--clay)!important;opacity:1}
footer{background:var(--paper)!important;color:var(--ink2)!important;border-top:1px solid var(--line)}
footer b,footer [style*="FFF8EC"]{color:var(--ink)!important}
footer button{color:var(--ink2)!important}
footer button:hover{color:var(--ink)!important}
footer p[style*="border-top"]{border-top-color:var(--line)!important}
section[style*="var(--ink)"]{background:var(--ink)!important}
.sp-orb{display:none!important}
:root[data-theme="dark"] .al-dunes path:nth-of-type(1){fill:#201D19}:root[data-theme="dark"] .al-dunes path:nth-of-type(2){fill:#29251F}:root[data-theme="dark"] .al-dunes path:nth-of-type(3){fill:#332E27}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]) .al-dunes path:nth-of-type(1){fill:#201D19}:root:not([data-theme="light"]) .al-dunes path:nth-of-type(2){fill:#29251F}:root:not([data-theme="light"]) .al-dunes path:nth-of-type(3){fill:#332E27}}
section[style*="var(--ink)"] h2{color:var(--paper)!important}
section[style*="var(--ink)"] .btn.primary{background:var(--paper)!important;color:var(--ink)!important;border-color:var(--paper)!important}
.pub-card.popular > span.chip[style*="absolute"]{display:none!important}
.pub-card::before{display:none!important}
.pub-card{transition:border-color .2s!important}.pub-card:hover{transform:none!important;border-color:var(--line2)!important}
.pub-card h3{color:var(--ink)!important;font-family:var(--font)!important;font-weight:600!important}
.pub-sec h2{background:none!important;-webkit-background-clip:border-box!important;background-clip:border-box!important;-webkit-text-fill-color:currentColor!important;color:var(--ink)!important}
.pub-sec:nth-of-type(even){background:var(--paper)!important}
.pub-card.popular,.pub-plan-pop{border:1px solid var(--ink)!important;box-shadow:none!important}
.pub-top{background:color-mix(in srgb,var(--paper) 88%,transparent)!important}
.brand b,.pub-top .brand b{font-weight:400!important}

.al-hero{position:relative;overflow:hidden;background:var(--paper);border-bottom:1px solid var(--line);padding:96px 0 0}
.al-hero .pub{position:relative;z-index:1;text-align:center}
.al-eyebrow{display:inline-flex;align-items:center;gap:8px;font-size:13px;color:var(--ink2);border:1px solid var(--line2);border-radius:999px;padding:5px 12px;background:var(--surface)}
.al-eyebrow i{width:6px;height:6px;border-radius:50%;background:var(--clay);display:inline-block}
.al-hero h1{font-size:clamp(44px,6.4vw,86px)!important;line-height:1!important;margin:26px auto 0;max-width:16ch}
.al-hero h1 em{font-style:italic;color:var(--ink2)}
.al-hero p.lead{font-size:clamp(17px,1.6vw,20px);color:var(--ink2);max-width:58ch;margin:22px auto 0;line-height:1.55}
.al-hero .row{justify-content:center;margin-top:30px;gap:10px}
.al-hero .btn{padding:13px 22px!important;font-size:16px!important}
.al-hero .al-trust{margin-top:18px;font-size:13px;color:var(--ink3)}
.al-dunes{display:block;width:100%;height:auto;margin-top:72px;color:var(--ink)}
.al-show{padding:0 0 80px;background:var(--paper)}
.al-show .preview{max-width:760px;margin:-40px auto 0;position:relative;z-index:2;text-align:left;box-shadow:0 30px 60px -40px rgba(25,23,20,.35)!important}
.al-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:28px;margin-top:64px}
@media (max-width:860px){.al-stats{grid-template-columns:1fr 1fr}.al-hero{padding-top:80px}}
@media (max-width:520px){.al-stats{grid-template-columns:1fr}}
</style>`);

// ---------- homepage: quiet, centered hero over a dune horizon; product preview and sourced stats below
const dunes = () => `<svg class="al-dunes" viewBox="0 0 1440 260" preserveAspectRatio="none" aria-hidden="true">
  <path d="M0 170C180 150 300 92 470 96C640 100 720 176 900 172C1080 168 1190 110 1440 118V260H0Z" fill="#EAE3D5"/>
  <path d="M0 214C210 210 330 150 540 150C760 150 820 222 1030 218C1200 214 1300 178 1440 182V260H0Z" fill="#DFD5C3"/>
  <path d="M0 246C260 244 420 206 660 206C900 206 980 250 1180 248C1300 247 1380 236 1440 236V260H0Z" fill="#D2C5AE"/>
  <circle cx="1080" cy="70" r="26" fill="#C4693F" opacity=".9"/></svg>`;
const baseHome = VIEWS.public;
VIEWS.public = el => {
  baseHome(el);
  const old = el.querySelector('.pub-hero'); if (!old) return;
  const preview = old.querySelector('.preview'); const stats = [...old.querySelectorAll('.pub-stat')]; const src = [...old.querySelectorAll('p.small')].pop();
  const authed = X.authed();
  const hero = document.createElement('section'); hero.className = 'al-hero';
  hero.innerHTML = `<div class="pub">
    <span class="al-eyebrow"><i></i>California wage &amp; hour intelligence</span>
    <h1>Payroll risk, found <em>before it finds you.</em></h1>
    <p class="lead">Aldune reads your pay stubs, timesheets, and policies, tests every shift against California law, shows the math, and hands you the finished fix — corrected policies, back-pay files, and letters ready to sign.</p>
    <div class="row"><button class="btn primary" data-act="go" data-to="${authed ? 'home' : 'signup'}">${authed ? 'Open the app' : 'Create your account'} →</button><button class="btn" data-act="go" data-to="p-product">See how it works</button></div>
    <div class="al-trust">Reads Toast, Square, ADP, UKG, Paychex, QuickBooks Time, Homebase, Excel, Word, PDF, and scans.</div>
  </div>${dunes()}`;
  const show = document.createElement('section'); show.className = 'al-show';
  show.innerHTML = `<div class="pub"></div>`;
  if (preview) show.firstChild.appendChild(preview);
  if (stats.length) { const g = document.createElement('div'); g.className = 'al-stats'; stats.forEach(s => g.appendChild(s)); show.firstChild.appendChild(g); }
  if (src) { src.style.textAlign = 'left'; show.firstChild.appendChild(src); }
  old.replaceWith(hero); hero.after(show);
};
if (S.view === 'public' && !X.authed()) X.render && X.render();
})();
