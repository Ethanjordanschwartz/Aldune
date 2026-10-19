# E2E Phase 18: decluttered Import, Penny (branding, drafts → Word), explain-every-number panels.
import os, zipfile
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); URL = 'file://' + os.path.join(ROOT, 'dist/paycure-standalone.html')
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1400, 'height': 950}, accept_downloads=True); errs = []
    pg.add_init_script('window.__PAYCURE_TEST__=true'); pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept())
    pg.goto(URL + '#/app/import'); pg.wait_for_timeout(900)
    words = len(pg.evaluate("(()=>{const c=document.querySelector('#views').cloneNode(true);c.querySelectorAll('option').forEach(o=>o.remove());return c.innerText})()").split()); print('import page words:', words)
    pg.screenshot(path='/tmp/p18_import.png')
    print('Penny branding:', 'Penny' in pg.inner_text('#as-fab'), '| nav:', pg.locator('#nav button[data-view="ask"]').inner_text())
    pg.click('#as-fab'); pg.fill('#as-panel #as-q', 'Draft a meal and rest period policy'); pg.keyboard.press('Enter'); pg.wait_for_timeout(800)
    print('draft block:', pg.locator('#as-panel .penny-draft').count() > 0)
    with pg.expect_download() as d: pg.click('#as-panel [data-act="penny-word"] >> nth=-1')
    x = zipfile.ZipFile(d.value.path()).read('word/document.xml').decode(); print('Word draft:', d.value.suggested_filename, '| has 226.7:', '226.7' in x)
    pg.fill('#as-panel #as-q', 'Write an email to managers about scheduling breaks'); pg.keyboard.press('Enter'); pg.wait_for_timeout(800); print('generic draft:', pg.locator('#as-panel .penny-draft').count() >= 2)
    pg.evaluate("document.getElementById('as-panel').classList.remove('open')")
    pg.evaluate("PCX.setView('home')"); pg.wait_for_timeout(300); pg.click('[data-act="demo"] >> nth=0'); pg.wait_for_selector('text=Likely exposure', timeout=60000); pg.wait_for_timeout(300)
    n = pg.locator('#views .kpi-why').count(); print('ⓘ on dashboard KPIs:', n)
    pg.click('#views .kpi-why >> nth=0'); pg.wait_for_timeout(300); d = pg.inner_text('#drawer')
    neutral = pg.evaluate("PCX.PC.runScenario(PCS.input, PCS.result, {...PCX.PC.DEFAULT_SCENARIO, ...PCX.PC.PERSPECTIVES.neutral}).total")
    print('explainer:', 'What it is' in d and 'How it’s calculated' in d and 'Where it comes from' in d, '| neutral total matches:', f"${neutral:,.0f}" in d.replace('.00', ''))
    pg.keyboard.press('Escape'); pg.evaluate("PCX.setView('backpay')"); pg.wait_for_timeout(300); pg.click('#views .kpi-why >> nth=0'); pg.wait_for_timeout(300); print('back pay explainer:', 'Back pay owed' in pg.inner_text('#drawer'))
    print('ERRORS', errs[:5]); b.close()
