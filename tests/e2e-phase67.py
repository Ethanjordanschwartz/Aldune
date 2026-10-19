# E2E (Phase 67): reproducible audits from the Audit trail; one honest Connections page (system picker + one linked folder);
# Litigation shows what case papers do and compares allegations with the records; homepage rotating words and light
# "How it works"; the sidebar logo always contrasts; pricing without Custom and with the one-time audit.
import os, re
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); ok = True
def check(label, cond):
    global ok; print(('PASS ' if cond else 'FAIL ') + label); ok = ok and bool(cond)
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={'width': 1400, 'height': 950}, accept_downloads=True); ctx.route('**/fonts.g*/**', lambda r: r.abort()); errs = []
    pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://' + os.path.join(ROOT, 'dist/paycure-standalone.html')); pg.wait_for_timeout(900)
    pg.evaluate("PCX.setView('public')"); pg.wait_for_timeout(500)
    src = pg.evaluate("document.documentElement.innerHTML")
    check('rotating words never say "every dollar"', 'every dollar' not in pg.inner_text('body') and 'every timecard.' in src)
    check('"How it works" sits on a light band', pg.evaluate("(() => { const s = [...document.querySelectorAll('.pub-sec')].find(x => /How it works/.test(x.textContent)); return s && !s.classList.contains('al-band-ink'); })()"))
    pg.evaluate("PCX.setView('p-pricing')"); pg.wait_for_timeout(300); t = pg.inner_text('body')
    check('pricing: Starter $349, Professional $899, Legal $1,799, one-time $1,950, no Custom', all(x in t for x in ['$349', '$899', '$1799' if '$1799' in t else '$1,799', '1,950']) and 'Custom' not in t)
    pg2 = ctx.new_page(); pg2.add_init_script('window.__PAYCURE_TEST__=true'); pg2.on('pageerror', lambda e: errs.append(str(e)))
    pg2.goto('file://' + os.path.join(ROOT, 'dist/paycure-standalone.html')); pg2.wait_for_timeout(900)
    pg2.click('[data-act="demo"] >> nth=0'); pg2.wait_for_selector('text=Likely exposure', timeout=60000); pg2.wait_for_timeout(800)
    tile = pg2.evaluate("(() => { const p = document.querySelector('.rail .brand svg path'); const r = document.querySelector('.rail'); return [getComputedStyle(p).fill, getComputedStyle(r).backgroundImage + ' ' + getComputedStyle(r).backgroundColor]; })()")
    check(f'logo mark is colored on a light sidebar, no box {tile}', tile[0] == 'rgb(107, 63, 42)' and '230, 214, 198' in tile[1])
    # reproduce
    pg2.evaluate("PCX.setView('trail')"); pg2.wait_for_timeout(900)
    check('audit trail lists the saved run', pg2.locator('[data-act="repro-run"]').count() >= 1)
    pg2.click('[data-act="repro-run"] >> nth=0'); pg2.wait_for_timeout(2500)
    check('saved run reproduces exactly', 'Reproduced exactly' in pg2.inner_text('#repro-panel'))
    with pg2.expect_download(timeout=60000) as dl: pg2.click('[data-act="repro-cert"] >> nth=0')
    check('reproduction certificate downloads', dl.value.suggested_filename.startswith('reproduction-certificate'))
    before = pg2.evaluate("PCS.result.engine.findings.length")
    pg2.evaluate("PCX.newAudit()"); pg2.wait_for_timeout(300)
    pg2.evaluate("PCX.setView('trail')"); pg2.wait_for_timeout(600)
    pg2.click('[data-act="repro-open"] >> nth=0'); pg2.wait_for_timeout(500); pg2.wait_for_function("!!(window.PCS && PCS.result)", timeout=60000); pg2.wait_for_timeout(500)
    check('a saved run opens as the current audit with the same findings', pg2.evaluate("PCS.result.engine.findings.length") == before)
    # connections
    pg2.evaluate("PCX.setView('connect')"); pg2.wait_for_timeout(400); c = pg2.inner_text('#views')
    check('connections: one system picker, one linked folder, honest direct-sync note', pg2.locator('#conn-sys').count() == 1 and pg2.locator('[data-connpick]').count() == 1 and 'Linked folder' in c and 'Direct sync' in c)
    pg2.select_option('#conn-sys', 'paychex'); pg2.wait_for_timeout(300)
    href = pg2.get_attribute('a[data-act="conn-open"]', 'href')
    check(f'choosing Paychex opens Paychex ({href}) and shows its reports', href and 'paychex' in href and 'Payroll Journal' in pg2.inner_text('#views'))
    pg2.select_option('#conn-sys', 'adp-wfn'); pg2.wait_for_timeout(300)
    check('choosing ADP opens a different site', 'adp.com' in (pg2.get_attribute('a[data-act="conn-open"]', 'href') or ''))
    # litigation
    pg2.evaluate("PCX.setView('litigation')"); pg2.wait_for_timeout(400)
    check('litigation explains what case papers do', 'What uploading case papers does' in pg2.inner_text('#views'))
    FC = os.path.join(ROOT, 'tests/fixtures/case/')
    pg2.set_input_files('#lit-files', [FC + 'complaint.txt', FC + 'paga_notice.txt']); pg2.wait_for_selector('#lit-analysis', timeout=30000); pg2.wait_for_timeout(400)
    v = pg2.inner_text('#views')
    check('allegations vs. records table: supported and found-but-not-alleged claims', 'Allegations vs. the records' in v and 'Supported by the records' in v and 'Not alleged, but found' in v)
    check('case papers set the PAGA period and the class period', 'PAGA period begins' in v and 'Class period begins' in v)
    check('no page errors', not errs); print(errs[:3])
    b.close()
print('ALL PASS' if ok else 'SOME FAILED')
