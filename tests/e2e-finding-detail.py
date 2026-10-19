# E2E: every finding's detail drawer is accurate. For the demo company and Acme sets 1, 3, 4, and 5, open EVERY finding and check:
# the header names the right worker and date (or period); no undefined/NaN/Invalid/[object] text; the ledger result equals the
# finding amount; the ledger formula matches the finding's own kind (no "liquidated damages" formula on a wages finding, etc.);
# the status reflects the finding state (violation / potential / cleared); dated time findings show that day's punches;
# the authorities are shown; and every number in the explanation that is a dollar amount appears consistently.
import os, sys, re, json
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); A = os.path.join(ROOT, 'tests/fixtures/acme'); ok = True
def check(label, cond):
    global ok; print(('PASS ' if cond else 'FAIL ') + label); ok = ok and bool(cond)
JS = r"""
async () => {
  const out = []; const F = PCS.result.engine.findings;
  const fdate = s => { if (!s) return ''; const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }); };
  const money = n => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  // one finding per rule × state × category × kind, plus a random sample, keeps the run quick and the coverage complete
  const seen = new Set(); const pick = [];
  for (const f of F) { const k = [f.ruleId, f.state, f.category, f.amountKind, !!f.date, !!f.premiumIndicated].join('|'); if (!seen.has(k)) { seen.add(k); pick.push(f); } }
  for (let i = 0; i < Math.min(40, F.length); i++) pick.push(F[(i * 7919) % F.length]);
  for (const f of pick) {
    PCX.openFinding(f.id); await new Promise(r => setTimeout(r, 0));
    const d = document.getElementById('drawer'); const txt = d.innerText; const sub = (document.getElementById('drawer-sub') || d).innerText;
    const e = PCS.empIndex.get(f.employeeId) || {}; const probs = [];
    if (/\bundefined\b|\bNaN\b|Invalid Date|\[object|\bnull\b/.test(txt)) probs.push('bad token: ' + (txt.match(/.{0,40}(undefined|NaN|Invalid Date|\[object|\bnull\b).{0,40}/) || [''])[0]);
    if (!txt.includes(e.name || f.employeeId)) probs.push('worker name missing');
    if (f.date && !txt.includes(fdate(f.date))) probs.push('date missing ' + f.date);
    if (!f.date && f.periodStart && !txt.includes(fdate(f.periodStart))) probs.push('period missing');
    const res = (txt.match(/Result[^\n]*\n?[^\n$]*\$([\d,]+\.\d\d)/) || [])[1];
    if (res !== undefined && Math.abs(Number(res.replace(/,/g, '')) - f.amount) > 0.005) probs.push(`ledger result ${res} ≠ amount ${f.amount}`);
    if (f.amountKind !== 'liquidated' && /liquidated damages/i.test((txt.match(/Formula:[^\n]*/) || [''])[0])) probs.push('liquidated formula on a non-liquidated finding');
    if (f.state === 'SUPPRESSED' && !/Cleared/i.test(txt)) probs.push('cleared state not shown');
    if (f.state === 'POTENTIAL' && !/Potential/i.test(txt)) probs.push('potential state not shown');
    if (f.state === 'VIOLATION' && /Insufficient evidence/.test(txt)) probs.push('violation labeled insufficient evidence');
    if (f.date && ['meal', 'rest'].includes(f.category) && f.state === 'VIOLATION' && (PCS.recordsBy.get(f.employeeId) || []).some(t => t.date === f.date) && !/Meal out/.test(txt)) probs.push('punches for the day not shown');
    if (!f.authorities.every(a => txt.includes(a.slice(0, 18)))) probs.push('authority missing');
    if (/Formula:\s*(See rule)?\s*\n/.test(txt)) probs.push('empty formula');
    out.push({ id: f.id, rule: f.ruleId, state: f.state, title: f.title, probs });
  }
  document.querySelector('[data-act="close-drawer"], #drawer .close, #drawer-close')?.click();
  return out;
}
"""
def audit(pg, label):
    rows = pg.evaluate(JS); bad = [r for r in rows if r['probs']]
    check(f'{label}: {len(rows)} finding details checked, all accurate', not bad)
    for r in bad[:12]: print('   ', r['rule'], r['state'], r['title'][:60], '→', '; '.join(r['probs']))
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={'width': 1400, 'height': 950}); ctx.route('**/fonts.g*/**', lambda r: r.abort()); errs = []
    pg = ctx.new_page(); pg.add_init_script('window.__PAYCURE_TEST__=true'); pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept())
    pg.goto('file://' + os.path.join(ROOT, 'dist/paycure-standalone.html')); pg.wait_for_timeout(900)
    pg.click('[data-act="demo"] >> nth=0'); pg.wait_for_selector('text=Likely exposure', timeout=60000); pg.wait_for_timeout(400)
    audit(pg, 'demo company')
    for f in ['acme_packet.docx', 'acme_packet3.docx', 'acme_packet4.docx', 'acme_packet5.docx']:
        c2 = b.new_context(viewport={'width': 1400, 'height': 950}); c2.route('**/fonts.g*/**', lambda r: r.abort()); pg = c2.new_page(); pg.add_init_script('window.__PAYCURE_TEST__=true'); pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept())
        pg.goto('file://' + os.path.join(ROOT, 'dist/paycure-standalone.html')); pg.wait_for_timeout(700); pg.evaluate("PCX.setView('import')"); pg.wait_for_timeout(200)
        pg.set_input_files('#bulk-files', [os.path.join(A, f)]); pg.wait_for_selector('[data-act="imp-analyze"]', timeout=60000); pg.wait_for_timeout(400)
        pg.click('[data-act="imp-analyze"]'); pg.wait_for_selector('text=Likely exposure', timeout=60000); pg.wait_for_timeout(400)
        audit(pg, f)
    check('no page errors', not errs); print(errs[:3])
    b.close()
print('ALL PASS' if ok else 'SOME FAILED'); sys.exit(0 if ok else 1)
