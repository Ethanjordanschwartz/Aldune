import { NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { requireUser } from '@/lib/supabase/server';
export async function GET(_: Request, { params }: { params: { cid: string } }) {
  const { sb, user } = await requireUser(); if (!user) return fail(401, 'Sign in first.');
  const { data: c } = await sb.from('assistant_conversations').select('id, title').eq('id', params.cid).is('deleted_at', null).maybeSingle();
  if (!c) return fail(404, 'Conversation not found.');
  const { data } = await sb.from('assistant_messages').select('role, content, citations, created_at').eq('conversation_id', c.id).order('created_at');
  return NextResponse.json({ conversation: c, messages: data || [] });
}
export async function DELETE(_: Request, { params }: { params: { cid: string } }) {
  const { sb, user } = await requireUser(); if (!user) return fail(401, 'Sign in first.');
  const { error } = await sb.from('assistant_conversations').update({ deleted_at: new Date().toISOString() }).eq('id', params.cid);
  return error ? fail(500, 'Couldn’t delete.', error) : NextResponse.json({ ok: true });
}
