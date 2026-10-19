# E2E (Phase 69): Litigation reads many case papers at once (Word, PDF, text), shows the Case analysis immediately,
# updates when a paper is removed or the side changes, exports a memo whose numbers match the screen, and the app stays
# light when the host page switches to dark.
import os, re, zipfile, io
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); F = os.path.join(ROOT, 'tests/fixtures/case/'); ok = True
def check(label, cond):
    global ok; print(('PASS ' if cond else 'FAIL ') + label); ok = ok and bool(cond)
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={'width': 1400, 'height': 950}, accept_downloads=True, color_scheme='dark'); ctx.route('**/fonts.g*/**', lambda r: r.abort()); errs = []
    pg = ctx.new_page(); pg.add_init_script('window.__PAYCURE_TEST__=true'); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://' + os.path.join(ROOT, 'dist/paycure-standalone.html')); pg.wait_for_timeout(900)
    pg.evaluate("document.documentElement.dataset.theme='dark'"); pg.wait_for_timeout(150)
    check('host dark mode does not darken the app', pg.evaluate("document.documentElement.dataset.theme") == 'light')
    rail = pg.evaluate("getComputedStyle(document.querySelector('.rail')).backgroundImage + getComputedStyle(document.querySelector('.rail')).backgroundColor")
    check(f'sidebar is light sand ({rail[:60]})', '230, 214, 198' in rail)
    check('no dark-mode switch to land in by accident', not pg.locator('#theme-btn').is_visible())
    pg.click('[data-act="demo"] >> nth=0'); pg.wait_for_selector('text=Likely exposure', timeout=60000); pg.wait_for_timeout(500)
    pg.evaluate("PCX.setView('litigation')"); pg.wait_for_timeout(400)
    check('one drop zone that accepts many files', pg.get_attribute('#lit-files', 'multiple') is not None and pg.locator('#lit-drop').count() == 1)
    check('explains what uploading does before any upload', 'What uploading case papers does' in pg.inner_text('#views'))
    pg.set_input_files('#lit-files', [F + 'complaint.docx', F + 'paga_notice.pdf', F + 'lwda_letter.txt', F + 'answer.txt'])
    pg.wait_for_selector('#lit-analysis', timeout=30000); pg.wait_for_timeout(500)
    t = pg.inner_text('#lit-analysis')
    check('all four papers read in one go (Word, PDF, text)', pg.evaluate("PCS.lit.docs.length") == 4 and all(x in t for x in ['complaint.docx', 'paga_notice.pdf', 'lwda_letter.txt', 'answer.txt']))
    check('types recognized', all(x in t for x in ['Complaint', 'PAGA notice', 'LWDA letter', 'Answer']))
    check('caption and case number', 'Maria Sanchez v. Pacific Coast Fresh' in t and '26CV07731' in t)
    check('seven causes of action listed', '7. Civil Penalties Under the Private Attorneys General Act' in t)
    check('deadlines with statutes', all(x in t for x in ['PAGA period begins', 'Jun 15, 2025', 'Earliest PAGA lawsuit', 'Aug 19, 2026', '2699.3(c)(1)(D)', 'Class period begins (4 years before filing)', 'Sep 8, 2022']))
    check('203 workers → early evaluation conference, not the under-100 cure', 'early evaluation conference' in t and 'Cure proposal due' not in t)
    A = pg.evaluate("PCS.lit.analysis")
    meal = next(a for a in A['allegations'] if a['claim'] == 'meal')
    js_meal = pg.evaluate("(() => { const f = PCS.result.engine.findings.filter(x => x.state === 'VIOLATION' && PC.claimOf(x) === 'meal'); return [f.length, Math.round(f.reduce((t, x) => t + x.amount, 0) * 100) / 100]; })()")
    check(f'meal row equals the findings ({meal["records"]["violations"]} / {js_meal[0]})', meal['records']['violations'] == js_meal[0] and abs(meal['records']['amount'] - js_meal[1]) < 0.01)
    check('every allegation row shows the papers’ own words and the law', '“Defendant required employees to work through their meal periods' in t and 'Lab. Code §§ 226.7, 512' in pg.inner_html('#lit-analysis'))
    check('standing table for the named plaintiff', 'Named-plaintiff standing' in t and 'Matched: Maria Sanchez' in t)
    check('PAGA from pay periods with both measures', 'defense measure' in t and 'plaintiff measure' in t and A['paga']['plaintiffMeasure'] >= A['paga']['defenseMeasure'] > 0)
    check('defense leverage cites authority', 'Defense leverage' in t and '2699' in t)
    # memo matches the screen
    with pg.expect_download(timeout=60000) as dl: pg.click('[data-act="lit-memo"]')
    path = dl.value.path(); z = zipfile.ZipFile(path); xml = z.read('word/document.xml').decode('utf8'); txt = re.sub(r'<[^>]+>', ' ', xml)
    check('memo downloads', dl.value.suggested_filename.startswith('case-analysis-defense'))
    check('memo carries the same PAGA numbers', f"{round(A['paga']['plaintiffMeasure']):,}" in txt and f"{round(A['paga']['defenseMeasure']):,}" in txt)
    check('memo has no undefined/NaN', not re.search(r'undefined|NaN|\[object', txt))
    # side switch changes the reading
    pg.click('[data-act="lit-side"][data-s="plaintiff"]'); pg.wait_for_timeout(600); t2 = pg.inner_text('#lit-analysis')
    check('plaintiff side → plaintiff leverage and plaintiff authorities', 'Plaintiff leverage' in t2 and 'For employees' in t2 and pg.evaluate("PCS.lit.analysis.side") == 'plaintiff')
    # remove a paper → analysis updates
    n_dead = len(A['deadlines'])
    idx = pg.evaluate("PCS.lit.docs.findIndex(d => d.name === 'paga_notice.pdf')")
    pg.click(f'[data-act="lit-rm"][data-k="{idx}"]'); pg.wait_for_timeout(600)
    check('removing a paper re-runs the analysis', pg.evaluate("PCS.lit.docs.length") == 3 and 'paga_notice.pdf' not in pg.inner_text('#lit-analysis'))
    # add more later — second batch appends
    pg.set_input_files('#lit-files', [F + 'paga_notice.txt']); pg.wait_for_timeout(1200)
    check('a second batch adds to the first', pg.evaluate("PCS.lit.docs.length") == 4)
    check('no page errors', not errs); print(errs[:3])
    b.close()
print('ALL PASS' if ok else 'SOME FAILED')
