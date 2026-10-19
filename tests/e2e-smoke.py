# Smoke test: every sidebar view and every public page renders without errors, blanks, or "undefined"/"NaN" text.
import os, re
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); URL = 'file://' + os.path.join(ROOT, 'dist/paycure-standalone.html')
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1400, 'height': 950}); errs = []
    pg.add_init_script('window.__PAYCURE_TEST__=true'); pg.on('pageerror', lambda e: errs.append(f'{pg.evaluate("PCS.view")}: {e}')); pg.on('dialog', lambda d: d.accept())
    pg.goto(URL); pg.wait_for_timeout(800); pg.evaluate("PCX.setView('home')"); pg.wait_for_timeout(300)
    pg.click('[data-act="demo"] >> nth=0'); pg.wait_for_selector('text=Likely exposure', timeout=60000)
    views = pg.evaluate("[...document.querySelectorAll('#nav button[data-view]')].map(b=>b.dataset.view)")
    bad = []
    for v in views:
        pg.evaluate(f"PCX.setView('{v}')"); pg.wait_for_timeout(350)
        t = pg.inner_text('#views'); words = len(t.split())
        issues = [x for x in ['undefined', 'NaN', '[object Object]', 'Something went wrong'] if re.search(r'\b' + re.escape(x) + r'\b', t)]
        if words < 15 or issues: bad.append((v, words, issues))
    print(f'{len(views)} app views checked; problems:', bad or 'none')
    pubs = ['public', 'p-product', 'p-solutions', 'p-pricing', 'p-resources', 'p-about', 'p-security', 'p-contact', 'p-law', 'tool-deadlines', 'tool-minwage', 'tool-shift', 'tool-paga']
    pb = []
    for v in pubs:
        pg.evaluate(f"PCX.setView('{v}')"); pg.wait_for_timeout(250); t = pg.inner_text('#views')
        if len(t.split()) < 40 or re.search(r'\b(undefined|NaN)\b', t): pb.append(v)
    print(f'{len(pubs)} public pages checked; problems:', pb or 'none')
    print('ERRORS', errs[:8]); b.close()
