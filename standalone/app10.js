/* Aldune standalone — part 10: public homepage, accounts (sign up, log in, pay), app gate, account page, connections */
(() => {
'use strict';
const X = window.PCX; const { PC, S, $, esc, money, toast, VIEWS } = X;
const PUBLIC = new Set(['public', 'signup', 'login', 'checkout', 'pending', 'reset']);
const HOURS = 3600 * 1000; const PROVISIONAL_HOURS = 72; const SESSION_HOURS = 12;

// ======================================================= passwords (PBKDF2-SHA256, 150k iterations, random salt)
const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
async function hashPw(pw, saltB64) {
  const salt = saltB64 ? Uint8Array.from(atob(saltB64), c => c.charCodeAt(0)) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 150000 }, key, 256);
  return { hash: b64(bits), salt: b64(salt) };
}
const pwProblems = pw => [pw.length < 10 && 'at least 10 characters', !/[A-Za-z]/.test(pw) && 'a letter', !/\d/.test(pw) && 'a number'].filter(Boolean);
const emailOk = e => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);

// ======================================================= session and entitlement
const session = () => { try { const s = JSON.parse(sessionStorage.getItem('paycure:session') || 'null'); return s && s.exp > Date.now() && S.account && s.email === S.account.email ? s : null; } catch { return null; } };
const startSession = () => { try { sessionStorage.setItem('paycure:session', JSON.stringify({ email: S.account.email, exp: Date.now() + SESSION_HOURS * HOURS })); } catch { /* ignore */ } };
const endSession = () => { try { sessionStorage.removeItem('paycure:session'); } catch { /* ignore */ } };
function entitled() {
  if (S.isOwner && !signedOut()) return { ok: true, why: 'owner' };
  const a = S.account; if (!a) return { ok: false, why: 'no-account' };
  if (isFounder() && !signedOut()) return { ok: true, why: 'founder' };
  const ent = S.entDoc; if (ent && ent.plan && ent.plan !== 'trial' && ent.status !== 'inactive' && !(ent.expires && ent.expires < new Date().toISOString().slice(0, 10))) return { ok: true, why: 'paid' };
  if (a.status === 'provisional' && a.paidClaimAt && Date.now() - new Date(a.paidClaimAt).getTime() < PROVISIONAL_HOURS * HOURS) return { ok: true, why: 'provisional' };
  if (a.status === 'trial' && S.cfg.flags.trial && Date.now() - new Date(a.createdAt).getTime() < 14 * 24 * HOURS) return { ok: true, why: 'trial' };
  return { ok: false, why: a.status === 'pending' || a.status === 'provisional' ? 'pending' : 'unpaid' };
}
const FOUNDERS = ['demo@aldune.dev'];
// Demo owner credential (public — see README): salted PBKDF2-SHA256 (600k iterations) — the password itself is never stored in code.
// Signing in with it rebuilds the owner account on any device/context (accounts are stored per browser).
const OWNER_CRED = { email: 'demo@aldune.dev', salt: 'bFlNJntDCQIWxeUl/Lbtgg==', hash: 'yrvA5JIR6qSF8ldO3xNiUIf8CKczPJFJ+2r/JshtvqM=', iterations: 600000 };
async function ownerMatch(email, pw) {
  if (email !== OWNER_CRED.email) return false;
  const salt = Uint8Array.from(atob(OWNER_CRED.salt), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: OWNER_CRED.iterations }, key, 256);
  return b64(bits) === OWNER_CRED.hash;
}
const isFounder = () => !!S.account && FOUNDERS.includes(String(S.account.email || '').toLowerCase());
// an explicit sign-out wins over owner status (owner login or platform owner) until the next successful login
const signedOut = () => { try { return sessionStorage.getItem('paycure:signedout') === '1'; } catch { return false; } };
const setSignedOut = v => { try { v ? sessionStorage.setItem('paycure:signedout', '1') : sessionStorage.removeItem('paycure:signedout'); } catch { /* ignore */ } };
X.signedOut = signedOut; X.setSignedOut = setSignedOut;
const authed = () => !!window.__PAYCURE_TEST__ || (!signedOut() && (S.isOwner || (!!session() && entitled().ok)));
X.PUBLIC = PUBLIC; X.session = session; X.isFounder = isFounder;
X.authed = authed; X.entitled = entitled;
function saveAccount() { X.persist(); if (X.touchDirectory) X.touchDirectory(); }

