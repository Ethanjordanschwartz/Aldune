from playwright.sync_api import sync_playwright
F='/home/claude/paycure-app/tests/fixtures/'
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':1400,'height':950}, accept_downloads=True); pg.add_init_script('window.__PAYCURE_TEST__=true')
    errs=[]; pg.on('pageerror',lambda e:errs.append('PAGEERR '+str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type=='error' and '403' not in m.text and 'ERR_TUNNEL_CONNECTION_FAILED' not in m.text and 'font' not in m.text.lower() else None)
    pg.on('dialog', lambda d: d.accept())
    pg.goto('file:///home/claude/paycure-app/dist/paycure-standalone.html'); pg.wait_for_timeout(800)
    # 1) notice before audit
    pg.evaluate("PCX.setView('review')"); pg.set_input_files('#rv-file',[F+'paga_notice.txt']); pg.wait_for_timeout(600)
    t=pg.inner_text('#views'); print('notice analysis (no data):', 'PAGA notice analysis' in t, '| sections:', t.count('§ '), '| deadline:', 'Oct 5, 2026' in t)
    # 2) assistant with actions, no data
    pg.click('#as-fab'); pg.fill('#as-panel #as-q','We received a PAGA notice. What do we do now?'); pg.keyboard.press('Enter'); pg.wait_for_timeout(700)
    a=pg.inner_text('#as-panel'); print('assistant: 33 days', '33 days' in a, '| $75', '$75' in a, '| actions:', pg.locator('#as-panel [data-act="as-action"]').count())
    pg.fill('#as-panel #as-q','Can we settle individually with employees while a class action is pending?'); pg.keyboard.press('Enter'); pg.wait_for_timeout(700)
    print('settlement answer cites Chindarah:', 'Chindarah' in pg.inner_text('#as-panel'))
    # 3) load demo, re-check notice analysis with data, click actions
    pg.click('#as-panel [data-act="as-close"]'); pg.evaluate("PCX.setView('home')"); pg.click('[data-act="demo"] >> nth=0'); pg.wait_for_selector('text=Likely exposure', timeout=60000)
    pg.evaluate("PCX.setView('review')"); pg.wait_for_timeout(400); t=pg.inner_text('#views'); print('notice with data shows issues:', 'potential issues for' in t)
    pg.click('[data-act="notice-date"]'); pg.wait_for_timeout(200); print('notice date set:', pg.inner_text('#toast'))
    pg.screenshot(path='/tmp/p11_notice.png')
    pg.click('#as-fab'); pg.click('#as-panel [data-act="as-new"]'); pg.fill('#as-panel #as-q','Can we settle individually with employees while a class action is pending?'); pg.keyboard.press('Enter'); pg.wait_for_timeout(700)
    pg.click('#as-panel [data-act="as-action"][data-k="settlement_packet"]'); pg.wait_for_timeout(400); print('action → settlement packet template:', pg.eval_on_selector('input[name=tpl][value="settlement"]','e=>e.checked'))
    pg.click('#as-fab'); pg.click('#as-panel [data-act="as-new"]'); pg.fill('#as-panel #as-q','What are our biggest risks?'); pg.keyboard.press('Enter'); pg.wait_for_timeout(900)
    acts=[x.get_attribute('data-k') for x in pg.locator('#as-panel [data-act="as-action"]').all()]; print('data answer actions:', acts)
    pg.click('#as-panel [data-act="as-action"][data-k="backpay"]'); pg.wait_for_timeout(300); print('action → back pay view:', 'Back-pay planner' in pg.inner_text('#views'))
    # 4) settlement allocation
    pg.evaluate("PCX.setView('settlement')"); pg.wait_for_timeout(400); print('allocation panel:', 'Net class fund' in pg.inner_text('#views'))
    with pg.expect_download() as dl: pg.click('[data-act="al-csv"]')
    print('allocation csv:', dl.value.suggested_filename)
    # 5) AI page
    pg.evaluate("PCX.setView('aiset')"); v=pg.inner_text('#views'); print('AI page mentions Claude:', 'Claude' in v.replace('claude-','') , '| title:', v.split('\n')[0])
    print('ERRORS', errs[:6]); b.close()
