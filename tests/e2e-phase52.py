# E2E Phase 52: the audit survives reloads (demo and uploaded), returns to the same page, respects direct links.
import os
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); URL = 'file://' + os.path.join(ROOT, 'dist/paycure-standalone.html')
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(); pg = ctx.new_page(); errs = []; pg.add_init_script('window.__PAYCURE_TEST__=true'); pg.on('pageerror', lambda e: errs.append(str(e)[:150]))
    pg.goto(URL); pg.wait_for_timeout(900); pg.evaluate("PCX.setView('home')"); pg.click('[data-act="demo"] >> nth=0'); pg.wait_for_selector('text=Likely exposure', timeout=60000)
    exp = pg.evaluate('PCS.result.exposure.base'); pg.evaluate("PCX.setView('solutions')"); pg.wait_for_timeout(1200)
    pg.reload(); pg.wait_for_function('window.PCS && PCS.result', timeout=90000); pg.wait_for_timeout(500)
    print('demo restored, same numbers:', pg.evaluate('PCS.result.exposure.base') == exp, '| same page:', pg.evaluate('PCS.view') == 'solutions')
    pg.goto(URL + '#/app/import'); pg.wait_for_function('window.PCS && PCS.result', timeout=90000); pg.wait_for_timeout(800); print('direct link respected:', pg.evaluate('PCS.view') == 'import')
    pg.set_input_files('[data-slotfiles="time"]', [os.path.join(ROOT, 'tests/fixtures/messy/kronos_punches.csv')]); pg.wait_for_timeout(2000); pg.click('[data-act="imp-analyze"]'); pg.wait_for_timeout(4500)
    n = pg.evaluate('PCS.input.timeRecords.length'); pg.reload(); pg.wait_for_function('window.PCS && PCS.result && PCS.input.timeRecords.length < 1000', timeout=90000)
    print('uploaded audit restored:', pg.evaluate('PCS.input.timeRecords.length') == n)
    print('ERRORS', errs[:3]); b.close()
