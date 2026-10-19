# E2E Phase 20: Penny AI status in every environment (simulated platform capability), notices checklist, case timeline.
import os
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); URL = 'file://' + os.path.join(ROOT, 'dist/paycure-standalone.html'); F = os.path.join(ROOT, 'tests/fixtures/')
ENVS = {
  'no-connection': '',
  'claude-no-ai': "window.claude={use:async n=>null};",
  'declined': "window.claude={use:async n=> n==='sample' ? Object.assign(async()=>{throw {code:'not_granted',message:'declined'}},{json:async()=>{throw {code:'not_granted'}}}) : null};",
  'working': "window.claude={use:async n=> n==='sample' ? Object.assign(async(input,opt)=>{const t='Here is your answer from Penny AI.\\n<<<DRAFT\\nOffer Letter\\n\\nWe are pleased to offer you the position.\\nDRAFT>>>'; if(opt&&opt.onText) opt.onText({text:t,delta:t}); return {text:t}},{json:async()=>({})}) : null};"
}
with sync_playwright() as p:
    b = p.chromium.launch(); errs = []
    for name, script in ENVS.items():
        pg = b.new_page(viewport={'width': 1300, 'height': 900}); pg.add_init_script('window.__PAYCURE_TEST__=true;' + script); pg.on('pageerror', lambda e: errs.append(f'{name}: {e}'))
        pg.goto(URL); pg.wait_for_timeout(1500); pg.evaluate("PCX.setView('home')"); pg.click('#as-fab'); pg.wait_for_timeout(300)
        pg.fill('#as-panel #as-q', 'Write an offer letter for a line cook' if name == 'working' else 'What is the capital of Peru?'); pg.keyboard.press('Enter'); pg.wait_for_timeout(1500)
        t = pg.inner_text('#as-panel'); banner = pg.locator('#as-panel .penny-status').inner_text() if pg.locator('#as-panel .penny-status').count() else ''
        link = pg.locator('#as-panel .penny-status a').first.get_attribute('href') if pg.locator('#as-panel .penny-status a').count() else ''
        print(f'{name:14} mode={pg.evaluate("PCX.aiMode()")} | banner: {banner[:70]!r} | link={bool(link)} | dead-end text: {"I don’t have a cited answer" in t} | draft card: {pg.locator("#as-panel .penny-draft").count()}')
        if name == 'declined': print('   declined guidance:', 'permission' in t, '| reload button:', pg.locator('[data-act="ai-reload"]').count() > 0)
        if name == 'working': print('   AI answer shown:', 'Penny AI' in t)
        pg.close()
    pg = b.new_page(viewport={'width': 1300, 'height': 900}, accept_downloads=True); pg.add_init_script('window.__PAYCURE_TEST__=true'); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL + '#/app/notices'); pg.wait_for_timeout(1000); n0 = pg.inner_text('#views .chip'); pg.check('[data-nt="0"]'); pg.wait_for_timeout(200); print('notices:', n0, '→', pg.inner_text('#views .chip'), '| rows:', pg.locator('[data-nt]').count())
    with pg.expect_download() as d: pg.click('[data-act="notices-docx"]')
    print('notices Word:', d.value.suggested_filename)
    pg.evaluate("PCX.setView('aiset')"); pg.wait_for_timeout(300); print('Penny AI page:', pg.inner_text('#views h1'))
    pg.evaluate("PCX.setView('litigation')"); pg.wait_for_timeout(300); pg.set_input_files('#lit-files', [F + 'synthetic_mediation_brief.txt']); pg.wait_for_timeout(1200)
    print('timeline:', 'Case timeline' in pg.inner_text('#views'))
    with pg.expect_download() as d: pg.click('[data-act="timeline-xlsx"]')
    print('timeline Excel:', d.value.suggested_filename)
    print('ERRORS', errs[:5]); b.close()
