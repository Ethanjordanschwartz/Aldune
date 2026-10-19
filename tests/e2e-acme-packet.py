# E2E: the user's third-party records packet (one Word file, 8 employees) and its PDF version go through Import → Analyze.
# Expect 8 workers, 7 flagged, Jennifer White clean, and the answer-key figures on the worker pages.
import os, sys
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); A = os.path.join(ROOT, 'tests/fixtures/acme')
ok = True
def check(label, cond):
    global ok; print(('PASS ' if cond else 'FAIL ') + label); ok = ok and bool(cond)
with sync_playwright() as p:
    b = p.chromium.launch()
    for f in ['acme_packet.docx', 'acme_packet.pdf']:
        pg = b.new_page(viewport={'width': 1400, 'height': 950}); pg.add_init_script('window.__PAYCURE_TEST__=true'); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept())
        pg.goto('file://' + os.path.join(ROOT, 'dist/paycure-standalone.html')); pg.wait_for_timeout(700)
        pg.evaluate("PCX.setView('import')")
        pg.set_input_files('#bulk-files', [os.path.join(A, f)]); pg.wait_for_selector('[data-act="imp-analyze"]', timeout=60000); pg.wait_for_timeout(400)
        it = pg.evaluate("PCS.bulk.items.map(i => [i.kind, i.note, (i.details||[]).length])")
        check(f'{f}: read as a records packet with 8 employees', it and it[0][0] == 'packet' and it[0][1].startswith('8 employees') and it[0][2] == 8)
        check(f'{f}: employer name read cleanly', pg.input_value('#im-name') == 'Acme Retail Group, Inc.')
        pg.screenshot(path=f'/tmp/acme_import_{f}.png')
        pg.click('[data-act="imp-analyze"]'); pg.wait_for_selector('text=Likely exposure', timeout=60000); pg.wait_for_timeout(500)
        st = pg.evaluate("(() => { const r = PCS.result; const by = {}; for (const f of r.engine.findings) { if (f.confidence === 'low') continue; (by[f.employeeId] ||= {w:0,l:0,p:0,r:0}); const k = f.amountKind; if (k==='wages'||k==='premium') by[f.employeeId].w += f.amount; else if (k==='liquidated') by[f.employeeId].l += f.amount; else if (k==='penalty') by[f.employeeId].p += f.amount; else if (k==='reimbursement') by[f.employeeId].r += f.amount; } return { n: PCS.result.engine.employeeSummaries ? PCS.result.engine.employeeSummaries.length : null, emps: r.engine.findings.map(f=>f.employeeId).filter((v,i,a)=>a.indexOf(v)===i), by, workers: (PCS.imp.norm||{}).input ? PCS.imp.norm.input.employees.length : null }; })()")
        r2 = lambda x: round(x, 2)
        by = st['by']; w = lambda e: r2(by.get(e, {}).get('w', 0))
        check(f'{f}: 8 workers analyzed', st['workers'] == 8)
        check(f'{f}: 7 flagged, Jennifer clean', len(st['emps']) == 7 and 'E-1007' not in st['emps'])
        print('   per worker:', {k: {kk: r2(vv) for kk, vv in v.items()} for k, v in by.items()})
        loc = [w('E-1001') == 144, w('E-1004') == 726.92, w('E-1005') == 26.5, r2(by.get('E-1006', {}).get('p', 0)) == 1680, w('E-1008') == 33.75]
        check(f'{f}: Maria 144, Robert 726.92, Ashley 26.50, David 1680, Carlos 33.75', all(loc))
        # Los Angeles worksite → city minimum wage $17.87 for Linda and James
        check(f'{f}: Linda at LA minimum wage 149.60 + 149.60 liquidated', w('E-1003') == 149.6 and r2(by['E-1003']['l']) == 149.6)
        check(f'{f}: James 213.43 (LA rate)', w('E-1002') == 213.43)
        check(f'{f}: no page errors', not errs); errs and print(errs[:3])
        pg.screenshot(path=f'/tmp/acme_dash_{f}.png'); pg.close()
    for f in ['acme_packet2.docx', 'acme_packet2.pdf']:
        pg = b.new_page(viewport={'width': 1400, 'height': 950}); pg.add_init_script('window.__PAYCURE_TEST__=true'); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept())
        pg.goto('file://' + os.path.join(ROOT, 'dist/paycure-standalone.html')); pg.wait_for_timeout(700)
        pg.evaluate("PCX.setView('import')")
        pg.set_input_files('#bulk-files', [os.path.join(A, f)]); pg.wait_for_selector('[data-act="imp-analyze"]', timeout=60000); pg.wait_for_timeout(400)
        it = pg.evaluate("PCS.bulk.items.map(i => [i.kind, i.note, (i.details||[]).length])")
        check(f'{f}: records packet with 13 employees', it and it[0][0] == 'packet' and it[0][1].startswith('13 employees'))
        pg.click('[data-act="imp-analyze"]'); pg.wait_for_selector('text=Likely exposure', timeout=60000); pg.wait_for_timeout(500)
        st = pg.evaluate("(() => { const by = {}; for (const f of PCS.result.engine.findings) { if (f.confidence === 'low' || !(f.amount > 0)) continue; (by[f.employeeId] ||= {w:0}); if (f.amountKind==='wages'||f.amountKind==='premium') by[f.employeeId].w += f.amount; } return by; })()")
        w = lambda e: round(st.get(e, {}).get('w', 0), 2)
        check(f'{f}: 12 flagged, control E-2009 clean', len(st) == 12 and 'E-2009' not in st)
        check(f'{f}: key figures (Robert 123.33, Hannah 600, Kevin 504.81, Victor 920, Taylor 62.10, LA Daniel 213.37, Emily 321.60)', [w('E-2003'), w('E-2007'), w('E-2008'), w('E-2012'), w('E-2013'), w('E-2004'), w('E-2005')] == [123.33, 600, 504.81, 920, 62.1, 213.37, 321.6]) or print('   ', {k: w(k) for k in st})
        check(f'{f}: no page errors', not errs); pg.close()
    for f in ['acme_packet3.docx', 'acme_packet3.pdf']:
        pg = b.new_page(viewport={'width': 1400, 'height': 950}); pg.add_init_script('window.__PAYCURE_TEST__=true'); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept())
        pg.goto('file://' + os.path.join(ROOT, 'dist/paycure-standalone.html')); pg.wait_for_timeout(700)
        pg.evaluate("PCX.setView('import')")
        pg.set_input_files('#bulk-files', [os.path.join(A, f)]); pg.wait_for_selector('[data-act="imp-analyze"]', timeout=60000); pg.wait_for_timeout(400)
        it = pg.evaluate("PCS.bulk.items.map(i => [i.kind, i.note])")
        check(f'{f}: records packet with 43 employees', it and it[0][0] == 'packet' and it[0][1].startswith('43 employees'))
        pg.click('[data-act="imp-analyze"]'); pg.wait_for_selector('text=Likely exposure', timeout=60000); pg.wait_for_timeout(500)
        st = pg.evaluate("(() => { const nm = new Map(PCS.input.employees.map(e => [e.id, e.name])); const by = {}; for (const f of PCS.result.engine.findings) { if (f.confidence === 'low' || f.amountKind === 'liquidated') continue; const n = nm.get(f.employeeId); (by[n] ||= 0); by[n] += f.amount; } return by; })()")
        w = lambda n: round(st.get(n, 0), 2)
        check(f'{f}: key figures (Xavier 2304, Ana 152, George 120, Aisha 778.85, Blake 900, Priya mileage, Quinn 31.67, Sergio split)', [w('Xavier Reed'), w('Ana Torres'), w('George Lin'), w('Aisha Bello'), w('Blake Turner'), w('Quinn Barnes'), w('Rita Mendez'), w('Yara Costa'), w('Zane Miller')] == [2304, 152, 120, 778.85, 900, 31.67, 36, 800, 880]) or print('   ', st)
        check(f'{f}: clean controls untouched', all(w(n) == 0 for n in ['Chen Wu', 'Frank Hughes', 'Olivia Grant', 'Jack Nolan', 'Tina Alvarez', 'Umar Siddiqui', 'Tara Oyelaran']))
        sc = pg.evaluate("(() => { const s = PC.scorecard(PCS.input, PCS.result); return Object.fromEntries(s.areas.map(a => [a.key, a.grade])); })()")
        check(f'{f}: no area with issues is graded A', all(g != 'A' for g in sc.values()))
        check(f'{f}: no page errors', not errs); pg.close()
    # set 4: full punches, no pay stubs — the exact way a user uploads it: the big drop zone (with the answer key in the same
    # batch, which must be set aside), and each slot's own file picker
    for how, sel, files in [('drop zone + answer key', '#bulk-files', ['acme_packet4.docx', 'acme_packet4_key.docx']), ('time slot', '[data-slotfiles="time"]', ['acme_packet4.docx']), ('payroll slot', '[data-slotfiles="payroll"]', ['acme_packet4.docx']), ('employees slot', '[data-slotfiles="employees"]', ['acme_packet4.docx'])]:
        pg = b.new_page(viewport={'width': 1400, 'height': 950}); pg.add_init_script('window.__PAYCURE_TEST__=true'); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept())
        pg.goto('file://' + os.path.join(ROOT, 'dist/paycure-standalone.html')); pg.wait_for_timeout(700)
        pg.evaluate("PCX.setView('import')"); pg.wait_for_timeout(200)
        pg.set_input_files(sel, [os.path.join(A, f) for f in files]); pg.wait_for_selector('[data-act="imp-analyze"]', timeout=60000); pg.wait_for_timeout(600)
        it = pg.evaluate("PCS.bulk.items.map(i => [i.kind, i.note || ''])")
        check(f'set 4 via {how}: read as a records packet (50 employees, 208 work periods)', any(k == 'packet' and n.startswith('50 employees') and '208 shifts' in n for k, n in it)) or print('   ', it)
        if len(files) > 1: check(f'set 4 via {how}: answer key set aside, not read as records', any(k == 'skipped' and 'Answer key' in n for k, n in it)) or print('   ', it)
        pg.click('[data-act="imp-analyze"]'); pg.wait_for_selector('text=Likely exposure', timeout=60000); pg.wait_for_timeout(500)
        tr = pg.evaluate("PCS.input.timeRecords.length")
        check(f'set 4 via {how}: every shift reached the audit ({tr})', tr == 208)
        st = pg.evaluate("(() => { const nm = new Map(PCS.input.employees.map(e => [e.id, e.name])); const by = {}; for (const f of PCS.result.engine.findings) { if (f.confidence === 'low' || f.amountKind === 'liquidated') continue; const n = nm.get(f.employeeId); (by[n] ||= 0); by[n] += f.amount; } return by; })()")
        w = lambda n: round(st.get(n, 0), 2)
        check(f'set 4 via {how}: key figures (George 240, Hana 95, Ivan 84, Noah 50, Quinn 31.67, Nadia 120, Farah 49.60, Victor 269.60)', [w('George Lin'), w('Hana Suzuki'), w('Ivan Petrov'), w('Noah Reed'), w('Quinn Barnes'), w('Nadia Haddad'), w('Farah Khan'), w('Victor Alvarez')] == [240, 95, 84, 50, 31.67, 120, 49.6, 269.6]) or print('   ', st)
        check(f'set 4 via {how}: clean controls untouched', all(w(n) == 0 for n in ['Olivia Grant', 'Jack Nolan', 'Tara Oyelaran', 'Grace Kim', 'Hassan Ali', 'Rebecca Stone', 'Tina Alvarez', 'Umar Siddiqui', 'Chen Wu', 'Frank Hughes']))
        body = pg.inner_text('body')
        check(f'set 4 via {how}: no "No time records were added" message', 'No time records were added' not in body)
        sc = pg.evaluate("(() => { const s = PC.scorecard(PCS.input, PCS.result); return Object.fromEntries(s.areas.map(a => [a.key, a.state])); })()")
        check(f'set 4 via {how}: meal and rest are assessed; overtime waits for payroll', sc.get('meal') == 'VIOLATION' and sc.get('rest') == 'VIOLATION' and sc.get('overtime') in ('PARTIAL', 'NOT_TESTED', 'VIOLATION')) or print('   ', sc)
        check(f'set 4 via {how}: no page errors', not errs) or print('   ', errs[:2]); pg.close()
    # set 5: 75 employees, punches for 31, no stubs — through the drop zone with the answer key in the same batch
    pg = b.new_page(viewport={'width': 1400, 'height': 950}); pg.add_init_script('window.__PAYCURE_TEST__=true'); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept())
    pg.goto('file://' + os.path.join(ROOT, 'dist/paycure-standalone.html')); pg.wait_for_timeout(700)
    pg.evaluate("PCX.setView('import')"); pg.wait_for_timeout(200)
    pg.set_input_files('#bulk-files', [os.path.join(A, f) for f in ['acme_packet5.docx', 'acme_packet5_key.docx']]); pg.wait_for_selector('[data-act="imp-analyze"]', timeout=60000); pg.wait_for_timeout(600)
    it = pg.evaluate("PCS.bulk.items.map(i => [i.kind, i.note || ''])")
    check('set 5: packet with 75 employees, answer key set aside', any(k == 'packet' and n.startswith('75 employees') for k, n in it) and any(k == 'skipped' for k, n in it)) or print('   ', it)
    pg.click('[data-act="imp-analyze"]'); pg.wait_for_selector('text=Likely exposure', timeout=60000); pg.wait_for_timeout(500)
    st = pg.evaluate("(() => { const nm = new Map(PCS.input.employees.map(e => [e.id, e.name])); const by = {}, states = {}; for (const f of PCS.result.engine.findings) { const n = nm.get(f.employeeId); (states[n] ||= []).push(f.state); if (f.state !== 'VIOLATION' || f.amountKind === 'liquidated') continue; by[n] = (by[n] || 0) + f.amount; } return { by, states }; })()")
    w = lambda n: round(st['by'].get(n, 0), 2)
    check('set 5: key figures (George 240, Hana 95, Nadia 120, Jose 120, Leon 560, Sofia 200)', [w('George Lin'), w('Hana Suzuki'), w('Nadia Haddad'), w('Jose Marin'), w('Leon Bishop'), w('Sofia Marquez')] == [240, 95, 120, 120, 560, 200]) or print('   ', st['by'])
    check('set 5: traps have no VIOLATION', all('VIOLATION' not in st['states'].get(n, []) for n in ['Jack Nolan', 'Hassan Ali', 'Alice Monroe', 'Grace Kim', 'Derek Hunt', 'Sara Holt', 'Victor Hughes', 'Dawn Porter', 'Olivia Grant']))
    pg.evaluate("PCX.setView('findings')"); pg.wait_for_timeout(500)
    body = pg.inner_text('#views')
    check('set 5: findings list shows potential and cleared states', 'potential' in body.lower() and ('if unpaid' in body.lower() or 'cleared' in body.lower() or 'not priced' in body.lower()))
    check('set 5: no page errors', not errs) or print('   ', errs[:2]); pg.close()
    b.close()
print('ALL PASS' if ok else 'SOME FAILED'); sys.exit(0 if ok else 1)
