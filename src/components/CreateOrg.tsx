'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
export function CreateOrg({ suggested }: { suggested?: string }) {
  const [name, setName] = useState(suggested || ''); const [type, setType] = useState('employer'); const [err, setErr] = useState(''); const router = useRouter();
  return (
    <form className="flex flex-wrap gap-3 items-end" onSubmit={async e => { e.preventDefault(); const { error } = await supabaseBrowser().rpc('create_organization', { org_name: name, org_kind: type }); if (error) setErr(error.message); else router.refresh(); }}>
      <label className="flex flex-col gap-1 text-sm">Organization name<input required value={name} onChange={e => setName(e.target.value)} className="border border-line rounded px-3 py-2" /></label>
      <label className="flex flex-col gap-1 text-sm">Type<select value={type} onChange={e => setType(e.target.value)} className="border border-line rounded px-3 py-2"><option value="employer">Employer</option><option value="law_firm">Law firm</option><option value="investment_firm">PE / investment firm</option><option value="consultant">Consultant</option><option value="other">Other</option></select></label>
      <button className="rounded bg-ledger text-white px-4 py-2 font-semibold">Create organization</button>{err && <p role="alert" className="text-risk-high text-sm w-full">{err}</p>}
    </form>
  );
}
