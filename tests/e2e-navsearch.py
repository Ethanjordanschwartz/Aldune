# E2E (Phase 73): "Go to…" in the sidebar finds pages — typed names, partial words, and everyday terms bring the page to the top;
# arrows + Enter open it; Esc clears; the rest of the menu returns. Also checks the sidebar colors and the single Log out link.
import os
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); ok = True
def check(label, cond):
    global ok; print(('PASS ' if cond else 'FAIL ') + label); ok = ok and bool(cond)
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={'width': 1400, 'height': 900}); ctx.route('**/fonts.g*/**', lambda r: r.abort()); errs = []
    pg = ctx.new_page(); pg.add_init_script('window.__PAYCURE_TEST__=true'); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://' + os.path.join(ROOT, 'dist/paycure-standalone.html')); pg.wait_for_timeout(900)
    pg.click('[data-act="demo"] >> nth=0'); pg.wait_for_selector('text=Likely exposure', timeout=60000); pg.wait_for_timeout(400)
    top = lambda: pg.evaluate("(document.querySelector('#navq-results button span')||{}).textContent || null")
    def typed(q): pg.fill('#nav-q', ''); pg.type('#nav-q', q); pg.wait_for_timeout(150); return top()
    for q, want in [('Litigation', 'Litigation'), ('litig', 'Litigation'), ('LIT', 'Litigation'), ('lawsuit', 'Litigation'), ('back pay', 'Back-pay planner'), ('backpay', 'Back-pay planner'),
                    ('findings', 'Findings'), ('fin', 'Findings'), ('pay eq', 'Pay equity'), ('scorecard', 'Compliance scorecard'), ('calendar', 'Compliance calendar'), ('kovel', 'Privileged audits'),
                    ('arbitration', 'Review documents'), ('dlse', 'Agency & records requests'), ('m&a', 'M&A due diligence'), ('penny', 'Penny AI'), ('settle', 'Settlement valuation'), ('wtpa', 'Notices & postings')]:
        got = typed(q); check(f'"{q}" → {want} on top (got {got})', got == want)
    typed('litig'); check('menu steps aside while searching', pg.evaluate("[...document.querySelectorAll('#nav > button[data-view]')].filter(b => b.offsetParent).length") == 0)
    pg.keyboard.press('Enter'); pg.wait_for_timeout(400)
    check('Enter opens the top match and clears the box', pg.evaluate('PCS.view') == 'litigation' and pg.input_value('#nav-q') == '')
    check('menu is back after opening', pg.evaluate("[...document.querySelectorAll('#nav > button[data-view]')].filter(b => b.offsetParent).length") >= 40)
    typed('pa'); first = top(); pg.keyboard.press('ArrowDown'); pg.wait_for_timeout(100); second = pg.evaluate("document.querySelector('#navq-results button.on span').textContent")
    pg.keyboard.press('Enter'); pg.wait_for_timeout(300); check(f'↓ then Enter opens the second match ({second})', second != first and pg.inner_text('#views h1') != '')
    typed('xyzq'); check('no match → a clear message', 'No page matches' in pg.inner_text('#nav'))
    pg.keyboard.press('Escape'); pg.wait_for_timeout(100); check('Esc clears the search', pg.input_value('#nav-q') == '' and pg.evaluate("[...document.querySelectorAll('#nav > button[data-view]')].filter(b => b.offsetParent).length") >= 40)
    typed('compl'); pg.click('#navq-results button >> nth=0'); pg.wait_for_timeout(300); check('clicking a result opens it', pg.evaluate('PCS.view') in ('scorecard', 'calendar'))
    w = pg.evaluate("[document.getElementById('nav-q').getBoundingClientRect().right, document.querySelector('.rail').getBoundingClientRect().right]")
    check(f'search box fits inside the sidebar {w}', w[0] <= w[1])
    c = pg.evaluate("[getComputedStyle(document.querySelector('.rail')).backgroundImage, getComputedStyle(document.querySelector('#nav > button[data-view]')).color]")
    check(f'sidebar is the light brown panel with near-black text {c}', '230, 214, 198' in c[0] and c[1] == 'rgb(34, 26, 21)')
    check('one Log out link in the sidebar footer', pg.locator('.rail .foot [data-act="logout"]').count() == 1)
    check('no page errors', not errs); print(errs[:3])
    b.close()
print('ALL PASS' if ok else 'SOME FAILED')
