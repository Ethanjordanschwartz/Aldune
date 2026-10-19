# E2E: a real (non-demo) company. Creating a letter asks once for the letterhead facts, fills them in, remembers them,
# and the demo letterhead never leaks into a real company's documents.
import os, sys, zipfile, re
from lxml import etree
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ok = True
def check(label, cond):
    global ok; print(('PASS ' if cond else 'FAIL ') + label); ok = ok and bool(cond)
W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
def text(path):
    z = zipfile.ZipFile(path); root = etree.fromstring(z.read('word/document.xml'))
    return '\n'.join(''.join(t.text or '' for t in p.iter(W + 't')) for p in root.iter(W + 'p'))
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1400, 'height': 950}, accept_downloads=True); pg.add_init_script('window.__PAYCURE_TEST__=true'); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept())
    pg.goto('file://' + os.path.join(ROOT, 'dist/paycure-standalone.html')); pg.wait_for_timeout(700)
    # demo first, then a real company: the demo letterhead must not carry over
    pg.evaluate("PCX.setView('home')"); pg.click('[data-act="demo"] >> nth=0'); pg.wait_for_selector('text=Likely exposure', timeout=60000)
    check('demo has a complete letterhead', pg.evaluate("!!PCS.party.employerAddress && !!PCS.party.signerName"))
    pg.evaluate("PCX.setView('import')"); pg.set_input_files('#bulk-files', [os.path.join(ROOT, 'tests/fixtures/acme/acme_packet.docx')]); pg.wait_for_selector('[data-act="imp-analyze"]'); pg.wait_for_timeout(300)
    pg.click('[data-act="imp-analyze"]'); pg.wait_for_selector('text=Likely exposure', timeout=60000); pg.wait_for_timeout(400)
    check('real company does not inherit the demo letterhead', pg.evaluate("!PCS.party.employerAddress && !PCS.party.signerName && PCS.party.employerName === 'Acme Retail Group, Inc.'"))
    pg.evaluate("PCX.setView('backpay')"); pg.wait_for_timeout(500)
    btn = pg.locator('[data-act="bp-one"]').first
    btn.click(); pg.wait_for_timeout(200)
    check('letter asks for the missing letterhead facts', pg.locator('#facts-modal').count() == 1 and pg.locator('#facts-modal [data-fact]').count() == 3)
    pg.fill('[data-fact="employerAddress"]', '1200 Market Street, Los Angeles, CA 90015'); pg.fill('[data-fact="signerName"]', 'Pat Morgan')
    pg.click('#facts-modal [data-fx="save"]'); pg.wait_for_timeout(200)
    check('blank field is required before saving', pg.locator('#facts-modal').count() == 1)
    pg.fill('[data-fact="signerTitle"]', 'Chief People Officer')
    with pg.expect_download() as d: pg.click('#facts-modal [data-fx="save"]')
    fp = '/tmp/facts-letter.docx'; d.value.save_as(fp); t = text(fp)
    check('letter contains the address and signer', '1200 Market Street, Los Angeles, CA 90015' in t and 'Pat Morgan' in t and 'Chief People Officer' in t)
    check('letter has no brackets or demo data', not re.search(r'\[|\]|Harvest Way|Dana Whitfield', t))
    with pg.expect_download(): pg.locator('[data-act="bp-one"]').nth(1).click()
    check('second letter does not ask again', pg.locator('#facts-modal').count() == 0)
    check('no page errors', not errs); errs and print(errs[:3])
    b.close()
print('ALL PASS' if ok else 'SOME FAILED'); sys.exit(0 if ok else 1)
