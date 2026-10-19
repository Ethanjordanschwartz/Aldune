'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';

interface Citation { type: string; id: string; label: string; href?: string }
interface Msg { role: 'user' | 'assistant'; content: string; citations?: Citation[]; error?: boolean }
interface Conv { id: string; title: string; updated_at: string }

const SUGGEST = ['What are our three biggest risks?', 'Which supervisors have the most meal-period issues?', 'What happens if we exclude workers with arbitration agreements?', 'Which workers are owed the most?', 'What does our handbook say about rest breaks?'];

/** Renders assistant text with [[type:id]] markers turned into numbered, linked citations. Text is never injected as HTML. */
function Rich({ text, citations }: { text: string; citations: Citation[] }) {
  const order = new Map(citations.map((c, i) => [`${c.type}:${c.id}`, i + 1]));
  const parts = text.split(/(\[\[[a-z]+:[^\]\s]+\]\])/g);
  return <>{parts.map((p, i) => { const m = p.match(/^\[\[([a-z]+):([^\]\s]+)\]\]$/); if (!m) return <span key={i}>{p}</span>; const n = order.get(`${m[1]}:${m[2]}`); const c = n ? citations[n - 1] : null; return c ? (c.href ? <Link key={i} href={c.href} title={c.label} className="align-super text-[11px] font-bold no-underline px-0.5">[{n}]</Link> : <sup key={i} title={c.label}>[{n}]</sup>) : null; })}</>;
}

