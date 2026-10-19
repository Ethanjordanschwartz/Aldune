/* Aldune — part 40: "See how it works" as a film, not a table.
   An auto-playing, looping motion walkthrough of the signed-in product (no play button): records go in, every shift is tested,
   exposure is counted with its math, a finding opens with the facts and the law, the fixes are drafted, and Penny answers.
   The long rules table moves into a collapsed "every rule and its authority" section. Honors reduced motion. */
(() => {
'use strict';
const X = window.PCX; const { PC, esc, VIEWS } = X;

document.head.insertAdjacentHTML('beforeend', `<style id="al-film-css">
.al-film{position:relative;max-width:1080px;margin:0 auto;border-radius:18px;background:var(--surface);border:1px solid var(--line);box-shadow:0 40px 90px -40px rgba(58,44,36,.35),0 2px 6px rgba(58,44,36,.06);overflow:hidden}
.al-film .chrome{display:flex;align-items:center;gap:7px;height:38px;padding:0 14px;border-bottom:1px solid var(--line);background:var(--sunk)}
.al-film .chrome i{width:10px;height:10px;border-radius:50%;background:var(--line2)}.al-film .chrome span{margin-left:12px;font-size:12px;color:var(--ink3)}
.al-film .body{display:grid;grid-template-columns:190px 1fr;height:430px}
.al-film .side{background:var(--rail-bg,#F2EBE0);border-right:1px solid var(--line);padding:16px 12px;display:flex;flex-direction:column;gap:6px}
.al-film .side .lg{display:flex;align-items:center;gap:7px;font-family:var(--serif);font-weight:650;font-size:20px;color:var(--brand,#7A4A33);margin-bottom:10px}
.al-film .side .it{height:26px;border-radius:7px;display:flex;align-items:center;gap:8px;padding:0 9px;font-size:12px;color:var(--ink2);transition:background .4s,color .4s}
.al-film .side .it b{width:12px;height:12px;border-radius:3px;background:var(--line2);display:inline-block;transition:background .4s}
.al-film .side .it.on{background:var(--surface);color:var(--head-ink,#3A2C24);box-shadow:0 0 0 1px var(--line)}.al-film .side .it.on b{background:var(--clay)}
.al-film .stage{position:relative;overflow:hidden}
.al-film .scene{position:absolute;inset:0;padding:26px 30px;opacity:0;transform:translateY(14px);transition:opacity .6s ease,transform .6s ease;pointer-events:none}
.al-film .scene.on{opacity:1;transform:none}
.al-film h4{margin:0 0 4px;font-family:var(--serif);font-size:26px;font-weight:600;color:var(--head-ink,#3A2C24)}
.al-film .sub{font-size:13px;color:var(--ink2);margin-bottom:18px}
.al-film .cap{position:absolute;left:0;right:0;bottom:0;display:flex;justify-content:center;gap:8px;padding:12px;background:linear-gradient(transparent,var(--surface) 60%)}
.al-film .cap i{width:28px;height:4px;border-radius:2px;background:var(--line);overflow:hidden;position:relative}
.al-film .cap i.on::after{content:"";position:absolute;inset:0;background:var(--clay);animation:alBar var(--dur,4.2s) linear forwards}
@keyframes alBar{from{transform:translateX(-100%)}to{transform:none}}
/* scene 1: files fly into the drop zone */
.al-film .drop{position:relative;height:230px;border:2px dashed var(--line2);border-radius:14px;display:grid;place-items:center;color:var(--ink3);font-size:13px}
.al-film .file{position:absolute;width:92px;padding:9px 10px;border-radius:9px;background:var(--surface);border:1px solid var(--line);box-shadow:0 8px 20px -10px rgba(58,44,36,.4);font-size:11px;color:var(--ink2);opacity:0}
.al-film .file b{display:block;font-size:10px;letter-spacing:.08em;color:var(--clay-ink,#A9512D)}
.al-film .scene.on .file{animation:alFly 1.3s cubic-bezier(.2,.7,.2,1) forwards}
@keyframes alFly{0%{opacity:0;transform:translate(var(--fx),-140px) rotate(var(--fr))}60%{opacity:1}100%{opacity:1;transform:translate(0,0) rotate(0)}}
.al-film .prog{margin-top:14px;height:8px;border-radius:4px;background:var(--sunk);overflow:hidden}.al-film .prog b{display:block;height:100%;width:0;background:var(--clay)}
.al-film .scene.on .prog b{animation:alFill 3s ease forwards .6s}@keyframes alFill{to{width:100%}}
/* scene 2: shifts scanned row by row */
.al-film table{width:100%;border-collapse:collapse;font-size:12px}.al-film td{padding:7px 8px;border-bottom:1px solid var(--line);color:var(--ink2)}
.al-film tr{opacity:0}.al-film .scene.on tr{animation:alRow .35s ease forwards}
@keyframes alRow{to{opacity:1}}
.al-film .ok{color:var(--ok)}.al-film .fl{color:var(--flag);font-weight:600}
/* scene 3: KPI + bars */
.al-film .fkpi{display:flex;gap:14px;margin-bottom:16px}.al-film .fkpi>div{flex:1;border:1px solid var(--line);border-radius:12px;padding:12px 14px}
.al-film .fkpi .v{font-family:var(--serif);font-size:30px;font-weight:600;color:var(--clay-ink,#A9512D)}.al-film .fkpi .k{font-size:11px;color:var(--ink3)}
.al-film .bar{display:grid;grid-template-columns:130px 1fr 70px;gap:10px;align-items:center;font-size:12px;color:var(--ink2);margin:8px 0}
.al-film .bar i{height:10px;border-radius:5px;background:var(--sunk);overflow:hidden}.al-film .bar i b{display:block;height:100%;width:0;background:var(--brand,#7A4A33)}
.al-film .scene.on .bar i b{animation:alGrow 1.4s cubic-bezier(.2,.7,.2,1) forwards}@keyframes alGrow{to{width:var(--w)}}
/* scene 4: finding card */
.al-film .card{border:1px solid var(--line);border-left:4px solid var(--clay);border-radius:12px;padding:14px 16px;background:var(--surface);max-width:560px;transform:translateX(40px);opacity:0}
.al-film .scene.on .card{animation:alIn .7s ease forwards .2s}@keyframes alIn{to{transform:none;opacity:1}}
.al-film .card .t{font-weight:650;color:var(--head-ink,#3A2C24)}.al-film .card .m{font-size:12px;color:var(--ink2);margin-top:4px;line-height:1.5}
.al-film .ledger{margin-top:10px;font-family:ui-monospace,Menlo,monospace;font-size:11.5px;background:var(--sunk);border-radius:8px;padding:8px 10px;color:var(--ink)}
.al-film .chip{display:inline-block;font-size:10.5px;border:1px solid var(--line);border-radius:999px;padding:2px 8px;margin:6px 6px 0 0;color:var(--ink2)}
/* scene 5: documents drafted */
.al-film .doc{display:flex;align-items:center;gap:12px;padding:11px 12px;border:1px solid var(--line);border-radius:10px;margin-bottom:9px;opacity:0;transform:translateY(8px)}
.al-film .scene.on .doc{animation:alIn .5s ease forwards}.al-film .doc .ic{width:28px;height:34px;border-radius:4px;background:var(--clay-tint,#F8E6DA);border:1px solid var(--line)}
.al-film .doc .ck{margin-left:auto;color:var(--ok);font-weight:700;opacity:0}.al-film .scene.on .doc .ck{animation:alRow .3s ease forwards}
/* scene 6: Penny */
.al-film .bub{max-width:420px;padding:10px 13px;border-radius:14px;font-size:13px;line-height:1.5;margin:8px 0;opacity:0}
.al-film .bub.q{margin-left:auto;background:var(--head-ink,#3A2C24);color:#FFF7EE;border-bottom-right-radius:4px}
.al-film .bub.a{background:var(--sunk);color:var(--ink);border-bottom-left-radius:4px}
.al-film .scene.on .bub{animation:alRow .5s ease forwards}
.al-film .typing{display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--ink3);margin:0 2px;animation:alDot 1s infinite}
@keyframes alDot{50%{opacity:.2}}
@media (max-width:760px){.al-film .body{grid-template-columns:1fr;height:470px}.al-film .side{display:none}}
@media (prefers-reduced-motion:reduce){.al-film .scene{position:relative;opacity:1;transform:none;border-bottom:1px solid var(--line)}.al-film .body{height:auto}.al-film .stage{overflow:visible}.al-film *{animation:none!important}.al-film tr,.al-film .file,.al-film .card,.al-film .doc,.al-film .bub,.al-film .doc .ck{opacity:1!important;transform:none!important}.al-film .bar i b{width:var(--w)!important}.al-film .prog b{width:100%}.al-film .cap{display:none}}
</style>`);

const NAV = ['Import data', 'Findings', 'Executive dashboard', 'Finding detail', 'Letters and packets', 'Ask Penny'];
const d = (ms) => `animation-delay:${ms}ms`;
const SCENES = [
  { nav: 0, html: `<h4>Drop in your records</h4><div class="sub">Pay stubs, timecards, payroll registers — PDF, Excel, Word, scans. From any system.</div>
    <div class="drop">${[['PDF', 'Pay stubs Jun.pdf', -260, -12], ['XLSX', 'Timecards Q2.xlsx', -90, 8], ['CSV', 'ADP register.csv', 80, -6], ['DOCX', 'Roster.docx', 240, 10]].map(([k, n, fx, fr], i) => `<div class="file" style="--fx:${fx}px;--fr:${fr}deg;left:calc(50% + ${(i - 1.5) * 104 - 46}px);top:84px;${d(i * 220)}"><b>${k}</b>${n}</div>`).join('')}<span style="position:absolute;bottom:14px">Reading 1,248 shifts · 96 pay periods · 58 workers</span></div><div class="prog"><b></b></div>` },
  { nav: 1, html: `<h4>Every shift, tested against California law</h4><div class="sub">Meal and rest periods, overtime and the regular rate, minimum wage by city and industry, rounding, final pay.</div>
    <table><tbody>${[['Jun 2', 'M. Torres', '7:00a – 5:30p', 'Meal began 5h 20m in', 'fl'], ['Jun 2', 'B. Osei', '8:00a – 4:30p', 'Compliant', 'ok'], ['Jun 3', 'K. Brown', '7:00a – 6:30p', 'No second meal (11h)', 'fl'], ['Jun 3', 'L. Park', '9:00a – 3:00p', 'Waiver on file — cleared', 'ok'], ['Jun 4', 'S. Diaz', '9a–1p · 5p–9p', 'Split shift premium', 'fl'], ['Jun 4', 'R. Stone', '8:00a – 4:30p', 'Compliant', 'ok']].map(([a, b, c, e, k], i) => `<tr style="${d(150 + i * 380)}"><td>${a}</td><td>${b}</td><td>${c}</td><td class="${k}">${k === 'ok' ? '✓ ' : '● '}${e}</td></tr>`).join('')}</tbody></table>` },
  { nav: 2, html: `<h4>Exposure, with the math behind it</h4><div class="sub">Owed now, likely exposure, and PAGA — every dollar traced to a formula and the source rows.</div>
    <div class="fkpi"><div><div class="v" data-count="18240">$0</div><div class="k">Owed to workers now</div></div><div><div class="v" data-count="212000">$0</div><div class="k">Likely exposure</div></div><div><div class="v" data-count="58">0</div><div class="k">Workers reviewed</div></div></div>
    ${[['Meal periods', '88%', '$7,412'], ['Overtime & regular rate', '61%', '$5,130'], ['Rest periods', '42%', '$3,540'], ['Minimum wage', '24%', '$2,158']].map(([l, w, v], i) => `<div class="bar"><span>${l}</span><i><b style="--w:${w};${d(200 + i * 200)}"></b></i><span style="text-align:right">${v}</span></div>`).join('')}` },
  { nav: 3, html: `<h4>Every finding, explained</h4><div class="sub">The facts from the record, the rule, the authority, and the calculation — ready for counsel.</div>
    <div class="card"><div class="t">Late meal period — Jun 2, 2026 · M. Torres</div><div class="m">Clocked in 7:00 AM; first meal began 12:20 PM — 5 hours 20 minutes into the shift. The first meal must begin before the end of the fifth hour of work.</div>
    <div class="ledger">1 hour × regular rate $22.00 = <b>$22.00</b> premium</div><span class="chip">Lab. Code §§ 512, 226.7</span><span class="chip">Brinker (2012)</span><span class="chip">Source: timecard row 214</span><span class="chip">High confidence</span></div>` },
  { nav: 4, html: `<h4>Then fix it</h4><div class="sub">Drafted from your data, in your templates or ours — reviewed by counsel, ready to sign.</div>
    ${[['Back-pay letters', '48 workers · English and Spanish'], ['Corrected meal and rest policy', 'Handbook redline with tracked changes'], ['PAGA cure proposal', 'Payments, 7% interest, timeline'], ['Reasonable-steps record', 'Supports the 15% PAGA cap']].map(([t, s], i) => `<div class="doc" style="${d(250 + i * 450)}"><span class="ic"></span><div><b style="font-size:13px;color:var(--head-ink,#3A2C24)">${t}</b><div style="font-size:11.5px;color:var(--ink3)">${s}</div></div><span class="ck" style="${d(650 + i * 450)}">✓ Ready</span></div>`).join('')}` },
  { nav: 5, html: `<h4>Ask Penny anything</h4><div class="sub">An AI assistant grounded in your audit and cited California law.</div>
    <div class="bub q" style="${d(200)}">Which location drives most of our meal exposure?</div>
    <div class="bub a" style="${d(1300)}"><span class="typing"></span><span class="typing" style="animation-delay:.2s"></span><span class="typing" style="animation-delay:.4s"></span></div>
    <div class="bub a" style="${d(2300)}">Oxnard — 2.2× the company rate of late meals, concentrated on Saturday shifts under one supervisor. Fixing the Saturday schedule removes about $4,900 of the $7,412. <span class="chip">Lab. Code § 512</span></div>` }
];
const DUR = 4200;
function film() {
  return `<div class="al-film" role="img" aria-label="Animated walkthrough of Aldune: import records, test every shift, see exposure, open a finding, draft fixes, ask Penny">
    <div class="chrome"><i></i><i></i><i></i><span>app.aldune.com</span></div>
    <div class="body"><div class="side"><div class="lg">${X.logo ? X.logo(20) : ''} Aldune</div>${NAV.map((n, i) => `<div class="it" data-i="${i}"><b></b>${n}</div>`).join('')}</div>
    <div class="stage">${SCENES.map((s, i) => `<div class="scene" data-s="${i}">${s.html}</div>`).join('')}<div class="cap">${SCENES.map((_, i) => `<i data-c="${i}"></i>`).join('')}</div></div></div></div>`;
}
let timer = null;
function play(root) {
  clearTimeout(timer); let k = 0;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const show = () => {
    if (!document.body.contains(root)) return;
    root.querySelectorAll('.scene').forEach((s, i) => { s.classList.toggle('on', i === k); if (i === k) { // restart CSS animations in the scene
      s.querySelectorAll('*').forEach(n => { n.style.animationName = 'none'; void n.offsetWidth; n.style.animationName = ''; }); } });
    root.querySelectorAll('.side .it').forEach((n, i) => n.classList.toggle('on', i === SCENES[k].nav));
    root.querySelectorAll('.cap i').forEach((n, i) => { n.classList.remove('on'); if (i === k) { void n.offsetWidth; n.classList.add('on'); } });
    root.querySelectorAll('.scene.on [data-count]').forEach(n => { const end = +n.dataset.count; const money = n.closest(".fkpi") && !/Workers/.test(n.nextElementSibling?.textContent || ''); const t0 = performance.now(); const step = t => { const p = Math.min(1, (t - t0) / 1400); const v = Math.round(end * (1 - Math.pow(1 - p, 3))); n.textContent = money ? '$' + v.toLocaleString() : v.toLocaleString(); if (p < 1 && document.body.contains(n)) requestAnimationFrame(step); }; requestAnimationFrame(step); });
    k = (k + 1) % SCENES.length; timer = setTimeout(show, DUR);
  };
  if (reduce) { root.querySelectorAll('.scene').forEach(s => s.classList.add('on')); return; }
  show();
}
X.productFilm = { html: film, play };

const base = VIEWS['p-product'];
VIEWS['p-product'] = el => {
  base(el);
  // the long rules table becomes a collapsed reference at the end
  const tblSec = [...el.querySelectorAll('.pub-sec')].find(s => /What Aldune checks/.test(s.querySelector('h2')?.textContent || ''));
  if (tblSec) { const h2 = tblSec.querySelector('h2'); const tw = tblSec.querySelector('.tablewrap'); if (h2 && tw) { const det = document.createElement('details'); det.className = 'law'; det.innerHTML = `<summary><b>Every rule Aldune applies, with its authority and version</b> <span class="small muted">(${Object.keys(PC.RULES).length} rules)</span></summary>`; tw.parentNode.insertBefore(det, tw); det.appendChild(tw); h2.textContent = 'The rules, for counsel'; } }
  const first = el.querySelector('.pub-sec');
  const sec = document.createElement('section'); sec.className = 'pub-sec'; sec.innerHTML = `<div class="pub"><p class="small" style="text-align:center;letter-spacing:.14em;text-transform:uppercase;color:var(--clay-ink,#A9512D);font-weight:600;margin:0 0 14px">Inside Aldune</p>${film()}<p class="small muted" style="text-align:center;margin-top:14px">Illustrative workspace with sample data.</p></div>`;
  if (first) first.parentNode.insertBefore(sec, first); else el.appendChild(sec);
  play(sec.querySelector('.al-film'));
};
})();
