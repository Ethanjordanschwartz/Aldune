import Link from 'next/link';
import { redirect } from 'next/navigation';
import { NewAuditWizard } from '@/components/NewAuditWizard';
import { requireUser, supabaseConfigured } from '@/lib/supabase/server';
import { APP } from '@/config/app';
export const dynamic = 'force-dynamic';
export default async function NewAudit() {
  if (!supabaseConfigured()) redirect('/audits/demo');
  const { user } = await requireUser(); if (!user) redirect('/login');
  return <main className="max-w-[1180px] mx-auto px-5 py-8"><Link href="/dashboard" className="no-underline text-ink font-extrabold text-xl">{APP.name}</Link><h1 className="text-3xl font-extrabold mt-6 mb-6">New audit</h1><NewAuditWizard /></main>;
}
