'use client';
import { useEffect, useState } from 'react';
export default function FinchCallback({ searchParams }: { searchParams: { code?: string; state?: string } }) {
  const [msg, setMsg] = useState('Finishing your connection…');
  useEffect(() => { (async () => {
    const orgId = searchParams.state || new URLSearchParams(window.location.search).get('state') || window.localStorage.getItem('paycure:connect-org') || '';
    if (!searchParams.code) { setMsg('The connection was cancelled.'); return; }
    const r = await fetch('/api/connectors/finch/callback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orgId, code: searchParams.code }) });
    if (r.ok) window.location.href = '/settings/connections'; else setMsg((await r.json()).error || 'Connection failed.');
  })(); }, [searchParams]);
  return <main className="max-w-xl mx-auto p-10"><p>{msg}</p></main>;
}
