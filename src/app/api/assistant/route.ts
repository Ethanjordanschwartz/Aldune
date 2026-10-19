import { z } from 'zod';
import { fail, rateLimit } from '@/lib/api';
import { aiConfigured } from '@/lib/ai/claude';
import { requireUser, supabaseConfigured } from '@/lib/supabase/server';
import { runAssistantTurn, sse, type AssistantEvent } from '@/lib/assistant/core';
import { claudeModel, demoAccess, orgAccess } from '@/lib/assistant/server';
import { enforce, recordUsage } from '@/lib/billing/server';
import { hasFeature } from '@/lib/billing/entitlements';
import { AI } from '@/config/app';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;
const Body = z.object({ message: z.string().trim().min(1).max(2000), conversationId: z.string().uuid().optional(), auditId: z.string().max(64).optional(), organizationId: z.string().uuid().optional(), history: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(8000) })).max(12).optional() });

export async function POST(req: Request) {
  if (!aiConfigured()) return fail(503, 'The assistant isn’t configured. Add ANTHROPIC_API_KEY.');
  const parsed = Body.safeParse(await req.json().catch(() => null)); if (!parsed.success) return fail(400, 'Ask a question of up to 2,000 characters.');
  const b = parsed.data;
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  const demo = b.auditId === 'demo' || !supabaseConfigured();

  let access, history = b.history || [], conversationId: string | null = null, orgId: string | null = null, remaining: number | null = null, context = '';
  let persist: ((text: string, citations: unknown[], tools: unknown[], usage: { input: number; output: number }) => Promise<void>) | null = null;

  if (demo) {
    if (!rateLimit(`assistant-demo:${ip}`, 15, 60 * 60_000)) return fail(429, 'Demo limit reached. Create an account to keep going.');
    access = demoAccess(); context = 'Context: public demo of a fictional company. The current audit id is "demo".';
  } else {
    const { sb, user } = await requireUser(); if (!user) return fail(401, 'Sign in to use the assistant.');
    if (!rateLimit(`assistant:${user.id}`, 30)) return fail(429, 'Too many requests. Wait a minute and try again.');
    if (b.conversationId) {
      const { data: c } = await sb.from('assistant_conversations').select('id, organization_id, audit_id').eq('id', b.conversationId).is('deleted_at', null).maybeSingle();
      if (!c) return fail(404, 'Conversation not found.'); conversationId = c.id; orgId = c.organization_id;
      const { data: msgs } = await sb.from('assistant_messages').select('role, content').eq('conversation_id', c.id).order('created_at', { ascending: false }).limit(12);
      history = (msgs || []).reverse().map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
    } else if (b.auditId) {
      const { data: a } = await sb.from('audits').select('organization_id').eq('id', b.auditId).maybeSingle(); if (!a) return fail(404, 'Audit not found.'); orgId = a.organization_id;
    } else if (b.organizationId) orgId = b.organizationId;
    else { const { data: m } = await sb.from('organization_members').select('organization_id').eq('user_id', user.id).limit(1).maybeSingle(); orgId = m?.organization_id ?? null; }
    if (!orgId) return fail(403, 'No organization found for your account.');
    const { data: member } = await sb.from('organization_members').select('role').eq('organization_id', orgId).eq('user_id', user.id).maybeSingle();
    if (!member) return fail(403, 'You don’t have access to this organization.');
    const { ent, check } = await enforce(sb, orgId, 'assistantMessages', 1, 'assistant_message');
    if (!hasFeature(ent, 'assistant')) return fail(402, 'The assistant isn’t included in your plan.');
    if (!check.ok) return fail(402, check.message || 'Monthly assistant limit reached.');
    remaining = check.limit === null ? null : check.limit - check.used - 1;
    if (!conversationId) {
      const { data: c, error } = await sb.from('assistant_conversations').insert({ organization_id: orgId, user_id: user.id, audit_id: b.auditId && b.auditId !== 'demo' ? b.auditId : null, title: b.message.slice(0, 70) }).select('id').single();
      if (error) return fail(500, 'Couldn’t start a conversation.', error); conversationId = c.id;
    }
    await sb.from('assistant_messages').insert({ conversation_id: conversationId, organization_id: orgId, role: 'user', content: b.message });
    access = orgAccess(sb, orgId);
    context = `Context: user role is ${member.role}.${b.auditId ? ` The user is viewing audit id "${b.auditId}".` : ''} Today is ${new Date().toISOString().slice(0, 10)}.`;
    const cid = conversationId, oid = orgId;
    persist = async (text, citations, tools, usage) => {
      await sb.from('assistant_messages').insert({ conversation_id: cid, organization_id: oid, role: 'assistant', content: text, citations, tool_calls: tools, input_tokens: usage.input, output_tokens: usage.output, model: AI.model });
      await sb.from('assistant_conversations').update({ updated_at: new Date().toISOString() }).eq('id', cid);
      await recordUsage(sb, oid, 'assistant_message');
    };
  }

  const ac = new AbortController(); req.signal.addEventListener('abort', () => ac.abort());
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: AssistantEvent) => { try { controller.enqueue(enc.encode(sse(e))); } catch { /* client gone */ } };
      emit({ type: 'meta', conversationId });
      try {
        const r = await runAssistantTurn({ model: claudeModel(), data: access!, history, message: b.message, context, emit, signal: ac.signal });
        if (persist) await persist(r.text, r.citations, r.toolLog, r.usage);
        emit({ type: 'done', text: r.text, citations: r.citations, usage: r.usage, remaining });
      } catch (e) {
        const errorId = `ERR-${Date.now().toString(36).toUpperCase()}`; console.error(errorId, e instanceof Error ? e.message : e);
        emit({ type: 'error', message: ac.signal.aborted ? 'Stopped.' : 'The assistant ran into a problem. Try again.', errorId });
      } finally { controller.close(); }
    }
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' } });
}
