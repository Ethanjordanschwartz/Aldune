from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':1400,'height':950}, accept_downloads=True); pg.add_init_script('window.__PAYCURE_TEST__=true')
    errs=[]; pg.on('pageerror',lambda e:errs.append('PAGEERR '+str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type=='error' and '403' not in m.text and 'ERR_TUNNEL_CONNECTION_FAILED' not in m.text and 'font' not in m.text.lower() else None)
    pg.on('dialog', lambda d: d.accept())
    pg.goto('file:///home/claude/paycure-app/dist/paycure-standalone.html'); pg.wait_for_timeout(800)
    pg.screenshot(path='/tmp/p10_landing.png')
    pg.click('[data-act="demo"] >> nth=0'); pg.wait_for_selector('text=Likely exposure', timeout=60000)
    pg.screenshot(path='/tmp/p10_exec.png')
    pg.evaluate("PCX.setView('solutions')"); pg.wait_for_timeout(400); pg.screenshot(path='/tmp/p10_solutions.png')
    print('playbooks:', pg.locator('.sol').count(), '| cure panel:', 'Received a PAGA notice' in pg.inner_text('#views'))
    for k in ['paga_cure','wage_letter_es','meal_rest_policy','training_memo','corrected_ws']:
        if pg.locator(f'[data-act="sol-doc"][data-k="{k}"]').count()==0: print('missing button', k); continue
        with pg.expect_download() as dl: pg.click(f'[data-act="sol-doc"][data-k="{k}"] >> nth=0')
        print('doc', dl.value.suggested_filename)
    with pg.expect_download() as dl: pg.click('[data-act="sol-all-docs"]')
    print('kit', dl.value.suggested_filename)
    pg.click('[data-act="sol-task"] >> nth=0'); pg.wait_for_timeout(200)
    # back pay
    pg.evaluate("PCX.setView('backpay')"); pg.wait_for_timeout(300); t10=pg.inner_text('.kpi.risk .v')
    pg.select_option('#bp-rate','0.07'); pg.wait_for_timeout(300); t7=pg.inner_text('.kpi.risk .v'); print('back pay 10% vs 7%:', t10, t7)
    with pg.expect_download() as dl: pg.click('[data-act="bp-csv"]')
    path=dl.value.path(); lines=open(path).read().splitlines(); print('payroll csv lines:', len(lines), lines[0]); print(' sample:', lines[1][:110])
    with pg.expect_download() as dl: pg.click('[data-act="bp-xlsx"]')
    print('bp xlsx', dl.value.suggested_filename)
    pg.evaluate("PCX.setView('exec')"); before=pg.inner_text('.kpi >> nth=2')
    pg.evaluate("PCX.setView('backpay')"); pg.click('[data-act="bp-paid-one"] >> nth=0'); pg.wait_for_timeout(300); print('mark paid toast:', pg.inner_text('#toast'))
    # documents page new templates + spanish
    pg.evaluate("PCX.setView('documents')"); pg.wait_for_timeout(300); print('new templates listed:', pg.locator('[data-act="sol-doc"]').count())
    # built-in review with Spanish rest-waiver text
    pg.evaluate("PCX.setView('review')"); pg.fill('#rv-text','Acuerdo de renuncia. Puedo renunciar a mi periodo de descanso cuando lo desee. I may waive my meal period when my shift is no more than six hours.'); pg.click('[data-act="rv-paste"]'); pg.wait_for_timeout(200)
    pg.click('[data-act="rv-ai"] >> nth=0'); pg.wait_for_timeout(400); rv=pg.inner_text('#views'); print('builtin review:', 'Built-in review' in rv, '| flags rest waiver:', 'Purports to waive rest breaks' in rv)
    # law library
    pg.evaluate("PCX.setView('law')"); pg.wait_for_timeout(200); print('law topics:', pg.locator('details.law').count())
    pg.click('[data-act="law-cat"][data-c="Recent changes"]'); pg.wait_for_timeout(150); print('recent changes:', pg.locator('details.law').count())
    pg.click('[data-act="law-tab"][data-t="index"]'); pg.wait_for_timeout(150); print('statute index rows:', pg.locator('#law-body tr').count())
    pg.click('[data-act="law-tab"][data-t="rules"]'); pg.wait_for_timeout(150); print('rules↔law rows:', pg.locator('#law-body tbody tr').count())
    pg.screenshot(path='/tmp/p10_law.png')
    # focus trap
    pg.evaluate("PCX.setView('findings')"); pg.click('tr[data-finding] >> nth=0'); pg.wait_for_timeout(300)
    for _ in range(60): pg.keyboard.press('Tab')
    print('focus stays in drawer:', pg.evaluate("document.querySelector('#drawer').contains(document.activeElement)"))
    pg.keyboard.press('Escape')
    # split shift appears in assistant routing
    pg.click('#as-fab'); pg.fill('#as-panel #as-q','What is required to cure a PAGA notice?'); pg.keyboard.press('Enter'); pg.wait_for_timeout(700); print('assistant cure law:', '33 days' in pg.inner_text('#as-panel'))
    print('ERRORS', errs[:6]); b.close()
