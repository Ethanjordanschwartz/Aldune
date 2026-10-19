# E2E Phases 23–27: classification tool, arbitration analysis, deadline calculator, template library, attorney flags.
import os, zipfile
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); URL = 'file://' + os.path.join(ROOT, 'dist/paycure-standalone.html'); F = os.path.join(ROOT, 'tests/fixtures/')
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1400, 'height': 950}, accept_downloads=True); errs = []
    pg.add_init_script('window.__PAYCURE_TEST__=true'); pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept())
    def dl(sel):
        with pg.expect_download() as d:
            pg.click(sel); pg.wait_for_timeout(150)
            if pg.locator('#facts-modal').count():  # Phase 59: documents ask once for facts they need
                pg.evaluate("document.querySelectorAll('#facts-modal input[data-fact]').forEach(i => { i.value = i.value || (i.type === 'date' ? '2026-09-15' : 'Test value'); })"); pg.click('#facts-modal [data-fx="save"]')
        x = d.value; return x.suggested_filename, os.path.getsize(x.path()), x.path()
    pg.goto(URL + '#/app/classify'); pg.wait_for_timeout(900)
    print('classify default:', pg.inner_text('#views h3 >> nth=-1') if False else ('Likely an employee' in pg.inner_text('#views')))
    for k, v in [('abc.A', '1'), ('abc.B', '1'), ('abc.C', '1')]: pg.select_option(f'[data-tri="{k}"]', v); pg.wait_for_timeout(100)
    for f in ['control', 'regular_business', 'no_distinct_business', 'directed', 'low_skill', 'entity_tools', 'long_term', 'paid_by_time', 'no_profit_loss', 'no_investment', 'belief_employment']: pg.select_option(f'[data-tri="b.{f}"]', '0'); pg.wait_for_timeout(40)
    print('all ABC prongs + no Borello factors → contractor supportable:', 'Contractor status supportable' in pg.inner_text('#views'))
    n, size, path = dl('[data-act="cl-memo"]'); print('memo:', n, size > 3000)
    pg.evaluate("PCX.setView('review')"); pg.wait_for_timeout(300); pg.set_input_files('#rv-file', [F + 'synthetic_arbitration_agreement.txt']); pg.wait_for_timeout(1200)
    t = pg.inner_text('#views'); print('arbitration analysis:', 'Arbitration agreement analysis' in t, '| at risk:', 'enforceability at risk' in t, '| Armendariz cited:', 'Armendariz' in t, '| Adolph routing:', 'Adolph' in t)
    print('replacement agreement:', dl('#views [data-act="tpl2"][data-k="arb"]')[0])
    pg.evaluate("PCX.setView('calendar')"); pg.wait_for_timeout(300); pg.fill('#dl-date', '2026-01-04'); pg.dispatch_event('#dl-date', 'change'); pg.wait_for_timeout(300)
    t = pg.inner_text('#views'); print('deadline calc: cure Feb 6 2026:', 'Feb 6, 2026' in t, '| 65-day waiting:', 'Mar 10, 2026' in t)
    n, size, path = dl('[data-act="dl-ics"]'); ics = open(path).read(); print('deadline ics:', ics.count('BEGIN:VEVENT'))
    pg.evaluate("PCX.setView('home')"); pg.wait_for_timeout(300); pg.click('[data-act="demo"] >> nth=0'); pg.wait_for_selector('text=Likely exposure', timeout=60000); pg.wait_for_timeout(300)
    print('attorney attention flag:', 'Attorney attention' in pg.inner_text('#views'))
    pg.evaluate("PCX.setView('readiness')"); pg.wait_for_timeout(300); print('readiness counts owed workers:', 'of 0 owed' not in pg.inner_text('#views'), '|', [l for l in pg.inner_text('#views').split('\n') if 'owed workers paid' in l][:1])
    pg.evaluate("PCX.setView('documents')"); pg.wait_for_timeout(400)
    for k in ['arb', 'commission', 'piece', 'wtpa_en', 'wtpa_es', 'notice']:
        n, size, path = dl(f'#views [data-act="tpl2"][data-k="{k}"]'); ok = 'word/document.xml' in zipfile.ZipFile(path).namelist(); print(f'  {n}: valid docx {ok}')
    print('ERRORS', errs[:5]); b.close()

# --- day-of-rest positive case, integrity panel, Penny deadline skill in the chat
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1400, 'height': 950}); errs = []
    pg.add_init_script('window.__PAYCURE_TEST__=true'); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL); pg.wait_for_timeout(900)
    pg.evaluate("""(async()=>{ const days=['2026-03-01','2026-03-02','2026-03-03','2026-03-04','2026-03-05','2026-03-06','2026-03-07'];
      const tr=days.map(d=>({employeeId:'E1',date:d,clockIn:480,clockOut:960,meals:[{out:720,in:750}]})); tr.push({...tr[0]});
      await PCX.runPipeline({employerName:'Seven Day Co',hasMealColumns:true,hasRestColumns:false,employees:[{id:'E1',name:'Pat Doe',hourlyRate:20,classification:'nonexempt'}],timeRecords:tr,payroll:[]},'7day','test'); })()""")
    pg.wait_for_timeout(3500); pg.evaluate("PCX.setView('exec')"); pg.wait_for_timeout(400)
    print('day-of-rest flag on 7-day week:', 'Day of rest' in pg.inner_text('#views'), '| duplicate removed:', pg.evaluate('PCS.integrity.removedDuplicates'))
    pg.click('#as-fab'); pg.fill('#as-panel #as-q', 'We got a PAGA notice on January 4, 2026. When is our cure deadline?'); pg.keyboard.press('Enter'); pg.wait_for_timeout(900)
    a = pg.locator('#as-chat .a').last; print('Penny deadline table:', a.locator('table').count() == 1, '| Feb 6:', 'February 6, 2026' in a.inner_text())
    print('ERRORS', errs[:5]); b.close()
