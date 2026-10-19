import subprocess, time, urllib.request, json, os
from playwright.sync_api import sync_playwright
mock = subprocess.Popen(['python3', 'tests/mock-anthropic.py'], cwd='/home/claude/paycure-app')
env = dict(os.environ, ANTHROPIC_API_KEY='test-key', ANTHROPIC_BASE_URL='http://127.0.0.1:4010', PORT='3000')
srv = subprocess.Popen(['npx', 'next', 'start', '-p', '3000'], cwd='/home/claude/paycure-app', env=env, stdout=open('/tmp/next.log', 'w'), stderr=subprocess.STDOUT)
for _ in range(60):
    try: urllib.request.urlopen('http://localhost:3000/'); break
    except Exception: time.sleep(0.5)
try:
    urllib.request.urlopen('http://localhost:3000/audits/demo', timeout=90)
    # raw SSE check
    req = urllib.request.Request('http://localhost:3000/api/assistant', data=json.dumps({'message': 'How many meal findings?', 'auditId': 'demo'}).encode(), headers={'Content-Type': 'application/json'})
    raw = urllib.request.urlopen(req, timeout=60).read().decode()
    events = [json.loads(l[6:]) for l in raw.split('\n') if l.startswith('data: ')]
    print('SSE types:', [e['type'] for e in events][:4], '...', events[-1]['type'])
    done = events[-1]; print('final:', done['text']); print('citations:', [(c['type'], c['id'], c['href']) for c in done['citations']])
    # validation errors
    try: urllib.request.urlopen(urllib.request.Request('http://localhost:3000/api/assistant', data=b'{"message":""}', headers={'Content-Type': 'application/json'}))
    except urllib.error.HTTPError as e: print('empty message ->', e.code)
    sc = json.loads(urllib.request.urlopen(urllib.request.Request('http://localhost:3000/api/audits/demo/scenario', data=json.dumps({'scenario': {'excludeArbitration': True}}).encode(), headers={'Content-Type': 'application/json'})).read())
    print('scenario total', sc['scenario']['total'], 'settlement target', sc['settlement']['target'])
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1400, 'height': 950}); pg.add_init_script('window.__PAYCURE_TEST__=true')
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        for path in ['/audits/demo/detective', '/audits/demo/scenarios', '/audits/demo/diligence']:
            pg.goto('http://localhost:3000' + path); pg.wait_for_timeout(1500); pg.screenshot(path='/tmp/w_' + path.split('/')[-1] + '.png')
        pg.goto('http://localhost:3000/audits/demo'); pg.click('text=Ask Aldune'); pg.wait_for_timeout(300)
        pg.click('text=What are our three biggest risks?'); pg.wait_for_selector('text=should disappear', timeout=30000); pg.wait_for_timeout(500)
        pg.screenshot(path='/tmp/w_assistant.png')
        print('panel has bogus id:', 'FND-000000' in pg.inner_text('aside[role=dialog]'))
        pg.click('aside[role=dialog] ol a >> nth=0'); pg.wait_for_timeout(1500); print('citation navigated to', pg.url)
        print('page errors', errs); b.close()
finally:
    srv.terminate(); mock.terminate()
