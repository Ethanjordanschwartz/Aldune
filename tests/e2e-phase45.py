# E2E Phase 45: owner login, privileged mode + watermarking, monthly monitoring, law update packs, M&A sizer, settlement strategy, methodology, pricing add-ons.
import os, zipfile, json
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); URL = 'file://' + os.path.join(ROOT, 'dist/paycure-standalone.html')
def docx_text(path): return zipfile.ZipFile(path).read('word/document.xml').decode()
with sync_playwright() as p:
    b = p.chromium.launch(); errs = []
    if os.environ.get('OWNER_PW'):  # owner password is never stored in files — pass it via the environment
        ctx = b.new_context(); pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(URL + '#/login'); pg.wait_for_timeout(1200); pg.fill('#li-email', 'demo@aldune.dev'); pg.fill('#li-pw', os.environ['OWNER_PW']); pg.click('[data-act="do-login"]'); pg.wait_for_timeout(2500)
        print('owner login:', pg.evaluate('PCS.isOwner'), pg.evaluate('PCS.view')); ctx.close()
    else: print('owner login: skipped (set OWNER_PW to test)')
    pg = b.new_page(viewport={'width': 1400, 'height': 950}, accept_downloads=True); pg.add_init_script('window.__PAYCURE_TEST__=true'); pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept())
    def dl(sel):
        with pg.expect_download() as d: pg.click(sel)
        return d.value.suggested_filename, d.value.path()
    pg.goto(URL); pg.wait_for_timeout(900); pg.evaluate("PCX.setView('home')"); pg.click('[data-act="demo"] >> nth=0'); pg.wait_for_selector('text=Likely exposure', timeout=60000)
    pg.evaluate("PCX.setView('privilege')"); pg.wait_for_timeout(300); pg.click('[data-act="priv-mode"][data-m="privileged"]'); pg.wait_for_timeout(200)
    pg.fill('[data-pc="name"]', 'A. Lawyer'); pg.dispatch_event('[data-pc="name"]', 'change'); pg.fill('[data-pc="firm"]', 'Firm LLP'); pg.dispatch_event('[data-pc="firm"]', 'change'); pg.wait_for_timeout(200)
    print('privileged banner:', 'Privileged audit' in pg.inner_text('#views'))
    n, path = dl('[data-act="priv-letter"]'); print('engagement letter:', n, 'Kovel' in docx_text(path))
    pg.evaluate("PCX.setView('reports')"); pg.wait_for_timeout(400); n, path = dl('[data-act="method-doc"]'); t = docx_text(path)
    print('methodology:', n, '| watermarked:', 'PRIVILEGED' in t, '| fingerprint:', pg.evaluate('PCS.result.engine.meta.inputHash') in t)
    pg.evaluate("PCX.setView('readiness')"); pg.wait_for_timeout(400); n, path = dl('[data-act="rd-plan"]'); t = docx_text(path); print('corrective plan:', n, '| NOT PRIVILEGED label:', 'NOT PRIVILEGED' in t)
    pg.evaluate("PCX.setView('monitor')"); pg.wait_for_timeout(400); print('monitoring add-on panel:', 'Monthly real-time monitoring' in pg.inner_text('#views'))
    before = pg.evaluate('(PCS.snapshots||[]).length'); pg.click('[data-act="mon-run"]'); pg.wait_for_timeout(1200); print('monthly run saved:', pg.evaluate('(PCS.snapshots||[]).length') == before + 1)
    pack = {'version': 'test.1', 'published': '2026-10-06', 'items': [{'kind': 'state_min_wage', 'effective': '2025-01-01', 'rate': 22.0, 'source': 'test', 'verification_status': 'attorney_verified', 'verified_by': 'Test Attorney'}]}
    open('/tmp/pack.json', 'w').write(json.dumps(pack)); exp0 = pg.evaluate('PCS.result.exposure.base')
    pg.evaluate("PCS.isOwner = true; PCX.setView('rules')"); pg.wait_for_timeout(400); pg.set_input_files('#law-pack', '/tmp/pack.json'); pg.wait_for_timeout(6000)
    print('law pack applied + re-run:', pg.evaluate('PCX.PC.appliedPacks().length') == 1, '| exposure changed:', pg.evaluate('PCS.result.exposure.base') != exp0)
    pg.evaluate("PCX.setView('diligence')"); pg.wait_for_timeout(500); t = pg.inner_text('#views'); print('M&A sizer:', 'Successor liability and deal protections' in t, '| escrow:', 'Escrow / holdback' in t)
    n, path = dl('[data-act="ma-memo"]'); print('M&A memo:', n, '§ 200.3' in docx_text(path))
    pg.evaluate("PCX.setView('litigation')"); pg.wait_for_timeout(500); t = pg.inner_text('#views'); print('strategy matrix:', 'pick-off and pick-up-sticks' in t, '| PAGA buy-out does not work:', 'does not work' in t)
    for k in ['memo', '998', 'ene', 'standing']:
        n, path = dl(f'[data-act="st-doc"][data-k="{k}"]'); print('  strategy doc:', n)
    pg2 = b.new_page(viewport={'width': 1300, 'height': 900}); pg2.goto(URL + '#/pricing'); pg2.wait_for_timeout(1500); t = pg2.inner_text('body'); print('pricing add-ons:', 'Monthly Real-Time Compliance Monitoring' in t, '| tiers:', 'Fully managed' in t)
    print('ERRORS', errs[:5]); b.close()
