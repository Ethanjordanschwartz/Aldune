'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
export function SaveRun({ audits }: { audits: { id: string; name: string }[] }) {
  const router = useRouter(); const [id, setId] = useState(audits[0]?.id || ''); const [label, setLabel] = useState(new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })); const [msg, setMsg] = useState('');
  if (!audits.length) return <p className="text-sm text-ink-2">Complete an audit to save a monitoring run.</p>;
  return <form className="flex flex-wrap gap-3 items-end" onSubmit={async e => { e.preventDefault(); const r = await fetch('/api/monitoring', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ auditId: id, label }) }); const j = await r.json().catch(() => ({})); setMsg(r.ok ? 'Saved' : j.error || 'Failed'); if (r.ok) router.refresh(); }}>
    <label className="flex flex-col gap-1 text-sm">Audit<select value={id} onChange={e => setId(e.target.value)} className="border border-line rounded px-2 py-1.5">{audits.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
    <label className="flex flex-col gap-1 text-sm">Run label<input value={label} onChange={e => setLabel(e.target.value)} className="border border-line rounded px-2 py-1.5" /></label>
    <button className="rounded bg-ledger text-white px-4 py-2 text-sm font-semibold">Save run</button>{msg && <span role="status" className="text-sm">{msg}</span>}</form>;
}
