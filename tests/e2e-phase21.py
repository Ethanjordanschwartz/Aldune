# E2E Phase 21: old saved answers are marked; Penny answers new law-library topics with citations.
import os
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); URL = 'file://' + os.path.join(ROOT, 'dist/paycure-standalone.html')
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1300, 'height': 900}); errs = []
    pg.add_init_script('window.__PAYCURE_TEST__=true'); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL); pg.wait_for_timeout(1200); pg.evaluate("PCX.setView('home')"); pg.click('#as-fab'); pg.wait_for_timeout(300)
    pg.evaluate("PCS.conv = { id: 'old', title: 'old', messages: [{ role: 'user', content: 'capital of Peru?' }, { role: 'assistant', content: 'I don’t have a cited answer for that in Aldune’s built-in library yet. With Aldune AI turned on (Aldune AI page), I can answer…', citations: [] }] }; PCX.refreshChat()")
    print('old answer marked:', pg.locator('#as-panel .penny-old').count() == 1)
    pg.click('#as-panel .penny-old [data-act="as-new"]'); pg.wait_for_timeout(300); print('new chat cleared:', pg.locator('#as-panel .penny-old').count() == 0)
    for q, want in [('Do our cashiers have to be given a seat?', 'Kilby'), ('How many hours can a 16 year old work on a school day?', '1391'), ('Do we need to give notice before laying off 60 people?', '1400'), ('Can we make employees repay training costs if they quit?', 'AB 692')]:
        pg.fill('#as-panel #as-q', q); pg.keyboard.press('Enter'); pg.wait_for_timeout(700)
        print(f'{q[:48]:50} cites {want}:', want in pg.locator('#as-panel #as-chat').inner_text().split(q)[-1])
    print('ERRORS', errs[:5]); b.close()