export function AssistantPanel({ auditId, signedIn }: { auditId?: string; signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [convId, setConvId] = useState<string | null>(null);
  const [convs, setConvs] = useState<Conv[]>([]);
  const [q, setQ] = useState(''); const [busy, setBusy] = useState(false); const [status, setStatus] = useState(''); const [remaining, setRemaining] = useState<number | null>(null);
  const abort = useRef<AbortController | null>(null); const end = useRef<HTMLDivElement>(null); const input = useRef<HTMLTextAreaElement>(null);

  const loadConvs = useCallback(async () => { if (!signedIn) return; const r = await fetch(`/api/assistant/conversations${auditId ? `?auditId=${auditId}` : ''}`); if (r.ok) setConvs((await r.json()).items || []); }, [auditId, signedIn]);
  useEffect(() => { if (open) { loadConvs(); setTimeout(() => input.current?.focus(), 50); } }, [open, loadConvs]);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [msgs, status]);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen(o => !o); } }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, []);

  async function openConv(id: string) {
    const r = await fetch(`/api/assistant/conversations/${id}`); if (!r.ok) return;
    const j = await r.json(); setConvId(id); setMsgs(j.messages.map((m: Msg) => ({ role: m.role, content: m.content, citations: m.citations || [] })));
  }
  async function del(id: string) { await fetch(`/api/assistant/conversations/${id}`, { method: 'DELETE' }); if (id === convId) { setConvId(null); setMsgs([]); } loadConvs(); }

  async function send(text: string) {
    const message = text.trim(); if (!message || busy) return;
    setQ(''); setBusy(true); setStatus('Thinking…');
    const history = msgs.filter(m => !m.error).map(m => ({ role: m.role, content: m.content }));
    setMsgs(m => [...m, { role: 'user', content: message }, { role: 'assistant', content: '' }]);
    const ac = new AbortController(); abort.current = ac;
    const patch = (fn: (m: Msg) => Msg) => setMsgs(all => { const c = all.slice(); c[c.length - 1] = fn(c[c.length - 1]); return c; });
    try {
      const r = await fetch('/api/assistant', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message, conversationId: convId || undefined, auditId, history: convId ? undefined : history.slice(-12) }), signal: ac.signal });
      if (!r.ok || !r.body) { const j = await r.json().catch(() => ({})); throw new Error(`${j.error || 'The assistant is unavailable.'}${j.errorId ? ` (${j.errorId})` : ''}`); }
      const reader = r.body.getReader(); const dec = new TextDecoder(); let buf = '';
      for (;;) {
        const { value, done } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        let i; while ((i = buf.indexOf('\n\n')) >= 0) {
          const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
          const line = chunk.split('\n').find(l => l.startsWith('data: ')); if (!line) continue;
          const e = JSON.parse(line.slice(6));
          if (e.type === 'meta' && e.conversationId) setConvId(e.conversationId);
          else if (e.type === 'delta') { setStatus(''); patch(m => ({ ...m, content: m.content + e.text })); }
          else if (e.type === 'tool') setStatus(`${e.label}…`);
          else if (e.type === 'done') { patch(m => ({ ...m, content: e.text, citations: e.citations })); if (e.remaining !== undefined) setRemaining(e.remaining); }
          else if (e.type === 'error') patch(m => ({ ...m, content: `${e.message}${e.errorId ? ` (${e.errorId})` : ''}`, error: true }));
        }
      }
      loadConvs();
    } catch (x) {
      const msg = ac.signal.aborted ? 'Stopped.' : x instanceof Error ? x.message : 'Something went wrong.';
      patch(m => ({ ...m, content: m.content || msg, error: !m.content }));
    } finally { setBusy(false); setStatus(''); abort.current = null; }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="no-print fixed right-5 bottom-5 z-30 rounded-full bg-ink text-white px-5 py-3 font-semibold shadow-lg hover:brightness-110" aria-label="Open the Aldune assistant (Ctrl+K)">Ask Aldune</button>
      {open && <div className="fixed inset-0 z-40 bg-black/30 no-print" onClick={() => setOpen(false)} aria-hidden />}
      <aside role="dialog" aria-modal="true" aria-label="Aldune assistant" className={`no-print fixed top-0 right-0 z-50 h-full w-full sm:w-[560px] bg-paper border-l border-line shadow-2xl flex transition-transform ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        {signedIn && <nav className="hidden md:flex w-44 shrink-0 flex-col border-r border-line bg-white" aria-label="Conversations">
          <button onClick={() => { setConvId(null); setMsgs([]); input.current?.focus(); }} className="m-2 rounded bg-ledger text-white text-sm font-semibold py-2">New chat</button>
          <ul className="overflow-y-auto text-sm">{convs.map(c => <li key={c.id} className={`group flex items-center ${c.id === convId ? 'bg-ledger-tint' : ''}`}><button onClick={() => openConv(c.id)} className="flex-1 text-left px-3 py-2 truncate" title={c.title}>{c.title}</button><button onClick={() => del(c.id)} className="opacity-0 group-hover:opacity-100 px-2 text-ink-2" aria-label={`Delete ${c.title}`}>×</button></li>)}</ul>
        </nav>}
        <div className="flex-1 flex flex-col min-w-0">
          <header className="flex items-center justify-between px-5 py-3 border-b border-line bg-white"><div><b>Aldune assistant</b><div className="text-xs text-ink-2">Answers from your audits and documents, with sources{remaining !== null ? ` · ${remaining.toLocaleString()} messages left this month` : ''}</div></div><button onClick={() => setOpen(false)} className="rounded border border-line px-3 py-1.5 text-sm">Close</button></header>
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5" aria-live="polite">
            {!msgs.length && <div><p className="text-sm text-ink-2 mb-3">Ask about findings, workers, locations, patterns, “what if” scenarios, or your uploaded documents.</p><div className="flex flex-wrap gap-2">{SUGGEST.map(s => <button key={s} onClick={() => send(s)} className="text-sm border border-line bg-white rounded-full px-3 py-1.5 hover:border-ink-2 text-left">{s}</button>)}</div></div>}
            {msgs.map((m, i) => m.role === 'user'
              ? <div key={i} className="font-semibold">{m.content}</div>
              : <div key={i} className={`border-l-4 pl-3 whitespace-pre-wrap leading-relaxed text-[15px] ${m.error ? 'border-risk-high text-risk-high' : 'border-ledger'}`}>
                  {m.content ? <Rich text={m.content} citations={m.citations || []} /> : <span className="text-ink-2">{status || 'Thinking…'}</span>}
                  {!!m.citations?.length && <ol className="mt-3 text-xs text-ink-2 space-y-0.5 list-none">{m.citations.map((c, n) => <li key={n}>[{n + 1}] {c.href ? <Link href={c.href} onClick={() => setOpen(false)}>{c.label}</Link> : c.label}</li>)}</ol>}
                </div>)}
            {busy && status && msgs[msgs.length - 1]?.content && <div className="text-sm text-ink-2">{status}</div>}
            <div ref={end} />
          </div>
          <form className="border-t border-line bg-white p-3 flex gap-2" onSubmit={e => { e.preventDefault(); send(q); }}>
            <label htmlFor="asst-q" className="sr-only">Message</label>
            <textarea id="asst-q" ref={input} value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(q); } }} rows={2} maxLength={2000} placeholder="Ask a question (Enter to send, Shift+Enter for a new line)" className="flex-1 resize-none border border-line rounded px-3 py-2 text-[15px]" />
            {busy ? <button type="button" onClick={() => abort.current?.abort()} className="rounded border border-line px-4 font-semibold">Stop</button> : <button className="rounded bg-ledger text-white px-4 font-semibold disabled:opacity-40" disabled={!q.trim()}>Send</button>}
          </form>
          <p className="px-4 pb-3 bg-white text-[11px] text-ink-2">AI answers are generated from your data and may be incomplete. Not legal advice. Amounts come from the calculation engine.</p>
        </div>
      </aside>
    </>
  );
}