// ======================================================= gate: everything except the public site requires login + payment
const baseRender = X.render;
X.render = () => {
  if (!S.isOwner && isFounder() && session() && !signedOut()) S.isOwner = true; // founder session keeps owner access across reloads
  if (((S.isOwner && !signedOut()) || window.__PAYCURE_TEST__) && S.view === 'public' && !S.showPublic) S.view = 'home';
  if (!authed() && !PUBLIC.has(S.view)) {
    S.view = !S.account ? 'public' : !session() ? 'login' : entitled().why === 'pending' ? 'pending' : 'checkout';
  }
  if (authed() && PUBLIC.has(S.view) && S.view !== 'public') S.view = 'home';
  document.body.classList.toggle('locked', !authed());
  baseRender();
  const foot = document.querySelector('.rail .foot'); if (foot && !authed()) foot.querySelector('[data-acct]')?.remove();
  if (foot && authed() && !foot.querySelector('[data-acct]')) foot.insertAdjacentHTML('afterbegin', `<div data-acct style="margin-bottom:8px">${S.isOwner ? '<b>Workspace owner</b>' : `<b>${esc(S.account?.name || '')}</b>${isFounder() ? ' <span class="chip ok" style="font-size:10px">Founder</span>' : ''}<br>${esc(S.account?.email || '')}`}<br><button data-act="go" data-to="account" style="all:unset;cursor:pointer;text-decoration:underline">Account</button> · <button data-act="show-public" style="all:unset;cursor:pointer;text-decoration:underline">Public site</button>${S.isOwner ? '' : ' · <button data-act="logout" style="all:unset;cursor:pointer;text-decoration:underline">Log out</button>'}</div>`);
};
document.head.insertAdjacentHTML('beforeend', `<style>
.locked .rail{display:none}.locked .app{grid-template-columns:1fr}.locked #as-fab{display:none}.locked main{padding:0!important;max-width:none}.locked .disclaimer{display:none}
.pub{max-width:1180px;margin:0 auto;padding:0 28px}
.pub-top{position:sticky;top:0;z-index:20;background:rgba(255,255,255,.82);backdrop-filter:blur(12px);border-bottom:1px solid var(--line)}
.pub-top .pub{display:flex;align-items:center;justify-content:space-between;height:64px}
.pub-top a,.pub-top button.link{all:unset;cursor:pointer;margin:0 10px;font-size:15px;color:var(--ink2)}
.pub-hero{background:radial-gradient(900px 480px at 88% 0%,rgba(47,107,87,.14),transparent 70%),radial-gradient(700px 420px at 0% 100%,rgba(199,125,90,.12),transparent 70%),linear-gradient(180deg,#FBF8F3,#F4EEE4);color:var(--ink);padding:76px 0 64px;border-bottom:1px solid var(--line)}
.pub-hero h1{color:var(--ink);font-size:clamp(38px,5.4vw,66px);max-width:15ch;line-height:1.02;letter-spacing:-0.035em}
.pub-hero h1 em{font-style:normal;background:linear-gradient(90deg,var(--ledger),#4E8C74 60%,var(--clay));-webkit-background-clip:text;background-clip:text;color:transparent}
.hero-grid{display:grid;grid-template-columns:1.05fr .95fr;gap:48px;align-items:center}@media (max-width:960px){.hero-grid{grid-template-columns:1fr}}
.preview{background:#fff;border:1px solid var(--line);border-radius:18px;box-shadow:0 30px 60px -30px rgba(30,38,34,.35),0 2px 6px rgba(30,38,34,.05);padding:20px;position:relative}
.preview .pv-row{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--line);font-size:13.5px}.preview .pv-row:last-child{border-bottom:0}
.pv-chip{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:3px 10px;font-size:12px;font-weight:600}
.pv-bars{display:flex;align-items:flex-end;gap:6px;height:64px;margin:12px 0 4px}.pv-bars span{flex:1;border-radius:6px 6px 2px 2px;background:linear-gradient(180deg,#5E9A84,var(--ledger))}
.pub-hero p{color:var(--ink2);font-size:19px;max-width:54ch}
.pub-stat{background:rgba(255,255,255,.7);border:1px solid var(--line);border-radius:14px;padding:16px 18px}
.pub-stat .n{font-family:var(--head);font-size:34px;font-weight:800;line-height:1;color:var(--ledger);letter-spacing:-0.03em}
.pub-stat .l{font-size:14px;opacity:.85;margin-top:6px}
.pub-sec{padding:64px 0;border-bottom:1px solid var(--line)}
.pub-sec h2{font-size:clamp(26px,3vw,38px);margin-top:0}
.pub-card{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:22px}
.auth{max-width:460px;margin:48px auto;background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:30px;box-shadow:0 20px 50px -30px rgba(42,32,25,.45)}
.auth h1{font-size:30px}
.auth .field{margin-top:12px}
.auth .btn.primary{width:100%;padding:13px;font-size:16px;margin-top:16px}
</style>`);

