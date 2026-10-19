/* Aldune — part 37: one honest Connections page.
   Before: eight look-alike cards (ADP, Paychex, …) that all did the same thing (link a folder). Now:
   1) choose your system → open its website in a new tab and get the exact exports Aldune needs from it;
   2) ONE linked folder for any system (scheduled reports land there; Sync picks up new files);
   3) Google Drive / Dropbox pickers; 4) direct API sync through Aldune Cloud where the vendor allows it.
   Every option says plainly what it does and whether it works in this window. */
(() => {
'use strict';
const X = window.PCX; const { S, esc, VIEWS } = X;
// [id, name, login URL, time export, payroll export, api]  — report names vary by plan and setup; the guide says so
const SYS = [
  ['adp-wfn', 'ADP Workforce Now', 'https://workforcenow.adp.com', 'Time & Attendance → Timecard (detail, with meal punches) — export to Excel', 'Reports → Payroll Register (earnings by code, hours, rates) for each pay period', 'partner'],
  ['adp-run', 'ADP RUN', 'https://runpayroll.adp.com', 'Time Tracking → Timecard detail export', 'Reports → Payroll Summary / Payroll Details (by employee)', 'partner'],
  ['paychex', 'Paychex Flex', 'https://myapps.paychex.com', 'Time and Attendance → Punch detail / Timecard report', 'Reports → Payroll Journal (by employee, with earnings codes)', 'partner'],
  ['gusto', 'Gusto', 'https://app.gusto.com', 'Time tools → Time sheets export (or your time app’s export)', 'Reports → Payroll journal (CSV)', 'oauth'],
  ['ukg', 'UKG Pro / Ready', 'https://www.ukg.com', 'Timekeeping → Timecard / punch detail (Genie or report library)', 'Payroll → Payroll register or earnings history', 'customer'],
  ['rippling', 'Rippling', 'https://app.rippling.com', 'Time & Attendance → Time entries export (with breaks)', 'Reports → Payroll journal / earnings by employee', 'oauth'],
  ['paylocity', 'Paylocity', 'https://access.paylocity.com', 'Time & Labor → Punch detail report', 'Reports → Payroll Register', 'customer'],
  ['paycom', 'Paycom', 'https://www.paycomonline.net', 'Time & Labor → Punch audit / timecard export', 'Reports → Payroll register', 'customer'],
  ['paycor', 'Paycor', 'https://secure.paycor.com', 'Time → Punch detail export', 'Reports → Payroll register', 'customer'],
  ['dayforce', 'Dayforce', 'https://www.dayforcehcm.com', 'Time → Timesheet / punch detail export', 'Reports → Pay register', 'customer'],
  ['workday', 'Workday', 'https://www.workday.com', 'Time Tracking → Time blocks report (custom report)', 'Payroll → Payroll results / pay register report', 'customer'],
  ['qbo', 'QuickBooks Payroll / Time', 'https://qbo.intuit.com', 'QuickBooks Time → Reports → Timesheet details', 'Reports → Payroll Details (or Payroll Summary by Employee)', 'oauth'],
  ['toast', 'Toast', 'https://www.toasttab.com/login', 'Employees → Time entries export (with breaks and tips)', 'Toast Payroll → Payroll register', 'partner'],
  ['square', 'Square', 'https://squareup.com/login', 'Team → Timecards → Export', 'Payroll → Reports → Payroll register', 'oauth'],
  ['homebase', 'Homebase', 'https://app.joinhomebase.com', 'Timesheets → Export (with breaks)', 'Payroll → Payroll journal (if you run payroll in Homebase)', 'partner'],
  ['7shifts', '7shifts', 'https://app.7shifts.com', 'Reports → Worked hours & wages / punch details', '— (payroll from your payroll provider)', 'partner'],
  ['deputy', 'Deputy', 'https://once.deputy.com', 'Timesheets → Export (with meal breaks)', '— (payroll from your payroll provider)', 'oauth'],
  ['wheniwork', 'When I Work', 'https://login.wheniwork.com', 'Attendance → Timesheets export', '— (payroll from your payroll provider)', 'oauth'],
  ['justworks', 'Justworks', 'https://secure.justworks.com', 'Time tracking → Timecards export', 'Reports → Payroll register', 'customer'],
  ['other', 'Another system, or Excel', '', 'Any timecard or punch export (CSV, Excel, PDF) — one row per punch or per shift', 'Any payroll register, journal, or pay stubs (CSV, Excel, PDF)', 'none']
];
const API_NOTE = { partner: 'Direct sync needs a vendor partner app and server-side credentials (some vendors also require a client certificate on every call).', oauth: 'Direct sync uses the vendor’s sign-in (OAuth) through Aldune Cloud.', customer: 'Direct sync uses API credentials your administrator creates in the system, stored by Aldune Cloud.', none: '' };
S.connSys = S.connSys || 'adp-wfn';

VIEWS.connect = el => {
  let framed = true; try { framed = window.self !== window.top; } catch { framed = true; }
  const fsOk = typeof window.showDirectoryPicker === 'function' && !framed;
  const ig = S.cfg.integrations || {}; const sys = SYS.find(s => s[0] === S.connSys) || SYS[0]; const [id, name, url, timeRep, payRep, api] = sys;
  const linked = (S.connLinked || {}).linked; const last = (S.connLast || {}).linked;
  const cloud = !!S.cfg.connectorEndpoint;
  el.innerHTML = X.head('Connections', 'Bring payroll and time records in from whatever system you use — without retyping anything.') + `
    <div class="panel"><h3 style="margin-top:0">1. Your payroll or timekeeping system</h3>
      <div class="row" style="align-items:flex-end;gap:12px;flex-wrap:wrap"><label class="field" style="min-width:260px;margin:0">System<select id="conn-sys">${SYS.map(s => `<option value="${s[0]}" ${s[0] === id ? 'selected' : ''}>${esc(s[1])}</option>`).join('')}</select></label>
      ${url ? `<a class="btn primary" href="${esc(url)}" target="_blank" rel="noopener" data-act="conn-open">Open ${esc(name)} ↗</a>` : ''}</div>
      <table style="margin-top:12px"><tbody>
        <tr><td style="width:150px"><b>Time records</b></td><td class="small">${esc(timeRep)}</td></tr>
        <tr><td><b>Payroll</b></td><td class="small">${esc(payRep)}</td></tr>
        <tr><td><b>Employee list</b></td><td class="small">Employee census with hire/termination dates, pay type, rate, and work location</td></tr>
      </tbody></table>
      ${url ? `<p class="small" style="margin:10px 0 0"><b>What the button does:</b> it opens ${esc(name)} in a new tab so you can sign in and export the reports above. It does not connect your account to Aldune — that is direct sync (section 4).</p>` : ''}
      <p class="cite" style="margin:8px 0 0">Report names vary by plan and setup. Aldune reads these exports as they come out of the system — CSV, Excel, or PDF; column names are matched automatically. Then drop them on the Import page, or let them land in the linked folder below.</p>
      <div class="row" style="margin-top:10px"><button class="btn" data-act="go" data-to="import">Go to Import</button></div></div>

    <div class="panel" style="margin-top:14px"><div class="row" style="justify-content:space-between;align-items:center"><h3 style="margin:0">2. Linked folder — any system</h3>${last ? `<span class="chip ok">Synced ${new Date(last).toLocaleDateString()}</span>` : '<span class="chip">Not linked</span>'}</div>
      <p class="small">Most systems can save or email reports on a schedule. Point them at one folder, link it here, and press Sync: Aldune imports only files it hasn’t seen. ${linked ? `Linked: <b>“${esc(linked)}”</b>.` : ''}</p>
      <div class="row">${fsOk ? `<button class="btn primary" data-act="conn-link" data-sys="linked">${linked ? 'Change folder' : 'Link folder'}</button>${linked ? '<button class="btn" data-act="conn-sync" data-sys="linked">Sync now</button>' : ''}<input type="file" webkitdirectory directory multiple data-connpick="linked" style="display:none">` : `<label class="btn primary" style="cursor:pointer">Choose folder<input type="file" webkitdirectory directory multiple data-connpick="linked" style="display:none"></label><span class="small muted">In this window, choose the folder each time (keeping it linked needs Aldune on its own address in Chrome or Edge).</span>`}</div></div>

    <div class="grid g2" style="margin-top:14px">
      <div class="panel"><h3 style="margin-top:0">3. Google Drive</h3><p class="small">Pick files or whole folders; Google Sheets and Docs are converted automatically. Read-only, for this import only.</p><button class="btn" data-act="link-drive">Choose from Google Drive</button> ${ig.googleClientId ? '<span class="chip ok">Ready</span>' : '<span class="chip">Administrator sets this up once</span>'}</div>
      <div class="panel"><h3 style="margin-top:0">Dropbox</h3><p class="small">Pick many files at once; they stream straight into Aldune.</p><button class="btn" data-act="link-dropbox">Choose from Dropbox</button> ${ig.dropboxKey ? '<span class="chip ok">Ready</span>' : '<span class="chip">Administrator sets this up once</span>'}</div>
    </div>

    <div class="panel" style="margin-top:14px"><h3 style="margin-top:0">4. Direct sync with ${esc(name)}</h3>
      ${api === 'none' ? '<p class="small">Use exports (1) or the linked folder (2).</p>' : cloud ? `<p class="small">${esc(API_NOTE[api])}</p><button class="btn primary" data-act="conn-api" data-sys="${esc(name.split(' ')[0])}">Connect ${esc(name)}</button>` : `<p class="small">${esc(API_NOTE[api])} That runs on Aldune Cloud, not in this browser window — it isn’t switched on for this workspace yet. Until it is, exports (1) and the linked folder (2) bring in the same records.</p>`}</div>`;
  el.querySelector('#conn-sys').addEventListener('change', e => { S.connSys = e.target.value; X.persist && X.persist(); X.render(); });
  el.querySelectorAll('[data-connpick]').forEach(i => i.addEventListener('change', async e => { const fl = [...e.target.files]; e.target.value = ''; if (!fl.length) return; S.connLast = { ...(S.connLast || {}), linked: new Date().toISOString() }; X.persist(); S.imp.step = 0; X.setView('import'); await X.processFiles(fl, null); }));
};
X.CONNECT_SYSTEMS = SYS;
})();
