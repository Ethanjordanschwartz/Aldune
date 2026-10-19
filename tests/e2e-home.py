# E2E: homepage v2 — bold hero, motion elements, numbered sections, hover lift, giant footer wordmark, no horizontal scroll.
import os, sys
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); ok = True
def check(label, cond):
    global ok; print(('PASS ' if cond else 'FAIL ') + label); ok = ok and bool(cond)
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={'width': 1400, 'height': 900}); ctx.route('**/fonts.g*/**', lambda r: r.abort()); pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://' + os.path.join(ROOT, 'dist/paycure-standalone.html')); pg.wait_for_timeout(900)
    pg.evaluate("PCX.setView('public')"); pg.wait_for_timeout(500)
    check('hero headline', pg.inner_text('.al-hero h1').startswith('Wage law'))
    check('hero headline is bold (≥ 550)', int(pg.evaluate("getComputedStyle(document.querySelector('.al-hero h1')).fontWeight")) >= 550)
    check('wordmark is bold (≥ 600)', int(pg.evaluate("getComputedStyle(document.querySelector('.pub-top .brand b')).fontWeight")) >= 600)
    check('dunes animate', pg.evaluate("getComputedStyle(document.querySelector('.al-dunes .d1')).animationName") == 'alDrift')
    check('marquee runs', pg.evaluate("getComputedStyle(document.querySelector('.al-track')).animationName") == 'alMarquee')
    w0 = pg.inner_text('.al-rot'); pg.wait_for_timeout(2900); check('rotating word changes', pg.inner_text('.al-rot') != w0)
    check('numbered section kickers', pg.locator('.al-kicker').count() >= 5)
    check('sections use distinct bands', pg.locator('.pub-sec.al-band-sand').count() >= 1 and pg.locator('.pub-sec.al-band-surface').count() >= 1 and pg.locator('.pub-sec.al-band-ink').count() == 0)  # owner: the dark "How it works" band was hard to read
    check('giant translucent wordmark behind footer', pg.locator('footer .al-giant').count() == 1 and float(pg.evaluate("getComputedStyle(document.querySelector('.al-giant')).opacity")) < 0.15)
    btn = pg.locator('.al-hero .btn.primary'); btn.hover(); pg.wait_for_timeout(350)
    check('button grows on hover', 'matrix(1.04' in pg.evaluate("getComputedStyle(document.querySelector('.al-hero .btn.primary')).transform"))
    pg.evaluate("document.querySelector('.al-show .preview').scrollIntoView()"); pg.wait_for_timeout(1800)
    check('live preview animates in', pg.evaluate("document.querySelector('.al-show .preview').classList.contains('in')"))
    check('no horizontal scroll (desktop)', pg.evaluate("document.documentElement.scrollWidth <= innerWidth"))
    for wv in [1440, 1920, 2560]:
        pg.set_viewport_size({'width': wv, 'height': 1000}); pg.wait_for_timeout(250)
        w = pg.evaluate("Math.round(document.querySelector('.al-hero').getBoundingClientRect().width)")
        check(f'homepage spans the full window at {wv}px (hero {w}px)', w >= wv - 20)
        for v in ['p-pricing', 'login']:
            pg.evaluate(f"PCX.setView('{v}')"); pg.wait_for_timeout(200)
            mw = pg.evaluate("Math.round(document.querySelector('main').getBoundingClientRect().width)")
            check(f'{v} spans the full window at {wv}px (main {mw}px)', mw >= wv - 20)
        pg.evaluate("PCX.setView('public')"); pg.wait_for_timeout(250)
    pg.set_viewport_size({'width': 1400, 'height': 900}); pg.wait_for_timeout(200)
    pg.set_viewport_size({'width': 390, 'height': 844}); pg.wait_for_timeout(300)
    check('no horizontal scroll (phone)', pg.evaluate("document.documentElement.scrollWidth <= innerWidth"))
    check('no page errors', not errs); errs and print(errs[:3]); b.close()
print('ALL PASS' if ok else 'SOME FAILED'); sys.exit(0 if ok else 1)
