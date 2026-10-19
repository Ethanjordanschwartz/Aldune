# E2E Phase 17: litigation workspace, POS page, broader assistant, legacy .doc reading.
import os, zipfile
from playwright.sync_api import sync_playwright

def _facts(pg):
    pg.wait_for_timeout(150)
    if pg.locator('#facts-modal').count():  # Phase 59: documents ask once for the facts they need
        pg.evaluate("document.querySelectorAll('#facts-modal input[data-fact]').forEach(i => { i.value = i.value || (i.type === 'date' ? '2026-09-15' : i.type === 'number' ? '5000' : 'Test value'); })"); pg.click('#facts-modal [data-fx="save"]')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); URL = 'file://' + os.path.join(ROOT, 'dist/paycure-standalone.html'); F = os.path.join(ROOT, 'tests/fixtures/')
DOC = '/mnt/user-data/uploads/Meal_Break_Waiver.doc'
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1400, 'height': 950}, accept_downloads=True); errs = []
    pg.add_init_script('window.__PAYCURE_TEST__=true'); pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept())
    pg.goto(URL + '#/app/litigation'); pg.wait_for_timeout(900)
    pg.set_input_files('#lit-files', [F + 'synthetic_mediation_brief.txt', F + 'synthetic_settlement_agreement.txt']); pg.wait_for_timeout(1200)
    print('facts filled:', pg.input_value('[data-lf="caption"]'), '|', pg.input_value('[data-lf="caseNumber"]'), '|', pg.input_value('[data-lf="plaintiffs"]'))
    v = pg.inner_text('#views'); print('damages table + range:', 'Theoretical max' in v and 'Expected settlement range' in v, '| settlement issue flagged:', 'Form 1099 as a penalty' in v)
    def dl(sel):
        with pg.expect_download() as d: pg.click(sel); _facts(pg)
        return d.value
    x = dl('[data-act="lit-doc"][data-k="brief"]'); xml = zipfile.ZipFile(x.path()).read('word/document.xml').decode(); print('defense brief:', x.suggested_filename, '| Kullar:', 'Kullar' in xml, '| Duran:', 'Duran' in xml, '| caption:', 'Lopez and Reyes v. Harbor Grill' in xml)
    print('PAGA response:', dl('[data-act="lit-doc"][data-k="response"]').suggested_filename, '| term sheet:', dl('[data-act="lit-doc"][data-k="term"]').suggested_filename, '| workbook:', dl('[data-act="lit-xlsx"]').suggested_filename)
    pg.click('[data-act="lit-side"][data-s="plaintiff"]'); pg.wait_for_timeout(200)
    x = dl('[data-act="lit-doc"][data-k="brief"]'); xml = zipfile.ZipFile(x.path()).read('word/document.xml').decode(); print('plaintiff brief has Donohue presumption + Adolph:', 'presumption' in xml and 'Adolph' in xml)
    print('demand letter:', dl('[data-act="lit-doc"][data-k="demand"]').suggested_filename, '| PAGA notice:', dl('[data-act="lit-doc"][data-k="notice"]').suggested_filename)
    # with audit data
    pg.evaluate("PCX.setView('home')"); pg.wait_for_timeout(300); pg.click('[data-act="demo"] >> nth=0'); pg.wait_for_selector('text=Likely exposure', timeout=60000)
    pg.evaluate("PCS.lit.inputs=null; PCX.setView('litigation')"); pg.wait_for_timeout(400); print('litigation uses audit:', 'Using your audit data' in pg.inner_text('#views'), '| class size from audit:', pg.input_value('[data-li="classSize"]'))
    # POS
    pg.evaluate("PCX.setView('pos')"); pg.wait_for_timeout(300); pg.select_option('#pos-sys', '7shifts'); pg.wait_for_timeout(200)
    t = pg.inner_text('#views'); print('POS: 7shifts documented:', 'Labor Exceptions Report' in t, '| checklist:', 'honest “No” option' in t)
    print('POS memo:', dl('[data-act="pos-memo"]').suggested_filename)
    # assistant never dead-ends
    pg.click('#as-fab'); pg.fill('#as-panel #as-q', 'How do I file a patent in Germany?'); pg.keyboard.press('Enter'); pg.wait_for_timeout(800)
    a = pg.inner_text('#as-panel'); print('assistant no refusal:', "won’t guess" not in a and "isn’t covered" not in a)
    pg.fill('#as-panel #as-q', 'How do we calculate a starting demand for a wage and hour class action?'); pg.keyboard.press('Enter'); pg.wait_for_timeout(800); print('assistant answers demand method:', 'Kullar' in pg.inner_text('#as-panel'))
    pg.evaluate("document.getElementById('as-panel').classList.remove('open')")
    if os.path.exists(DOC):
        pg.evaluate("PCX.setView('review')"); pg.wait_for_timeout(300); pg.set_input_files('#rv-file', [DOC]); pg.wait_for_timeout(1200); print('legacy .doc read:', 'MEAL PERIOD' in pg.inner_text('#views').upper())
    print('ERRORS', errs[:5]); b.close()
