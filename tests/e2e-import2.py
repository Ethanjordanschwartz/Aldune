# E2E for the redesigned Import page: per-section bulk drops, status, partial analysis, guide, next-step banner.
import os
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); B = os.path.join(ROOT, 'tests/fixtures/bulk'); RL = os.path.join(ROOT, 'tests/fixtures/real'); F = os.path.join(ROOT, 'tests/fixtures')
stubs = sorted(os.path.join(B, f) for f in os.listdir(B) if f.startswith('paystub')) + [os.path.join(RL, f) for f in ['Paychex_stub_0001.pdf', 'ADP_EARNINGS_STATEMENT_E2002.pdf', 'Paystub-Ana-Ruiz-2026-02-20.pdf', 'stub_week_ending_E2004.pdf']]
URL = 'file://' + os.path.join(ROOT, 'dist/paycure-standalone.html')
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1400, 'height': 1000}); pg.add_init_script('window.__PAYCURE_TEST__=true'); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept())
    pg.goto(URL); pg.wait_for_timeout(700); pg.evaluate("PCX.setView('import')")
    print('empty next bar:', 'Add files to any section' in pg.inner_text('#next-bar'))
    pg.set_input_files('[data-slotfiles="payroll"]', stubs); pg.wait_for_function("document.querySelector('[data-slot=\"payroll\"] .chip.ok')", timeout=120000)
    card = pg.inner_text('[data-slot="payroll"]'); print('payroll card:', ' | '.join(card.split('\n')[:4]))
    nb = pg.inner_text('#next-bar'); print('next bar ready:', 'Analyze now' in nb, '| mentions wage statements:', 'wage statements' in nb)
    pg.click('[data-act="slot-view"][data-ds="payroll"]'); pg.wait_for_timeout(200); tbl = pg.inner_text('#views'); print('review count in table:', tbl.count('Review'), '| real layouts read:', all(x in tbl for x in ['Maria Lopez', 'Ana Ruiz', 'Carmen Diaz']))
    pg.screenshot(path='/tmp/p13_import.png')
    pg.click('[data-act="imp-analyze"]'); pg.wait_for_selector('text=Likely exposure', timeout=60000)
    print('payroll-only audit ran:', pg.inner_text('#c-f'), 'findings | skipped note:', 'Not checked yet' in pg.inner_text('#toast'))
    pg.wait_for_timeout(300); print('next-step banner on dashboard:', 'Next step:' in pg.inner_text('#views'))
    pg.evaluate("PCX.setView('home')"); pg.wait_for_timeout(200); g = pg.inner_text('#views'); print('guide (on Home):', 'You are here' in g, '| path rows:', pg.locator('#views table tr').count())
    # fresh page: other sections + scans + docs-only
    pg.goto(URL); pg.wait_for_timeout(600); pg.evaluate("PCX.setView('import')")
    pg.set_input_files('[data-slotfiles="time"]', [os.path.join(RL, 'Timecard_Pedro_Ramirez.pdf')]); pg.wait_for_timeout(1500)
    pg.set_input_files('[data-slotfiles="employees"]', [os.path.join(RL, 'Employee_Roster.pdf'), os.path.join(RL, 'W2_Rosa_Flores_2025.pdf')]); pg.wait_for_timeout(1500)
    pg.set_input_files('[data-slotfiles="payroll"]', [os.path.join(RL, 'scanned_stub.pdf')]); pg.wait_for_timeout(1500)
    print('time card:', pg.inner_text('[data-slot="time"]').split('\n')[1:3]); print('census card:', pg.inner_text('[data-slot="employees"]').split('\n')[1:3])
    print('scan status:', 'scans need enhanced AI' in pg.inner_text('#next-bar') or 'need enhanced AI' in pg.inner_text('#next-bar'))
    pg.click('[data-act="imp-analyze"]'); pg.wait_for_selector('text=Likely exposure', timeout=60000); print('timesheet+census audit:', pg.inner_text('#c-f'), 'findings')
    pg.goto(URL); pg.wait_for_timeout(600); pg.evaluate("PCX.setView('import')")
    pg.set_input_files('#im-docs', [os.path.join(F, 'paga_notice.txt')]); pg.wait_for_timeout(800); print('docs-only next bar:', 'Review documents' in pg.inner_text('#next-bar'))
    print('ERRORS', errs[:5]); b.close()
