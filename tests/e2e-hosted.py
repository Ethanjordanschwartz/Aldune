# E2E (Phase 72): the page looks the same when the Claude viewer embeds it. The viewer puts our whole document inside its own
# <body>, so our <head> styles land in the body. Before the fix they outranked every theme layer the app adds later — the
# logged-in sidebar showed the old forest-green theme. This test wraps the build the same way and compares computed colors.
import os, http.server, threading, functools
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); ok = True
def check(label, cond):
    global ok; print(('PASS ' if cond else 'FAIL ') + label); ok = ok and bool(cond)
tmp = '/tmp/aldune-hosted'; os.makedirs(tmp, exist_ok=True)
src = open(os.path.join(ROOT, 'dist/paycure-standalone.html')).read()
open(os.path.join(tmp, 'plain.html'), 'w').write(src)
open(os.path.join(tmp, 'wrapped.html'), 'w').write('<!doctype html><html><head><meta charset=utf8><style>:root{color-scheme:light}body{margin:0;background:#fff;color:#000}</style></head><body>\n' + src + '</body></html>')
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Q, directory=tmp))
threading.Thread(target=srv.serve_forever, daemon=True).start(); port = srv.server_address[1]
PROBE = """(() => { const c = (s, p) => { const e = document.querySelector(s); return e ? getComputedStyle(e)[p] : null; };
  return { rail: c('.rail', 'backgroundImage'), nav: c('.nav button', 'color'), active: c('.nav button[aria-current="page"]', 'backgroundColor'), brand: c('.rail .brand b', 'color'),
    h1: c('#views h1', 'color'), primary: c('.btn.primary', 'backgroundColor'), body: c('body', 'backgroundColor') }; })()"""
HOME = """(() => { const c = (s, p) => { const e = document.querySelector(s); return e ? getComputedStyle(e)[p] : null; };
  return { hero: c('.al-hero h1', 'color'), handled: c('.al-hero h1 em', 'color'), pubBrand: c('.pub-top .brand b', 'color'), body: c('body', 'backgroundColor') }; })()"""
res = {}
with sync_playwright() as p:
    b = p.chromium.launch()
    for v in ['plain', 'wrapped']:
        ctx = b.new_context(viewport={'width': 1400, 'height': 900}, color_scheme='dark'); ctx.route('**/fonts.g*/**', lambda r: r.abort()); errs = []
        pg = ctx.new_page(); pg.add_init_script('window.__PAYCURE_TEST__=true'); pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(f'http://127.0.0.1:{port}/{v}.html'); pg.wait_for_timeout(1200)
        pg.evaluate("PCX.setView('public')"); pg.wait_for_timeout(500); home = pg.evaluate(HOME)
        pg.goto(f'http://127.0.0.1:{port}/{v}.html'); pg.wait_for_timeout(1200)
        pg.click('[data-act="demo"] >> nth=0'); pg.wait_for_selector('text=Likely exposure', timeout=60000); pg.wait_for_timeout(500)
        res[v] = {**pg.evaluate(PROBE), **{'home_' + k: x for k, x in home.items()}}; res[v]['errs'] = errs; ctx.close()
    b.close()
srv.shutdown()
P, W = res['plain'], res['wrapped']
check(f"sidebar is the soft brown panel when embedded ({W['rail'][:60]})", '230, 214, 198' in (W['rail'] or ''))
check(f"sidebar text is dark and readable ({W['nav']})", W['nav'] == 'rgb(34, 26, 21)')
for k in ['rail', 'nav', 'active', 'brand', 'h1', 'primary', 'body', 'home_hero', 'home_handled', 'home_pubBrand', 'home_body']:
    check(f'{k}: embedded = standalone ({W[k]})', W[k] == P[k])
check('no page errors', not P['errs'] and not W['errs']); print(P['errs'][:2], W['errs'][:2])
print('ALL PASS' if ok else 'SOME FAILED')
