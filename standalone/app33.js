/* Aldune — part 33: homepage v2. Bolder type (Fraunces), motion (drifting dunes, live audit preview, count-ups,
   marquee, scroll reveals), sectioned bands, hover lift, and a giant translucent wordmark behind the footer.
   Motion is disabled for people who prefer reduced motion. */
(() => {
'use strict';
const X = window.PCX; const { S, VIEWS } = X;

document.head.insertAdjacentHTML('beforeend', `<style id="al-home2">
:root{--serif:"Fraunces","Instrument Serif",Georgia,"Times New Roman",serif}
h1,h2,.doc-title,.countdown{font-family:var(--serif)!important;font-variation-settings:"opsz" 96;letter-spacing:-0.02em!important}
h1{font-weight:560!important} h2{font-weight:520!important}
.brand b,.rail .brand b,.pub-top .brand b{font-family:var(--serif)!important;font-weight:680!important;letter-spacing:-0.03em!important;font-variation-settings:"opsz" 72}
.pub-top .brand b{font-size:29px!important}
.rail .brand b{font-size:28px!important}
.kpi .v,.pub-stat .n{font-family:var(--serif)!important;font-weight:560!important}

/* hover: everything clickable grows slightly, as if about to be pressed */
.btn,.pubnav .link,.pub-card,.al-pill,.pv-row,.lawchip,.al-feature{transition:transform .22s cubic-bezier(.2,.8,.2,1),box-shadow .22s ease,background .2s,border-color .2s,opacity .2s}
.btn:hover{transform:scale(1.04)} .btn:active{transform:scale(.98)}
.pubnav .link:hover{transform:scale(1.06)}
.pub-card:hover,.al-feature:hover{transform:translateY(-4px) scale(1.015)!important;box-shadow:0 22px 50px -28px rgba(25,23,20,.35)!important}
.pv-row:hover{transform:translateX(4px)}

/* hero */
.al-hero{padding:104px 0 0!important;background:radial-gradient(1200px 520px at 50% 120%,rgba(196,105,63,.10),transparent 60%),var(--paper)!important}
.al-hero h1{font-size:clamp(52px,8vw,112px)!important;font-weight:600!important;line-height:.95!important;letter-spacing:-0.035em!important;max-width:13ch!important}
.al-hero h1 em{font-style:italic;font-weight:500;color:var(--clay)!important}
.al-hero p.lead{font-size:clamp(18px,1.7vw,21px)!important;color:var(--ink2)}
.al-hero .btn{padding:15px 26px!important;font-size:16.5px!important;border-radius:999px!important}
.al-eyebrow{font-weight:500}
.al-rot{display:inline-block;min-width:8ch;color:var(--ink);font-weight:600;border-bottom:2px solid var(--clay)}
.al-dunes{margin-top:56px!important;width:108%!important;margin-left:-4%!important}
.al-dunes .d1{animation:alDrift 26s ease-in-out infinite alternate}
.al-dunes .d2{animation:alDrift 19s ease-in-out infinite alternate-reverse}
.al-dunes .d3{animation:alDrift 31s ease-in-out infinite alternate}
.al-dunes .sun{animation:alSun 9s ease-in-out infinite;transform-origin:1080px 70px}
@keyframes alDrift{from{transform:translateX(-28px)}to{transform:translateX(28px)}}
@keyframes alSun{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-10px) scale(1.06)}}

/* marquee of what Aldune checks (keeps moving on hover) */
.app > main,.app > *{min-width:0}
.al-marquee{max-width:100vw;contain:inline-size;overflow:hidden;border-bottom:1px solid var(--line);background:var(--surface);padding:16px 0;-webkit-mask-image:linear-gradient(90deg,transparent,#000 10%,#000 90%,transparent);mask-image:linear-gradient(90deg,transparent,#000 10%,#000 90%,transparent)}
.al-track{display:flex;gap:46px;width:max-content;animation:alMarquee 70s linear infinite;font-family:var(--serif);font-size:22px;font-weight:520;color:var(--ink3);white-space:nowrap}
.al-track span::before{content:"✦";color:var(--clay);font-size:12px;margin-right:46px;vertical-align:4px}
@keyframes alMarquee{to{transform:translateX(-50%)}}

/* live preview */
.al-show{padding:64px 0 96px!important}
.al-show .preview{margin-top:0!important}
.al-show .preview{overflow:hidden}
.al-scan{position:absolute;left:0;right:0;height:56px;top:-56px;background:linear-gradient(180deg,transparent,rgba(196,105,63,.10),transparent);animation:alScan 4.8s ease-in-out infinite;pointer-events:none}
@keyframes alScan{0%{top:-56px}60%,100%{top:100%}}
.preview .pv-row{opacity:0;transform:translateY(6px)}
.preview.in .pv-row{opacity:1;transform:none;transition:opacity .5s ease,transform .5s ease}
.preview.in .pv-row:nth-of-type(1){transition-delay:.5s}.preview.in .pv-row:nth-of-type(2){transition-delay:.9s}.preview.in .pv-row:nth-of-type(3){transition-delay:1.3s}
.preview .pv-bars span{transform:scaleY(.05);transform-origin:bottom;transition:transform .9s cubic-bezier(.2,.8,.2,1)}
.preview.in .pv-bars span{transform:scaleY(1)}
.preview.in .pv-bars span:nth-child(2){transition-delay:.1s}.preview.in .pv-bars span:nth-child(3){transition-delay:.2s}.preview.in .pv-bars span:nth-child(4){transition-delay:.3s}.preview.in .pv-bars span:nth-child(5){transition-delay:.4s}.preview.in .pv-bars span:nth-child(6){transition-delay:.5s}

/* sectioned bands */
.pub-sec{padding:104px 0!important;border-bottom:0!important;position:relative}
.pub-sec.al-band-paper{background:var(--paper)!important}
.pub-sec.al-band-surface{background:var(--surface)!important}
.pub-sec.al-band-sand{background:var(--sand)!important}
.pub-sec.al-band-ink{background:var(--ink)!important;color:#EFEAE0}
.pub-sec.al-band-ink h2,.pub-sec.al-band-ink h3,.pub-sec.al-band-ink b{color:#F8F4EC!important}
.pub-sec.al-band-ink .pub-card{background:#221F1B!important;border-color:#34302A!important;color:#D9D2C5}
.pub-sec.al-band-ink .pub-card p{color:#BDB4A6}
.pub-sec.al-band-ink [style*="color:var(--warn)"]{color:var(--clay)!important}
.al-kicker{display:flex;align-items:center;gap:12px;font-size:12.5px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--clay);margin-bottom:18px}
.al-kicker i{font-style:normal;font-family:var(--serif);font-size:15px;letter-spacing:0;color:inherit;opacity:.8}
.al-kicker::after{content:"";height:1px;width:56px;background:currentColor;opacity:.4}
.pub-sec h2{font-size:clamp(34px,4.4vw,58px)!important;line-height:1.02!important;letter-spacing:-0.03em!important;max-width:20ch;margin-bottom:28px!important}

/* reveal on scroll */
.al-rv{opacity:0;transform:translateY(22px);transition:opacity .8s ease,transform .8s cubic-bezier(.2,.8,.2,1)}
.al-rv.in{opacity:1;transform:none}

/* footer: giant translucent wordmark in the background */
footer{position:relative;overflow:hidden;padding-bottom:clamp(140px,19vw,300px)!important}
footer > .pub{position:relative;z-index:1}
.al-giant{position:absolute;left:50%;bottom:-0.17em;transform:translateX(-50%);font-family:var(--serif);font-weight:700;font-size:clamp(150px,27vw,430px);line-height:1;letter-spacing:-0.05em;color:var(--ink);opacity:.06;white-space:nowrap;pointer-events:none;user-select:none;z-index:0}
:root[data-theme="dark"] .al-giant{opacity:.09}

@media (prefers-reduced-motion: reduce){
  .al-dunes .d1,.al-dunes .d2,.al-dunes .d3,.al-dunes .sun,.al-track,.al-scan{animation:none!important}
  .al-rv,.preview .pv-row,.preview .pv-bars span{opacity:1!important;transform:none!important;transition:none!important}
  .btn:hover,.pub-card:hover,.al-feature:hover,.pubnav .link:hover{transform:none!important}
}
</style>`);

const reduce = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
function countUp(el) {
  if (el.dataset.done) return; el.dataset.done = '1';
  const node = [...el.childNodes].find(c => c.nodeType === 3 && /\d/.test(c.nodeValue)); if (!node || reduce()) return;
  const raw = node.nodeValue; const m = raw.match(/^(\s*\$?)([\d,]+)(.*)$/s); if (!m) return;
  const target = Number(m[2].replace(/,/g, '')); if (!target) return;
  const t0 = performance.now(), dur = 1400;
  const step = t => { const k = Math.min(1, (t - t0) / dur); const e = 1 - Math.pow(1 - k, 3); node.nodeValue = k < 1 ? m[1] + Math.round(target * e).toLocaleString('en-US') + m[3] : raw; if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
function observe(root) {
  const items = root.querySelectorAll('.al-rv,.preview,.pub-stat .n,[data-count]');
  if (!('IntersectionObserver' in window)) { items.forEach(i => i.classList.add('in')); return; }
  const io = new IntersectionObserver(es => es.forEach(en => { if (!en.isIntersecting) return; const t = en.target; t.classList.add('in'); if (t.matches('.pub-stat .n,[data-count]')) countUp(t); if (t.matches('.preview')) { const big = t.querySelector('[data-count]'); if (big) countUp(big); } io.unobserve(t); }), { threshold: 0.18 });
  items.forEach(i => io.observe(i));
}

const WORDS = ['every shift.', 'every pay stub.', 'every timecard.', 'every rule.'];
let rotTimer = null;
const SECTIONS = { product: ['01', 'What it does', 'al-band-surface'], how: ['02', 'How it works', 'al-band-sand'], pricing: ['04', 'Pricing', 'al-band-surface'], about: ['05', 'Who we are', 'al-band-paper'] };

const base = VIEWS.public;
VIEWS.public = el => {
  base(el);
  const hero = el.querySelector('.al-hero'); if (!hero) return;
  const authed = X.authed();
  // hero copy: bolder, more concrete
  const h1 = hero.querySelector('h1'); if (h1) h1.innerHTML = 'Wage law, <em>handled.</em>';
  const lead = hero.querySelector('p.lead'); if (lead) lead.innerHTML = `Aldune reads <span class="al-rot" aria-live="polite">${WORDS[0]}</span> It tests your records against California law, shows the math line by line, and hands you the finished fix — corrected policies, back-pay files, and letters ready to sign.`;
  hero.querySelectorAll('.al-dunes path').forEach((p, i) => p.classList.add(`d${i + 1}`)); const sun = hero.querySelector('.al-dunes circle'); if (sun) sun.classList.add('sun');
  hero.querySelector('.al-trust')?.remove();
  // marquee
  const sys = ['Find exposure before a PAGA notice does', 'Every shift tested against California law', 'Meal and rest premiums, to the minute', 'Overtime and the regular rate, recomputed', 'Every dollar traced to a source record', 'PAGA penalties capped at 15% when reasonable steps come first', 'Minimum wage by state, city, and industry', 'Final pay, wage statements, and waiting time', 'Fix it with documents ready to sign'];
  hero.insertAdjacentHTML('afterend', `<div class="al-marquee" aria-label="What Aldune checks"><div class="al-track">${[...sys, ...sys].map(s => `<span>${s}</span>`).join('')}</div></div>`);
  // live preview: scanning line and a counted-up exposure figure
  const pv = el.querySelector('.al-show .preview');
  if (pv) { pv.insertAdjacentHTML('afterbegin', '<span class="al-scan" aria-hidden="true"></span>'); const big = [...pv.querySelectorAll('div')].find(d => /^\$[\d,]+/.test(d.textContent.trim()) && d.children.length <= 1); if (big && big.firstChild) big.setAttribute('data-count', ''); }
  // sectioned bands with numbered kickers
  const secs = [...el.querySelectorAll('.pub-sec')]; let n = 0;
  secs.forEach((s, i) => {
    const meta = SECTIONS[s.id]; const h2 = s.querySelector('h2');
    const band = meta ? meta[2] : ['al-band-paper', 'al-band-sand', 'al-band-surface'][i % 3]; s.classList.add(band);
    if (h2 && !s.querySelector('.al-kicker')) { n++; const label = meta ? meta[1] : /question/i.test(h2.textContent) ? 'Questions' : /built for/i.test(h2.textContent) ? 'Who it’s for' : 'More'; h2.insertAdjacentHTML('beforebegin', `<div class="al-kicker"><i>${String(n).padStart(2, '0')}</i>${label}</div>`); }
    s.querySelectorAll('h2,.pub-card,.grid > div,details').forEach(x => x.classList.add('al-rv'));
  });
  // footer: giant translucent wordmark
  const ft = el.querySelector('footer'); if (ft && !ft.querySelector('.al-giant')) ft.insertAdjacentHTML('beforeend', '<div class="al-giant" aria-hidden="true">Aldune</div>');
  // rotating word
  clearInterval(rotTimer);
  if (!reduce()) { let k = 0; rotTimer = setInterval(() => { const r = document.querySelector('.al-rot'); if (!r || S.view !== 'public') { clearInterval(rotTimer); return; } k = (k + 1) % WORDS.length; r.style.transition = 'opacity .25s'; r.style.opacity = '0'; setTimeout(() => { r.textContent = WORDS[k]; r.style.opacity = '1'; }, 250); }, 2400); }
  // subtle parallax on the hero dunes
  if (!reduce()) { const svg = hero.querySelector('.al-dunes'); const onScroll = () => { if (!svg.isConnected) { removeEventListener('scroll', onScroll); return; } const y = Math.min(scrollY, 600); svg.style.transform = `translateY(${y * -0.06}px)`; }; addEventListener('scroll', onScroll, { passive: true }); }
  void authed; observe(el);
};
if (S.view === 'public' && !X.authed()) X.render && X.render();
})();
