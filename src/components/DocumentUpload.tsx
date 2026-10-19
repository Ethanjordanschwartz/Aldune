'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
export function DocumentUpload({ orgId }: { orgId: string }) {
  const router = useRouter(); const [text, setText] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  async function send(fd: FormData) { setBusy(true); setErr(''); fd.append('organizationId', orgId); const r = await fetch('/api/documents', { method: 'POST', body: fd }); const j = await r.json().catch(() => ({})); setBusy(false); if (!r.ok) { setErr(j.error || 'Upload failed.'); return; } router.push(`/documents/${j.id}`); }
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <label className="bg-white border-2 border-dashed border-line rounded-lg p-5 cursor-pointer"><b>Upload a document</b><p className="text-sm text-ink-2">Handbook, meal waiver, arbitration, severance, or settlement agreement · .docx, .pdf, .txt · up to 15 MB</p><input type="file" accept=".docx,.pdf,.txt,.md" className="mt-3 text-sm" disabled={busy} onChange={e => { const f = e.target.files?.[0]; if (f) { const fd = new FormData(); fd.append('file', f); send(fd); } }} /></label>
      <div className="bg-white border border-line rounded-lg p-5"><label className="text-sm font-semibold" htmlFor="doc-text">Or paste text</label><textarea id="doc-text" value={text} onChange={e => setText(e.target.value)} rows={4} className="w-full border border-line rounded px-2 py-1.5 mt-2 text-sm" /><button disabled={busy || !text.trim()} onClick={() => { const fd = new FormData(); fd.append('text', text); fd.append('name', `Pasted text ${new Date().toLocaleDateString()}`); send(fd); }} className="mt-2 rounded bg-ledger text-white px-4 py-2 text-sm font-semibold disabled:opacity-50">{busy ? 'Saving…' : 'Add document'}</button></div>
      {err && <p role="alert" className="text-risk-high text-sm md:col-span-2">{err}</p>}
    </div>
  );
}
