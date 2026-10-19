# E2E Phase 19: H-2A option, Penny's take, draft revisions, reference-document drafting.
import os
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); URL = 'file://' + os.path.join(ROOT, 'dist/paycure-standalone.html'); F = os.path.join(ROOT, 'tests/fixtures/')
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1400, 'height': 950}, accept_downloads=True); errs = []
    pg.add_init_script('window.__PAYCURE_TEST__=true'); pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept())
    pg.goto(URL + '#/app/import'); pg.wait_for_timeout(900); pg.select_option('#im-ind', 'agriculture'); pg.wait_for_timeout(200); print('H-2A option:', pg.locator('#im-h2a').count() == 1)
    pg.evaluate("PCX.setView('home')"); pg.wait_for_timeout(300); pg.click('[data-act="demo"] >> nth=0'); pg.wait_for_selector('text=Likely exposure', timeout=60000); pg.wait_for_timeout(300)
    t = pg.inner_text('#views'); print('Penny’s take:', 'Penny’s take' in t, '| follow-ups:', pg.locator('[data-act="penny-ask"]').count())
    pg.click('#as-fab'); ask = lambda q: (pg.fill('#as-panel #as-q', q), pg.keyboard.press('Enter'), pg.wait_for_timeout(700))
    last = lambda: pg.locator('#as-panel .penny-draft').last.inner_text()
    ask('Draft a meal and rest period policy'); base = last()
    ask('add a lactation section'); a = last(); print('add section:', 'Lactation' in a and len(a) > len(base))
    ask('remove the lactation section'); r = last(); print('remove section:', 'Lactation' not in r)
    ask('make it shorter'); sh = last(); print('shorter:', len(sh) < len(r))
    ask('the company name is Harbor Grill, Inc.'); print('company name inserted:', 'Harbor Grill, Inc.' in last() or 'Inserted' in pg.inner_text('#as-panel'))
    pg.set_input_files('#as-panel #as-file', [F + 'bad_handbook.txt']); pg.wait_for_timeout(1500)
    ask('revise this to comply with California law'); rv = last(); print('revised from reference:', 'never forfeited' in rv and 'use-it-or-lose-it' not in rv)
    print('ERRORS', errs[:5]); b.close()