// ======================================================= public homepage
const SRC = { notices2025: 'California Employment Law Report (Jan. 2026), LWDA filing data', fy25: 'LWDA Initial Statement of Reasons for proposed PAGA regulations (FY 2024–25)', since2006: 'California Department of Industrial Relations data, via Duane Morris Class Action Review' };
function topbar() {
  if (X.topbar) return X.topbar();
  return `<div class="pub-top"><div class="pub"><div class="brand" style="color:var(--ink)"><svg class="al-mark" width="24" height="24" viewBox="0 0 32 32" aria-hidden="true"><path d="M3 25C9.5 25 12 13.5 18.5 13.5C23.5 13.5 25 19.5 29 19.5V25Z" fill="currentColor"/><circle cx="23.5" cy="8.5" r="3" fill="#C4693F"/></svg> <b style="font-family:Fraunces,Georgia,serif;font-size:22px">Aldune</b></div>
    <nav><a href="#product" data-scroll="product">Product</a><a href="#how" data-scroll="how">How it works</a><a href="#pricing" data-scroll="pricing">Pricing</a><a href="#about" data-scroll="about">About</a>${authed() ? '<button class="btn primary" data-act="go" data-to="home">Open the app →</button>' : '<button class="link" data-act="go" data-to="login">Log in</button><button class="btn primary" data-act="go" data-to="signup">Get started</button>'}</nav></div></div>`;
}
VIEWS.public = el => {
  const rules = Object.keys(PC.RULES).length, topics = PC.LAW.length, answers = PC.FAQ.length, locals = Object.keys(PC.LOCAL_MIN_WAGE).length;
  const plans = ['starter', 'professional', 'legal'];
  el.innerHTML = topbar() + `
  <section class="pub-hero"><div class="pub"><div class="hero-grid"><div>
    <span class="pv-chip" style="background:var(--ledger-tint);color:var(--ledger)">● California wage-and-hour intelligence</span>
    <h1 style="margin-top:16px">Messy payroll data in. <em>Defensible answers</em> out.</h1>
    <p>Drop in thousands of pay stubs, timesheets, and POS exports — any layout, any mess. Aldune reads them, tests every shift against California law, shows the math, and tells you exactly what to fix.</p>
    <div class="row" style="margin-top:22px"><button class="btn primary" style="padding:14px 22px;font-size:17px" data-act="go" data-to="${authed() ? 'home' : 'signup'}">${authed() ? 'Open the app' : 'Create your account'} →</button><button class="btn" style="padding:14px 22px;font-size:17px;background:#fff;color:var(--ink);border-color:var(--line)" data-scroll="how">See how it works</button></div>
    <div class="small" style="margin-top:14px;color:var(--ink2)">Reads Toast, Square, ADP, UKG, Paychex, QuickBooks Time, Homebase, Excel, PDF, and scans.</div>
  </div>
  <div class="preview" aria-hidden="true">
    <div class="row" style="justify-content:space-between;align-items:center"><b style="font-family:var(--head)">Audit · Harbor Grill</b><span class="pv-chip" style="background:var(--ledger-tint);color:var(--ledger)">2,000 files read</span></div>
    <div style="margin-top:14px;font-size:12px;color:var(--ink2)">Likely exposure</div><div style="font-family:var(--head);font-size:34px;font-weight:800;letter-spacing:-0.03em">$184,320 <span style="font-size:14px;color:var(--ledger);font-weight:700">▼ 38% after fixes</span></div>
    <div class="pv-bars"><span style="height:92%"></span><span style="height:70%"></span><span style="height:55%"></span><span style="height:40%"></span><span style="height:28%"></span><span style="height:16%"></span></div>
    <div class="pv-row"><span>100,182 shifts normalized</span><span class="pv-chip" style="background:var(--ledger-tint);color:var(--ledger)">99.8% exact</span></div>
    <div class="pv-row"><span>System problem: premiums paid at base rate</span><span class="pv-chip" style="background:var(--flag-tint);color:var(--flag)">fix first</span></div>
    <div class="pv-row"><span>PAGA cap readiness</span><span class="pv-chip" style="background:var(--warn-tint);color:var(--warn)">3 of 4 steps</span></div>
  </div></div>
    <div class="grid g3" style="grid-template-columns:repeat(4,minmax(0,1fr));margin-top:56px;gap:16px">
      <div class="pub-stat"><div class="n">10,098</div><div class="l">PAGA notices filed in 2025 — a record high</div></div>
      <div class="pub-stat"><div class="n">24%</div><div class="l">of FY 2024–25 notices came from just five law firms</div></div>
      <div class="pub-stat"><div class="n">1 yr</div><div class="l">of penalties per notice, plus 3–4 years of wage claims</div></div>
      <div class="pub-stat"><div class="n">33 days</div><div class="l">to cure after a notice — if you know what’s wrong</div></div>
    </div>
    <p class="small" style="margin-top:18px;opacity:.7;font-size:12px">Sources: ${esc(SRC.notices2025)}; ${esc(SRC.fy25)}; Lab. Code §§ 2699, 2699.3; Code Civ. Proc. §§ 338, 340.</p>
  </div></section>
  <section class="pub-sec" id="product"><div class="pub">
    <h2>Everything you need to find, prove, and fix wage-and-hour exposure</h2>
    <div class="grid g3" style="margin-top:20px">${[
      ['Reads your real records', 'Drop in hundreds of pay stubs, timesheets, W-2s, and payroll exports — PDF, Word, Excel, or a ZIP. Aldune sorts and reads them in seconds.'],
      [`${rules} versioned California rules`, `Meal, rest, split shifts, overtime and regular rate, state, local (${locals} ordinances), and industry minimum wages, wage statements, final pay, paydays, expenses, classification.`],
      ['Every dollar explained', 'Each finding shows the rule, the formula, the inputs, and the source rows — with separate legal, data, and calculation confidence.'],
      ['PAGA, modeled correctly', 'Pre- and post-2024 statutes, the $25/$50/$200 rules, 15%/30% caps, cure deadlines, and six scenarios side by side.'],
      ['Fixes, not just findings', 'Back-pay payroll files, wage letters in English and Spanish, cure proposals, Pick Up Stix packets, policies, and training memos.'],
      [`An assistant grounded in law`, `${topics} cited law topics and ${answers} in-depth answers. It cites its sources and links you to the tool that resolves the issue.`]
    ].map(([t, d]) => `<div class="pub-card"><h3 style="margin-top:0;font-family:Fraunces,Georgia,serif">${t}</h3><p class="small">${d.split(/(?<=[.!?])\s+(?=[A-Z])/)[0]}</p></div>`).join('')}</div>
  </div></section>
  <section class="pub-sec" id="how"><div class="pub">
    <h2>How it works</h2>
    <div class="grid g3" style="grid-template-columns:repeat(4,minmax(0,1fr));margin-top:20px">${[['1', 'Create your account', 'Choose a plan and sign in. Two minutes.'], ['2', 'Add your records', 'Pay stubs, timesheets, and employee lists — any format, hundreds at once, or link a folder.'], ['3', 'See your exposure', 'Dashboard, patterns, every finding with its calculation, and PAGA scenarios.'], ['4', 'Fix and document', 'Pay what’s owed, correct the cause, and build the reasonable-steps record that caps PAGA penalties.']].map(([n, t, d]) => `<div class="pub-card"><div style="font-family:Fraunces,Georgia,serif;font-size:34px;color:var(--warn)">${n}</div><b>${t}</b><p class="small">${d}</p></div>`).join('')}</div>
  </div></section>
  <section class="pub-sec"><div class="pub"><div class="grid g2" style="align-items:center">
    <div><h2>Built for the people who answer for payroll risk</h2><ul>${['<b>Employers and HR</b> — find and pay what’s owed and monitor every month.', '<b>Employment counsel</b> — audit a client in minutes, test a PAGA notice against the data, and value settlement.', '<b>CFOs and boards</b> — one number, what drives it, and how much remediation reduces it.', '<b>Buyers and investors</b> — quantify liability in a California target.'].map(x => `<li style="margin:8px 0">${x}</li>`).join('')}</ul></div>
    <div class="pub-card"><b>Proven at scale in testing</b><table style="margin-top:10px"><tbody>${[['Employees per audit (tested)', '50,000+'], ['Documents read in one batch (tested)', '260 in ~1 second'], ['Automated accuracy tests', '100+'], ['Local minimum wage ordinances', String(locals)], ['Remediation templates', '20+']].map(([a, b]) => `<tr><td class="small">${a}</td><td class="n"><b>${b}</b></td></tr>`).join('')}</tbody></table><p class="cite" style="margin-top:8px">Product test results, not customer data.</p></div></div></div></section>
  <section class="pub-sec" id="pricing"><div class="pub">
    <h2>Pricing</h2><p class="small muted">Billed monthly, or annually with two months free. Payments processed securely by Stripe.</p>
    <div class="grid g3" style="grid-template-columns:repeat(3,minmax(0,1fr));margin-top:16px">${plans.map(k => { const pl = PC.PLANS[k]; return `<div class="pub-card" style="${k === 'professional' ? 'border:2px solid var(--ledger)' : ''}">${k === 'professional' ? '<span class="chip ok">Most popular</span>' : ''}<h3 style="font-family:Fraunces,Georgia,serif;margin:8px 0 0">${pl.name}</h3><div style="font-family:Fraunces,Georgia,serif;font-size:34px;font-weight:600;margin:6px 0">${pl.monthly ? `$${pl.monthly}<span class="small muted">/mo</span>` : 'Custom'}</div><ul class="small">${pl.marketing.map(m => `<li>${m}</li>`).join('')}</ul><button class="btn ${k === 'professional' ? 'primary' : ''}" style="width:100%;margin-top:8px" data-act="${k === 'enterprise' ? 'contact' : 'choose-plan'}" data-plan="${k}">${k === 'enterprise' ? 'Contact sales' : 'Choose ' + pl.name}</button></div>`; }).join('')}</div>
  </div></section>
  <section class="pub-sec" id="about"><div class="pub"><div class="grid g2">
    <div><h2>About Aldune</h2><p>Aldune was built by California employment litigators who have defended and resolved wage-and-hour class and PAGA actions — and who watched employers learn about problems only when a notice arrived. Our approach: deterministic calculations you can audit line by line, law you can cite, and practical fixes, so compliance is something you can prove.</p><p class="small muted">Aldune is decision-support software, not a law firm, and does not provide legal advice.</p></div>
    <div class="pub-card"><b>Security and privacy</b><ul class="small">${['Payroll files are read inside your browser — not uploaded to our servers.', 'Social Security numbers and tax IDs are masked to the last four digits as files are read.', 'Your audits, decisions, and history are private to your account.', 'Calculations are deterministic and versioned; AI never computes amounts.'].map(x => `<li style="margin:6px 0">${x}</li>`).join('')}</ul></div></div></div></section>
  <section class="pub-sec"><div class="pub"><h2>Questions</h2>${[['Is this legal advice?', 'No. Aldune shows potential issues, estimates, and the law behind them. Have California employment counsel review before relying on results.'], ['What do I need to start?', 'Any of: pay stubs or payroll registers, timesheets or time exports, an employee list. PDF, Word, Excel, CSV, or a ZIP. You don’t need all three.'], ['Can it connect to ADP or Paychex?', 'Link the folder your payroll reports download to and Aldune pulls in new files with one click. Direct API connections are available on Aldune Cloud plans.'], ['How fast is it?', 'Hundreds of documents are read in seconds; a year of records for hundreds of employees analyzes in a few seconds.']].map(([q, a]) => `<details class="law"><summary>${q}</summary><p>${a}</p></details>`).join('')}</div></section>
  <section style="padding:60px 0;background:var(--ink);color:#F6EEDF"><div class="pub" style="text-align:center"><h2 style="color:#FFF8EC">See your exposure this week.</h2><button class="btn primary" style="padding:14px 24px;font-size:17px" data-act="go" data-to="${authed() ? 'home' : 'signup'}">${authed() ? 'Open the app' : 'Create your account'} →</button><p class="small" style="opacity:.7;margin-top:20px">© ${new Date().getFullYear()} Aldune · Decision-support software, not legal advice · ${S.cfg.contact ? esc(S.cfg.contact) : ''}</p></div></section>`;
  el.querySelectorAll('[data-scroll]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); const t = document.getElementById(a.dataset.scroll); if (t) t.scrollIntoView({ behavior: 'smooth' }); }));
};

// ======================================================= sign up / log in / reset
VIEWS.signup = el => {
  const plan = S.chosenPlan || 'professional';
  el.innerHTML = topbar() + `<div class="auth"><h1>Create your account</h1><p class="small muted">Plan: <b>${PC.PLANS[plan].name}</b> · <button class="btn" style="padding:2px 8px" data-act="go" data-to="public">change</button></p>
    ${S.account ? `<p class="note small">An account already exists here for ${esc(S.account.email)}. <button class="btn" data-act="go" data-to="login">Log in</button></p>` : ''}
    <label class="field">Full name<input id="su-name" autocomplete="name"></label><label class="field">Work email<input id="su-email" type="email" autocomplete="email"></label>
    <label class="field">Company<input id="su-co" autocomplete="organization" value="${esc(S.profile?.company || '')}"></label>
    <div class="grid g2"><label class="field">Your role<select id="su-role">${['HR / payroll', 'Employment attorney', 'Executive / finance', 'Compliance / risk', 'Operations', 'Other'].map(r => `<option>${r}</option>`).join('')}</select></label><label class="field">California employees<input id="su-emp" type="number" min="1"></label></div>
    <label class="field">Password<input id="su-pw" type="password" autocomplete="new-password"></label><div class="cite" id="su-pwhint">At least 10 characters with a letter and a number.</div>
    <label class="check" style="margin-top:12px"><input type="checkbox" id="su-terms"> <span class="small">I agree to the Terms of Service and Privacy Policy and understand Aldune is not legal advice.</span></label>
    <button class="btn primary" data-act="do-signup">Create account and continue to payment</button><p class="small" style="text-align:center;margin-top:12px">Already have an account? <button class="btn" style="padding:2px 8px" data-act="go" data-to="login">Log in</button></p></div>`;
  $('#su-pw').addEventListener('input', e => { const p = pwProblems(e.target.value); $('#su-pwhint').textContent = p.length ? `Needs ${p.join(', ')}.` : 'Strong enough ✓'; });
};
async function doSignup() {
  const v = id => $(id).value.trim(); const name = v('#su-name'), email = v('#su-email').toLowerCase(), company = v('#su-co'), pw = $('#su-pw').value;
  if (name.split(/\s+/).length < 2) return toast('Enter your full name.'); if (!emailOk(email)) return toast('Enter a valid work email.'); if (!company) return toast('Enter your company name.');
  const p = pwProblems(pw); if (p.length) return toast(`Password needs ${p.join(', ')}.`); if (!$('#su-terms').checked) return toast('Please accept the terms to continue.');
  const h = await hashPw(pw);
  S.account = { name, email, company, role: v('#su-role'), employees: Number(v('#su-emp')) || null, pw: h.hash, salt: h.salt, createdAt: new Date().toISOString(), status: 'unpaid', plan: S.chosenPlan || 'professional', ref: `PC-${Math.random().toString(36).slice(2, 8).toUpperCase()}` };
  S.profile = { ...(S.profile || {}), company, employees: S.account.employees, ref: S.account.ref, createdAt: S.account.createdAt };
  if (isFounder()) { S.account.status = 'founder'; }
  saveAccount(); startSession(); X.log && X.log('account.created', { company }); X.setView(isFounder() ? 'guide' : 'checkout');
}
VIEWS.login = el => {
  el.innerHTML = topbar() + `<div class="auth"><h1>Log in</h1>${S.account ? '' : '<p class="note small">No account on this device yet. <button class="btn" data-act="go" data-to="signup">Create one</button></p>'}
    <label class="field">Email<input id="li-email" type="email" autocomplete="username" value="${esc(S.account?.email || '')}"></label><label class="field">Password<input id="li-pw" type="password" autocomplete="current-password"></label>
    <button class="btn primary" data-act="do-login">Log in</button><p class="small" style="text-align:center;margin-top:12px"><button class="btn" style="padding:2px 8px" data-act="go" data-to="reset">Forgot password?</button></p></div>`;
  $('#li-pw').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
};
async function doLogin() {
  const email = $('#li-email').value.trim().toLowerCase(), pw = $('#li-pw').value; S.loginFails = S.loginFails || 0;
  if (FOUNDERS.includes(email) && await ownerMatch(email, pw)) {
    // owner: (re)build the account on this device, full access, no lockout
    const h = await hashPw(pw); const prev = S.account && S.account.email === email ? S.account : {};
    S.account = { ...prev, name: prev.name || 'Demo Reviewer', email, company: prev.company || 'Aldune', role: 'Owner', pw: h.hash, salt: h.salt, createdAt: prev.createdAt || new Date().toISOString(), status: 'founder', plan: 'enterprise' };
    S.isOwner = true; S.loginFails = 0; setSignedOut(false); S.showPublic = false; saveAccount(); startSession(); X.log && X.log('account.owner_login', {}); toast('Signed in as owner — full access.'); X.setView('home'); return;
  }
  if (S.loginFails >= 5 && Date.now() - (S.lastFail || 0) < 60000) return toast('Too many attempts. Wait a minute and try again.');
  if (!S.account || S.account.email !== email || (await hashPw(pw, S.account.salt)).hash !== S.account.pw) { S.loginFails++; S.lastFail = Date.now(); return toast('Email or password is incorrect.'); }
  S.loginFails = 0; setSignedOut(false); S.showPublic = false; startSession(); X.log && X.log('account.login', {}); X.setView(entitled().ok ? 'home' : entitled().why === 'pending' ? 'pending' : 'checkout');
}
VIEWS.reset = el => {
  el.innerHTML = topbar() + `<div class="auth"><h1>Reset your password</h1><p class="small muted">Your Aldune account on this device is protected by your sign-in to this browser. Confirm your account email and name to set a new password.</p>
    <label class="field">Email<input id="rs-email" type="email"></label><label class="field">Full name<input id="rs-name"></label><label class="field">New password<input id="rs-pw" type="password" autocomplete="new-password"></label>
    <button class="btn primary" data-act="do-reset">Set new password</button></div>`;
};

// ======================================================= checkout (plan + payment) and pending
VIEWS.checkout = el => {
  const a = S.account || {}; const plan = a.plan || 'professional'; const per = S.billPeriod || 'monthly'; const L = S.cfg.links || {};
  const link = k => { const u = L[`${k}_${per}`]; return u ? `${u}${u.includes('?') ? '&' : '?'}client_reference_id=${encodeURIComponent(a.ref || '')}${a.email ? `&prefilled_email=${encodeURIComponent(a.email)}` : ''}` : ''; };
  el.innerHTML = topbar() + `<div class="pub" style="padding-top:36px;max-width:980px"><h1 style="font-size:34px">Choose your plan</h1><p class="small muted">Account ${esc(a.email || '')} · reference <b>${esc(a.ref || '')}</b></p>
    <div class="seg" style="margin:10px 0 18px">${['monthly', 'annual'].map(p => `<button data-act="bill-period" data-p="${p}" aria-pressed="${per === p}">${p === 'monthly' ? 'Monthly' : 'Annual (2 months free)'}</button>`).join('')}</div>
    <div class="grid g3">${['starter', 'professional', 'legal'].map(k => { const pl = PC.PLANS[k]; const price = per === 'annual' ? pl.monthly * 10 : pl.monthly; const u = link(k); return `<div class="pub-card" style="${plan === k ? 'border:2px solid var(--ledger)' : ''}"><h3 style="margin-top:0;font-family:Fraunces,Georgia,serif">${pl.name}</h3><div style="font-family:Fraunces,Georgia,serif;font-size:32px;font-weight:600">$${price.toLocaleString()}<span class="small muted">/${per === 'annual' ? 'yr' : 'mo'}</span></div><ul class="small">${pl.marketing.map(m => `<li>${m}</li>`).join('')}</ul>${u ? `<a class="btn ${plan === k ? 'primary' : ''}" style="display:block;text-align:center;text-decoration:none" href="${esc(u)}" target="_blank" rel="noopener" data-act="pay-open" data-plan="${k}">Pay with Stripe →</a>` : `<button class="btn ${plan === k ? 'primary' : ''}" style="width:100%" data-act="request-access" data-plan="${k}">Request ${pl.name}</button>`}</div>`; }).join('')}</div>
    ${Object.keys(L).length ? `<div class="panel" style="margin-top:18px"><b>Finished paying?</b><p class="small">Stripe opens in a new tab. When your payment is complete, confirm here — you’ll get immediate access while we verify the payment (usually within one business day).</p><button class="btn primary" data-act="paid-confirm">I’ve completed payment — open Aldune</button></div>` : '<p class="note small" style="margin-top:18px">Online checkout isn’t set up yet. Request a plan and our team will contact you to complete billing and activate your account.</p>'}
    ${S.cfg.flags.trial ? '<div class="panel" style="margin-top:12px"><b>Not ready to pay?</b> <button class="btn" data-act="start-trial">Start a 14-day trial</button></div>' : ''}
    <p class="small muted" style="margin-top:16px">Card details are entered only on Stripe’s secure checkout. <button class="btn" style="padding:2px 8px" data-act="logout">Log out</button></p></div>`;
};
VIEWS.pending = el => {
  const a = S.account || {};
  el.innerHTML = topbar() + `<div class="auth" style="max-width:560px"><h1>We’re activating your account</h1><p>Thanks${a.name ? `, ${esc(a.name.split(' ')[0])}` : ''}. Your request for <b>${esc(PC.PLANS[a.plan || 'professional'].name)}</b> (reference <b>${esc(a.ref || '')}</b>) is with our team. Access opens as soon as billing is confirmed — usually within one business day.</p>
    <p class="small muted">Questions: ${esc(S.cfg.contact || 'contact your Aldune representative')}.</p><div class="row"><button class="btn" data-act="go" data-to="checkout">Back to plans</button><button class="btn" data-act="check-status">Check status</button><button class="btn" data-act="logout">Log out</button></div></div>`;
};

// ======================================================= account page
VIEWS.account = el => {
  const a = S.account || {}; const e = entitled();
  el.innerHTML = X.head('Account', S.isOwner ? 'Workspace owner — full access.' : 'Your profile, plan, and security.') + (S.isOwner && !a.email ? '<p class="small">Owner access comes from your workspace ownership. Customers create accounts on the public site.</p><button class="btn" data-act="logout">Log out</button>' : `
    <div class="grid g2"><div class="panel"><h3 style="margin-top:0">Profile</h3><table><tbody>${[['Name', a.name], ['Email', a.email], ['Company', a.company], ['Role', a.role], ['Account reference', a.ref], ['Member since', a.createdAt && new Date(a.createdAt).toLocaleDateString()]].map(([k, v]) => `<tr><td class="small">${k}</td><td>${esc(v || '—')}</td></tr>`).join('')}</tbody></table></div>
    <div class="panel"><h3 style="margin-top:0">Plan and billing</h3><p><b>${esc(PC.PLANS[(S.entDoc && S.entDoc.plan) || a.plan || 'professional'].name)}</b> · ${{ paid: 'Active', provisional: 'Active — payment being verified', trial: 'Trial', owner: 'Owner', founder: 'Founder — full access' }[e.why] || 'Inactive'}</p><div class="row"><button class="btn" data-act="go" data-to="plans">Usage and plans</button></div><p class="small muted" style="margin-top:8px">Invoices, payment methods, and cancellation are managed in the Stripe customer portal linked from your receipt.</p></div>
    <div class="panel"><h3 style="margin-top:0">Change password</h3><label class="field">Current password<input id="ac-old" type="password" autocomplete="current-password"></label><label class="field">New password<input id="ac-new" type="password" autocomplete="new-password"></label><button class="btn primary" style="margin-top:10px" data-act="change-pw">Update password</button></div>
    <div class="panel"><h3 style="margin-top:0">Sign out or delete</h3><div class="row"><button class="btn" data-act="logout">Log out</button><button class="btn" data-act="delete-account" style="color:var(--flag)">Delete account and data</button></div><p class="small muted" style="margin-top:8px">Deleting removes your account, saved runs, review decisions, tasks, and history from this workspace.</p></div></div>`);
};

// ======================================================= connections: linked folder sync (works now) + direct API connectors (Aldune Cloud)
const SYSTEMS = [['ADP', 'ADP Workforce Now / RUN', 'API Central project or Marketplace partner app: OAuth 2.0 client credentials plus a mutual-TLS client certificate on every call.'], ['Paychex', 'Paychex Flex', 'Paychex Flex API partner credentials (OAuth 2.0).'], ['Gusto', 'Gusto', 'Gusto developer application (OAuth 2.0 user authorization).'], ['UKG', 'UKG Pro / Ready', 'UKG API credentials from your UKG administrator.'], ['Rippling', 'Rippling', 'Rippling app partnership (OAuth 2.0).'], ['Paylocity', 'Paylocity', 'Paylocity API credentials (OAuth 2.0 client credentials).'], ['QuickBooks', 'QuickBooks Payroll', 'Intuit developer app (OAuth 2.0).'], ['FieldClock', 'FieldClock (agriculture time)', 'CSV/PDF exports via linked folder; API on request.']];
const idb = () => new Promise((res, rej) => { const r = indexedDB.open('paycure', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const kvSet = async (k, v) => { const db = await idb(); return new Promise((res, rej) => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = res; t.onerror = () => rej(t.error); }); };
X.kvSet = (k, v) => kvSet(k, v); X.kvGet = k => kvGet(k);
const kvGet = async k => { const db = await idb(); return new Promise((res, rej) => { const t = db.transaction('kv').objectStore('kv').get(k); t.onsuccess = () => res(t.result); t.onerror = () => rej(t.error); }); };
async function* walk(dir, path = '') { for await (const [name, h] of dir.entries()) { if (h.kind === 'file') yield { h, path: path + name }; else if (!name.startsWith('.')) yield* walk(h, `${path}${name}/`); } }
async function syncFolder(system) {
  let handle; try { handle = await kvGet(`folder:${system}`); } catch { handle = null; }
  if (!handle) { toast('Link a folder first.'); return; }
  if ((await handle.queryPermission({ mode: 'read' })) !== 'granted' && (await handle.requestPermission({ mode: 'read' })) !== 'granted') { toast('Permission to read the folder was not granted.'); return; }
  const seen = new Set((S.connSeen || {})[system] || []); const files = [];
  for await (const { h, path } of walk(handle)) { const f = await h.getFile(); const key = `${path}|${f.size}|${f.lastModified}`; if (!seen.has(key) && /\.(pdf|docx|csv|xlsx|xls|txt|zip|png|jpe?g)$/i.test(f.name)) { files.push(f); seen.add(key); } }
  S.connSeen = { ...(S.connSeen || {}), [system]: [...seen] }; S.connLast = { ...(S.connLast || {}), [system]: new Date().toISOString() }; X.persist();
  if (!files.length) { toast('No new files since the last sync.'); X.render(); return; }
  S.imp.step = 0; X.setView('import'); await X.processFiles(files, null); X.log && X.log('connection.sync', { system, files: files.length });
}
VIEWS.connect = el => {
  let framed = true; try { framed = window.self !== window.top; } catch { framed = true; }
  const fsOk = typeof window.showDirectoryPicker === 'function' && !framed;
  el.innerHTML = X.head('Connections', 'Bring payroll and time records in automatically. Link the folder your reports download to — Aldune picks up new files with one click — or connect directly through Aldune Cloud.') + `
    <div class="alert info"><b>Linked folders work today.</b> Schedule your payroll system to save pay registers, pay stubs, and timecard reports to a folder (most systems can save or email reports on a schedule), link that folder below, and press Sync whenever new files arrive. ${fsOk ? '' : 'Here, choose the folder each time you sync (keeping a folder linked needs Aldune on its own web address, in Chrome or Edge).'}</div>
    <div class="grid g2" style="margin-top:14px">${SYSTEMS.map(([id, name, api]) => `<div class="panel"><div class="row" style="justify-content:space-between"><h3 style="margin:0">${esc(name)}</h3>${(S.connLast || {})[id] ? `<span class="chip ok">Synced ${new Date(S.connLast[id]).toLocaleDateString()}</span>` : '<span class="chip">Not linked</span>'}</div>
      <p class="small"><b>Linked folder:</b> ${(S.connLinked || {})[id] ? `✓ “${esc(S.connLinked[id])}”` : 'not linked'}</p>
      <div class="row">${fsOk ? `<button class="btn primary" data-act="conn-link" data-sys="${id}">${(S.connLinked || {})[id] ? 'Change folder' : 'Link folder'}</button>${(S.connLinked || {})[id] ? `<button class="btn" data-act="conn-sync" data-sys="${id}">Sync now</button>` : ''}` : `<label class="btn primary" style="cursor:pointer">Choose folder<input type="file" webkitdirectory directory multiple data-connpick="${id}" style="display:none"></label>`}<button class="btn" data-act="go" data-to="guide">Which reports?</button>${fsOk ? `<input type="file" webkitdirectory directory multiple data-connpick="${id}" style="display:none">` : ''}</div>
      <p class="cite" style="margin-top:10px"><b>Direct API (Aldune Cloud):</b> ${esc(api)} ${S.cfg.connectorEndpoint ? '<button class="btn" data-act="conn-api" data-sys="' + id + '">Connect</button>' : 'Requires the Aldune Cloud connector service — ask your administrator.'}</p></div>`).join('')}</div>
    <p class="small muted" style="margin-top:12px">Why not a one-click ADP login inside this page? ADP requires every API call to come from a registered server presenting OAuth credentials and a mutual-TLS client certificate — a browser page can’t do that securely. Aldune Cloud runs those connectors server-side.</p>`;
  el.querySelectorAll('[data-connpick]').forEach(i => i.addEventListener('change', async e => { const fl = [...e.target.files]; const sys = e.target.dataset.connpick; e.target.value = ''; if (!fl.length) return; S.connLast = { ...(S.connLast || {}), [sys]: new Date().toISOString() }; X.persist(); S.imp.step = 0; X.setView('import'); await X.processFiles(fl, null); }));
};

// ======================================================= events
document.addEventListener('click', async e => {
  const a = e.target.closest('[data-act]'); if (!a) return; const d = a.dataset;
  try {
    switch (d.act) {
      case 'choose-plan': S.chosenPlan = d.plan; if (S.account) { S.account.plan = d.plan; saveAccount(); } X.setView(S.account ? (session() ? 'checkout' : 'login') : 'signup'); break;
      case 'contact': window.location.href = `mailto:${S.cfg.contact || ''}?subject=${encodeURIComponent('Aldune Enterprise')}`; break;
      case 'do-signup': await doSignup(); break;
      case 'do-login': await doLogin(); break;
      case 'do-reset': { const em = $('#rs-email').value.trim().toLowerCase(), nm = $('#rs-name').value.trim(), pw = $('#rs-pw').value; if (!S.account || S.account.email !== em || S.account.name.toLowerCase() !== nm.toLowerCase()) { toast('That email and name don’t match the account on this device.'); break; } const p = pwProblems(pw); if (p.length) { toast(`Password needs ${p.join(', ')}.`); break; } const h = await hashPw(pw); Object.assign(S.account, { pw: h.hash, salt: h.salt }); saveAccount(); toast('Password updated — log in with your new password.'); X.setView('login'); break; }
      case 'logout': endSession(); setSignedOut(true); S.isOwner = false; S.showPublic = true; toast('Logged out'); X.setView('public'); break;
      case 'pay-open': if (S.account) { S.account.plan = d.plan; S.account.payOpenedAt = new Date().toISOString(); saveAccount(); } break;
      case 'paid-confirm': if (!S.account?.payOpenedAt) { toast('Open Stripe checkout and complete payment first.'); break; } Object.assign(S.account, { status: 'provisional', paidClaimAt: new Date().toISOString() }); S.dirExtra = { ...(S.dirExtra || {}), requestedPlan: `${S.account.plan} (${S.billPeriod || 'monthly'}) — paid, verify`, requestedAt: new Date().toISOString(), email: S.account.email }; saveAccount(); X.log && X.log('plan.requested', { plan: S.account.plan }); toast('Welcome to Aldune!'); X.setView('guide'); break;
      case 'request-access': Object.assign(S.account, { plan: d.plan, status: 'pending' }); S.dirExtra = { ...(S.dirExtra || {}), requestedPlan: `${d.plan} — requested`, requestedAt: new Date().toISOString(), email: S.account.email }; saveAccount(); X.setView('pending'); break;
      case 'start-trial': Object.assign(S.account, { status: 'trial' }); saveAccount(); X.setView('guide'); break;
      case 'check-status': if (X.loadShared) await X.loadShared(); toast(entitled().ok ? 'Your account is active.' : 'Still being activated.'); X.render(); break;
      case 'show-public': S.showPublic = true; X.setView('public'); break;
      case 'change-pw': { const old = $('#ac-old').value, nw = $('#ac-new').value; if ((await hashPw(old, S.account.salt)).hash !== S.account.pw) { toast('Current password is incorrect.'); break; } const p = pwProblems(nw); if (p.length) { toast(`Password needs ${p.join(', ')}.`); break; } const h = await hashPw(nw); Object.assign(S.account, { pw: h.hash, salt: h.salt }); saveAccount(); toast('Password updated'); break; }
      case 'delete-account': if (confirm('Delete your Aldune account and all saved data on this workspace? This can’t be undone.')) { S.account = null; S.snapshots = []; S.events = []; S.profile = null; endSession(); X.persist(); try { localStorage.clear(); } catch { /* ignore */ } toast('Account deleted'); X.setView('public'); } break;
      case 'conn-link': { try { const h = await window.showDirectoryPicker({ mode: 'read' }); await kvSet(`folder:${d.sys}`, h); S.connLinked = { ...(S.connLinked || {}), [d.sys]: h.name }; X.persist(); toast(`Linked “${h.name}”`); await syncFolder(d.sys); } catch (err) { if (err && err.name !== 'AbortError') { const fb = document.querySelector(`[data-connpick="${d.sys}"]`); if (fb) fb.click(); else toast('Choose the folder from the Import page — this browser can’t keep folders linked.'); } } break; }
      case 'conn-sync': await syncFolder(d.sys); break;
      case 'conn-api': { try { const r = await fetch(`${S.cfg.connectorEndpoint.replace(/\/$/, '')}/sync?provider=${encodeURIComponent(d.sys.toLowerCase())}&ref=${encodeURIComponent(S.account?.ref || '')}`); if (!r.ok) throw new Error(`HTTP ${r.status}`); const j = await r.json(); for (const ds of ['employees', 'time', 'payroll']) if (j[ds] && j[ds].length) { const headers = Object.keys(j[ds][0]); X.mergeTable(ds, { headers, rows: j[ds], mapping: Object.fromEntries(headers.map(h => [h, h])), suggestions: headers.map(h => ({ column: h, field: h, confidence: 1 })), name: `${d.sys} API`, files: 1 }); } S.imp.step = 0; X.setView('import'); toast(`${d.sys}: records imported`); } catch (err) { toast(`Connector unavailable (${err.message}). Use a linked folder meanwhile.`); } break; }
    }
  } catch (err) { toast(err.message || 'Something went wrong.'); }
});
// new accounts land on the guide until company setup is done
const baseHome = VIEWS.home; VIEWS.home = el => { if (!S.profile?.done && !S.isOwner && !window.__PAYCURE_TEST__) { VIEWS.guide(el); return; } baseHome(el); };
// apply the gate to the first screen as soon as this module loads
X.render();
})();
