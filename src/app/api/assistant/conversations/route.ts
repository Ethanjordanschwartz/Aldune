export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { requireUser, supabaseConfigured } from '@/lib/supabase/server';
export async function GET(req: Request) {
  if (!supabaseConfigured()) return NextResponse.json({ items: [] });
  const { sb, user } = await requireUser(); if (!user) return fail(401, 'Sign in first.');
  const audit = new URL(req.url).searchParams.get('auditId');
  let q = sb.from('assistant_conversations').select('id, title, audit_id, updated_at').is('deleted_at', null).order('updated_at', { ascending: false }).limit(30);
  if (audit && audit !== 'demo') q = q.eq('audit_id', audit);
  const { data, error } = await q; if (error) return fail(500, 'Couldn’t load conversations.', error);
  return NextResponse.json({ items: data });
}
