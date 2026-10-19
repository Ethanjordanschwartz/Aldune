'use client';
import { useState } from 'react';
import { Button } from './ui';

const SUGGEST = ['What are our three biggest risks?', 'Which employees have the most findings?', 'Which location has the most meal-period issues?', 'How much exposure relates to rest periods?', 'Which employees will sue us?'];
export function AskChat({ auditId }: { auditId: string }) {
  const [msgs, setMsgs] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [q, setQ] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  async function ask(question: string) {
    if (!question.trim()) return; setBusy(true); setErr('');
    const history = msgs; setMsgs([...msgs, { role: 'user', content: question }]); setQ('');
    try {
      const r = await fetch(`/api/audits/${auditId}/ai`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'ask', question, history }) });
      const j = await r.json(); if (!r.ok) throw new Error(j.error);
      setMsgs(m => [...m, { role: 'assistant', content: j.text }]);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Something went wrong.'); } finally { setBusy(false); }
  }
  return (
    <div className="bg-white border border-line rounded-lg p-5">
      <div className="space-y-4 min-h-[160px]" aria-live="polite">
        {!msgs.length && <div className="flex flex-wrap gap-2">{SUGGEST.map(s => <button key={s} onClick={() => ask(s)} className="text-sm border border-line rounded-full px-3 py-1 hover:border-ink-2">{s}</button>)}</div>}
        {msgs.map((m, i) => <div key={i} className={m.role === 'user' ? 'font-semibold' : 'whitespace-pre-wrap leading-relaxed border-l-4 border-ledger pl-3'}>{m.content}</div>)}
        {busy && <p className="text-ink-2 text-sm">Querying the audit…</p>}
        {err && <p role="alert" className="text-risk-high text-sm">{err}</p>}
      </div>
      <form className="flex gap-2 mt-4" onSubmit={e => { e.preventDefault(); ask(q); }}>
        <label className="sr-only" htmlFor="ask">Question</label>
        <input id="ask" value={q} onChange={e => setQ(e.target.value)} placeholder="Ask about findings, workers, locations, or exposure" className="flex-1 border border-line rounded px-3 py-2" maxLength={500} />
        <Button variant="primary" disabled={busy}>Ask</Button>
      </form>
      <p className="text-xs text-ink-2 mt-3">Answers come from database queries over this audit. The assistant won’t predict who will sue or give legal advice.</p>
    </div>
  );
}
