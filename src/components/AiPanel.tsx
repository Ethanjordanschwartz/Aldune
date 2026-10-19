'use client';
import { useState } from 'react';
import { Button } from './ui';

/** Calls the AI route with structured context only. Shows errors in plain language. */
export function AiPanel({ auditId, body, label, intro }: { auditId: string; body: Record<string, unknown>; label: string; intro?: string }) {
  const [text, setText] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true); setErr('');
    try {
      const r = await fetch(`/api/audits/${auditId}/ai`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json(); if (!r.ok) throw new Error(`${j.error}${j.errorId ? ` (${j.errorId})` : ''}`); setText(j.text);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Something went wrong.'); } finally { setBusy(false); }
  }
  return (
    <div>
      {intro && !text && <p className="text-sm text-ink-2 mb-3">{intro}</p>}
      {!text && <Button onClick={go} disabled={busy}>{busy ? 'Writing…' : label}</Button>}
      {text && <div className="whitespace-pre-wrap text-[15px] leading-relaxed">{text}<p className="text-xs text-ink-2 mt-3">Written by AI from this audit’s structured results. Amounts come from the calculation engine.</p></div>}
      {err && <p role="alert" className="text-sm text-risk-high mt-2">{err}</p>}
    </div>
  );
}
