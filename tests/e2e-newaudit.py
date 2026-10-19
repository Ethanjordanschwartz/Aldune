# E2E: start fresh — the New audit action clears files, results, and review decisions (and the saved copy), with a clear
# in-app confirmation; the professional shell (dark sidebar with icons, top bar, breadcrumb) renders on every app page.
import os, sys
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); ok = True
def check(label, cond):
    global ok; print(('PASS ' if cond else 'FAIL ') + label); ok = ok and bool(cond)
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={'width': 1400, 'height': 900}); ctx.route('**/fonts.g*/**', lambda r: r.abort()); pg = ctx.new_page(); pg.add_init_script('window.__PAYCURE_TEST__=true'); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://' + os.path.join(ROOT, 'dist/paycure-standalone.html')); pg.wait_for_timeout(900)
    pg.click('[data-act="demo"] >> nth=0'); pg.wait_for_selector('text=Likely exposure', timeout=60000); pg.wait_for_timeout(400)
    for wv in [1440, 1920]:
        pg.set_viewport_size({'width': wv, 'height': 1000}); pg.wait_for_timeout(200)
        mw = pg.evaluate("Math.round(document.querySelector('main').getBoundingClientRect().width)"); rw = pg.evaluate("Math.round(document.querySelector('.rail').getBoundingClientRect().width)")
        check(f'app fills the window at {wv}px (sidebar {rw} + main {mw})', rw == 256 and mw >= wv - 256 - 20)
    pg.set_viewport_size({'width': 1400, 'height': 900}); pg.wait_for_timeout(200)
    check('sidebar has icons on every item', pg.evaluate("[...document.querySelectorAll('.nav button[data-view]')].every(b => b.querySelector('.al-ico'))"))
    check('top bar with breadcrumb', 'Executive dashboard' in pg.inner_text('.al-top .al-crumb'))
    check('top bar shows the loaded audit', 'workers' in pg.inner_text('.al-top .al-status'))
    check('brand tile uses the Aldune mark', pg.locator('.rail .brand .al-tile svg.al-mark').count() == 1)
    pg.evaluate("PCX.setView('import')"); pg.wait_for_timeout(300)
    check('import page explains that an audit is loaded', pg.locator('.al-loaded').count() == 1)
    pg.click('.al-top .al-newbtn'); pg.wait_for_timeout(200)
    check('confirmation dialog explains what clears', pg.locator('#al-new-modal').count() == 1 and 'findings' in pg.inner_text('#al-new-modal'))
    pg.click('#al-new-modal [data-x="cancel"]'); pg.wait_for_timeout(150)
    check('cancel keeps the audit', pg.evaluate("!!PCS.result"))
    pg.click('.al-top [data-act="new-audit"]'); pg.wait_for_timeout(150); pg.click('#al-new-modal [data-x="go"]'); pg.wait_for_timeout(400)
    st = pg.evaluate("({ r: !!PCS.result, i: !!PCS.input, files: Object.keys(PCS.imp.files||{}).length, bulk: (PCS.bulk&&PCS.bulk.items||[]).length, status: Object.keys(PCS.status||{}).length, view: PCS.view })")
    check('cleared: no result, no input, no files', not st['r'] and not st['i'] and st['files'] == 0 and st['bulk'] == 0)
    check('lands on Import to add files', st['view'] == 'import')
    check('top bar says no audit loaded', 'No audit' in pg.inner_text('.al-top .al-status'))
    pg.evaluate("PCX.setView('exec')"); pg.wait_for_timeout(300)
    check('dashboard asks for files instead of showing old numbers', 'Pacific Coast' not in pg.inner_text('#views'))
    pg.reload(); pg.wait_for_timeout(1500)
    check('the cleared audit does not come back after reload', not pg.evaluate("!!PCS.result"))
    check('no page errors', not errs); errs and print(errs[:3])
    pg.screenshot(path='/tmp/newaudit.png'); b.close()
print('ALL PASS' if ok else 'SOME FAILED'); sys.exit(0 if ok else 1)
