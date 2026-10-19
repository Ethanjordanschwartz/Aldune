# E2E Phase 49: agency & records requests (deadlines, records packet with Bates log, letter, .ics) and the automatic audit brief.
import os, shutil, zipfile
import openpyxl
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); URL = 'file://' + os.path.join(ROOT, 'dist/paycure-standalone.html')
with sync_playwright() as p:
    b = p.chromium.launch(); errs = []; pg = b.new_page(viewport={'width': 1400, 'height': 950}, accept_downloads=True); pg.add_init_script('window.__PAYCURE_TEST__=true'); pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept())
    pg.goto(URL); pg.wait_for_timeout(900); pg.evaluate("PCX.setView('home')"); pg.click('[data-act="demo"] >> nth=0'); pg.wait_for_selector('text=Likely exposure', timeout=60000)
    t = pg.inner_text('#views'); print('audit brief shown:', 'Your audit, in 30 seconds' in t)
    pg.click('summary:has-text("Your audit, in 30 seconds")'); pg.wait_for_timeout(200)  # folded under "More detail" since Phase 57
    pg.click('[data-act="brief-hide"]'); pg.wait_for_timeout(300); print('brief hides:', 'Your audit, in 30 seconds' not in pg.inner_text('#views'))
    pg.reload(); pg.wait_for_function('window.PCS && PCS.result', timeout=90000); pg.evaluate("PCX.setView('exec')"); pg.wait_for_timeout(400)  # audit restores automatically
    print('stays hidden after reload (same data):', pg.evaluate('!!PCS.result') and 'Your audit, in 30 seconds' not in pg.inner_text('#views'))
    pg.evaluate("PCX.setView('agency')"); pg.wait_for_timeout(400)
    emp = pg.evaluate("PCS.input.employees.find(e => PCS.input.timeRecords.some(t => t.employeeId === e.id) && PCS.input.payroll.some(x => x.employeeId === e.id)).id")
    pg.select_option('#ag-type', 'records_226'); pg.fill('#ag-date', '2026-10-01'); pg.select_option('#ag-emp', emp); pg.click('[data-act="ag-add"]'); pg.wait_for_timeout(400)
    t = pg.inner_text('#views'); print('§ 226 deadline 2026-10-22:', '2026-10-22' in t)
    def dl(sel):
        with pg.expect_download() as d: pg.click(sel)
        fn = '/tmp/' + d.value.suggested_filename; shutil.copy(d.value.path(), fn); return fn
    fn = dl('[data-act="ag-packet"]'); wb = openpyxl.load_workbook(fn); sheets = {s.title: s.max_row for s in wb.worksheets}
    nt = pg.evaluate(f"PCS.input.timeRecords.filter(t => t.employeeId === '{emp}').length"); npy = pg.evaluate(f"PCS.input.payroll.filter(x => x.employeeId === '{emp}').length")
    print('packet sheets:', list(sheets), '| time rows match:', sheets['Time records'] - 1 == nt, '| payroll rows match:', sheets['Payroll'] - 1 == npy, '| bates:', str(wb['Time records']['A2'].value).startswith('SPN-'))
    fn = dl('[data-act="ag-letter"]'); x = zipfile.ZipFile(fn).read('word/document.xml').decode(); print('cover letter:', 'reserves all objections' in x and '226' in x)
    fn = dl('[data-act="ag-ics"]'); print('calendar file:', 'BEGIN:VEVENT' in open(fn).read())
    pg.select_option('#ag-type', 'bofe_citation'); pg.fill('#ag-date', '2026-11-02'); pg.select_option('#ag-emp', ''); pg.click('[data-act="ag-add"]'); pg.wait_for_timeout(400)
    print('BOFE 15 business days (2026-11-24):', '2026-11-24' in pg.inner_text('#views'), '| matters:', pg.evaluate('PCS.matters.length'))
    print('ERRORS', errs[:5]); b.close()
