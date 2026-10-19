/* ---------- Calmer executive dashboard: the answer first, everything else one click away.
   Order: setup prompt → title → the four headline numbers → Penny's take → where the exposure comes from.
   Every other panel (coverage, system gaps, grade breakdown, remediation scenarios, AI summary…) is folded into
   a list of one-line sections that open on click. Content is unchanged — only how much is on screen at once. */
(() => {
const X = window.PCX; const { S, esc } = X; const V = X.VIEWS; const prev = V.exec;
S.ui = S.ui || {}; S.ui.execOpen = S.ui.execOpen || {};
const titleOf = n => (n.querySelector('h3, h2, b, strong')?.textContent || n.textContent || '').replace(/\s+/g, ' ').trim().replace(/AI$/, '').slice(0, 70);
const hintOf = n => {
  const t = n.textContent.replace(/\s+/g, ' ');
  let m = t.match(/Compliance grade:? (?:<b>)?([A-F][+-]?\s*\(\d+\/100\)|Incomplete)/) || t.match(/\b([A-F][+-]?) ?(\d+)\/100\b/);
  if (m) return m[2] ? `Grade ${m[1]} (${m[2]}/100)` : `Grade ${m[1]}`;
  if ((m = t.match(/(\d+% coverage)/))) return m[1];
  if ((m = t.match(/(\d+) of (\d+) [A-Za-z-]+ capabilities are missing/))) return `${m[1]} of ${m[2]} missing`;
  const k = n.querySelectorAll('details').length; if (k) return `${k} pattern${k === 1 ? '' : 's'}`;
  return '';
};
V.exec = el => {
  prev(el);
  try {
    const root = el.querySelector('section') || el; if (!root || !S.result) return;
    const kids = [...root.children];
    const head = kids.find(k => k.querySelector('h1')); const kpis = kids.find(k => k.classList.contains('kpis'));
    if (!head || !kpis) return;
    const penny = kids.find(k => /Penny’s take/.test(k.textContent.slice(0, 40)));
    const where = kids.find(k => /Where the exposure comes from/.test(k.textContent.slice(0, 80)));
    const keepTop = new Set([head, kpis, penny, where].filter(Boolean));
    const fold = kids.filter(k => !keepTop.has(k) && !k.classList.contains('alert') && !/not legal advice/i.test(k.textContent) && k.textContent.trim());
    head.after(kpis); if (penny) kpis.after(penny); if (where) (penny || kpis).after(where);
    // the board brief and Risk Explorer are primary actions: keep them on screen
    const act = root.querySelector('[data-act="rpt"][data-r="board"]')?.closest('.row');
    if (act) { act.style.margin = '14px 0 0'; ((where || penny || kpis)).after(act); }
    if (!fold.length) return;
    // a short "Compliance grade" link row belongs with the grade panel that follows it
    const groups = []; for (const k of fold) { if (k.classList.contains('row') && /Compliance grade/.test(k.textContent)) { groups.push([k]); continue; } const last = groups[groups.length - 1]; if (last && last.length === 1 && last[0].classList.contains('row') && /Compliance grade/.test(last[0].textContent)) last.push(k); else groups.push([k]); }
    const box = document.createElement('div'); box.className = 'panel calm-more'; box.style.marginTop = '16px';
    box.innerHTML = `<div class="row" style="justify-content:space-between;align-items:baseline"><h3 style="margin:0">More detail</h3><span class="small muted">Click a section to open it</span></div>`;
    for (const g of groups) {
      const main = g[g.length - 1]; const title = titleOf(main); const key = title.slice(0, 40);
      const d = document.createElement('details'); d.className = 'calm-sec'; if (S.ui.execOpen[key]) d.open = true;
      const hint = (g.length > 1 && hintOf(g[0])) || hintOf(main);
      d.innerHTML = `<summary><span>${esc(title)}</span>${hint ? `<span class="small muted">${esc(hint)}</span>` : ''}</summary>`;
      const body = document.createElement('div'); body.className = 'calm-body'; g.forEach(n => { n.style.margin = '8px 0 0'; body.appendChild(n); }); d.appendChild(body);
      d.addEventListener('toggle', () => { S.ui.execOpen[key] = d.open; });
      box.appendChild(d);
    }
    const foot = [...root.children].find(k => /not legal advice/i.test(k.textContent) && !k.querySelector('h1'));
    if (foot) root.insertBefore(box, foot); else root.appendChild(box);
  } catch (e) { /* layout is cosmetic: never break the dashboard */ }
};
const css = document.createElement('style');
css.textContent = `.calm-sec{border-top:1px solid var(--line,#e6dfd6)}.calm-sec:first-of-type{margin-top:10px}.calm-sec>summary{list-style:none;cursor:pointer;display:flex;justify-content:space-between;gap:12px;align-items:center;padding:12px 4px;font-weight:600}.calm-sec>summary::-webkit-details-marker{display:none}.calm-sec>summary::after{content:'▸';color:var(--muted,#8a7f73);margin-left:8px;transition:transform .15s}.calm-sec[open]>summary::after{transform:rotate(90deg)}.calm-sec>summary span.small{font-weight:400;margin-left:auto}.calm-sec>summary:hover{color:var(--ledger)}.calm-body{padding:0 0 14px}.calm-body>.panel{box-shadow:none}.more-menu{position:relative;display:inline-block}.more-menu>summary{list-style:none;padding-left:12px;padding-right:12px}.more-menu>summary::-webkit-details-marker{display:none}.more-pop{position:absolute;right:0;top:calc(100% + 6px);z-index:20;background:var(--surface,#fff);border:1px solid var(--line,#e6dfd6);border-radius:12px;padding:8px;display:flex;flex-direction:column;gap:6px;min-width:190px;box-shadow:0 12px 30px -12px rgba(42,32,25,.35)}.more-pop .btn{justify-content:flex-start;text-align:left}`;
document.head.appendChild(css);
})();
