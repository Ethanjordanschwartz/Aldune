# E2E: "What changes?" on the Import page explains, in plain English, how the chosen industry's rules differ — no raw markup.
import os, sys
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); ok = True
def check(label, cond):
    global ok; print(('PASS ' if cond else 'FAIL ') + label); ok = ok and bool(cond)
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1400, 'height': 950}); pg.add_init_script('window.__PAYCURE_TEST__=true'); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://' + os.path.join(ROOT, 'dist/paycure-standalone.html')); pg.wait_for_timeout(700)
    for ind, expect in [('manufacturing', 'Shift differentials'), ('agriculture', 'seventh-day premium does not apply'), ('household', '9 hours/day or 45/week'), ('motion_picture', 'within 6 hours'), ('healthcare', 'waive one of their two meal periods'), ('general', 'No industry-specific changes')]:
        pg.evaluate("PCX.setView('import')"); pg.wait_for_timeout(200)
        pg.select_option('#im-ind', ind); pg.wait_for_timeout(200)
        pg.click('[data-act="ind-rules"]'); pg.wait_for_timeout(250)
        title = pg.inner_text('#drawer-title'); body = pg.inner_text('#drawer-body')
        check(f'{ind}: title is plain text', '<' not in title and 'what changes' in title)
        check(f'{ind}: explains the difference ("{expect}")', expect in body and 'Standard California rules' in body and '<table' not in body)
        pg.keyboard.press('Escape')
    check('no page errors', not errs); errs and print(errs[:3])
    pg.screenshot(path='/tmp/industry.png'); b.close()
print('ALL PASS' if ok else 'SOME FAILED'); sys.exit(0 if ok else 1)
