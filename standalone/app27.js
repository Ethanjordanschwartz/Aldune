/* Aldune — part 27: agency & records requests (intake → deadlines → checklist → records packet), and the automatic audit brief */
(() => {
'use strict';
const X = window.PCX; const { PC, S, $, esc, money, toast, VIEWS } = X;
const iso = () => new Date().toISOString().slice(0, 10);
S.matters = S.matters || [];

// ======================================================= Agency & records requests
VIEWS.agency = el => {
  const emps = S.input?.employees || []; const types = Object.entries(PC.MATTER_LABEL);
  el.innerHTML = X.head('Agency & records requests', 'Log what arrived and Aldune sets the deadline, the checklist, and the records to produce.') + `
    <div class="panel"><h3 style="margin-top:0">Log a new request or notice</h3><div class="grid g3" style="grid-template-columns:repeat(4,minmax(0,1fr))">
      <label class="field">What arrived<select id="ag-type">${types.map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join('')}</select></label>
      <label class="field">Date received or served<input type="date" id="ag-date" value="${iso()}"></label>
      <label class="field">Employee (if any)<select id="ag-emp"><option value="">— none —</option>${emps.slice(0, 2000).map(e => `<option value="${esc(e.id)}">${esc(e.name)}</option>`).join('')}</select></label>
      <label class="field">Reference / case no.<input id="ag-ref" placeholder="Optional"></label></div>
      <button class="btn primary" data-act="ag-add" style="margin-top:8px">Add and set deadlines</button></div>
    ${S.matters.length ? S.matters.map((m, i) => { const p = PC.matterPlan(m); const e = emps.find(x => x.id === m.employeeId); const next = p.deadlines.find(d => d.kind === 'deadline') || p.deadlines[0]; const left = next ? Math.round((Date.parse(next.date) - Date.parse(iso())) / 864e5) : null;
      return `<div class="panel" style="margin-top:12px;border-left:5px solid ${left !== null && left <= 7 ? 'var(--flag)' : 'var(--ledger)'}"><div class="row" style="justify-content:space-between;align-items:flex-start;gap:12px"><div><h3 style="margin:0">${esc(PC.MATTER_LABEL[m.type])}</h3><div class="small muted">Received ${esc(m.received)}${e ? ` · ${esc(e.name)}` : ''}${m.ref ? ` · ${esc(m.ref)}` : ''}</div></div>${next ? `<span class="chip ${left !== null && left <= 7 ? 'flag' : 'warn'}">${left !== null && left >= 0 ? `${left} days left` : 'past due'} · ${esc(next.date)}</span>` : ''}</div>
        <table style="margin-top:8px"><tbody>${p.deadlines.map(d => `<tr><td class="small"><b>${esc(d.label)}</b><div class="cite">${esc(d.rule)} — ${esc(d.cite)}</div></td><td class="n">${esc(d.date)}</td></tr>`).join('')}</tbody></table>
        <div class="small" style="margin-top:6px"><b>Checklist</b><ul style="margin:4px 0">${p.checklist.map(c => `<li>${esc(c)}</li>`).join('')}</ul></div>
        <div class="row">${p.employeeRecords && m.employeeId && S.input ? `<button class="btn primary" data-act="ag-packet" data-i="${i}">Employee records packet (Excel)</button>` : ''}<button class="btn" data-act="ag-letter" data-i="${i}">Response cover letter (Word)</button><button class="btn" data-act="ag-ics" data-i="${i}">Add deadlines to calendar (.ics)</button><button class="btn" data-act="ag-del" data-i="${i}">Close</button></div><p class="cite" style="margin-top:6px">${esc(p.cite)}</p></div>`; }).join('') : '<p class="small muted" style="margin-top:12px">No open requests. When a records request, wage claim, citation, investigation letter, or PAGA notice arrives, log it here.</p>'}`;
};
const bates = (n) => `SPN-${String(n).padStart(6, '0')}`;
document.addEventListener('click', async e => {
  const a = e.target.closest('[data-act^="ag-"]'); if (!a) return; const i = +a.dataset.i; const m = S.matters[i];
  try {
    if (a.dataset.act === 'ag-add') { const type = $('#ag-type').value, received = $('#ag-date').value || iso(); const employeeId = $('#ag-emp').value || undefined; if (PC.matterPlan({ type, received }).employeeRecords && !employeeId) toast('Tip: pick the employee so Aldune can assemble their records packet.'); S.matters.unshift({ id: `m${Date.now()}`, type, received, employeeId, ref: $('#ag-ref').value.trim() || undefined, smallEmployer: (S.input?.employees.length || 0) < 100 }); X.persist(); X.log && X.log('agency.matter_added', { type }); X.render(); }
    if (a.dataset.act === 'ag-del') { if (!confirm('Close this matter?')) return; S.matters.splice(i, 1); X.persist(); X.render(); }
    if (a.dataset.act === 'ag-ics') { const p = PC.matterPlan(m); const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Aldune//Agency//EN', ...p.deadlines.flatMap((d, k) => ['BEGIN:VEVENT', `UID:aldune-${m.id}-${k}`, `DTSTAMP:${iso().replace(/-/g, '')}T000000Z`, `DTSTART;VALUE=DATE:${d.date.replace(/-/g, '')}`, `SUMMARY:${d.label} — ${PC.MATTER_LABEL[m.type]}`, `DESCRIPTION:${d.rule} (${d.cite})`, 'END:VEVENT']), 'END:VCALENDAR'].join('\r\n'); await X.save(`deadlines-${m.type}-${m.received}.ics`, new Blob([ics], { type: 'text/calendar' })); }
    if (a.dataset.act === 'ag-packet') { const r = PC.employeeRecords(S.input, m.employeeId); if (!r) { toast('That employee is not in the current audit.'); return; } const XL = PC.XLSX; const wb = XL.utils.book_new(); let n = 1;
      const cover = [['Employee records packet'], ['Employer', S.input.employerName], ['Employee', `${r.employee.name} (${r.employee.id})`], ['Request', PC.MATTER_LABEL[m.type]], ['Received', m.received], ['Prepared', iso()], [], ...Object.entries(r.employee).map(([k, v]) => [k.replace(/_/g, ' '), String(v)])];
      XL.utils.book_append_sheet(wb, XL.utils.aoa_to_sheet(cover), 'Cover');
      const tStart = n; XL.utils.book_append_sheet(wb, XL.utils.json_to_sheet(r.time.map(t => ({ bates: bates(n++), ...t }))), 'Time records');
      const pStart = n; XL.utils.book_append_sheet(wb, XL.utils.json_to_sheet(r.pay.map(p => ({ bates: bates(n++), ...p }))), 'Payroll');
      XL.utils.book_append_sheet(wb, XL.utils.aoa_to_sheet([['Production log'], ['Item', 'Bates range', 'Records'], ['Time records', r.time.length ? `${bates(tStart)}–${bates(pStart - 1)}` : '—', r.time.length], ['Payroll records', r.pay.length ? `${bates(pStart)}–${bates(n - 1)}` : '—', r.pay.length], ['Produced on', iso()]]), 'Production log');
      await X.save(`records-packet-${r.employee.id}-${iso()}.xlsx`, new Blob([XL.write(wb, { bookType: 'xlsx', type: 'array' })])); X.log && X.log('agency.packet', { type: m.type }); }
    if (a.dataset.act === 'ag-letter') { const p = PC.matterPlan(m); const e2 = S.input?.employees.find(x => x.id === m.employeeId); const r = m.employeeId && S.input ? PC.employeeRecords(S.input, m.employeeId) : null;
      await X.saveDocx([{ title: 'Response cover letter', draftBanner: 'DRAFT — prepared with Aldune. Attorney review recommended before sending.', blocks: [{ t: 'title', text: `Response — ${PC.MATTER_LABEL[m.type]}` }, { t: 'p', runs: [`${S.input?.employerName || '[[EMPLOYER]]'} · ${iso()}`] }, { t: 'p', runs: [`Re: ${m.ref ? `${m.ref} — ` : ''}${e2 ? e2.name : '[[EMPLOYEE / AGENCY]]'}; request received ${m.received}`] },
        { t: 'p', align: 'justify', runs: [r ? `Enclosed are the records responsive to the request: ${r.time.length.toLocaleString()} time records and ${r.pay.length.toLocaleString()} payroll records, Bates-numbered as shown in the enclosed production log. ${S.input?.employerName || 'The employer'} reserves all objections and does not waive any privilege or protection by this production.` : `${S.input?.employerName || 'The employer'} acknowledges receipt and will respond by ${p.deadlines[0]?.date || '[[DATE]]'}. ${S.input?.employerName || 'The employer'} reserves all rights, objections, and defenses.`] },
        { t: 'table', head: ['Deadline', 'Date', 'Authority'], rows: p.deadlines.map(d => [d.label, d.date, d.cite]) }, { t: 'signature', lines: [{ label: '[[NAME, TITLE]]' }] }, { t: 'p', runs: [{ text: p.cite, italic: true }] }] }], `response-${m.type}-${iso()}.docx`); }
  } catch (err) { toast(err.message); }
});

// ======================================================= Automatic audit brief (top of the dashboard)
S.briefHidden = S.briefHidden || {};
const baseExec = VIEWS.exec;
VIEWS.exec = el => {
  baseExec(el); if (!S.result || S.pov === 'plaintiff') return; const key = S.result.engine.meta.inputHash; if (S.briefHidden[key]) return;
  const snaps = (S.snapshots || []).filter(s => s.employer === S.input.employerName); const prev = snaps.filter(s => !String(s.id).endsWith(key)).slice(-1)[0];
  const sc = PC.scorecard(S.input, S.result); const fps = X.fpOf ? X.fpOf() : []; const pro = PC.proactiveAlerts(S.input, S.result, iso(), { noticeDate: S.readiness?.noticeDate || undefined });
  const owed = S.result.engine.employees.reduce((t, e) => t + e.exposure.wagesAndPremiums + e.exposure.reimbursement, 0);
  const todo = [sc.overall === null ? 'Add the missing records so every area can be tested (Fix queue, step 1).' : null, owed > 0 ? `Pay ${money(owed)} owed to workers — payroll file and letters are ready in the Fix queue.` : null, fps[0] ? `Fix the system problem behind many findings: ${fps[0].title.toLowerCase()}.` : null, pro[0] ? pro[0].title + '.' : null].filter(Boolean).slice(0, 3);
  el.querySelector('.kpis')?.insertAdjacentHTML('beforebegin', `<div class="panel" style="margin-bottom:14px;background:linear-gradient(135deg,#F4FAF7,#FFFFFF)"><div class="row" style="justify-content:space-between;align-items:center"><h3 style="margin:0">Your audit, in 30 seconds</h3><button class="btn" style="padding:2px 10px" data-act="brief-hide" aria-label="Hide the brief">Hide</button></div>
    <p class="small" style="margin:6px 0">${sc.overall === null ? `Incomplete — ${sc.coverage}% of areas could be tested.` : `Compliance grade <b>${sc.grade} (${sc.overall}/100)</b>.`} ${prev ? `Since your last saved run (${esc(prev.windowEnd)}): exposure ${S.result.exposure.base >= prev.exposureBase ? 'up' : 'down'} <b>${money(Math.abs(S.result.exposure.base - prev.exposureBase))}</b>${prev.grade && sc.overall !== null ? `, grade ${esc(prev.grade)} → ${sc.grade}` : ''}.` : 'Save this run on Monitoring to track changes month to month.'}</p>
    <ol class="small" style="margin:4px 0 8px">${todo.map(t => `<li>${esc(t)}</li>`).join('')}</ol><div class="row"><button class="btn primary" data-act="go" data-to="fixqueue">Open the Fix queue</button><button class="btn" data-act="go" data-to="monitor">Save this run</button></div></div>`);
};
document.addEventListener('click', e => { if (e.target.closest('[data-act="brief-hide"]') && S.result) { S.briefHidden[S.result.engine.meta.inputHash] = true; X.persist(); X.render(); } });
X.render();
})();
