'use client';
import { useState } from 'react';
export function BillingActions({ orgId, canManage, hasCustomer, plans, current }: { orgId: string; canManage: boolean; hasCustomer: boolean; plans: { id: string; name: string; monthly: number; marketing: string[] }[]; current: string }) {
  const [err, setErr] = useState(''); const [busy, setBusy] = useState('');
  async function go(path: string, body: object, key: string) {
    setBusy(key); setErr('');
    const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({})); setBusy('');
    if (!r.ok || !j.url) { setErr(j.error || 'Something went wrong.'); return; } window.location.href = j.url;
  }
  return (
    <div>
      <div className="grid gap-4 md:grid-cols-3">
        {plans.map(p => <div key={p.id} className={`bg-white border rounded-lg p-5 flex flex-col ${current === p.id ? 'border-ledger' : 'border-line'}`}>
          <h3 className="font-bold text-lg">{p.name}</h3><p className="text-3xl font-extrabold mt-1">${p.monthly}<span className="text-base font-normal text-ink-2">/month</span></p>
          <ul className="text-sm text-ink-2 mt-3 space-y-1 flex-1">{p.marketing.map(m => <li key={m}>{m}</li>)}</ul>
          {current === p.id ? <span className="mt-4 text-center text-sm font-semibold text-ledger">Current plan</span> : <button disabled={!canManage || !!busy} onClick={() => go('/api/billing/checkout', { organizationId: orgId, plan: p.id }, p.id)} className="mt-4 rounded bg-ledger text-white py-2 font-semibold disabled:opacity-50">{busy === p.id ? 'Opening checkout…' : current === 'trial' ? 'Choose plan' : 'Switch plan'}</button>}
        </div>)}
      </div>
      <div className="mt-5 flex gap-3 items-center">{hasCustomer && <button disabled={!canManage || !!busy} onClick={() => go('/api/billing/portal', { organizationId: orgId }, 'portal')} className="rounded border border-line bg-white px-4 py-2 font-semibold">{busy === 'portal' ? 'Opening…' : 'Manage billing, invoices, and payment method'}</button>}{!canManage && <span className="text-sm text-ink-2">Only owners and admins can change billing.</span>}</div>
      {err && <p role="alert" className="text-risk-high text-sm mt-3">{err}</p>}
    </div>
  );
}
