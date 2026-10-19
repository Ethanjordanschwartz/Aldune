# E2E Phase 53: inside a viewer where IndexedDB is blocked, the audit is saved to and restored from the account database.
import os
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); URL = 'file://' + os.path.join(ROOT, 'dist/paycure-standalone.html')
INIT = """window.__PAYCURE_TEST__ = true;
// simulate the Claude viewer: IndexedDB blocked, per-user account database available (persists in localStorage, 256 KB/doc)
Object.defineProperty(window, 'indexedDB', { value: { open() { throw new DOMException('blocked', 'SecurityError'); } } });
window.__MAXDOC__ = 0;
window.__TEST_CAPS_DB__ = { doc: path => ({
  set: async v => { const t = JSON.stringify(v); window.__MAXDOC__ = Math.max(window.__MAXDOC__, t.length); if (t.length > 256 * 1024) throw Object.assign(new Error('too big'), { code: 'size' }); localStorage.setItem('mockdb:' + path, t); },
  get: async () => { const t = localStorage.getItem('mockdb:' + path); return { exists: t !== null, data: () => JSON.parse(t) }; },
  delete: async () => localStorage.removeItem('mockdb:' + path) }) };"""
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(); pg = ctx.new_page(); errs = []; pg.add_init_script(INIT); pg.on('pageerror', lambda e: errs.append(str(e)[:150]))
    pg.goto(URL); pg.wait_for_timeout(900); pg.evaluate("PCX.setView('home')"); pg.click('[data-act="demo"] >> nth=0'); pg.wait_for_selector('text=Likely exposure', timeout=60000); pg.wait_for_timeout(2500)
    exp = pg.evaluate('PCS.result.exposure.base'); print('IndexedDB blocked:', pg.evaluate("(()=>{try{indexedDB.open('x');return false}catch(e){return true}})()"), '| saved chunks:', pg.evaluate("Object.keys(localStorage).filter(k=>k.startsWith('mockdb:')).length"), '| largest doc KB:', pg.evaluate('Math.round(window.__MAXDOC__/1024)'))
    pg.evaluate("PCX.setView('fixqueue')"); pg.wait_for_timeout(800)
    pg.reload(); pg.wait_for_function('window.PCS && PCS.result', timeout=90000); pg.wait_for_timeout(600)
    print('restored from account database:', pg.evaluate('PCS.result.exposure.base') == exp, '| page:', pg.evaluate('PCS.view'))
    print('ERRORS', errs[:3]); b.close()
