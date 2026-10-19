'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from './ui';

const OPTIONS = [['open', 'Open'], ['under_review', 'Under review'], ['confirmed', 'Confirmed'], ['dismissed', 'Dismissed'], ['resolved', 'Resolved']] as const;
export function StatusControl({ auditId, findingId, status }: { auditId: string; findingId: string; status: string }) {
  const [value, setValue] = useState(status); const [note, setNote] = useState(''); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function save() {
    setBusy(true); setMsg('');
    const r = await fetch(`/api/audits/${auditId}/findings/${findingId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: value, note: note || undefined }) });
    const j = await r.json().catch(() => ({})); setBusy(false);
    if (!r.ok) { setMsg(j.error || 'Couldn’t save.'); return; }
    setMsg('Saved'); setNote(''); router.refresh();
  }
  return (
    <div className="space-y-3">
      <label className="flex flex-col gap-1 text-sm">Review status
        <select value={value} onChange={e => setValue(e.target.value)} className="border border-line rounded px-2 py-1.5">{OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
      <label className="flex flex-col gap-1 text-sm">Note (optional)
        <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} placeholder="For example: employee chose to take a late meal; signed acknowledgment on file." className="border border-line rounded px-2 py-1.5" /></label>
      <div className="flex items-center gap-3"><Button variant="primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save review'}</Button>{msg && <span role="status" className="text-sm text-ink-2">{msg}</span>}</div>
    </div>
  );
}
