# E2E Phase 46: multi-W-2 files, incomplete-audit honesty, one grade, fix queue (pre-filled), 7% back pay, perspective, privilege question, motion homepage.
import os, zipfile, csv, shutil
import openpyxl
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); URL = 'file://' + os.path.join(ROOT, 'dist/paycure-standalone.html'); W = os.path.join(ROOT, 'tests/fixtures/messy/w2/')
with sync_playwright() as p:
    b = p.chromium.launch(); errs = []
    def page():
        pg = b.new_page(viewport={'width': 1400, 'height': 950}, accept_downloads=True); pg.add_init_script('window.__PAYCURE_TEST__=true'); pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept()); return pg
    for f in ['w2_batch_2025.pdf', 'w2_register_2025.csv']:
        pg = page(); pg.goto(URL + '#/app/import'); pg.wait_for_timeout(900); pg.set_input_files('[data-slotfiles="employees"]', [W + f]); pg.wait_for_timeout(3500)
        t = pg.inner_text('#views'); print(f, '→ W-2s read:', '40 W-2s' in t)
        btn = pg.locator('[data-act="imp-analyze"]')
        if btn.count() and btn.is_enabled(): btn.click(); pg.wait_for_timeout(5000)
        print('   workers:', pg.evaluate('PCS.input ? PCS.input.employees.length : 0'), '| view:', pg.evaluate('PCS.view'))
        pg.evaluate("PCX.setView('exec')"); pg.wait_for_timeout(400); t = pg.inner_text('#views')
        print('   incomplete banner:', 'Incomplete audit' in t, '| exposure not assessed:', 'Not assessed' in t, '| no A 100:', 'A (100/100)' not in t)
        pg.evaluate("PCX.setView('scorecard')"); pg.wait_for_timeout(300); print('   scorecard grade:', pg.evaluate("PCX.PC.scorecard(PCS.input, PCS.result).grade")); pg.close()
    pg = page(); pg.goto(URL); pg.wait_for_timeout(900); pg.evaluate("PCX.setView('home')"); pg.click('[data-act="demo"] >> nth=0'); pg.wait_for_selector('text=Likely exposure', timeout=60000)
    pg.evaluate("PCX.setView('monitor')"); pg.wait_for_timeout(300); pg.locator('text=Save current audit as a run').first.click() if pg.locator('text=Save current audit as a run').count() else None; pg.wait_for_timeout(800)
    t = pg.inner_text('#views'); print('demo: one grade (no risk score shown):', 'Risk score' not in t)
    pg.evaluate("PCX.setView('exec')"); pg.wait_for_timeout(300); pg.click('text=Fix what’s owed'); pg.wait_for_timeout(500); print('Fix what’s owed → view:', pg.evaluate('PCS.view'))
    t = pg.inner_text('#views'); print('queue steps:', t.count('Step '), '| pay step:', 'Pay ' in t)
    def dl(sel):
        with pg.expect_download() as d: pg.click(sel)
        x = d.value; fn = '/tmp/' + x.suggested_filename; shutil.copy(x.path(), fn); return fn
    fn = dl('[data-act="fq-payroll"]'); rows = list(csv.reader(open(fn))); print('payroll CSV rows:', len(rows) - 1, '| names filled:', all(r[1] for r in rows[1:]), '| amounts:', all(float(r[4]) > 0 for r in rows[1:]))
    fn = dl('[data-act="fq-workbook"]'); wb = openpyxl.load_workbook(fn); print('workbook:', [(s.title, s.max_row) for s in wb.worksheets])
    pg.evaluate("PCS.readiness.noticeDate='2026-09-20'; PCX.render()"); pg.wait_for_timeout(300)
    fn = dl('[data-act="fq-cure"]'); x = zipfile.ZipFile(fn).read('word/document.xml').decode(); print('cure proposal: Exhibit A rows:', x.count('Former') + x.count('Current') > 50, '| 7%:', '7%' in x, '| verification:', '2015.5' in x)
    fn = dl('[data-act="fq-all"]'); print('fix-all package downloaded')
    pg.evaluate("PCX.setView('solutions')"); pg.wait_for_timeout(400); fn = dl('[data-act="bp-cure"]'); print('Back pay at 7% →', os.path.basename(fn), '| then view:', pg.evaluate('PCS.view'))
    pg.evaluate("PCX.setView('solutions')"); pg.wait_for_timeout(300); pg.click('[data-act="pov"][data-v="plaintiff"]'); pg.wait_for_timeout(400); t = pg.inner_text('#views'); print('plaintiff view: case builder:', 'Case builder' in t, '| demand:', 'Opening demand' in t, '| lit side:', pg.evaluate('PCS.lit.side'))
    pg.click('[data-act="pov"][data-v="defense"]'); pg.wait_for_timeout(200)
    pg.evaluate("PCX.setView('privilege')"); pg.wait_for_timeout(300); t = pg.inner_text('#views'); print('privilege question:', 'Is your attorney directing this audit?' in t, '| no banner on this page:', pg.locator('#priv-bar').count() == 0)
    print('citation toggle gone:', pg.locator('#cite-toggle').count() == 0, '| setup banner w/o agriculture:', 'agricultural' not in pg.inner_text('body').lower()); pg.close()
    pg = b.new_page(viewport={'width': 1300, 'height': 900}); pg.goto(URL); pg.wait_for_timeout(1500); print('homepage motion:', pg.locator('.sp-stream').count() == 1, pg.locator('.sp-orb').count() == 2, '| logo v3:', pg.locator('.sp-mark[data-v="3"]').count() >= 1)
    pg.screenshot(path='/tmp/home46.png'); pg.close()
    print('ERRORS', errs[:5]); b.close()
