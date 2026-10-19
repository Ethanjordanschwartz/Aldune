# E2E: Generate documents — several templates in one download; the customer's own Word template filled per worker;
# Penny's take follows the employer / employee-counsel switch; public pricing has no "Custom" plan; the homepage
# marquee carries product messages and keeps moving on hover; the sidebar matches the public site (no crowded New audit).
import os, io, zipfile, re
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); ok = True
def check(label, cond):
    global ok; print(('PASS ' if cond else 'FAIL ') + label); ok = ok and bool(cond)
def make_docx(path, paras):
    ct = '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'
    rels = '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'
    body = ''.join('<w:p>' + ''.join(f'<w:r><w:t xml:space="preserve">{r}</w:t></w:r>' for r in runs) + '</w:p>' for runs in paras)
    doc = f'<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>{body}</w:body></w:document>'
    with zipfile.ZipFile(path, 'w') as z: z.writestr('[Content_Types].xml', ct); z.writestr('_rels/.rels', rels); z.writestr('word/document.xml', doc)
tpl = '/tmp/claude-0/e2e_payment_letter.docx'
make_docx(tpl, [['{{Company}}'], ['Dear {{Employee ', 'Name}},'], ['Enclosed is a check for «Total Amount» (', '{{Amount in Words}}', ').'], ['Employee ID: ________'], ['{{Findings List}}'], ['Sincerely, [Signer Name]'], ['{Branch Code}']])
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={'width': 1400, 'height': 900}, accept_downloads=True); ctx.route('**/fonts.g*/**', lambda r: r.abort()); errs = []
    pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://' + os.path.join(ROOT, 'dist/paycure-standalone.html')); pg.wait_for_timeout(900)
    # public site
    pg.evaluate("PCX.setView('p-pricing')"); pg.wait_for_timeout(300)
    t = pg.inner_text('#views') if pg.locator('#views').count() else pg.inner_text('body')
    check('pricing shows no Custom / Enterprise plan', 'Custom' not in t and 'Enterprise' not in t and 'Contact sales' not in t)
    pg.evaluate("PCX.setView('public')"); pg.wait_for_timeout(500)
    mq = pg.inner_text('.al-marquee') if pg.locator('.al-marquee').count() else ''
    check('marquee carries product and PAGA messages, not vendor names', 'PAGA' in mq and not re.search(r'\b(ADP|Gusto|Paychex|Toast|UKG|Paycom)\b', mq))
    pg.hover('.al-marquee'); pg.wait_for_timeout(200)
    check('marquee keeps moving on hover', pg.evaluate("getComputedStyle(document.querySelector('.al-track')).animationPlayState") == 'running')
    # app
    pg2 = ctx.new_page(); pg2.add_init_script('window.__PAYCURE_TEST__=true'); pg2.on('pageerror', lambda e: errs.append(str(e)))
    pg2.goto('file://' + os.path.join(ROOT, 'dist/paycure-standalone.html')); pg2.wait_for_timeout(900)
    pg2.click('[data-act="demo"] >> nth=0'); pg2.wait_for_selector('text=Likely exposure', timeout=60000); pg2.wait_for_timeout(400)
    check('sidebar has no New audit button squeezed between workspace and search', pg2.locator('.rail .al-new:visible').count() == 0 and pg2.locator('.al-top .al-newbtn').count() == 1)
    check('sidebar uses the light paper palette like the public site', pg2.evaluate("getComputedStyle(document.querySelector('.rail')).backgroundColor") not in ('rgb(20, 19, 17)',))
    def penny(): return pg2.inner_text('xpath=//b[contains(., "Penny’s take")]/ancestor::div[contains(@class,"panel")][1]')
    a = penny(); pg2.click('[data-act="pov"][data-v="plaintiff"]'); pg2.wait_for_timeout(400); c = penny()
    check("Penny's take changes with the perspective", a != c and 'employee counsel view' in c and ('Strongest claim' in c or 'demand' in c))
    pg2.click('[data-act="pov"][data-v="defense"]'); pg2.wait_for_timeout(300)
    check("Penny's take returns to the employer view", 'employer view' in penny())
    # documents
    pg2.evaluate("PCX.setView('documents')"); pg2.wait_for_timeout(500)
    check('documents page offers your own templates and batch download', pg2.locator('#ct-panel').count() == 1 and pg2.locator('#ct-multi').count() == 1)
    pg2.set_input_files('#ct-file', tpl); pg2.wait_for_timeout(800)
    panel = pg2.inner_text('#ct-panel')
    check('uploaded template lists recognized fields', all(x in panel for x in ['Employee name', 'Employer legal name', 'Total amount', 'Total amount in words', 'Employee ID', 'List of findings with amounts', 'Signer name']))
    check('unrecognized placeholder gets an input', pg2.locator('[data-ct-extra][data-label="Branch Code"]').count() == 1)
    pg2.fill('[data-ct-extra][data-label="Branch Code"]', 'Branch 7')
    # two workers selected below → two filled copies in one zip
    ids = pg2.evaluate("PCS.result.engine.employees.filter(x => x.exposure.wagesAndPremiums > 0).slice(0, 2).map(x => x.employee.id)")
    pg2.evaluate("ids => { PCS.dg.sel = new Set(ids); }", ids)
    with pg2.expect_download() as dl: pg2.click('[data-act="ct-fill"]')
    d = dl.value; data = open(d.path(), 'rb').read()
    z = zipfile.ZipFile(io.BytesIO(data)); names = z.namelist()
    check(f'one filled copy per selected worker ({len(names)})', len(names) == 2 and all(n.endswith('.docx') for n in names))
    inner = zipfile.ZipFile(io.BytesIO(z.read(names[0]))).read('word/document.xml').decode()
    txt = re.sub(r'<[^>]+>', '', inner)
    name0 = pg2.evaluate("id => PCS.empIndex.get(id).name", ids[0]); name1 = pg2.evaluate("id => PCS.empIndex.get(id).name", ids[1])
    check('filled with the worker name, amounts, words, ID, and findings', (name0 in txt or name1 in txt) and '$' in txt and 'dollars and' in txt and ('Employee ID: ' + ids[0] in txt or 'Employee ID: ' + ids[1] in txt) and 'Total:' in txt)
    check('placeholders replaced and typed value used', '{{' not in txt and '«' not in txt and 'Branch 7' in txt)
    # several at once
    pg2.click('#ct-multi summary'); pg2.wait_for_timeout(150)
    for k in ['tpl:exec_report', 'tpl:meal_waiver', 'tpl:wage_letter']:
        pg2.check(f'[data-ct-multi="{k}"]'); pg2.wait_for_timeout(200)
    cid = pg2.evaluate("PCS.ctpl.list[0].id"); pg2.check(f'[data-ct-multi="ct:{cid}"]'); pg2.wait_for_timeout(200)
    check('download button counts the selection', 'Download selected (4)' in pg2.inner_text('#ct-multi'))
    with pg2.expect_download(timeout=120000) as dl2: pg2.click('[data-act="ct-multi-go"]')
    z2 = zipfile.ZipFile(io.BytesIO(open(dl2.value.path(), 'rb').read())); n2 = z2.namelist()
    check(f'several documents in one zip ({len(n2)} files)', len(n2) >= 5 and any(n.startswith('exec_report') for n in n2) and any(n.startswith('meal_waiver') for n in n2) and any(n.startswith('wage_letter') for n in n2) and sum(1 for n in n2 if n.startswith('e2e_payment_letter')) == 2)
    check('every file in the zip is a real Word document', all(zipfile.ZipFile(io.BytesIO(z2.read(n))).read('word/document.xml') for n in n2))
    # template survives a reload (saved in this browser)
    pg2.reload(); pg2.wait_for_timeout(1200)
    pg2.evaluate("PCX.setView('documents')"); pg2.wait_for_timeout(1200)
    check('template is still there after reload', 'e2e_payment_letter' in pg2.inner_text('#ct-panel'))
    check('no page errors', not errs); print(errs[:3])
    b.close()
print('ALL PASS' if ok else 'SOME FAILED')
