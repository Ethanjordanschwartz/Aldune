/* Aldune — part 36: reproducible audits.
   Every run is saved with everything needed to reproduce it exactly: the records as read, the assumptions (including the
   audit date), custom rules, rule versions, and software version. From the Audit trail you can re-run any saved audit
   and see whether it reproduces to the cent (and why not, if rules have changed since), open it as the current audit,
   or download a reproduction certificate. Runs are saved in this browser, per account; the newest 25 are kept. */
(() => {
'use strict';
const X = window.PCX; const { PC, S, esc, money, toast } = X; const H = window.PCX_HOOKS; const VIEWS = X.VIEWS;
const KEY = () => `runs:${(S.account && S.account.email) || 'local'}`; const MAX = 25;
let cache = null;
async function list() { if (cache) return cache; let v = null; try { v = await X.kvGet(KEY()); } catch { v = null; } cache = Array.isArray(v) ? v : []; return cache; }
async function store() { try { await X.kvSet(KEY(), cache); } catch (e) { console.warn('IndexedDB unavailable:', e && e.name); } }

// a compact, order-independent summary of what a run produced — compared field by field when reproducing
function summarize(result) {
  const F = result.engine.findings; const by = {}; const st = { VIOLATION: 0, POTENTIAL: 0, SUPPRESSED: 0 };
  for (const f of F) { const k = f.ruleId; by[k] = Math.round(((by[k] || 0) + (f.state === 'VIOLATION' ? f.amount : 0)) * 100) / 100; st[f.state || (f.confidence === 'low' ? 'POTENTIAL' : 'VIOLATION')]++; }
  const owed = Math.round(result.engine.employees.reduce((t, x) => t + x.exposure.wagesAndPremiums + x.exposure.reimbursement, 0) * 100) / 100;
  return { findings: F.length, states: st, owed, base: Math.round((result.exposure?.base || 0) * 100) / 100, byRule: by, workers: result.engine.employees.length, shifts: result.engine.shifts.length };
}
X.runSummary = summarize;

const baseAfter = H.afterRun;
H.afterRun = async (source, ...rest) => {
  if (baseAfter) await baseAfter(source, ...rest);
  try {
    if (!S.input || !S.result) return; await list();
    const m = S.result.engine.meta;
    const rec = { id: `r${Date.now().toString(36)}`, ranAt: m.ranAt, label: S.label || S.input.employerName || 'Audit', employer: S.input.employerName || '', source: source || S.source || '', inputHash: m.inputHash, auditDate: m.assumptions.auditDate,
      assumptions: JSON.parse(JSON.stringify(S.assumptions || m.assumptions)), extraChecks: JSON.parse(JSON.stringify(S.extraChecks || [])), ruleVersions: m.ruleVersions, softwareVersion: m.softwareVersion,
      input: JSON.parse(JSON.stringify(S.input)), summary: summarize(S.result) };
    // the same records, assumptions, and rules already saved: keep one copy (the newest)
    cache = [rec, ...cache.filter(x => !(x.inputHash === rec.inputHash && JSON.stringify(x.assumptions) === JSON.stringify(rec.assumptions) && JSON.stringify(x.ruleVersions) === JSON.stringify(rec.ruleVersions)))].slice(0, MAX);
    await store();
  } catch (e) { console.warn('run not saved', e); }
};

function compare(a, b) {
  const diffs = [];
  const keys = ['findings', 'owed', 'base', 'workers', 'shifts']; const names = { findings: 'Findings', owed: 'Owed to workers', base: 'Base exposure', workers: 'Workers', shifts: 'Shifts' };
  for (const k of keys) if (Math.abs((a[k] || 0) - (b[k] || 0)) > 0.005) diffs.push([names[k], a[k], b[k], k !== 'findings' && k !== 'workers' && k !== 'shifts']);
  for (const s of ['VIOLATION', 'POTENTIAL', 'SUPPRESSED']) if ((a.states?.[s] || 0) !== (b.states?.[s] || 0)) diffs.push([`${s.charAt(0) + s.slice(1).toLowerCase()} findings`, a.states?.[s] || 0, b.states?.[s] || 0, false]);
  for (const r of new Set([...Object.keys(a.byRule || {}), ...Object.keys(b.byRule || {})])) if (Math.abs((a.byRule[r] || 0) - (b.byRule[r] || 0)) > 0.005) diffs.push([`${r} amount`, a.byRule[r] || 0, b.byRule[r] || 0, true]);
  return diffs;
}
function reproduce(rec) {
  const now = PC.runAudit(rec.input, rec.assumptions, rec.extraChecks || []);
  const sum = summarize(now); const diffs = compare(rec.summary, sum);
  const curRules = now.engine.meta.ruleVersions; const changed = Object.keys({ ...rec.ruleVersions, ...curRules }).filter(k => rec.ruleVersions[k] !== curRules[k]).map(k => `${k}: ${rec.ruleVersions[k] || '—'} → ${curRules[k] || 'removed'}`);
  return { sum, diffs, changed, hash: now.engine.meta.inputHash, hashOk: now.engine.meta.inputHash === rec.inputHash, softwareNow: now.engine.meta.softwareVersion };
}
X.reproduceRun = async id => { const r = (await list()).find(x => x.id === id); return r ? reproduce(r) : null; };

function panel(runs) {
  const rep = S.repro || {};
  return `<div class="panel" id="repro-panel" style="margin-bottom:16px"><h3 style="margin-top:0">Saved runs — reproduce any audit</h3>
    <p class="small muted" style="margin:0 0 10px">Each run keeps the records as read, the assumptions (including the audit date), custom rules, and rule versions. Re-run it to confirm the same findings and amounts, or open it as the current audit.</p>
    ${runs.length ? `<div class="tablewrap"><table><thead><tr><th>Run</th><th>Records</th><th class="n">Findings</th><th class="n">Owed now</th><th>Fingerprint</th><th></th></tr></thead><tbody>${runs.map(r => `<tr><td><b>${esc(r.label)}</b><div class="cite">${new Date(r.ranAt).toLocaleString()} · audit date ${esc(r.auditDate)}</div></td><td class="small">${r.summary.workers.toLocaleString()} workers · ${r.summary.shifts.toLocaleString()} shifts</td><td class="n">${r.summary.findings.toLocaleString()}</td><td class="n">${money(r.summary.owed, true)}</td><td class="small"><code>${esc(r.inputHash)}</code></td><td style="white-space:nowrap"><button class="btn primary" data-act="repro-run" data-id="${esc(r.id)}">Reproduce</button> <button class="btn" data-act="repro-open" data-id="${esc(r.id)}">Open</button> <button class="btn" data-act="repro-cert" data-id="${esc(r.id)}">Certificate</button></td></tr>
      ${rep.id === r.id ? `<tr><td colspan="6">${rep.res.diffs.length ? `<div class="alert high"><b>Did not reproduce exactly.</b> ${rep.res.changed.length ? `Rules changed since this run: ${esc(rep.res.changed.join('; '))}.` : ''} ${!rep.res.hashOk ? 'The records fingerprint differs.' : ''}<table style="margin-top:6px"><thead><tr><th>Measure</th><th class="n">Saved run</th><th class="n">Re-run now</th></tr></thead><tbody>${rep.res.diffs.slice(0, 12).map(([n, a, b, $]) => `<tr><td>${esc(n)}</td><td class="n">${$ ? money(a, true) : a}</td><td class="n">${$ ? money(b, true) : b}</td></tr>`).join('')}</tbody></table></div>` : `<div class="alert ok" style="border-left:4px solid var(--ok)"><b>Reproduced exactly.</b> Same records fingerprint (${esc(rep.res.hash)}), same ${rep.res.sum.findings.toLocaleString()} findings (${rep.res.sum.states.VIOLATION} violations, ${rep.res.sum.states.POTENTIAL} potential, ${rep.res.sum.states.SUPPRESSED} cleared), same ${money(rep.res.sum.owed, true)} owed and ${money(rep.res.sum.base, true)} base exposure.${rep.res.changed.length ? ` Note: rule versions changed since (${esc(rep.res.changed.join('; '))}) without changing these results.` : ''}</div>`}</td></tr>` : ''}`).join('')}</tbody></table></div>` : '<p class="small muted">No saved runs yet — run an audit and it appears here.</p>'}</div>`;
}

const baseTrail = VIEWS.trail;
VIEWS.trail = el => {
  baseTrail(el);
  const h = el.querySelector('.tablewrap'); if (!h) return;
  if (!cache) { list().then(() => { if (S.view === 'trail') X.render(); }); }
  h.insertAdjacentHTML('beforebegin', panel(cache || []));
};

async function certificate(rec) {
  const res = reproduce(rec);
  const P = t => ({ t: 'p', runs: [t] }); const Hd = t => ({ t: 'heading', text: t });
  const model = { title: `Reproduction certificate — ${rec.label}`, draftBanner: 'Prepared with Aldune decision-support software. Not legal advice.', blocks: [
    { t: 'title', text: 'Audit reproduction certificate' },
    P(`Audit: ${rec.label}${rec.employer && rec.employer !== rec.label ? ` (${rec.employer})` : ''}. Original run: ${new Date(rec.ranAt).toLocaleString()}. Re-run: ${new Date().toLocaleString()}.`),
    P(`Records fingerprint: ${rec.inputHash} (${res.hashOk ? 'matches' : `re-run fingerprint ${res.hash} — differs`}). Audit date used: ${rec.auditDate}. Software: ${rec.softwareVersion} (now ${res.softwareNow}).`),
    P(res.diffs.length ? `Result: did NOT reproduce exactly (${res.diffs.length} difference${res.diffs.length === 1 ? '' : 's'}).` : `Result: reproduced exactly — ${res.sum.findings} findings, ${money(res.sum.owed)} owed to workers, ${money(res.sum.base)} base exposure.`),
    ...(res.diffs.length ? [Hd('Differences'), ...res.diffs.map(([n, a, b, $]) => P(`${n}: saved ${$ ? money(a) : a}; re-run ${$ ? money(b) : b}.`))] : []),
    Hd('Rule versions used'), P(Object.entries(rec.ruleVersions).map(([k, v]) => `${k} ${v}`).join('; ')),
    ...(res.changed.length ? [P(`Changed since the original run: ${res.changed.join('; ')}.`)] : []),
    Hd('Assumptions used'), P(Object.entries(rec.assumptions).filter(([, v]) => v !== undefined && typeof v !== 'object').map(([k, v]) => `${k}: ${v}`).join('; '))
  ] };
  await X.saveDocx([model], `reproduction-certificate-${rec.inputHash}.docx`);
}

document.addEventListener('click', async e => {
  const a = e.target.closest('[data-act]'); if (!a || !/^repro-/.test(a.dataset.act)) return;
  const rec = (await list()).find(x => x.id === a.dataset.id); if (!rec) { toast('That run is no longer saved.'); return; }
  if (a.dataset.act === 'repro-run') { X.busy && X.busy('Re-running the saved audit'); try { S.repro = { id: rec.id, res: reproduce(rec) }; } finally { X.idle && X.idle(); } X.log && X.log('audit.reproduced', { inputHash: rec.inputHash, exact: !S.repro.res.diffs.length }); X.render(); }
  if (a.dataset.act === 'repro-open') { S.assumptions = JSON.parse(JSON.stringify(rec.assumptions)); S.extraChecks = JSON.parse(JSON.stringify(rec.extraChecks || [])); await X.runPipeline({ ...JSON.parse(JSON.stringify(rec.input)), auditDate: rec.auditDate }, rec.label, rec.source || 'saved-run'); toast(`Opened the saved run from ${new Date(rec.ranAt).toLocaleDateString()}.`); }
  if (a.dataset.act === 'repro-cert') await certificate(rec);
});
})();
