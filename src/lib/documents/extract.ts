import 'server-only';
/** Extract plain text from an uploaded document. Throws a user-facing message when the format can't be read. */
export async function extractText(name: string, buf: ArrayBuffer): Promise<string> {
  const lower = name.toLowerCase();
  if (lower.endsWith('.txt') || lower.endsWith('.md')) return new TextDecoder().decode(buf);
  if (lower.endsWith('.docx')) { const mammoth = await import('mammoth'); const r = await mammoth.extractRawText({ buffer: Buffer.from(buf) }); return r.value; }
  if (lower.endsWith('.pdf')) {
    const { extractText: pdf, getDocumentProxy } = await import('unpdf');
    const doc = await getDocumentProxy(new Uint8Array(buf)); const { text } = await pdf(doc, { mergePages: true });
    const t = Array.isArray(text) ? text.join('\n') : text; if (!t.trim()) throw new Error('This PDF has no text layer (it may be a scan). Upload a text PDF or Word file.'); return t;
  }
  if (lower.endsWith('.doc')) throw new Error('Older .doc files aren’t supported. Save as .docx or PDF.');
  throw new Error('Upload a .docx, .pdf, or .txt file.');
}
