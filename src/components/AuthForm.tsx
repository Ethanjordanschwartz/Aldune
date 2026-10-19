'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';

const TYPES = [['employer', 'Employer'], ['law_firm', 'Law firm'], ['investment_firm', 'PE / investment firm'], ['consultant', 'Consultant'], ['other', 'Other']];
export function AuthForm({ mode, configured }: { mode: 'login' | 'signup'; configured: boolean }) {
  const router = useRouter();
  const [f, setF] = useState({ first: '', last: '', email: '', password: '', org: '', type: 'employer' });
  const [err, setErr] = useState(''); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);
  if (!configured) return <p className="text-sm bg-[#FFF8DB] border border-marker rounded p-3">Accounts aren’t configured on this deployment yet. Add the Supabase keys in the environment, or <Link href="/audits/demo">explore the demo</Link>.</p>;
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(''); setMsg('');
    const sb = supabaseBrowser();
    try {
      if (mode === 'login') {
        const { error } = await sb.auth.signInWithPassword({ email: f.email, password: f.password }); if (error) throw error;
        router.push('/dashboard'); router.refresh(); return;
      }
      if (f.password.length < 12) throw new Error('Use a password of at least 12 characters.');
      const { data, error } = await sb.auth.signUp({ email: f.email, password: f.password, options: { data: { first_name: f.first, last_name: f.last, pending_org: f.org, pending_org_type: f.type } } });
      if (error) throw error;
      if (!data.session) { setMsg('Check your email to confirm your account, then sign in. Your organization will be created on first sign-in.'); return; }
      await sb.from('profiles').upsert({ id: data.user!.id, first_name: f.first, last_name: f.last, email: f.email });
      const { error: e2 } = await sb.rpc('create_organization', { org_name: f.org, org_kind: f.type }); if (e2) throw e2;
      router.push('/dashboard'); router.refresh();
    } catch (x) { setErr(x instanceof Error ? x.message : 'Something went wrong.'); } finally { setBusy(false); }
  }
  const field = (k: keyof typeof f, label: string, type = 'text', auto?: string) => <label className="flex flex-col gap-1 text-sm">{label}<input required type={type} autoComplete={auto} value={f[k]} onChange={e => setF({ ...f, [k]: e.target.value })} className="border border-line rounded px-3 py-2" /></label>;
  return (
    <form onSubmit={submit} className="space-y-4">
      {mode === 'signup' && <div className="grid grid-cols-2 gap-3">{field('first', 'First name', 'text', 'given-name')}{field('last', 'Last name', 'text', 'family-name')}</div>}
      {field('email', 'Work email', 'email', 'email')}{field('password', 'Password', 'password', mode === 'login' ? 'current-password' : 'new-password')}
      {mode === 'signup' && <>{field('org', 'Organization name', 'text', 'organization')}<label className="flex flex-col gap-1 text-sm">Organization type<select value={f.type} onChange={e => setF({ ...f, type: e.target.value })} className="border border-line rounded px-3 py-2">{TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label></>}
      <button disabled={busy} className="w-full rounded bg-ledger text-white py-2.5 font-semibold disabled:opacity-50">{busy ? 'Working…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
      {err && <p role="alert" className="text-sm text-risk-high">{err}</p>}{msg && <p role="status" className="text-sm">{msg}</p>}
      <p className="text-sm text-ink-2">{mode === 'login' ? <>New here? <Link href="/signup">Create an account</Link></> : <>Already have an account? <Link href="/login">Sign in</Link></>}</p>
    </form>
  );
}
