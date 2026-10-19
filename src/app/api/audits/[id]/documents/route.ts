import { NextResponse } from 'next/server';
import { authorizedSource, fail } from '@/lib/api';
import { buildDocs, DocRequest } from '@/lib/documents/build';
import { toDocx, toHtml } from '@/lib/documents/render';
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const a = await authorizedSource(params.id); if ('error' in a) return a.error;
  const parsed = DocRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(400, 'Some document details are missing or invalid.');
  try {
    const docs = await buildDocs(a.source, parsed.data);
    if (!docs.length) return fail(422, 'No documents to generate for the selected employees with these settings.');
    if (parsed.data.format === 'html') return NextResponse.json({ html: toHtml(docs), count: docs.length });
    const buf = await toDocx(docs);
    return new NextResponse(new Uint8Array(buf), { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'Content-Disposition': `attachment; filename="${parsed.data.template}-${new Date().toISOString().slice(0, 10)}.docx"` } });
  } catch (e) { return fail(500, 'Couldn’t generate the documents.', e); }
}
