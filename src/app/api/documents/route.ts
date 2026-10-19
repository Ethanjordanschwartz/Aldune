import { NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { requireUser } from '@/lib/supabase/server';
import { extractText } from '@/lib/documents/extract';
import { classifyDocument, quickCheckDocument, type DocType } from '@/lib/documents/review';
const MAX = 15 * 1024 * 1024;
export async function GET() {
  const { sb, user } = await requireUser(); if (!user) return fail(401, 'Sign in first.');
  const { data, error } = await sb.from('org_documents').select('id, name, doc_type, char_count, ai_review, created_at').is('deleted_at', null).order('created_at', { ascending: false }).limit(200);
  return error ? fail(500, 'Couldn’t load documents.', error) : NextResponse.json({ items: data });
}
export async function POST(req: Request) {
  const { sb, user } = await requireUser(); if (!user) return fail(401, 'Sign in first.');
  const form = await req.formData().catch(() => null); if (!form) return fail(400, 'Upload a file or paste text.');
  const orgId = String(form.get('organizationId') || '');
  const { data: m } = await sb.from('organization_members').select('role').eq('organization_id', orgId).eq('user_id', user.id).maybeSingle();
  if (!m || m.role === 'viewer') return fail(403, 'You don’t have permission to add documents.');
  const file = form.get('file'); let name = String(form.get('name') || 'Pasted text'), text = String(form.get('text') || ''), path: string | null = null;
  if (file && typeof file !== 'string') {
    if (file.size > MAX) return fail(413, 'Files must be under 15 MB.');
    const buf = await file.arrayBuffer(); name = file.name.slice(0, 200);
    try { text = await extractText(name, buf); } catch (e) { return fail(422, e instanceof Error ? e.message : 'Couldn’t read that file.'); }
    path = `${orgId}/documents/${crypto.randomUUID()}-${name.replace(/[^\w.-]/g, '_')}`;
    const up = await sb.storage.from('audit-files').upload(path, new Blob([buf]), { contentType: file.type || 'application/octet-stream' });
    if (up.error) return fail(500, 'Couldn’t store the file.', up.error);
  }
  text = text.replace(/\u0000/g, '').trim().slice(0, 400_000); if (!text) return fail(400, 'The document has no readable text.');
  const type = (String(form.get('docType') || '') || classifyDocument(text)) as DocType;
  const { data, error } = await sb.from('org_documents').insert({ organization_id: orgId, name, doc_type: type, storage_path: path, text_content: text, quick_check: quickCheckDocument(type, text), uploaded_by: user.id }).select('id').single();
  if (error) return fail(500, 'Couldn’t save the document.', error);
  await sb.from('audit_logs').insert({ organization_id: orgId, actor_id: user.id, action: 'document.upload', target_type: 'document', target_id: data.id });
  return NextResponse.json({ id: data.id });
}
