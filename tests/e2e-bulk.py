# E2E: bulk upload of 260 PDFs (files), a ZIP, and mixed files → mapping → validation → audit.
import os, time
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); B = os.path.join(ROOT, 'tests/fixtures/bulk'); F = os.path.join(ROOT, 'tests/fixtures')
pdfs = sorted(os.path.join(B, f) for f in os.listdir(B) if f.endswith('.pdf'))
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1400, 'height': 950}); pg.add_init_script('window.__PAYCURE_TEST__=true'); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept())
    pg.goto('file://' + os.path.join(ROOT, 'dist/paycure-standalone.html')); pg.wait_for_timeout(700)
    pg.evaluate("PCX.setView('import')")
    t0 = time.time(); pg.set_input_files('#bulk-files', pdfs); pg.wait_for_function("document.querySelectorAll('.slotzone .chip.ok').length >= 3", timeout=180000)
    print(f'260 PDFs read in {time.time()-t0:.1f}s')
    cards = {d: pg.inner_text(f'[data-slot="{d}"]').split('\n')[2] for d in ['employees', 'time', 'payroll']}; print('sections:', cards)
    print('226 check shown:', 'Pay stub check' in pg.inner_text('#views'))
    print('sections filled:', cards['payroll'].startswith('160'), cards['time'].startswith('800'), cards['employees'].startswith('20'))
    pg.screenshot(path='/tmp/p12_bulk.png')
    pg.fill('#im-name', 'Valley Fresh Packing, Inc.')
    pg.click('[data-act="imp-analyze"]'); pg.wait_for_selector('text=Likely exposure', timeout=60000)
    print('audit ran:', pg.inner_text('#c-f'), 'findings')
    pg.evaluate("PCX.setView('findings')"); pg.wait_for_timeout(300); cats = pg.inner_text('#views'); print('wage statement + meal findings:', 'Wage statement' in cats or 'wage statement' in cats.lower(), 'meal' in cats.lower())
    # ZIP + mixed batch in a fresh page
    pg.goto('file://' + os.path.join(ROOT, 'dist/paycure-standalone.html')); pg.wait_for_timeout(600); pg.evaluate("PCX.setView('import')")
    open('/tmp/bad.exe', 'wb').write(b'MZ')
    pg.set_input_files('#bulk-files', [os.path.join(F, 'bulk.zip'), os.path.join(ROOT, 'sample-data/payroll_register.csv'), os.path.join(F, 'paga_notice.txt'), os.path.join(F, 'Arbitration_Agreement.docx'), '/tmp/bad.exe'])
    pg.wait_for_function("document.querySelectorAll('.slotzone .chip.ok').length >= 3", timeout=180000)
    print('zip+mixed:', pg.evaluate("(()=>{const c={};PCS.bulk.items.forEach(i=>{const k=i.status==='error'?'error':i.kind;c[k]=(c[k]||0)+1});return JSON.stringify(c)})()"))
    pg.click('[data-act="slot-view"][data-ds=""]'); pg.wait_for_timeout(200); print('unsupported reported:', 'Unsupported file type' in pg.inner_text('#views'))
    print('ERRORS', errs[:5]); b.close()
