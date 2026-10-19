# E2E: standalone app served over HTTP, AI provider = proxy endpoint (mock Anthropic). Verifies the real tool loop + citation validation in the browser.
import subprocess, time, os
from playwright.sync_api import sync_playwright
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
mock = subprocess.Popen(['python3', 'tests/mock-anthropic.py'], cwd=root)
web = subprocess.Popen(['python3', '-m', 'http.server', '8765', '--bind', '127.0.0.1'], cwd=os.path.join(root, 'dist'), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.2)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page(); pg.add_init_script('window.__PAYCURE_TEST__=true'); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto('http://127.0.0.1:8765/paycure-standalone.html'); pg.wait_for_timeout(600)
        pg.evaluate("localStorage.setItem('paycure:ai', JSON.stringify({endpoint:'http://127.0.0.1:4010/v1/messages', model:'claude-sonnet-5-5'}))")
        pg.click('[data-act="demo"] >> nth=0'); pg.wait_for_selector('text=Likely exposure', timeout=60000)
        pg.click('#as-fab'); pg.fill('#as-panel #as-q', 'How many meal findings are there?'); pg.keyboard.press('Enter'); pg.wait_for_timeout(2500)
        t = pg.inner_text('#as-panel'); print('mode badge proxy:', 'Aldune AI' in t); print('answer via proxy:', 'Via proxy' in t, '| fake removed:', 'FND-000000' not in t)
        print('validated citations:', pg.locator('#as-panel [data-act="cite"][data-t="finding"]').count())
        pg.evaluate("PCX.setView('exec')"); pg.evaluate("document.querySelectorAll('#views details.calm-sec').forEach(d => d.open = true)"); pg.click('[data-act="ai-exec"]'); pg.wait_for_timeout(1500); print('narrative via proxy:', len(pg.inner_text('#ai-exec')) > 0)
        print('ERRORS', errs); b.close()
finally:
    mock.terminate(); web.terminate()
