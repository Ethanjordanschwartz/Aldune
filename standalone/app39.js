/* Aldune — part 39: brand palette v3 (owner feedback, Oct 2026).
   • Softer, warmer type: espresso instead of near-black; headings in deep cocoa, never a harsh black
   • Orange leads: primary buttons, links, and the sun in the mark; the mark and the word "Aldune" in burnt umber (never boxed,
     never white) so they sit naturally on the tan paper
   • Light theme by default (dark only when the user picks it); a light, warm sidebar that matches the public site
   • "California. Compliant." as the brand line
   Loaded last: overrides tokens only, no logic. */
(() => {
'use strict';
const X = window.PCX;
X.BRAND = { ...(X.BRAND || {}), name: 'Aldune', tagline: 'California. Compliant.' };
// light unless the user chose dark with the theme button (system dark mode no longer flips the app)
try { if (!localStorage.getItem('paycure:theme')) document.documentElement.dataset.theme = 'light'; } catch { document.documentElement.dataset.theme = 'light'; }

document.head.insertAdjacentHTML('beforeend', `<style id="al-brand-v3">
:root,:root[data-theme="light"]{
  --paper:#F7F2EA; --surface:#FFFDF9; --sunk:#F1EADF; --line:#E6DDCF; --line2:#D8CCBA; --sand:#EFE6D8;
  --ink:#2E2520; --ink2:#695C52; --ink3:#9A8C80;
  --brand:#7A4A33;            /* burnt umber: the mark and the word "Aldune" */
  --clay:#D16F45; --clay-ink:#A9512D; --clay-tint:#F8E6DA; --marker:#D16F45;
  --ledger:#B4532E; --ledger-ink:#FFFFFF; --ledger-tint:#F6E4D8;   /* primary actions are orange, not black */
  --head-ink:#3A2C24;          /* headings: deep cocoa */
  --rail-bg:#F2EBE0; --rail-hover:#EAE1D3; --rail-active:#FFFDF9; --rail-ink2:#5E5047; --rail-ink3:#97887B;
}
:root[data-theme="dark"]{ --brand:#E6B48C; --head-ink:#F1E8DC; --ledger:#D16F45; --ledger-ink:#FFFFFF; --clay-ink:#E8936B; }

/* type: headings in cocoa, body in espresso — no pure black anywhere */
h1,h2,h3,.al-hero h1,#views h1,.pub h1,.pub h2{color:var(--head-ink)!important}
.al-crumb b{color:var(--head-ink)!important}

/* primary buttons: orange with white text (passes contrast at button sizes) */
.btn.primary,.pub .btn.primary,.al-top .al-newbtn{background:var(--ledger)!important;border-color:var(--ledger)!important;color:var(--ledger-ink)!important}
.btn.primary:hover,.al-top .al-newbtn:hover{filter:brightness(1.06);opacity:1}
section[style*="var(--ink)"] .btn.primary{background:var(--ledger)!important;color:#fff!important;border-color:var(--ledger)!important}
a{color:var(--clay-ink)}
.seg button[aria-pressed="true"]{background:var(--head-ink)!important;color:var(--paper)!important}

/* the mark and wordmark: umber dune + orange sun, no box, on every surface */
.al-mark path{fill:var(--brand)!important}.al-mark circle{fill:var(--clay)!important}
.brand b,.rail .brand b,.pub-top .brand b{color:var(--brand)!important}
.rail .brand .al-tile{background:transparent!important;box-shadow:none!important;width:28px!important;height:28px!important;border-radius:0!important}
.rail .brand .al-tile svg{width:28px!important;height:28px!important}
.rail .brand .al-tile svg path{fill:var(--brand)!important}.rail .brand .al-tile svg circle{fill:var(--clay)!important}

/* hero: "Wage law," in cocoa, "handled." in orange; rotating word underline in orange */
.al-hero h1{color:var(--head-ink)!important}.al-hero h1 em{color:var(--clay)!important}
.al-rot{color:var(--head-ink)!important}
.al-giant{color:var(--brand)!important;opacity:.07!important}

/* sidebar: warm and light; active item lifted, icon in orange */
.rail{background:var(--rail-bg)!important}
.nav button[aria-current="page"] .al-ico{color:var(--clay)!important}
.al-ws .av{background:var(--brand)!important;color:#FFF7EE!important}
.rail .al-tagline{display:block;padding:0 8px 2px;margin-top:-8px;font:600 10.5px/1.2 var(--font);letter-spacing:.14em;text-transform:uppercase;color:var(--clay-ink)}
.al-tagline-pub{display:inline-block;margin-left:10px;font:600 11px/1 var(--font);letter-spacing:.14em;text-transform:uppercase;color:var(--clay-ink);vertical-align:middle}
@media (max-width:860px){.rail .al-tagline,.al-tagline-pub{display:none}}

/* the privilege band (home page + Privileged audits) */
.al-priv{display:flex;gap:16px;align-items:flex-start;border:1px solid var(--line);border-left:4px solid var(--brand);background:var(--surface);border-radius:14px;padding:18px 20px}
.al-priv .ic{flex:none;width:40px;height:40px;border-radius:10px;background:var(--clay-tint);display:grid;place-items:center;color:var(--brand)}
.al-priv h3{margin:0 0 2px!important;font-size:19px!important}
.al-priv .k{font:600 11px/1 var(--font);letter-spacing:.14em;text-transform:uppercase;color:var(--clay-ink);margin-bottom:6px}
.al-priv p{margin:4px 0 0;color:var(--ink2);font-size:14px;line-height:1.55}
</style>`);

// brand line under the logo in the sidebar and next to it on the public header
function tag() {
  const rb = document.querySelector('.rail .brand'); if (rb && !document.querySelector('.rail .al-tagline')) rb.insertAdjacentHTML('afterend', '<span class="al-tagline">California. Compliant.</span>');
  const pb = document.querySelector('.pub-top .brand'); if (pb && !pb.querySelector('.al-tagline-pub')) pb.insertAdjacentHTML('beforeend', '<span class="al-tagline-pub">California. Compliant.</span>');
}
// attorney-client privilege, stated accurately: protection comes from how the audit is set up, and the records stay discoverable
const PRIV = `<div class="al-priv" id="al-priv"><span class="ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4"/></svg></span><div>
  <div class="k">Attorney-client privilege</div><h3>Protected under the Kovel doctrine</h3>
  <p>Run an audit at the direction of counsel and Aldune works as counsel’s consultant — the arrangement recognized in <i>United States v. Kovel</i> (2d Cir. 1961) and California Evidence Code § 952. Findings, models, and memos are kept as privileged attorney work product: labeled, access-controlled, and not shared outside the legal team, so they are not handed to plaintiffs’ attorneys.</p>
  <p class="small" style="font-size:12.5px">Privilege depends on the engagement being set up and run correctly — counsel retains Aldune, directs the work, and receives the results. The underlying payroll and time records stay discoverable, as they always are.</p></div></div>`;
X.PRIV_BAND = PRIV;
const VIEWS = X.VIEWS;
const basePub = VIEWS.public;
if (basePub) VIEWS.public = el => { basePub(el); if (el.querySelector('#al-priv')) return; const mq = el.querySelector('.al-marquee'); const html = `<section class="pub-sec" style="padding-top:36px;padding-bottom:12px"><div class="pub">${PRIV}</div></section>`; if (mq) mq.insertAdjacentHTML('afterend', html); };
const basePrivView = VIEWS.privilege;
if (basePrivView) VIEWS.privilege = el => { basePrivView(el); if (el.querySelector('#al-priv')) return; const h = el.querySelector('h1'); const after = h && h.nextElementSibling ? h.nextElementSibling : h; if (after) after.insertAdjacentHTML('afterend', `<div style="margin:12px 0 16px">${PRIV}</div>`); };
const baseRender = X.render; X.render = (...a) => { const r = baseRender(...a); try { tag(); } catch { /* ignore */ } return r; };
tag();
})();
