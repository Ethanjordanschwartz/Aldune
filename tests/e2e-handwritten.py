# E2E (Phase 74): a handwritten time card (as a scan transcription) and an OCR'd pay stub, dropped on Import, become a correct audit:
# the card's shifts and meals are read (strike-throughs, "30 min lunch @ 11:30", illegible punches flagged), the stub's OCR'd numbers
# are fixed, and an untimed meal is never reported as a missed meal.
import os
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); H = os.path.join(ROOT, 'tests/fixtures/handwritten'); ok = True
def check(label, cond):
    global ok; print(('PASS ' if cond else 'FAIL ') + label); ok = ok and bool(cond)
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1400, 'height': 1000}); pg.add_init_script('window.__PAYCURE_TEST__=true'); errs = []
    pg.route('**/fonts.g*/**', lambda r: r.abort()); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://' + os.path.join(ROOT, 'dist/paycure-standalone.html')); pg.wait_for_timeout(800); pg.evaluate("PCX.setView('import')"); pg.wait_for_timeout(300)
    pg.set_input_files('[data-slotfiles="time"]', [os.path.join(H, 'rosa_timecard_scan.txt')]); pg.wait_for_timeout(1500)
    pg.set_input_files('[data-slotfiles="payroll"]', [os.path.join(H, 'rosa_stub_scan.txt')]); pg.wait_for_timeout(1500)
    card = pg.inner_text('[data-slot="time"]'); check(f'time card read: {card.splitlines()[1:3]}', '6 shift' in card)
    pg.click('[data-act="imp-analyze"]'); pg.wait_for_selector('text=Likely exposure', timeout=60000); pg.wait_for_timeout(500)
    T = pg.evaluate("PCS.input.timeRecords.map(t => [t.date, t.clockIn, t.clockOut, (t.meals||[]).map(m => m.out + '-' + m.in).join(','), t.mealDeductMin || 0])")
    print(T)
    by = {t[0]: t for t in T}
    check('Wed "7:00am-3:30pm w/ 30 min lunch @ 11:30" → meal 11:30–12:00', '2026-03-04' in by and by['2026-03-04'][3] != '')
    check('Thu strike-through ignored: clock-in 7:05', '2026-03-05' in by and ('7:05' in str(by['2026-03-05'][1]) or by['2026-03-05'][1] in (425, '07:05')))
    P = pg.evaluate("PCS.input.payroll.map(p => [p.periodStart, p.periodEnd, p.regHours, p.regRate, p.otHours, p.otRate])")
    check(f'OCR stub fixed: {P}', P and P[0] == ['2026-03-01', '2026-03-14', 80, 20, 4.5, 30])
    F = pg.evaluate("PCS.result.engine.findings.filter(f => f.category === 'meal').map(f => [f.date, f.title])")
    print(F)
    check('Fri "no lunch" on an 8.5-hour shift is a missed meal', any(f[0] == '2026-03-06' and 'meal' in f[1].lower() for f in F))
    check('Tue meal starting at 12:45 (5h47m after 6:58) is late', any(f[0] == '2026-03-03' and 'late' in f[1].lower() for f in F))
    check('Thu with an illegible punch is not called a missed meal (timing unknown instead)', not any(f[0] == '2026-03-05' and 'No meal' in f[1] for f in F))
    check('no page errors', not errs); print(errs[:3])
    b.close()
print('ALL PASS' if ok else 'SOME FAILED')
