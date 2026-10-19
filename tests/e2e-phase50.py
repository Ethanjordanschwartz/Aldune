# E2E Phase 50: logout hides the app (even for owners), plaintiff view changes the numbers, no privilege banner.
import os
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); URL = 'file://' + os.path.join(ROOT, 'dist/paycure-standalone.html')
with sync_playwright() as p:
    b = p.chromium.launch(); errs = []
    if os.environ.get('OWNER_PW'):
        ctx = b.new_context(); pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(URL + '#/login'); pg.wait_for_timeout(1200); pg.fill('#li-email', 'demo@aldune.dev'); pg.fill('#li-pw', os.environ['OWNER_PW']); pg.click('[data-act="do-login"]'); pg.wait_for_timeout(2500)
        print('signed in, rail visible:', pg.is_visible('.rail'))
        pg.evaluate("PCX.setView('account')"); pg.wait_for_timeout(300); pg.click('[data-act="logout"] >> nth=0'); pg.wait_for_timeout(800)
        print('after logout: view', pg.evaluate('PCS.view'), '| rail hidden:', not pg.is_visible('.rail'))
        pg.evaluate("PCX.setView('findings')"); pg.wait_for_timeout(300); print('app gated after logout:', pg.evaluate('PCS.view') == 'public')
        pg.reload(); pg.wait_for_timeout(2000); print('still signed out after reload:', not pg.is_visible('.rail'))
        ctx.close()
    else: print('owner logout: skipped (set OWNER_PW)')
    # logout for any signed-in session: simulate an owner flag then log out
    pg = b.new_page(viewport={'width': 1400, 'height': 950}); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL); pg.wait_for_timeout(1200); pg.evaluate("PCS.isOwner = true; PCX.setView('home')"); pg.wait_for_timeout(400); print('owner flag → app shown:', pg.is_visible('.rail'))
    pg.evaluate("PCX.setView('account')"); pg.wait_for_timeout(300); pg.click('[data-act="logout"] >> nth=0'); pg.wait_for_timeout(600)
    print('owner logs out → rail hidden:', not pg.is_visible('.rail'), '| view:', pg.evaluate('PCS.view'))
    pg.evaluate("PCS.isOwner = true; PCX.setView('findings')"); pg.wait_for_timeout(300); print('platform owner flag cannot bypass sign-out:', pg.evaluate('PCS.view') == 'public'); pg.close()
    pg = b.new_page(viewport={'width': 1400, 'height': 950}); pg.add_init_script('window.__PAYCURE_TEST__=true'); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL); pg.wait_for_timeout(900); pg.evaluate("PCX.setView('home')"); pg.click('[data-act="demo"] >> nth=0'); pg.wait_for_selector('text=Likely exposure', timeout=60000)
    pg.evaluate("PCX.setView('exec')"); pg.wait_for_timeout(300); dv = pg.evaluate("[...document.querySelectorAll('#views .kpi .v')].map(v=>v.textContent)")
    pg.click('[data-act="pov"][data-v="plaintiff"]'); pg.wait_for_timeout(500); pv = pg.evaluate("[...document.querySelectorAll('#views .kpi .v')].map(v=>v.textContent)")
    print('defense KPIs:', dv[:3], '\nplaintiff KPIs:', pv[:3], '\nnumbers differ:', dv[:3] != pv[:3])
    pg.evaluate("PCS.priv.mode='privileged'; PCX.setView('exec')"); pg.wait_for_timeout(300); print('no privilege banner:', pg.locator('#priv-bar').count() == 0)
    print('ERRORS', errs[:5]); b.close()
