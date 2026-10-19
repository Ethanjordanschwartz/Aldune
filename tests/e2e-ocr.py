# E2E (Phase 75): scans without the AI — a crooked, speckled photo of a printed time card (JPG) and an image-only scanned pay stub
# (PDF) are read with the built-in text recognition (Tesseract, normally loaded from jsDelivr; served locally here) and become a
# correct audit. Also: when the reader can't load, the file is marked as a scan with a clear next step (no crash).
import os, subprocess, mimetypes
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); S = os.path.join(ROOT, 'tests/fixtures/scans'); ok = True
V = '/tmp/aldune-ocr'
if not os.path.exists(os.path.join(V, 'node_modules/tesseract.js-core')):
    os.makedirs(V, exist_ok=True); subprocess.run('npm init -y >/dev/null && npm install tesseract.js@5.1.1 @tesseract.js-data/eng@1.0.0 >/dev/null 2>&1', shell=True, cwd=V)
NM = os.path.join(V, 'node_modules')
MAP = [('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/', 'tesseract.js/dist/'), ('https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/', 'tesseract.js-core/'), ('https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int/', '@tesseract.js-data/eng/4.0.0_best_int/')]
def serve(route):
    url = route.request.url
    for pre, local in MAP:
        if url.startswith(pre):
            f = os.path.join(NM, local, url[len(pre):].split('?')[0])
            if os.path.exists(f):
                ct = 'application/wasm' if f.endswith('.wasm') else 'application/javascript' if f.endswith('.js') else 'application/octet-stream'
                return route.fulfill(status=200, body=open(f, 'rb').read(), headers={'content-type': ct, 'access-control-allow-origin': '*'})
    return route.fulfill(status=404, body='')
