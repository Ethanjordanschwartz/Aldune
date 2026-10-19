# E2E Phase 48: perspective changes the dashboard and queue, Penny reports the compliance grade, Home has no troubleshooting, proactive card.
import os, zipfile
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); URL = 'file://' + os.path.join(ROOT, 'dist/paycure-standalone.html')
with sync_playwright() as p:
    b = p.chromium.launch(); errs = []; pg = b.new_page(viewport={'width': 1400, 'height': 950}, accept_downloads=True); pg.add_init_script('window.__PAYCURE_TEST__=true'); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL); pg.wait_for_timeout(900); pg.evaluate("PCX.setView('home')"); pg.click('[data-act="demo"] >> nth=0'); pg.wait_for_selector('text=Likely exposure', timeout=60000)
    pg.evaluate("PCX.setView('exec')"); pg.wait_for_timeout(300); before = pg.inner_text('#views')
    pg.click('[data-act="pov"][data-v="plaintiff"]'); pg.wait_for_timeout(500); after = pg.inner_text('#views')
    print('plaintiff dashboard differs:', before != after, '| case panel:', 'Case view — employee counsel' in after, '| relabeled:', 'Likely recovery' in after and 'Aggrieved employees' in after, '| Build the case:', 'Build the case' in after)
    pg.click('text=Build the case >> nth=0'); pg.wait_for_timeout(400); t = pg.inner_text('#views'); print('case queue:', 'Case queue' in t and 'Request the records' in t)
    with pg.expect_download() as d: pg.click('[data-act="pq-records"]')
    x = zipfile.ZipFile(d.value.path()).read('word/document.xml').decode(); print('records request:', '226(b)' in x and '1198.5' in x)
    pg.click('[data-act="pov"][data-v="defense"]') if pg.locator('[data-act="pov"]').count() else None
    pg.evaluate("PCS.pov='defense'; PCX.setView('exec')"); pg.wait_for_timeout(300); print('defense view restored:', 'Fix what’s owed' in pg.inner_text('#views'))
    pg.click('#as-fab'); pg.wait_for_timeout(300)
    pg.fill('#as-panel #as-q', 'Give me a summary of the audit'); pg.keyboard.press('Enter'); pg.wait_for_timeout(2500)
    ans = pg.inner_text('#as-panel'); pg.keyboard.press('Escape'); print('Penny uses compliance grade:', '82/100' in ans or 'B (82' in ans, '| no 68/100:', '68/100' not in ans)
    pg.evaluate("PCX.setView('home')"); pg.wait_for_timeout(400); t = pg.inner_text('#views'); print('home: no troubleshooting:', 'Troubleshooting' not in t, '| proactive card:', 'Aldune noticed' in t)
    pg.evaluate("PCX.setView('quality')"); pg.wait_for_timeout(300); print('troubleshooting on Data quality:', 'Troubleshooting' in pg.inner_text('#views'))
    print('ERRORS', errs[:5]); b.close()
