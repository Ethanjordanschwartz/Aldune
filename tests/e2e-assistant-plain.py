from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':1400,'height':950}, accept_downloads=True); pg.add_init_script('window.__PAYCURE_TEST__=true')
    errs=[]; pg.on('pageerror',lambda e:errs.append('PAGEERR '+str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type=='error' and '403' not in m.text and 'ERR_TUNNEL_CONNECTION_FAILED' not in m.text and 'font' not in m.text.lower() else None)
    pg.on('dialog', lambda d: d.accept('Run'))
    pg.goto('file:///home/claude/paycure-app/dist/paycure-standalone.html'); pg.wait_for_timeout(800)
    # 1) Law question with NO audit loaded, in plain HTML
    pg.click('#as-fab'); pg.wait_for_timeout(200)
    pg.fill('#as-panel #as-q','When is a second meal period required?'); pg.keyboard.press('Enter'); pg.wait_for_timeout(800)
    t=pg.inner_text('#as-panel'); print('LAW (no audit):', 'tenth hour' in t, '| mode badge:', 'Aldune Intelligence' in t)
    pg.fill('#as-panel #as-q','How do I register a trademark in Japan?'); pg.keyboard.press('Enter'); pg.wait_for_timeout(600)
    print('OUT OF SCOPE helpful, no refusal:', "isn’t covered" not in pg.inner_text('#as-panel'))
    pg.click('#as-panel [data-act="cite"][data-t="law"] >> nth=0'); pg.wait_for_timeout(400); print('law citation → library:', pg.url.endswith('.html') and 'law library' in pg.inner_text('#views').lower())
    # 2) Load demo, ask data questions
    pg.evaluate("PCX.setView('home')"); pg.click('[data-act="demo"] >> nth=0'); pg.wait_for_selector('text=Likely exposure', timeout=60000)
    pg.click('#as-fab'); pg.click('#as-panel [data-act="as-new"]'); pg.wait_for_timeout(100)
    for q in ['What are our biggest risks?','Show me the meal-period findings at Oxnard','What if we exclude workers with arbitration agreements and fix meal periods?','Which workers create the most exposure?']:
        pg.fill('#as-panel #as-q', q); pg.keyboard.press('Enter'); pg.wait_for_timeout(1200)
    txt=pg.inner_text('#as-panel'); print('DATA answers:', 'risk score' in txt, 'at Oxnard' in txt, 'Meal periods treated as remediated' in txt, 'most estimated exposure' in txt)
    n=pg.locator('#as-panel [data-act="cite"][data-t="finding"]').count(); print('finding citations:', n)
    pg.click('#as-panel [data-act="cite"][data-t="finding"] >> nth=0'); pg.wait_for_timeout(400)
    dt=pg.inner_text('#drawer-body'); print('cite→finding drawer: confidence trio', 'Legal/rule:' in dt, '| source rows', 'time row' in dt, '| ledger', 'Calculation ledger' in dt); pg.click('#drawer-close')
    # 3) Built-in narratives
    pg.evaluate("PCX.setView('exec')"); pg.click('summary:has-text("Executive summary")'); pg.click('[data-act="ai-exec"]'); pg.wait_for_timeout(300); print('exec summary built-in:', 'Next steps' in pg.inner_text('#ai-exec'), '| strategies panel:', 'How much could remediation' in pg.inner_text('#views'))
    with pg.expect_download() as dl: pg.click('[data-act="rpt"][data-r="board"]')
    print('board brief:', dl.value.suggested_filename)
    pg.screenshot(path='/tmp/p9_exec.png', full_page=False)
    # 4) Risk explorer drill
    pg.evaluate("PCX.setView('explorer')"); pg.click('tr[data-act="rx"] >> nth=0'); pg.wait_for_timeout(200); pg.click('tr[data-act="rx"] >> nth=0'); pg.wait_for_timeout(200)
    pg.screenshot(path='/tmp/p9_explorer.png'); pg.click('tr[data-finding] >> nth=0'); pg.wait_for_timeout(300); print('explorer → finding:', 'Why was this flagged?' in pg.inner_text('#drawer-body')); pg.click('#drawer-close')
    # 5) AI settings validation, law library search, rules
    pg.evaluate("PCX.setView('aiset')"); pg.fill('#ai-key','not-a-key'); pg.click('[data-act="ai-save"]'); print('bad key rejected:', 'doesn’t look like' in pg.inner_text('#toast'))
    pg.evaluate("PCX.setView('law')"); pg.fill('#law-q','los angeles minimum'); pg.wait_for_timeout(200); print('law search:', 'Local minimum wage' in pg.inner_text('#law-body'))
    pg.evaluate("PCX.setView('rules')"); print('rules local MW:', 'Mountain View' in pg.inner_text('#views'), 'phase-in' in pg.inner_text('#views'))
    pg.evaluate("PCX.setView('detective')"); pg.click('[data-act="ai-det"]'); pg.wait_for_timeout(200); print('detective built-in:', 'Investigate' in pg.inner_text('#ai-det'))
    pg.evaluate("PCX.setView('remediation')"); pg.click('[data-act="task-seed"]'); pg.wait_for_timeout(200); print('task priority col:', pg.locator('[data-f="priority"]').count())
    print('ERRORS', errs[:8]); b.close()
