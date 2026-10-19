// Word output for handbook review: tracked-changes redline (w:ins / w:del) with explanatory notes, and a clean revised handbook.
import { Document, Packer, Paragraph, TextRun, InsertedTextRun, DeletedTextRun, HeadingLevel } from 'docx';
import { redlinePlan, reviewHandbook, type HandbookReview } from './handbook';
const AUTHOR = 'Aldune'; const DATE = () => new Date().toISOString();
const FONT = { font: 'Times New Roman', size: 24 };
function summary(review: HandbookReview, title: string): Paragraph[] {
  return [
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: title, bold: true, ...FONT, size: 32 })] }),
    new Paragraph({ children: [new TextRun({ text: 'DRAFT FOR COUNSEL REVIEW — prepared with Aldune. Verify against current law and your facts before adopting.', italics: true, color: '9A3B24', ...FONT })] }),
    new Paragraph({ children: [new TextRun({ text: `Compliance score: ${review.score}/100 · ${review.problems.length} provisions revised · ${review.missing.length} required policies added.`, bold: true, ...FONT })] }),
    ...review.problems.map(p => new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: `${p.title}. `, bold: true, ...FONT }), new TextRun({ text: `${p.problem} (${p.cite})`, ...FONT })] })),
    ...review.missing.map(m => new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: `Added: ${m.title}. `, bold: true, ...FONT }), new TextRun({ text: `${m.appliesTo}. ${m.cite}.`, ...FONT })] })),
    new Paragraph({ pageBreakBefore: true, children: [] })
  ];
}
let rid = 1;
export async function redlineDocx(text: string, name = 'Employee Handbook', out: 'buffer' | 'blob' = 'buffer'): Promise<Uint8Array | Blob> {
  const review = reviewHandbook(text); const plan = redlinePlan(text, review); const date = DATE();
  const body: Paragraph[] = [];
  let addedHeader = false;
  for (const item of plan) {
    if (item.kind === 'add' && !addedHeader) { body.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new InsertedTextRun({ text: 'California Policies Added by Revision', id: rid++, author: AUTHOR, date, bold: true, ...FONT })] })); addedHeader = true; }
    if (item.heading) body.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new InsertedTextRun({ text: item.heading, id: rid++, author: AUTHOR, date, bold: true, ...FONT })] }));
    body.push(new Paragraph({ spacing: { after: 120 }, children: item.segments.map(sg => sg.type === 'keep' ? new TextRun({ text: sg.text, ...FONT }) : sg.type === 'del' ? new DeletedTextRun({ text: sg.text, id: rid++, author: AUTHOR, date, ...FONT }) : new InsertedTextRun({ text: sg.text, id: rid++, author: AUTHOR, date, ...FONT })) }));
    if (item.note) body.push(new Paragraph({ indent: { left: 720 }, spacing: { after: 200 }, children: [new TextRun({ text: `Aldune note: ${item.note}`, italics: true, color: '6A5847', ...FONT, size: 20 })] }));
  }
  const doc = new Document({ creator: 'Aldune', title: `${name} — redline`, features: { trackRevisions: true }, sections: [{ children: [...summary(review, `${name} — Redline`), ...body] }] });
  return out === 'blob' ? Packer.toBlob(doc) : new Uint8Array(await Packer.toBuffer(doc));
}
export async function cleanHandbookDocx(text: string, name = 'Employee Handbook', out: 'buffer' | 'blob' = 'buffer'): Promise<Uint8Array | Blob> {
  const plan = redlinePlan(text);
  const body: Paragraph[] = [new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: `${name} (revised)`, bold: true, ...FONT, size: 32 })] }), new Paragraph({ children: [new TextRun({ text: 'DRAFT FOR COUNSEL REVIEW — revised with Aldune.', italics: true, ...FONT })] })];
  let addedHeader = false;
  for (const item of plan) {
    if (item.kind === 'add' && !addedHeader) { body.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: 'California Policies', bold: true, ...FONT })] })); addedHeader = true; }
    if (item.heading) body.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: item.heading, bold: true, ...FONT })] }));
    body.push(new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: item.segments.filter(s => s.type !== 'del').map(s => s.text).join('').replace(/\s{2,}/g, ' ').trim(), ...FONT })] }));
  }
  const doc = new Document({ creator: 'Aldune', title: `${name} (revised)`, sections: [{ children: body }] });
  return out === 'blob' ? Packer.toBlob(doc) : new Uint8Array(await Packer.toBuffer(doc));
}
