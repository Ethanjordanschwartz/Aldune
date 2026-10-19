# E2E: public homepage → gate → sign up → plan/payment → app → log out / log in → connections → actionable guide.
import os
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); URL = 'file://' + os.path.join(ROOT, 'dist/paycure-standalone.html')
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={'width': 1400, 'height': 950}); pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept())
    pg.goto(URL); pg.wait_for_timeout(800)
    t = pg.inner_text('#views'); print('homepage:', 'Messy payroll data in' in t, '| stats:', '10,098' in t, '| pricing:', 'Professional' in t, '| rail hidden:', not pg.is_visible('.rail'))
    pg.screenshot(path='/tmp/p14_home.png')
    pg.evaluate("PCX.setView('findings')"); pg.wait_for_timeout(200); print('gate blocks app:', pg.evaluate('PCS.view') == 'public' and 'Messy payroll data in' in pg.inner_text('#views') and not pg.is_visible('.rail'))
    pg.click('[data-act="choose-plan"][data-plan="professional"]'); pg.wait_for_timeout(200)
    pg.fill('#su-name', 'Dana Rivera'); pg.fill('#su-email', 'dana@valleyfresh.com'); pg.fill('#su-co', 'Valley Fresh Packing, Inc.'); pg.fill('#su-emp', '220'); pg.fill('#su-pw', 'short'); pg.check('#su-terms')
    pg.click('[data-act="do-signup"]'); print('weak password rejected:', 'Password needs' in pg.inner_text('#toast'))
    pg.fill('#su-pw', 'ValleyFresh2026'); pg.click('[data-act="do-signup"]'); pg.wait_for_timeout(1200)
    print('checkout shown:', 'Choose your plan' in pg.inner_text('#views'))
    pg.click('[data-act="request-access"][data-plan="professional"]'); pg.wait_for_timeout(200); print('pending screen:', 'activating your account' in pg.inner_text('#views'))
    pg.evaluate("PCX.setView('exec')"); pg.wait_for_timeout(200); print('still gated while pending:', 'activating your account' in pg.inner_text('#views'))
    # owner configures checkout links → customer pays
    pg.evaluate("PCS.cfg.links={professional_monthly:'https://buy.stripe.com/test_123'}; PCX.setView('checkout')"); pg.wait_for_timeout(200)
    with ctx.expect_page() as newp: pg.click('[data-act="pay-open"][data-plan="professional"]')
    stripe = newp.value; print('stripe link opened:', 'buy.stripe.com/test_123' in stripe.url and 'client_reference_id=PC-' in stripe.url); stripe.close()
    pg.click('[data-act="paid-confirm"]'); pg.wait_for_timeout(300); print('in the app after payment:', pg.is_visible('.rail'), '| landed on:', pg.evaluate('PCS.view'))
    pg.click('[data-act="logout"] >> nth=0'); pg.wait_for_timeout(200); print('logged out → public:', pg.evaluate('PCS.view') == 'public' and not pg.is_visible('.rail'))
    pg.evaluate("PCX.setView('login')"); pg.fill('#li-pw', 'wrongpassword1'); pg.click('[data-act="do-login"]'); pg.wait_for_timeout(1000); print('bad password rejected:', 'incorrect' in pg.inner_text('#toast'))
    pg.fill('#li-pw', 'ValleyFresh2026'); pg.click('[data-act="do-login"]'); pg.wait_for_timeout(1200); print('logged in:', pg.is_visible('.rail'), pg.evaluate('PCS.view'))
    pg.evaluate("PCX.setView('account')"); pg.wait_for_timeout(200); print('account page:', 'dana@valleyfresh.com' in pg.inner_text('#views'))
    pg.evaluate("PCX.setView('connect')"); pg.wait_for_timeout(200); c = pg.inner_text('#views'); print('connections:', 'ADP Workforce Now' in c, 'mutual-TLS' in c)
    pg.evaluate("PCX.setView('guide')"); pg.wait_for_timeout(200)
    pg.click('[data-act="go"][data-to="backpay"] >> nth=0'); pg.wait_for_timeout(200); print('guide role button navigates:', pg.evaluate('PCS.view'))
    pg.evaluate("PCX.setView('quality')"); pg.wait_for_timeout(200); pg.evaluate("PCX.setView('import')"); pg.wait_for_timeout(200); print('troubleshooting on Import:', 'Having trouble with a file?' in pg.inner_text('#views')); print('troubleshooting button → import:', pg.evaluate('PCS.view'))
    print('ERRORS', errs[:5]); b.close()