def check(label, cond):
    global ok; print(('PASS ' if cond else 'FAIL ') + label); ok = ok and bool(cond)
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 1400, 'height': 1000}); ctx.route('**/fonts.g*/**', lambda r: r.abort()); ctx.route('https://cdn.jsdelivr.net/**', serve)
    pg = ctx.new_page(); pg.add_init_script('window.__PAYCURE_TEST__=true'); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://' + os.path.join(ROOT, 'dist/paycure-standalone.html')); pg.wait_for_timeout(800)
    check('AI is off in this test (built-in reader must do the work)', pg.evaluate("PCX.aiMode()") == 'builtin')
    pg.evaluate("PCX.setView('import')"); pg.wait_for_timeout(300)
    pg.set_input_files('[data-slotfiles="time"]', [os.path.join(S, 'timecard_photo.jpg')]); pg.wait_for_function("document.querySelector('[data-slot=\"time\"] .chip.ok, [data-slot=\"time\"] .chip.flag, [data-slot=\"time\"] .chip.warn')", timeout=180000); pg.wait_for_timeout(500)
    pg.set_input_files('[data-slotfiles="payroll"]', [os.path.join(S, 'paystub_scan.pdf')]); pg.wait_for_function("document.querySelector('[data-slot=\"payroll\"] .chip.ok, [data-slot=\"payroll\"] .chip.flag, [data-slot=\"payroll\"] .chip.warn')", timeout=180000); pg.wait_for_timeout(500)
    tcard, pcard = pg.inner_text('[data-slot="time"]'), pg.inner_text('[data-slot="payroll"]'); print(tcard.splitlines()[:4], pcard.splitlines()[:4])
    notes = pg.evaluate("PCS.bulk.items.map(i => i.note)"); print(notes)
    check('photo of a time card read with built-in recognition: 5 shifts', '5 shift' in tcard and any('built-in text recognition' in (n or '') for n in notes))
    pg.click('[data-act="imp-analyze"]'); pg.wait_for_selector('text=Likely exposure', timeout=60000); pg.wait_for_timeout(500)
    T = pg.evaluate("PCS.input.timeRecords.map(t => [t.date, t.clockIn, t.clockOut, (t.meals||[]).map(m => m.out + '-' + m.in).join(',')])"); print(T)
    want = [['2026-03-09', 360, 870, '735-765'], ['2026-03-10', 360, 870, '630-660'], ['2026-03-11', 360, 870, '600-620'], ['2026-03-12', 360, 1005, ''], ['2026-03-13', 360, 870, '660-690']]
    check('every punch on the photo read exactly', T == want)
    P = pg.evaluate("PCS.input.payroll.map(p => [p.periodStart, p.periodEnd, p.regHours, p.regRate, p.otHours, p.otRate])"); print(P)
    check('scanned PDF stub read: period, hours, rates', P == [['2026-03-09', '2026-03-22', 80, 18.5, 2.75, 27.75]])
    F = pg.evaluate("PCS.result.engine.findings.filter(f => f.category === 'meal').map(f => [f.date, f.title])"); print(F)
    check('late meal (6:00 → 12:15), short meal (20 min), no meal on 10.75 h', any(f[0] == '2026-03-09' and 'late' in f[1].lower() for f in F) and any(f[0] == '2026-03-11' and 'short' in f[1].lower() for f in F) and any(f[0] == '2026-03-12' and 'No meal' in f[1] for f in F))
    check('no page errors', not errs); print(errs[:3]); ctx.close()
    # a low-resolution, blurred, rotated phone photo: values the recognizer is unsure of are flagged, and findings wait for confirmation
    ctx = b.new_context(viewport={'width': 1400, 'height': 1000}); ctx.route('**/fonts.g*/**', lambda r: r.abort()); ctx.route('https://cdn.jsdelivr.net/**', serve)
    pg = ctx.new_page(); pg.add_init_script('window.__PAYCURE_TEST__=true'); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://' + os.path.join(ROOT, 'dist/paycure-standalone.html')); pg.wait_for_timeout(800); pg.evaluate("PCX.setView('import')"); pg.wait_for_timeout(300)
    pg.set_input_files('[data-slotfiles="time"]', [os.path.join(S, 'timecard_lowres_photo.jpg')]); pg.wait_for_function("document.querySelector('[data-slot=\"time\"] .chip.ok, [data-slot=\"time\"] .chip.flag, [data-slot=\"time\"] .chip.warn')", timeout=180000); pg.wait_for_timeout(500)
    fl = pg.evaluate("PCS.bulk.docs.filter(d => d.kind === 'timesheet').flatMap(d => d.data.entries.map(e => e.flagged || ''))")
    check(f'low-res photo: all five days read, uncertain ones flagged ({sum(1 for x in fl if "verify" in x)} flagged)', len(fl) == 5 and any('verify' in x for x in fl))
    pg.click('[data-act="imp-analyze"]'); pg.wait_for_selector('text=Likely exposure', timeout=60000); pg.wait_for_timeout(400)
    st = pg.evaluate("PCS.result.engine.findings.filter(f => f.category === 'meal').map(f => [f.date, f.state, f.missingInput || ''])"); print(st)
    check('findings on flagged days are POTENTIAL (confirm the punches), never counted as owed', all(x[1] != 'VIOLATION' for x in st if x[0] in {d for d, f in zip(['2026-03-09','2026-03-10','2026-03-11','2026-03-12','2026-03-13'], fl) if 'verify' in f}))
    # confirm / correct the flagged days
    pg.evaluate("PCX.setView('findings')"); pg.wait_for_timeout(500)
    check('Findings lists the days to confirm', pg.locator('#pc-panel').count() == 1 and '5 days to confirm' in pg.inner_text('#pc-panel'))
    k = pg.get_attribute('[data-act="pc-save"] >> nth=0', 'data-k')
    for f, v in [('in', '06:00'), ('m1o', '12:15'), ('m1i', '12:45'), ('out', '14:30')]: pg.fill(f'[data-pc="{k}"][data-f="{f}"]', v)
    pg.click('[data-act="pc-save"] >> nth=0'); pg.wait_for_timeout(1500)
    emp, day = k.split('|')
    rec = pg.evaluate(f"(() => {{ const t = PCS.input.timeRecords.find(x => x.employeeId === {emp!r} && x.date === {day!r}); return [t.clockIn, t.clockOut, t.meals.map(m => m.out + '-' + m.in).join(','), !!t.lowConfidence]; }})()")
    check(f'a corrected day takes the confirmed punches and loses its flag {rec}', rec == [360, 870, '735-765', False])
    st = pg.evaluate(f"PCS.result.engine.findings.filter(f => f.date === {day!r} && f.category === 'meal').map(f => f.state)")
    check(f'its late-meal finding is now provable {st}', 'VIOLATION' in st)
    check('the audit trail records the correction', pg.evaluate("(PCS.events || PCS.audit || []).some ? JSON.stringify(PCS.events || []).includes('punch.confirmed') : true"))
    pg.evaluate("PCX.setView('findings')"); pg.wait_for_timeout(400); pg.click('[data-act="pc-confirm-all"]'); pg.wait_for_timeout(1500)
    check('confirm all clears every flag', pg.evaluate("PCS.input.timeRecords.filter(t => t.lowConfidence).length") == 0 and pg.locator('#pc-panel').count() == 0)
    check('low-res: no page errors', not errs); ctx.close()
    # reader unavailable → clear scan status, no crash
    ctx = b.new_context(); ctx.route('https://cdn.jsdelivr.net/**', lambda r: r.abort()); ctx.route('**/fonts.g*/**', lambda r: r.abort())
    pg = ctx.new_page(); pg.add_init_script('window.__PAYCURE_TEST__=true'); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://' + os.path.join(ROOT, 'dist/paycure-standalone.html')); pg.wait_for_timeout(800); pg.evaluate("PCX.setView('import')"); pg.wait_for_timeout(300)
    pg.set_input_files('[data-slotfiles="time"]', [os.path.join(S, 'timecard_photo.jpg')]); pg.wait_for_timeout(4000)
    it = pg.evaluate("PCS.bulk.items.map(i => [i.status, i.note])"); print(it)
    check('offline: the scan is listed with a clear next step', any(x[0] == 'scan' and ('could not be loaded' in x[1] or 'enhanced AI' in x[1]) for x in it))
    check('offline: no page errors', not errs); print(errs[:3])
    b.close()
print('ALL PASS' if ok else 'SOME FAILED')
