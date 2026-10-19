# E2E: multi-page public site, navigation from every pre-login page, back/forward, deep links, free tools, founder access.
import os
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); URL = 'file://' + os.path.join(ROOT, 'dist/paycure-standalone.html')
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1300, 'height': 900}); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept())
    pg.goto(URL); pg.wait_for_timeout(800)
    view = lambda: pg.evaluate('PCS.view')
    nav = lambda label: pg.click(f'.pub-top .pubnav button:has-text("{label}")')
    for label, v in [('Product', 'p-product'), ('Solutions', 'p-solutions'), ('Pricing', 'p-pricing'), ('Free tools', 'p-resources'), ('About', 'p-about')]:
        nav(label); pg.wait_for_timeout(150); print(f'{label:10} → {view():12} {pg.evaluate("location.hash")}', 'OK' if view() == v else 'FAIL')
    pg.go_back(); pg.wait_for_timeout(200); print('back →', view()); pg.go_forward(); pg.wait_for_timeout(200); print('forward →', view())
    pg.click('.pub-top .brand'); pg.wait_for_timeout(150); print('logo → home:', view() == 'public')
    pg.click('.pub-top [data-to="signup"]'); pg.wait_for_timeout(150)
    for label in ['Pricing', 'About']: nav(label); pg.wait_for_timeout(150); print(f'from signup, {label} →', view())
    pg.click('.pub-top .brand'); pg.wait_for_timeout(150); print('from about, logo →', view())
    # start an account (unpaid) then navigate freely
    pg.click('.pub-top [data-to="signup"]'); pg.fill('#su-name', 'Pat Lee'); pg.fill('#su-email', 'pat@acme.com'); pg.fill('#su-co', 'Acme'); pg.fill('#su-pw', 'AcmeCompany2026'); pg.check('#su-terms'); pg.click('[data-act="do-signup"]'); pg.wait_for_timeout(1200)
    print('after signup:', view(), '| topbar shows Finish setup:', 'Finish setup' in pg.inner_text('.pub-top'))
    nav('Pricing'); pg.wait_for_timeout(150); print('unpaid user can browse Pricing:', view()); pg.click('.pub-top .brand'); pg.wait_for_timeout(150); print('and Home:', view())
    pg.evaluate("location.hash='#/app/findings'"); pg.wait_for_timeout(300); print('unpaid deep link to app is gated →', view())
    # tools
    pg.evaluate("location.hash='#/resources/paga-deadlines'"); pg.wait_for_timeout(300); pg.fill('#t-date', '2026-09-02'); pg.fill('#t-emp', '60'); pg.click('#tool-go'); t = pg.inner_text('#tool-out'); print('deadlines tool:', 'October 5, 2026' in t and 'November 6, 2026' in t)
    pg.evaluate("location.hash='#/resources/minimum-wage'"); pg.wait_for_timeout(300); pg.select_option('#t-city', label='West Hollywood'); pg.fill('#t-d', '2026-08-01'); pg.click('#tool-go'); print('min wage tool:', pg.inner_text('#tool-out').split('\n')[0])
    pg.evaluate("location.hash='#/resources/shift-checker'"); pg.wait_for_timeout(300); pg.click('#tool-go'); print('shift tool:', pg.inner_text('#tool-out').split('\n')[0])
    pg.evaluate("location.hash='#/resources/paga-estimate'"); pg.wait_for_timeout(300); pg.select_option('#t-cap', '0.15'); pg.click('#tool-go'); print('PAGA estimate has cap row:', '15% cap' in pg.inner_text('#tool-out'))
    pg.evaluate("location.hash='#/resources/law'"); pg.wait_for_timeout(300); pg.fill('#pl-q', 'heat'); pg.wait_for_timeout(200); print('public law search:', 'cool-down' in pg.inner_text('#pl-list'))
    print('pricing compare table:', '1,000' in pg.evaluate("(PCX.setView('p-pricing'), document.querySelector('#views').innerText)"))
    # founder
    pg.evaluate("sessionStorage.clear(); PCS.account=null; PCX.persist(); PCX.setView('signup')"); pg.wait_for_timeout(200)
    pg.fill('#su-name', 'Demo Reviewer'); pg.fill('#su-email', 'Demo@Aldune.dev'); pg.fill('#su-co', 'Aldune'); pg.fill('#su-pw', 'SignupTest2026!'); pg.check('#su-terms'); pg.click('[data-act="do-signup"]'); pg.wait_for_timeout(1300)
    print('founder skips payment → in app:', pg.is_visible('.rail'), view(), '| founder badge:', 'Founder' in pg.inner_text('.rail'))
    pg.evaluate("location.hash='#/app/backpay'"); pg.wait_for_timeout(300); print('founder deep link:', view())
    for i in range(3): pg.evaluate("PCX.setView('home')"); pg.wait_for_timeout(200); pg.evaluate("document.querySelector('[data-act=\"demo\"]') ? document.querySelector('[data-act=\"demo\"]').click() : PCX.loadDemo && PCX.loadDemo()"); pg.wait_for_timeout(2500)
    print('founder never hits plan limits:', not pg.evaluate("(()=>{const d=document.getElementById('drawer');return !!(d&&d.classList.contains('open')&&/Plan limit/.test(d.innerText))})()"))
    pg.click('.rail [data-act="show-public"]'); pg.wait_for_timeout(200); print('founder → public site:', view(), '| topbar Open the app:', 'Open the app' in pg.inner_text('.pub-top'))
    pg.click('.pub-top [data-to="home"]'); pg.wait_for_timeout(200); print('back into app:', view(), pg.is_visible('.rail'))
    pg.set_viewport_size({'width': 390, 'height': 800}); pg.evaluate("PCX.setView('public')"); pg.wait_for_timeout(200); pg.click('[data-act="pub-menu"]'); pg.wait_for_timeout(100); print('mobile menu opens:', pg.is_visible('.pubnav'))
    print('ERRORS', errs[:5]); b.close()
