# E2E Phase 22: Penny server on your own domain (no Claude login), markdown rendering, PAGA readiness, calendar, attestation integration, spec documents.
import os, subprocess, time, zipfile
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
srv = subprocess.Popen(['node', os.path.join(ROOT, 'tests/serve-site.js')], env={**os.environ, 'PORT': '8765'}, stdout=subprocess.PIPE); srv.stdout.readline()
try:
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1300, 'height': 900}, accept_downloads=True); errs = []
        pg.add_init_script('window.__PAYCURE_TEST__=true'); pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept())
        pg.goto('http://127.0.0.1:8765/'); pg.wait_for_timeout(2000)
        print('Penny server detected:', pg.evaluate('PCX.aiMode()'), '| endpoint:', pg.evaluate('PCS.cfg.assistantEndpoint'))
        pg.evaluate("PCX.setView('home')"); pg.click('#as-fab'); pg.wait_for_timeout(300)
        print('no login banner:', pg.locator('#as-panel .penny-status').count() == 0)
        pg.fill('#as-panel #as-q', 'Explain California overtime'); pg.keyboard.press('Enter'); pg.wait_for_timeout(3000)
        a = pg.locator('#as-chat .a').last
        print('AI answer:', 'Overtime basics' in a.inner_text(), '| heading:', a.locator('h4, h3, h5').count() > 0, '| list:', a.locator('ul li').count(), '| table:', a.locator('table').count(), '| bold:', a.locator('strong').count() > 0, '| raw markdown leaked:', '**' in a.inner_text() or '##' in a.inner_text())
        pg.evaluate("document.getElementById('as-panel').classList.remove('open')")
        pg.evaluate("PCX.setView('home')"); pg.wait_for_timeout(300); pg.click('[data-act="demo"] >> nth=0'); pg.wait_for_selector('text=Likely exposure', timeout=60000)
        pg.evaluate("PCX.setView('readiness')"); pg.wait_for_timeout(500); t = pg.inner_text('#views')
        print('readiness:', 'Likely PAGA cap' in t, '| sticks rows:', pg.locator('#views tbody tr').count())
        pg.check('#rd-train'); pg.wait_for_timeout(200); print('training toggled → category met:', 'met' in pg.inner_text('#views'))
        with pg.expect_download() as d: pg.click('[data-act="rd-plan"]')
        print('corrective plan:', d.value.suggested_filename)
        pg.evaluate("PCX.setView('calendar')"); pg.wait_for_timeout(300); print('calendar rows:', pg.locator('[data-cal]').count())
        with pg.expect_download() as d: pg.click('[data-act="cal-ics"]')
        ics = open(d.value.path()).read(); print('ics:', ics.startswith('BEGIN:VCALENDAR'), '| events:', ics.count('BEGIN:VEVENT'), '| pay data date:', 'Pay data report' in ics)
        rows = pg.evaluate("PCS.input.timeRecords.slice(0,6).map(t => [t.employeeId, t.date])")
        csv = 'Employee ID,Date,Meal Provided,Rest Provided\n' + '\n'.join(f'{e},{d},Yes,{"No" if i % 2 else "Yes"}' for i, (e, d) in enumerate(rows)); open('/tmp/att.csv', 'w').write(csv)
        pg.evaluate("PCX.setView('attest')"); pg.wait_for_timeout(300); pg.set_input_files('#aq-file', '/tmp/att.csv'); pg.wait_for_timeout(500)
        print('attestations imported:', pg.evaluate('PCS.att.length'))
        pg.click('[data-act="aq-apply"]'); pg.wait_for_timeout(2500); print('applied to audit:', pg.evaluate("PCS.input.timeRecords.filter(t => t.attestation).length"), '| attested-no-rest findings:', pg.evaluate("PCS.result.engine.findings.filter(f => /ATTESTED/.test(JSON.stringify(f.evidence))).length"))
        pg.evaluate("PCX.setView('litigation')"); pg.wait_for_timeout(400)
        for k in ['agreement', 'approval']:
            with pg.expect_download() as d: pg.click(f'[data-act="lit-doc2"][data-k="{k}"]')
            x = zipfile.ZipFile(d.value.path()).read('word/document.xml').decode(); print(k, d.value.suggested_filename, '| Amaro:' if k == 'agreement' else '| Dunk:', ('Amaro' if k == 'agreement' else 'Dunk') in x)
        print('ERRORS', errs[:5]); b.close()
finally: srv.terminate()
