'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
export function ReviewButton({ docId, again }: { docId: string; again: boolean }) {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  return <div><button disabled={busy} onClick={async () => { setBusy(true); setErr(''); const r = await fetch(`/api/documents/${docId}/review`, { method: 'POST' }); const j = await r.json().catch(() => ({})); setBusy(false); if (!r.ok) setErr(`${j.error || 'Review failed.'}${j.errorId ? ` (${j.errorId})` : ''}`); else router.refresh(); }} className="rounded bg-ledger text-white px-4 py-2 text-sm font-semibold disabled:opacity-50">{busy ? 'Reviewing (about 30 seconds)…' : again ? 'Review again with Claude' : 'Review with Claude'}</button>{err && <p role="alert" className="text-risk-high text-sm mt-2">{err}</p>}</div>;
}
