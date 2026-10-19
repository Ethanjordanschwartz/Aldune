/* Aldune — part 42: palette v4 (owner feedback, Oct 8 2026).
   • The app keeps its own light theme even when the page it is shown inside switches to dark (the Claude viewer sets
     data-theme="dark" on the page when the viewer is in dark mode — that is what turned the sidebar dark). Dark is used
     only when the user picks it with the theme button.
   • Three tones in the brand line: Aldune in burnt umber, "California." in warm taupe, "Compliant." in orange
   • "handled." back to the deeper orange (#C4693F); headings a touch softer than before
   • A warmer sand sidebar with an orange active marker
   • A shorter, stronger privilege band */
(() => {
'use strict';
const X = window.PCX; const VIEWS = X.VIEWS; const root = document.documentElement;
// ---------------------------------------------------------------- one theme: light
// Aldune ships one look — warm light paper with a sand sidebar. A dark theme stored by an earlier version, the operating
// system's dark mode, or the Claude viewer setting data-theme="dark" on the page no longer changes it.
const choice = 'light';
try { ['paycure:theme', 'aldune:theme'].forEach(k => localStorage.removeItem(k)); } catch { /* storage unavailable */ }
root.dataset.theme = choice; root.style.colorScheme = 'light';
new MutationObserver(() => { if (root.dataset.theme !== choice) root.dataset.theme = choice; }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
document.addEventListener('click', e => { if (e.target.closest && e.target.closest('#theme-btn')) { e.stopImmediatePropagation(); e.preventDefault(); } }, true);
X.themeChoice = () => choice;

// ---------------------------------------------------------------- tokens and polish
document.head.insertAdjacentHTML('beforeend', `<style id="al-brand-v4">
:root,:root[data-theme="light"]{ --clay:#C4693F; --marker:#C4693F; --head-ink:#4A3A30; --ink:#3A2F28; --brand:#7A4A33; --taupe:#9A8576;
  --rail-bg:#F5EEE3; --rail-hover:#EDE3D4; --rail-active:#FFFDF9; --rail-ink2:#5E5047; --rail-ink3:#A08F80; }
.al-hero h1 em{color:#C4693F!important}
/* brand line: three tones */
.al-tagline,.al-tagline-pub{color:var(--taupe)!important}
.al-tagline em,.al-tagline-pub em{font-style:normal;color:var(--clay)!important}
.al-tagline-pub{border-left:1px solid var(--line2);padding-left:12px;margin-left:12px!important;font-weight:600!important;letter-spacing:.16em!important}
.rail .al-tagline{font-weight:600!important;letter-spacing:.16em!important;margin-top:-6px!important}
.brand b,.rail .brand b,.pub-top .brand b{color:var(--brand)!important}
/* sidebar */
/* sidebar: soft "brown bear" camel — clearly its own panel, with dark text, the umber logo, and orange accents all legible */
.rail{background:linear-gradient(180deg,#E6D6C6 0%,#DDCAB8 100%)!important;border-right:1px solid #CDB8A3!important;--brand:#6B3F2A;--rail-ink2:#2E241E;--rail-ink3:#4A392E;--rail-hover:rgba(255,250,242,.38);--rail-active:#FBF6EE}
.rail .nav button,.rail .nav a{color:#221A15!important;font-weight:550!important}
.rail .nav button .al-ico,.rail .nav button svg{color:#3E3027!important;opacity:1!important}
.rail .nav button:hover{background:var(--rail-hover)!important}
.rail .nav button[aria-current="page"]{background:var(--rail-active)!important;box-shadow:inset 3px 0 0 var(--clay),0 1px 3px rgba(58,47,40,.12)!important;color:#221A15!important;font-weight:600}
.rail .nav button[aria-current="page"] .al-ico{color:var(--clay)!important}
.rail .nav .sec,.rail .nav summary,.rail .nav h4,.rail .nav .grp{color:#4A392E!important;opacity:1!important}
.rail .brand b{color:#6B3F2A!important}.rail .al-mark path,.rail .brand svg path{fill:#6B3F2A!important}.rail .al-mark circle,.rail .brand svg circle{fill:#C4693F!important}
.rail .al-tagline{color:#3E3027!important}.rail .al-tagline em{color:#9C4A26!important;font-weight:700}
.rail .al-ws,.rail #nav-q{background-color:#FBF6EE!important;border-color:#C9AD8C!important;color:#221A15!important}
.rail #nav-q::placeholder{color:#7A6555!important}
.rail .foot,.rail .foot *{color:#2E241E!important}
.rail .chip,.rail .count,.rail .nav .n{background:rgba(255,250,242,.55)!important;color:#2E241E!important;border-color:transparent!important}
#theme-btn{display:none!important}
#as-fab{background:var(--brand)!important;border-color:var(--brand)!important;color:#FFF7EE!important}
/* privilege band v2 */
.al-priv2{position:relative;overflow:hidden;border-radius:20px;padding:30px 32px;background:linear-gradient(135deg,#FFF9F2 0%,#F7E6D8 100%);border:1px solid #EBD8C6;display:grid;grid-template-columns:auto 1fr;gap:24px;align-items:center}
.al-priv2::after{content:"";position:absolute;right:-60px;top:-60px;width:220px;height:220px;border-radius:50%;background:radial-gradient(circle,rgba(196,105,63,.18),rgba(196,105,63,0) 70%)}
.al-priv2 .seal{width:76px;height:76px;border-radius:50%;background:var(--clay);display:grid;place-items:center;color:#FFF7EE;box-shadow:0 10px 24px -10px rgba(196,105,63,.7),inset 0 0 0 6px rgba(255,255,255,.18)}
.al-priv2 .k{font:600 11.5px/1 var(--font);letter-spacing:.16em;text-transform:uppercase;color:var(--clay-ink);margin-bottom:8px}
.al-priv2 h3{margin:0!important;font-family:var(--serif)!important;font-size:30px!important;line-height:1.1!important;letter-spacing:-.01em;color:var(--head-ink)!important}
.al-priv2 p{margin:8px 0 0;color:var(--ink2);font-size:15px;line-height:1.5;max-width:720px}
.al-priv2 .pills{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
.al-priv2 .pills span{background:rgba(255,253,249,.85);border:1px solid #EBD8C6;border-radius:999px;padding:5px 12px;font-size:12.5px;font-weight:600;color:var(--brand)}
.al-priv2 .fine{font-size:11.5px;color:var(--ink3);margin-top:12px}
@media (max-width:700px){.al-priv2{grid-template-columns:1fr;padding:24px}.al-priv2 h3{font-size:24px!important}}
</style>`);

// brand line markup: "California." taupe, "Compliant." orange
function tagline() { document.querySelectorAll('.al-tagline,.al-tagline-pub').forEach(t => { if (!t.querySelector('em')) t.innerHTML = 'California. <em>Compliant.</em>'; }); }

const PRIV2 = `<div class="al-priv2" id="al-priv"><div class="seal"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/></svg></div><div>
  <div class="k">Attorney-client privilege · Kovel</div><h3>Your audit stays privileged.</h3>
  <p>Run at the direction of counsel, Aldune works as counsel’s consultant under <i>United States v. Kovel</i>. Findings and memos stay attorney work product — not handed to plaintiffs’ attorneys.</p>
  <div class="pills"><span>Counsel directs the work</span><span>Labeled work product</span><span>Access limited to the legal team</span></div>
  <div class="fine">Privilege depends on counsel setting up the engagement. Underlying payroll and time records remain discoverable.</div></div></div>`;
X.PRIV_BAND = PRIV2;
const swap = el => { const old = el.querySelector('#al-priv'); if (old && !old.classList.contains('al-priv2')) old.outerHTML = PRIV2; };
for (const v of ['public', 'privilege']) { const b = VIEWS[v]; if (b) VIEWS[v] = el => { b(el); swap(el); }; }
const baseRender = X.render; X.render = (...a) => { const r = baseRender(...a); try { tagline(); } catch { /* ignore */ } return r; };
tagline();
X.render();
})();
