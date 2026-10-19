# E2E Phase 29: compliance scorecard, dashboard grade, citation toggle, joint-employer check.
import os
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); URL = 'file://' + os.path.join(ROOT, 'dist/paycure-standalone.html')
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1400, 'height': 950}); errs = []
    pg.add_init_script('window.__PAYCURE_TEST__=true'); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL); pg.wait_for_timeout(900); pg.evaluate("PCX.setView('home')"); pg.click('[data-act="demo"] >> nth=0'); pg.wait_for_selector('text=Likely exposure', timeout=60000); pg.wait_for_timeout(300)
    print('dashboard grade:', 'Compliance grade' in pg.inner_text('#views'))
    pg.click('summary:has-text("Compliance grade")'); pg.wait_for_timeout(200)  # folded under "More detail" since Phase 57
    pg.click('text=see scorecard'); pg.wait_for_timeout(400); t = pg.inner_text('#views'); print('scorecard:', 'Overall compliance grade' in t, '| rows:', pg.locator('#views tbody tr').count())
    cites = pg.locator('#views .cite').count(); vis = pg.evaluate("[...document.querySelectorAll('#views .cite')].filter(e => e.offsetParent).length"); print('citations always shown (toggle removed):', cites > 0 and vis == cites and pg.locator('#cite-toggle').count() == 0)
    pg.evaluate("PCX.setView('classify')"); pg.wait_for_timeout(300); pg.check('[data-je="controlsHours"]'); pg.wait_for_timeout(200)
    print('joint employer:', 'Likely a joint employer' in pg.inner_text('#views'))
    pg.check('[data-je="laborContractor"]'); pg.check('[data-je="usualCourse"]'); pg.check('[data-je="atClientPremises"]'); pg.fill('#je-n', '30'); pg.dispatch_event('#je-n', 'change'); pg.wait_for_timeout(200)
    print('§ 2810.3 note:', '2810.3' in pg.inner_text('#views'))
    print('ERRORS', errs[:5]); b.close()
