# QA: click every download button across the app (demo company loaded) and require a non-empty file and no errors.
import os
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); URL = 'file://' + os.path.join(ROOT, 'dist/paycure-standalone.html')
DL = r'^(rpt$|onboard-packet|hb2-issue|tpl2|cl-memo|dl-ics|cal-ics|rd-plan|lit-doc2|notices-docx|dl-|sol-doc|sol-all-docs|bp-csv|bp-xlsx|bp-one|binder|lit-doc|lit-xlsx|pos-memo|sep-agree|xlsx|trail-csv|att-csv|al-csv|dg-docx|board|hb-)'
VIEWS = ['reports', 'documents', 'solutions', 'backpay', 'settlement', 'detective', 'diligence', 'findings', 'litigation', 'pos', 'remediation', 'attest', 'classify', 'calendar', 'readiness', 'notices', 'handbook2']
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1400, 'height': 950}, accept_downloads=True); errs = []
    pg.add_init_script('window.__PAYCURE_TEST__=true'); pg.on('pageerror', lambda e: errs.append(f"{pg.evaluate('PCS.view')}: {e}")); pg.on('dialog', lambda d: d.accept())
    pg.goto(URL); pg.wait_for_timeout(800); pg.evaluate("PCX.setView('home')"); pg.wait_for_timeout(300); pg.click('[data-act="demo"] >> nth=0'); pg.wait_for_selector('text=Likely exposure', timeout=60000)
    ok, bad, seen = 0, [], set()
    for v in VIEWS:
        pg.evaluate(f"PCX.setView('{v}')"); pg.wait_for_timeout(500)
        n = pg.evaluate(f"[...document.querySelectorAll('#views [data-act]')].filter(x => new RegExp('{DL}').test(x.dataset.act) && x.offsetParent).length")
        for i in range(n):
            pg.evaluate(f"PCX.setView('{v}')"); pg.wait_for_timeout(250)
            info = pg.evaluate(f"(()=>{{const el=[...document.querySelectorAll('#views [data-act]')].filter(x => new RegExp('{DL}').test(x.dataset.act) && x.offsetParent)[{i}]; if(!el) return null; return [el.dataset.act, el.dataset.k||el.dataset.kind||el.dataset.age||'', (el.textContent||'').trim().slice(0,40)]}})()")
            if not info: continue
            key = f"{v}:{info[0]}:{info[1]}:{info[2]}"
            if key in seen: continue
            seen.add(key)
            try:
                with pg.expect_download(timeout=15000) as d:
                    pg.evaluate(f"[...document.querySelectorAll('#views [data-act]')].filter(x => new RegExp('{DL}').test(x.dataset.act) && x.offsetParent)[{i}].click()")
                    pg.wait_for_timeout(150)
                    if pg.locator('#facts-modal').count():
                        pg.evaluate("document.querySelectorAll('#facts-modal input[data-fact]').forEach(i => { i.value = i.value || (i.type === 'date' ? '2026-09-15' : i.type === 'number' ? '5000' : 'Test value'); })"); pg.click('#facts-modal [data-fx="save"]')
                size = os.path.getsize(d.value.path()); (ok := ok + 1) if size > (40 if info[0].endswith('csv') else 200) else bad.append((key, f'{size} bytes'))
            except Exception as e:
                bad.append((key, str(e)[:60]))
            pg.evaluate("document.querySelectorAll('.drawer.open').forEach(x=>x.classList.remove('open'))")
    print(f'downloads OK: {ok}; failed: {len(bad)}'); [print('  FAIL', k, why) for k, why in bad]
    print('ERRORS', errs[:6]); b.close()
