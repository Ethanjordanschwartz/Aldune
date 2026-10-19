# E2E Phase 39: prevention (pre-payroll, schedule), capability card, living handbook, onboarding packet, pricing.
import os
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); URL = 'file://' + os.path.join(ROOT, 'dist/paycure-standalone.html'); F = os.path.join(ROOT, 'tests/fixtures/messy/')
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1400, 'height': 950}, accept_downloads=True); errs = []
    pg.add_init_script('window.__PAYCURE_TEST__=true'); pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept())
    pg.goto(URL); pg.wait_for_timeout(900); pg.evaluate("PCX.setView('home')"); pg.click('[data-act="demo"] >> nth=0'); pg.wait_for_selector('text=Likely exposure', timeout=60000); pg.wait_for_timeout(300)
    print('capability card:', 'What your systems can’t do yet' in pg.inner_text('#views'))
    csv = pg.evaluate("""(()=>{const p=PCS.input.payroll; const s=p[0].periodStart; const rows=p.filter(x=>x.periodStart===s).slice(0,60); return 'Employee ID,Period Start,Period End,Pay Date,Regular Hours,Rate,Overtime Hours\\n'+rows.map(r=>[r.employeeId,r.periodStart,r.periodEnd,r.payDate||r.periodEnd,(r.regHours+r.otHours+r.dtHours).toFixed(2),r.regRate||20,0].join(',')).join('\\n')})()""")
    open('/tmp/draft.csv', 'w').write(csv)
    pg.evaluate("PCX.setView('prevent')"); pg.wait_for_timeout(300); pg.set_input_files('#pv-pay', '/tmp/draft.csv'); pg.wait_for_timeout(4000)
    t = pg.inner_text('#views'); print('pre-payroll blocks OT-stripped draft:', 'Hold this run' in t)
    with pg.expect_download() as d: pg.click('[data-act="pv-csv"]')
    print('corrections CSV:', d.value.suggested_filename)
    pg.set_input_files('#pv-sched', F + 'square_timecards.csv'); pg.wait_for_timeout(1500); print('schedule issues listed:', 'must fix' in pg.inner_text('#views'))
    pg.evaluate("PCX.setView('handbook2')"); pg.wait_for_timeout(300)
    with pg.expect_download() as d: pg.click('[data-act="hb2-issue"]')
    print('handbook issued:', d.value.suggested_filename); pg.wait_for_timeout(300)
    pg.locator('[data-ack]').first.check(); pg.wait_for_timeout(200); print('ack counted:', '1 / ' in pg.inner_text('#views'))
    with pg.expect_download() as d: pg.click('[data-act="hb2-gap"]')
    print('gap report:', d.value.suggested_filename)
    with pg.expect_download() as d: pg.click('[data-act="onboard-packet"]')
    print('onboarding packet:', d.value.suggested_filename, os.path.getsize(d.value.path()) > 8000)
    pg = b.new_page(viewport={'width': 1300, 'height': 900}); pg.goto(URL + '#/pricing'); pg.wait_for_timeout(1500); print('pricing lists prevention:', 'Prevention suite' in pg.inner_text('body'), '| brand Aldune:', 'Aldune' in pg.inner_text('body') and 'Paycure' not in pg.inner_text('body'))
    print('ERRORS', errs[:5]); b.close()
