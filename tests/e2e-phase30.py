# E2E Phase 30: attorney-authored custom rules (validate, preview, save in review, verify with attorney name).
import os, json
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); URL = 'file://' + os.path.join(ROOT, 'dist/paycure-standalone.html')
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1400, 'height': 950}); errs = []
    pg.add_init_script('window.__PAYCURE_TEST__=true'); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('dialog', lambda d: d.accept('Jane Doe, SBN 123456') if d.type == 'prompt' else d.accept())
    pg.goto(URL); pg.wait_for_timeout(900); pg.evaluate("PCX.setView('home')"); pg.click('[data-act="demo"] >> nth=0'); pg.wait_for_selector('text=Likely exposure', timeout=60000)
    pg.evaluate("PCX.setView('rules')"); pg.wait_for_timeout(400)
    pg.fill('#cr-src', json.dumps({'id': 'bad', 'title': 'x', 'authority': 'Lab. Code § 512', 'scope': 'shift', 'violation_trigger': 'hours > ('})); pg.click('[data-act="cr-check"]'); pg.wait_for_timeout(200)
    print('invalid rule rejected:', 'Error' in pg.inner_text('#cr-out'))
    rule = {'id': 'long_no_second_meal', 'title': 'Shifts over 10 hours without a second meal', 'authority': 'Lab. Code § 512(a)', 'scope': 'shift', 'violation_trigger': 'hours > 10 AND meals < 2', 'amount': 'rate', 'verification_status': 'attorney_verified'}
    pg.fill('#cr-src', json.dumps(rule)); pg.click('[data-act="cr-check"]'); pg.wait_for_timeout(300); out = pg.inner_text('#cr-out'); print('preview:', out)
    rule['verified_by'] = 'x'; pg.fill('#cr-src', json.dumps(rule)); pg.click('[data-act="cr-save"]'); pg.wait_for_timeout(300)
    print('saved in review (self-verification blocked):', pg.evaluate("PCS.customRules[0].verification_status"))
    pg.click('[data-act="cr-verify"]'); pg.wait_for_timeout(300); print('verified by attorney:', pg.evaluate("PCS.customRules[0].verified_by"), '| badge:', 'verified — Jane Doe' in pg.inner_text('#views'))
    pg.click('[data-act="cr-verify"]'); pg.wait_for_timeout(200); print('returned to review:', pg.evaluate("PCS.customRules[0].verification_status"))
    print('ERRORS', errs[:5]); b.close()
