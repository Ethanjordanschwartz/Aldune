# E2E Phase 16: single progress bar, industries, coverage/recordkeeping, handbook redline, chat attachments, unified Home, binder, separation agreement.
import os, zipfile, io
from playwright.sync_api import sync_playwright

def _facts(pg):
    pg.wait_for_timeout(150)
    if pg.locator('#facts-modal').count():  # Phase 59: documents ask once for the facts they need
        pg.evaluate("document.querySelectorAll('#facts-modal input[data-fact]').forEach(i => { i.value = i.value || (i.type === 'date' ? '2026-09-15' : i.type === 'number' ? '5000' : 'Test value'); })"); pg.click('#facts-modal [data-fx="save"]')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); URL = 'file://' + os.path.join(ROOT, 'dist/paycure-standalone.html'); F = os.path.join(ROOT, 'tests/fixtures/')
B = os.path.join(F, 'bulk'); stubs = sorted(os.path.join(B, f) for f in os.listdir(B) if f.startswith('paystub'))[:40]
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1400, 'height': 950}, accept_downloads=True); errs = []
    pg.add_init_script('window.__PAYCURE_TEST__=true'); pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept())
    pg.goto(URL); pg.wait_for_timeout(800); pg.evaluate("PCX.setView('home')"); pg.wait_for_timeout(300)
    print('nav has no separate Start here:', pg.locator('#nav button[data-view="guide"]').count() == 0, '| home has calendar:', 'Compliance calendar' in pg.inner_text('#views'))
    pg.evaluate("PCX.setView('import')"); pg.wait_for_timeout(300)
    pg.evaluate("window.__maxBars=0; new MutationObserver(()=>{window.__maxBars=Math.max(window.__maxBars, document.querySelectorAll('#bulk-bar').length)}).observe(document.body,{subtree:true,childList:true})")
    for chunk in [stubs[:15], stubs[15:30], stubs[30:]]: pg.set_input_files('[data-slotfiles="payroll"]', chunk); pg.wait_for_timeout(2500)
    print('max progress bars on screen at once:', pg.evaluate('window.__maxBars'), '| left behind:', pg.evaluate("document.querySelectorAll('#bulk-bar').length"))
    print('industry options:', pg.locator('#im-ind option').count())
    pg.evaluate("PCX.processFiles && (PCS.bulk={items:[],docs:[],running:false}); PCS.imp.files={}; PCX.render()"); pg.wait_for_timeout(200)
    pg.set_input_files('[data-slotfiles="employees"]', [F + 'pos_employees.csv']); pg.wait_for_timeout(800); pg.set_input_files('[data-slotfiles="time"]', [F + 'pos_timepunches.csv']); pg.wait_for_timeout(800)
    pg.select_option('#im-ind', 'motion_picture'); pg.wait_for_timeout(200)
    pg.click('[data-act="imp-analyze"]'); pg.wait_for_selector('text=Likely exposure', timeout=60000); pg.wait_for_timeout(400)
    v = pg.inner_text('#views'); print('industry panel:', 'Industry rules applied: Motion picture' in v, '| coverage says meal not tested:', 'Meal periods' in v and 'meal punches' in v)
    print('recordkeeping findings:', pg.evaluate("PCS.result.engine.findings.filter(f=>f.category==='recordkeeping').length"))
    # handbook review
    pg.evaluate("PCX.setView('review')"); pg.set_input_files('#rv-file', [F + 'bad_handbook.txt']); pg.wait_for_timeout(800)
    rv = pg.inner_text('#views'); print('policy review shown:', 'required change' in rv)
    with pg.expect_download() as dl: pg.click('[data-act="hb-redline"] >> nth=0'); _facts(pg)
    data = open(dl.value.path(), 'rb').read(); xml = zipfile.ZipFile(io.BytesIO(data)).read('word/document.xml').decode()
    print('redline has tracked changes:', '<w:del ' in xml and '<w:ins ' in xml, '| file:', dl.value.suggested_filename)
    with pg.expect_download() as dl: pg.click('[data-act="hb-clean"] >> nth=0'); _facts(pg)
    print('revised handbook:', dl.value.suggested_filename)
    # chat attachments
    pg.click('#as-fab'); pg.wait_for_timeout(200); pg.set_input_files('#as-panel #as-file', [F + 'bad_handbook.txt']); pg.wait_for_timeout(1500)
    ch = pg.inner_text('#as-panel'); print('chat reviewed handbook:', 'reviewed as a' in ch, '| redline button in chat:', pg.locator('#as-panel [data-act="hb-redline"]').count() > 0)
    pg.set_input_files('#as-panel #as-file', stubs[:12]); pg.wait_for_timeout(5000)
    ch = pg.inner_text('#as-panel'); print('chat analyzed data:', 'I analyzed' in ch, '| findings mentioned:', 'findings' in ch)
    pg.evaluate("document.getElementById('as-panel').classList.remove('open')")
    # binder + separation agreement
    pg.evaluate("PCX.setView('reports')"); pg.wait_for_timeout(300)
    with pg.expect_download() as dl: pg.click('[data-act="binder"]'); _facts(pg)
    z = zipfile.ZipFile(dl.value.path()); print('binder files:', sorted(z.namelist()))
    pg.evaluate("PCX.setView('documents')"); pg.wait_for_timeout(300)
    with pg.expect_download() as dl: pg.click('[data-act="sep-agree"][data-age="40"]'); _facts(pg)
    sx = zipfile.ZipFile(dl.value.path()).read('word/document.xml').decode(); print('separation 40+ has OWBPA + carve-out:', 'Age Discrimination in Employment Act' in sx and 'unlawful acts in the workplace' in sx)
    pg.evaluate("PCX.setView('home')"); pg.wait_for_timeout(300); print('home shows audit snapshot:', 'Data coverage' in pg.inner_text('#views'))
    print('ERRORS', errs[:5]); b.close()
