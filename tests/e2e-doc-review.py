# E2E: upload policy documents (.doc with an embedded logo, .docx, the client's original form, a handbook .txt) on Import,
# then download the redline, clean version, and memo from Review documents and verify each is a real, usable Word file.
import os, sys, zipfile, re, io, subprocess, tempfile
from lxml import etree
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); P = os.path.join(ROOT, 'tests/fixtures/policies')
ok = True
def check(label, cond):
    global ok; print(('PASS ' if cond else 'FAIL ') + label); ok = ok and bool(cond)
W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
def docx_info(path):
    z = zipfile.ZipFile(path); names = z.namelist()
    for n in names:
        if n.endswith('.xml') or n.endswith('.rels'): etree.fromstring(z.read(n))  # every part parses
    doc = z.read('word/document.xml').decode('utf8')
    root = etree.fromstring(z.read('word/document.xml'))
    text = '\n'.join(''.join(t.text or '' for t in p.iter(W + 't')) for p in root.iter(W + 'p'))
    return {'names': names, 'doc': doc, 'text': text, 'ins': doc.count('<w:ins '), 'del': doc.count('<w:del '), 'comments': z.read('word/comments.xml').decode('utf8').count('<w:comment ') if 'word/comments.xml' in names else 0}
def opens_in_office(path):
    with tempfile.TemporaryDirectory() as d:
        r = subprocess.run(['soffice', '--headless', '--convert-to', 'pdf', '--outdir', d, path], capture_output=True, timeout=120)
        return any(f.endswith('.pdf') and os.path.getsize(os.path.join(d, f)) > 1000 for f in os.listdir(d))
files = [os.path.join(P, 'meal_waiver.doc'), os.path.join(P, 'meal_waiver.docx'), os.path.join(ROOT, 'tests/fixtures/Meal_Break_Waiver.docx'), os.path.join(ROOT, 'tests/fixtures/bad_handbook.txt')]
out = tempfile.mkdtemp()
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1400, 'height': 950}, accept_downloads=True); pg.add_init_script('window.__PAYCURE_TEST__=true'); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept())
    pg.goto('file://' + os.path.join(ROOT, 'dist/paycure-standalone.html')); pg.wait_for_timeout(700); pg.evaluate("PCX.setView('import')")
    pg.set_input_files('#im-docs', files); pg.wait_for_timeout(2500)
    pg.evaluate("PCX.setView('review')"); pg.wait_for_timeout(600)
    t = pg.inner_text('#views')
    check('every document shows a review card', pg.locator('[data-act="hb-redline"]').count() >= 4)
    check('meal waiver reviewed as a form (not a handbook)', 'Meal period waiver' in t and 'required changes' in t)
    check('no binary junk shown', not re.search(r'JFIF|8BIM|Photoshop', t))
    names = pg.evaluate("PCS.docs.map(d => d.name)")
    for i, n in enumerate(names):
        base = re.sub(r'\.[a-z0-9]+$', '', os.path.basename(n), flags=re.I)
        got = {}
        for act in ['hb-redline', 'hb-clean', 'hb-memo']:
            loc = pg.locator(f'[data-act="{act}"][data-i="{i}"]').first
            if not loc.count(): continue
            with pg.expect_download() as d: loc.click()
            fp = os.path.join(out, f'{i}-{act}.docx'); d.value.save_as(fp); got[act] = fp
        check(f'{n}: redline, clean, and memo downloaded', len(got) == 3)
        if len(got) < 3: continue
        R, C, M = docx_info(got['hb-redline']), docx_info(got['hb-clean']), docx_info(got['hb-memo'])
        check(f'{n}: redline has tracked insertions/deletions and a comment per change', R['ins'] > 3 and R['del'] > 0 and R['comments'] > 2)
        check(f'{n}: clean version has no tracked changes or comments', C['ins'] == 0 and C['del'] == 0 and C['comments'] == 0)
        check(f'{n}: memo explains the changes', 'MEMORANDUM' in M['text'] and 'Authority' in M['text'] and 'Next steps' in M['text'])
        check(f'{n}: no junk or placeholders in any output', not re.search(r'JFIF|8BIM|undefined|NaN|\[object|\[__\]|\[contact\]', R['text'] + C['text'] + M['text']))
        if 'aiver' in n:
            for must in ['end of my fifth hour', 'Labor Code section 226.7', 'This form does not waive rest periods', 'RENUNCIA AL PERIODO DE COMIDA']:
                check(f'{n}: clean contains “{must}”', must in C['text'])
            check(f'{n}: rest-break waiver removed', '___ periodo de descanso' not in C['text'] and 'for every five (5) hour period' not in C['text'])
        if n.endswith('.docx'):
            check(f'{n}: revised in place — logo/drawing kept', '<w:drawing>' in R['doc'] and '<w:drawing>' in C['doc'] and any(x.startswith('word/media/') for x in R['names']))
        if i == 0:
            check(f'{n}: redline opens in an office suite', opens_in_office(got['hb-redline'])); check(f'{n}: clean opens', opens_in_office(got['hb-clean']))
    check('no page errors', not errs); errs and print(errs[:3])
    b.close()
print('ALL PASS' if ok else 'SOME FAILED'); sys.exit(0 if ok else 1)
