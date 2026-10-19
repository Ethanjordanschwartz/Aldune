import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { AI } from '@/config/app';
import type { Block, DataAccess, ModelClient } from './core';
import { getSource } from '../store';
import { demoInput, demoResult } from '../store/demo';
import { loadInput } from '../store/db';
import { runAudit } from '../engine/audit';
import type { supabaseServer } from '../supabase/server';

/** Claude via the Messages streaming API. */
export function claudeModel(): ModelClient {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return {
    async turn({ system, messages, tools }, onText, signal) {
      // Anthropic's server-side web search lets Penny answer current-law and general questions with linked sources (disable with AI_WEB_SEARCH=off).
      const web = process.env.AI_WEB_SEARCH === 'off' ? [] : [{ type: 'web_search_20250305', name: 'web_search', max_uses: Number(process.env.AI_WEB_SEARCH_MAX_USES || 5) }];
      const allTools = [...tools, ...web];
      const stream = client.messages.stream({ model: AI.model, max_tokens: AI.maxTokens, system, messages: messages as Anthropic.MessageParam[], ...(allTools.length ? { tools: allTools as never } : {}) }, { signal });
      stream.on('text', t => onText(t));
      const m = await stream.finalMessage();
      return { content: m.content as unknown as Block[], stopReason: m.stop_reason, usage: { input: m.usage.input_tokens, output: m.usage.output_tokens } };
    }
  };
}

/** Public demo data (no persistence). */
export function demoAccess(): DataAccess {
  return {
    async listAudits() { return [{ id: 'demo', name: 'Pacific Coast Fresh, Inc. — annual audit (demo)', status: 'complete' }]; },
    async source(id) { return id === 'demo' ? getSource('demo') : null; },
    async model(id) { return id === 'demo' ? { input: demoInput(), result: demoResult() } : null; },
    async searchDocuments() { return []; },
    async getDocument() { return null; }
  };
}

const modelCache = new Map<string, { at: number; v: { input: import('../engine/types').AuditInput; result: import('../engine/audit').AuditResult } }>();
/** Organization-scoped access through the user's RLS-bound client. Every lookup is also filtered by organization_id. */
export function orgAccess(sb: ReturnType<typeof supabaseServer>, orgId: string): DataAccess {
  const owns = async (auditId: string) => { const { data } = await sb.from('audits').select('id, assumptions').eq('id', auditId).eq('organization_id', orgId).is('deleted_at', null).maybeSingle(); return data; };
  return {
    async listAudits() { const { data } = await sb.from('audits').select('id, name, status, created_at').eq('organization_id', orgId).is('deleted_at', null).order('created_at', { ascending: false }).limit(50); return (data || []).map(a => ({ id: a.id, name: a.name, status: a.status, createdAt: a.created_at })); },
    async source(auditId) { return (await owns(auditId)) ? getSource(auditId) : null; },
    async model(auditId) {
      const a = await owns(auditId); if (!a) return null;
      const hit = modelCache.get(`${orgId}:${auditId}`); if (hit && Date.now() - hit.at < 10 * 60_000) return hit.v;
      const input = await loadInput(sb, auditId); if (!input) return null;
      const v = { input, result: runAudit(input, (a.assumptions as object) || {}) }; modelCache.set(`${orgId}:${auditId}`, { at: Date.now(), v }); if (modelCache.size > 20) modelCache.delete(modelCache.keys().next().value!); return v;
    },
    async searchDocuments(q, limit) {
      const { data } = await sb.from('org_documents').select('id, name, doc_type, text_content').eq('organization_id', orgId).is('deleted_at', null).textSearch('search', q, { type: 'websearch' }).limit(limit);
      return (data || []).map(d => { const t = d.text_content as string; const i = Math.max(0, t.toLowerCase().indexOf(q.toLowerCase().split(' ')[0] || '')); return { id: d.id, name: d.name, type: d.doc_type, snippet: t.slice(Math.max(0, i - 150), i + 350) }; });
    },
    async getDocument(id) { const { data } = await sb.from('org_documents').select('id, name, doc_type, text_content, ai_review').eq('id', id).eq('organization_id', orgId).is('deleted_at', null).maybeSingle(); return data ? { id: data.id, name: data.name, type: data.doc_type, text: data.text_content, review: data.ai_review } : null; }
  };
}
