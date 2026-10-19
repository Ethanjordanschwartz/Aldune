/* Aldune — part 28: the audit survives reloads, viewer remounts, and backgrounded tabs (IndexedDB) */
(() => {
'use strict';
const X = window.PCX, H = window.PCX_HOOKS; const { S, toast } = X;
const KEY = 'audit:current'; let restoring = false;
// ---- account storage (works inside the Claude viewer, where IndexedDB can be blocked): gzip + chunks under the per-document limit
const CHUNK = 180000;
const b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = t => Uint8Array.from(atob(t), c => c.charCodeAt(0));
async function gz(text) { if (typeof CompressionStream === 'undefined') return { data: text, gz: false }; const cs = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip')); return { data: b64(new Uint8Array(await new Response(cs).arrayBuffer())), gz: true }; }
async function gunz(data, isGz) { if (!isGz) return data; const ds = new Blob([unb64(data)]).stream().pipeThrough(new DecompressionStream('gzip')); return await new Response(ds).text(); }
// test hook (test mode only): a mock account database to simulate the Claude viewer
const testDb = () => { if (window.__PAYCURE_TEST__ && window.__TEST_CAPS_DB__) { S.caps = Object.assign(S.caps || {}, { db: window.__TEST_CAPS_DB__, uid: 'test-user' }); } };
const acctPath = () => { testDb(); return S.caps && S.caps.db && S.caps.uid ? `data/users/${S.caps.uid}/store/audit` : null; };
async function saveToDb(db, base, rec) {
  const { data, gz: isGz } = await gz(JSON.stringify(rec)); const n = Math.ceil(data.length / CHUNK);
  for (let i = 0; i < n; i++) await db.doc(`${base}/c${i}`).set({ i, part: data.slice(i * CHUNK, (i + 1) * CHUNK) });
  await db.doc(`${base}/meta`).set({ chunks: n, gz: isGz, savedAt: rec.savedAt, label: rec.label, view: rec.view });
}
async function loadFromDb(db, base) {
  const m = await db.doc(`${base}/meta`).get(); if (!m.exists) return null; const meta = m.data(); let data = '';
  for (let i = 0; i < meta.chunks; i++) { const c = await db.doc(`${base}/c${i}`).get(); if (!c.exists) return null; data += c.data().part; }
  return JSON.parse(await gunz(data, meta.gz));
}
X.auditStore = { saveToDb, loadFromDb, CHUNK }; // exposed for tests
// save after every successful analysis (normalized records only — never the original files)
const prevAfter = H.afterRun;
H.afterRun = async source => {
  if (prevAfter) await prevAfter(source);
  if (restoring || !S.input || !S.result) return;
  const rec = { v: 1, savedAt: new Date().toISOString(), source: source || 'upload', label: S.result.engine.meta.label || S.auditLabel || 'Audit', input: S.input, assumptions: S.assumptions || null, extraChecks: S.extraChecks || [], view: S.view };
  let saved = false;
  try { await X.kvSet(KEY, rec); saved = true; } catch (e) { console.warn('IndexedDB unavailable:', e && e.name); }
  const base = acctPath(); if (base) { try { await saveToDb(S.caps.db, base, rec); saved = true; } catch (e) { console.warn('Account save failed:', e && e.code); } }
  if (!saved) toast('This browser blocks saving — the audit will need to be re-run after a reload.');
};
// remember the page the user is on, so a reload returns there
const baseSetView = X.setView; X.setView = v => { baseSetView(v); if (S.result) X.kvGet(KEY).then(d => { if (d && d.view !== v) { d.view = v; return X.kvSet(KEY, d); } }).catch(() => {}); };
X.clearSavedAudit = async () => { try { await X.kvSet(KEY, null); } catch { /* ignore */ } const base = acctPath(); if (base) { try { await S.caps.db.doc(`${base}/meta`).delete(); } catch { /* ignore */ } } };
async function restore() {
  if (S.result || S.input) return;
  let d = null; try { d = await X.kvGet(KEY); } catch { d = null; }
  const base = acctPath(); if (base) { try { const a = await loadFromDb(S.caps.db, base); if (a && (!d || (a.savedAt || '') > (d.savedAt || ''))) d = a; } catch { /* ignore */ } }
  if (!d || !d.input || !d.input.employees) return;
  restoring = true; const viewAtStart = S.view; const explicitRoute = /#\/app\/[a-z]/i.test(location.hash);
  try { S.assumptions = d.assumptions; S.extraChecks = d.extraChecks || []; await X.runPipeline(d.input, d.label, d.source);
    if (S.result) { toast('Your last audit is restored.');
      // return to where they were — unless the link names a page, or they navigated while it restored
      if (explicitRoute) X.setView(viewAtStart); else if (d.view && d.view !== 'public') X.setView(d.view); } }
  catch (e) { console.warn('Could not restore the saved audit:', e); }
  finally { restoring = false; }
}
// clear the saved audit only when the audit itself is gone (account deleted, or “Clear everything” cleared the analysis)
document.addEventListener('click', e => { const a = e.target.closest('[data-act]'); if (!a) return; if (['delete-account', 'bulk-clear'].includes(a.dataset.act)) setTimeout(() => { if (!S.result) X.clearSavedAudit(); }, 50); });
// restore once the app is ready (and only for signed-in / test sessions)
const start = async () => { for (let i = 0; i < 40 && S.caps === undefined; i++) await new Promise(r => setTimeout(r, 100)); if (window.__PAYCURE_TEST__ || !(X.signedOut && X.signedOut())) restore(); };
setTimeout(start, 0);
})();
