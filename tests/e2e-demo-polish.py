# E2E (Phase 70): demo is presentation-ready — always the light theme (even with an old stored dark choice or a dark host), no
# setup nudge in the demo, Portfolio/Monitoring/Pay equity have content, Litigation sample papers show live deadlines, and every
# page in the sidebar opens with no errors and no undefined/NaN.
import os, re
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); ok = True
def check(label, cond):
    global ok; print(('PASS ' if cond else 'FAIL ') + label); ok = ok and bool(cond)
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={'width': 1400, 'height': 900}, color_scheme='dark'); ctx.route('**/fonts.g*/**', lambda r: r.abort()); errs = []
    pg = ctx.new_page(); pg.add_init_script('window.__PAYCURE_TEST__=true')
    pg.add_init_script("try{localStorage.setItem('paycure:theme','dark');localStorage.setItem('aldune:theme','dark')}catch(e){}; document.addEventListener('DOMContentLoaded',()=>document.documentElement.setAttribute('data-theme','dark'))")
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://' + os.path.join(ROOT, 'dist/paycure-standalone.html')); pg.wait_for_timeout(900)
    pg.click('[data-act="demo"] >> nth=0'); pg.wait_for_selector('text=Likely exposure', timeout=60000); pg.wait_for_timeout(500)
    th = pg.evaluate("[document.documentElement.dataset.theme, getComputedStyle(document.querySelector('.rail')).backgroundImage, getComputedStyle(document.body).backgroundColor]")
    check(f'light theme despite stored dark + dark host {th[0]}', th[0] == 'light' and '230, 214, 198' in th[1])
    check('no theme switch visible', not pg.locator('#theme-btn').is_visible())
    check('no "Next step: set up your company" nudge in the demo', 'Next step:' not in pg.inner_text('#views'))
    pg.evaluate("PCX.setView('portfolio')"); pg.wait_for_timeout(500); t = pg.inner_text('#views')
    check('portfolio shows the demo company and labeled samples', 'Pacific Coast Fresh' in t and '(sample)' in t and '2 audits' in t)
    pg.evaluate("PCX.setView('monitor')"); pg.wait_for_timeout(500); t = pg.inner_text('#views')
    check('monitoring compares the demo company with its own prior month', 'Latest run: Monthly re-audit' in t and '▼' in t)
    pg.evaluate("PCX.setView('payequity')"); pg.wait_for_timeout(500); t = pg.inner_text('#views')
    check('pay equity has rows in the demo', 'Job titles reviewed' in t and 'Male' in t)
    pg.evaluate("PCX.setView('litigation')"); pg.wait_for_timeout(400); pg.click('[data-act="lit-sample"]'); pg.wait_for_selector('#lit-analysis', timeout=20000); pg.wait_for_timeout(500)
    A = pg.evaluate("PCS.lit.analysis")
    check('sample case papers → analysis with an upcoming deadline and the plaintiff matched', A['headline']['nextDeadline'] is not None and A['standing'][0]['matched'] == 'Maria Sanchez')
    views = list(dict.fromkeys(pg.evaluate("[...document.querySelectorAll('.rail [data-view]:not([hidden])')].map(b => b.dataset.view)")))
    bad = []
    for v in views:
        n = len(errs); pg.evaluate(f"PCX.setView({v!r})"); pg.wait_for_timeout(350); t = pg.inner_text('#views')
        if re.search(r'\bundefined\b|\bNaN\b|\[object Object\]|Invalid Date', t) or len(errs) > n or len(t) < 80: bad.append(v)
    check(f'all {len(views)} sidebar pages open cleanly {bad}', not bad)
    pg.goto('file://' + os.path.join(ROOT, 'dist/paycure-standalone.html')); pg.wait_for_timeout(900)
    pg.evaluate("PCX.newAudit && PCX.newAudit()"); pg.wait_for_timeout(300)
    check('no page errors', not errs); print(errs[:3])
    b.close()
print('ALL PASS' if ok else 'SOME FAILED')
