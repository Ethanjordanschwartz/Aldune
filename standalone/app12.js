/* Aldune standalone — part 12: link documents without downloading them (Google Drive, Dropbox, linked folders, payroll connectors),
   owner settings for integrations and public-site content. */
(() => {
'use strict';
const X = window.PCX; const { S, $, esc, toast, busy, idle, VIEWS } = X;
const loadScript = (src, attrs = {}) => new Promise((res, rej) => { if (document.querySelector(`script[src="${src}"]`)) return res(); const s = document.createElement('script'); s.src = src; Object.entries(attrs).forEach(([k, v]) => s.setAttribute(k, v)); s.onload = res; s.onerror = () => rej(new Error('blocked')); document.head.appendChild(s); });
const hostedOnly = 'This works when Aldune runs on its own web address (for example app.paycure.com). This preview window blocks outside scripts.';
const ACCEPT = /\.(pdf|docx|docm|doc|txt|rtf|csv|tsv|xlsx|xls|xlsm|xlsb|ods|fods|zip|png|jpe?g|webp)$/i;

// ---------- Dropbox Chooser: pick many files or whole folders' contents; files stream straight from Dropbox
async function fromDropbox(slot) {
  const key = S.cfg.integrations?.dropboxKey; if (!key) { toast('Dropbox isn’t set up yet — the workspace administrator adds a Dropbox app key in Settings → Integrations.'); return; }
  try { await loadScript('https://www.dropbox.com/static/api/2/dropins.js', { id: 'dropboxjs', 'data-app-key': key }); } catch { toast(hostedOnly); return; }
  window.Dropbox.choose({ multiselect: true, linkType: 'direct', folderselect: false, extensions: ['.pdf', '.docx', '.doc', '.txt', '.csv', '.xlsx', '.xls', '.zip', '.png', '.jpg', '.jpeg'],
    success: async files => {
      const out = []; busy('Fetching from Dropbox', `0 of ${files.length}`);
      for (const [i, f] of files.entries()) { try { const r = await fetch(f.link); if (!r.ok) throw new Error(); const b = await r.blob(); out.push(new File([b], f.name, { type: b.type })); } catch { toast(`Couldn’t fetch ${f.name}`); } const m = $('#ov-msg'); if (m) m.textContent = `${i + 1} of ${files.length} · ${f.name}`; }
      idle(); if (out.length) { S.imp.step = 0; X.setView('import'); await X.processFiles(out, slot || null); }
    } });
}
// ---------- Google Drive Picker: multi-select files (and folders’ files), downloaded with the user’s short-lived read-only token
async function fromDrive(slot) {
  const g = S.cfg.integrations || {}; if (!g.googleClientId || !g.googleApiKey) { toast('Google Drive isn’t set up yet — the workspace administrator adds a Google client ID and API key in Settings → Integrations.'); return; }
  try { await loadScript('https://apis.google.com/js/api.js'); await loadScript('https://accounts.google.com/gsi/client'); } catch { toast(hostedOnly); return; }
  await new Promise(r => window.gapi.load('picker', r));
  const token = await new Promise((res, rej) => { const c = window.google.accounts.oauth2.initTokenClient({ client_id: g.googleClientId, scope: 'https://www.googleapis.com/auth/drive.readonly', callback: t => (t.error ? rej(new Error(t.error)) : res(t.access_token)) }); c.requestAccessToken(); });
  const view = new window.google.picker.DocsView().setIncludeFolders(true).setSelectFolderEnabled(true);
  const picker = new window.google.picker.PickerBuilder().addView(view).enableFeature(window.google.picker.Feature.MULTISELECT_ENABLED).setOAuthToken(token).setDeveloperKey(g.googleApiKey)
    .setCallback(async data => {
      if (data.action !== window.google.picker.Action.PICKED) return;
      const api = (path) => fetch(`https://www.googleapis.com/drive/v3/${path}`, { headers: { Authorization: `Bearer ${token}` } });
      const items = []; const queue = [...data.docs];
      busy('Listing Google Drive files', '');
      while (queue.length && items.length < 3000) { const d = queue.shift(); if (d.mimeType === 'application/vnd.google-apps.folder') { let pageToken = ''; do { const r = await (await api(`files?q='${d.id}'+in+parents+and+trashed=false&fields=nextPageToken,files(id,name,mimeType)&pageSize=1000${pageToken ? `&pageToken=${pageToken}` : ''}`)).json(); (r.files || []).forEach(f => queue.push(f)); pageToken = r.nextPageToken || ''; } while (pageToken); } else items.push(d); }
      const files = [];
      for (const [i, f] of items.entries()) {
        const m = $('#ov-msg'); if (m) m.textContent = `${i + 1} of ${items.length} · ${f.name}`;
        try {
          if (String(f.mimeType).startsWith('application/vnd.google-apps.spreadsheet')) { const b = await (await api(`files/${f.id}/export?mimeType=text/csv`)).blob(); files.push(new File([b], `${f.name}.csv`)); }
          else if (String(f.mimeType).startsWith('application/vnd.google-apps.document')) { const b = await (await api(`files/${f.id}/export?mimeType=application/vnd.openxmlformats-officedocument.wordprocessingml.document`)).blob(); files.push(new File([b], `${f.name}.docx`)); }
          else if (ACCEPT.test(f.name)) { const b = await (await api(`files/${f.id}?alt=media`)).blob(); files.push(new File([b], f.name, { type: b.type })); }
        } catch { /* skip unreadable */ }
      }
      idle(); if (files.length) { S.imp.step = 0; X.setView('import'); await X.processFiles(files, slot || null); } else toast('No supported files were selected.');
    }).build();
  picker.setVisible(true);
}
X.fromDropbox = fromDropbox; X.fromDrive = fromDrive;

// ---------- "Link your documents" row at the top of the Import page
const baseImport = VIEWS.import;
VIEWS.import = el => {
  baseImport(el); if (S.imp.step !== 0) return;
  const anchor = el.querySelector('.grid.g3'); if (!anchor) return;
  anchor.insertAdjacentHTML('beforebegin', `<details class="link-more" style="margin:0 0 12px"><summary class="small" style="cursor:pointer;color:var(--ledger)">Link Google Drive, Dropbox, or a payroll system instead of uploading</summary><div class="row" style="margin-top:8px"><button class="btn" data-act="link-drive">Google Drive</button><button class="btn" data-act="link-dropbox">Dropbox</button><button class="btn" data-act="go" data-to="connect">Folder or payroll system</button></div></details>`);
};

// ---------- Connections page: cloud storage cards on top
const baseConnect = VIEWS.connect;
VIEWS.connect = el => {
  baseConnect(el);
  const i = S.cfg.integrations || {};
  el.querySelector('.alert')?.insertAdjacentHTML('beforebegin', `<div class="grid g2" style="margin-bottom:14px">
    <div class="panel"><h3 style="margin-top:0">Google Drive</h3><p class="small">Pick files or whole folders of pay stubs and timesheets — Google Sheets and Docs are converted automatically. Read-only access, used only for this import.</p><button class="btn primary" data-act="link-drive">Choose from Google Drive</button> ${i.googleClientId ? '<span class="chip ok">Set up</span>' : '<span class="chip">Needs setup</span>'}</div>
    <div class="panel"><h3 style="margin-top:0">Dropbox</h3><p class="small">Pick many files at once; they stream straight from Dropbox into Aldune.</p><button class="btn primary" data-act="link-dropbox">Choose from Dropbox</button> ${i.dropboxKey ? '<span class="chip ok">Set up</span>' : '<span class="chip">Needs setup</span>'}</div></div>`);
};

// ---------- owner settings: integrations and public-site content
const baseAdmin = VIEWS.admin;
VIEWS.admin = async el => {
  await baseAdmin(el); if (!S.isOwner) return;
  const i = S.cfg.integrations || {}; const c = S.cfg.site || {};
  el.insertAdjacentHTML('beforeend', `<div class="grid g2" style="margin-top:16px">
    <div class="panel"><h3 style="margin-top:0">Integrations</h3><p class="small muted">Keys are public client identifiers (no secrets). ${esc(hostedOnly)}</p>
      <label class="field">Dropbox app key<input id="ig-dbx" value="${esc(i.dropboxKey || '')}" placeholder="from dropbox.com/developers → App console"></label>
      <label class="field">Google OAuth client ID<input id="ig-gid" value="${esc(i.googleClientId || '')}" placeholder="xxxx.apps.googleusercontent.com"></label>
      <label class="field">Google API key (Picker)<input id="ig-gkey" value="${esc(i.googleApiKey || '')}"></label>
      <label class="field">Payroll connector endpoint (Aldune Cloud)<input id="ig-conn" value="${esc(S.cfg.connectorEndpoint || '')}" placeholder="https://app.paycure.com/api/connectors"></label>
      <button class="btn primary" style="margin-top:10px" data-act="save-integrations">Save integrations</button></div>
    <div class="panel"><h3 style="margin-top:0">Public site content</h3>
      <label class="field">Tagline<input id="sc-tag" value="${esc(c.tagline || '')}" placeholder="Compliance you can prove."></label>
      <label class="field">Mission (About page)<textarea id="sc-mis" rows="3">${esc(c.mission || '')}</textarea></label>
      <label class="field">Founder name<input id="sc-fn" value="${esc(c.founderName || '')}"></label><label class="field">Founder title<input id="sc-ft" value="${esc(c.founderTitle || '')}" placeholder="Founder & CEO"></label>
      <label class="field">Founder bio<textarea id="sc-fb" rows="3">${esc(c.founderBio || '')}</textarea></label>
      <label class="field">Contact email<input id="sc-ce" value="${esc(S.cfg.contact || '')}"></label>
      <button class="btn primary" style="margin-top:10px" data-act="save-site">Save site content</button> <button class="btn" data-act="show-public">Preview public site</button></div></div>`);
};
async function saveCfg(msg) { try { if (S.caps.db) await S.caps.db.doc('config/app').set(S.cfg); toast(msg); } catch (e) { toast(`Couldn’t save (${e.code || 'error'})`); } }
document.addEventListener('click', async e => {
  const a = e.target.closest('[data-act]'); if (!a) return;
  try {
    if (a.dataset.act === 'link-drive') await fromDrive(null);
    if (a.dataset.act === 'link-dropbox') await fromDropbox(null);
    if (a.dataset.act === 'save-integrations') { S.cfg.integrations = { dropboxKey: $('#ig-dbx').value.trim(), googleClientId: $('#ig-gid').value.trim(), googleApiKey: $('#ig-gkey').value.trim() }; S.cfg.connectorEndpoint = $('#ig-conn').value.trim(); await saveCfg('Integrations saved'); }
    if (a.dataset.act === 'save-site') { S.cfg.site = { tagline: $('#sc-tag').value.trim(), mission: $('#sc-mis').value.trim(), founderName: $('#sc-fn').value.trim(), founderTitle: $('#sc-ft').value.trim(), founderBio: $('#sc-fb').value.trim() }; S.cfg.contact = $('#sc-ce').value.trim(); await saveCfg('Site content saved'); }
  } catch (err) { idle(); toast(err.message === 'blocked' ? hostedOnly : (err.message || 'Something went wrong.')); }
});
})();
