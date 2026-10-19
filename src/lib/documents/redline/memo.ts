// Review memo that accompanies a redline: what the document is, every change with the original language, the reason,
// and the authority, plus rollout steps. Written for the employer (or counsel) to act on.
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle } from 'docx';
import type { ReviewPlan } from './engine';

const F = { font: 'Times New Roman', size: 22 };
const P = (text: string, o: { bold?: boolean; italics?: boolean; color?: string; size?: number; after?: number } = {}) => new Paragraph({ spacing: { after: o.after ?? 120 }, children: [new TextRun({ text, ...F, bold: o.bold, italics: o.italics, color: o.color, size: o.size ?? F.size })] });
const cell = (children: Paragraph[], w: number, shade?: string) => new TableCell({ width: { size: w, type: WidthType.PERCENTAGE }, shading: shade ? { fill: shade } : undefined, margins: { top: 60, bottom: 60, left: 100, right: 100 }, children });

export function rolloutSteps(plan: ReviewPlan): string[] {
  const s = ['Have California employment counsel review the redline and accept or reject each tracked change.'];
  if (plan.kind === 'meal_waiver' || plan.kind === 'on_duty_meal') s.push('Retire the old form. Collect a newly signed form from every employee who will rely on it; waivers signed on the old form should not be relied on for shifts after the new form is issued.', 'Offer the form in the language the employee reads best, give the employee a signed copy, and keep the original with the personnel file.', 'Do not condition hiring, scheduling, or shifts on signing; make sure managers know the employee may revoke at any time.');
  else s.push('Publish the revised policy, obtain signed acknowledgments, and train managers on the changes.', 'Update payroll and timekeeping settings to match the revised policy (premium pay codes, meal punches, pay to the minute).');
  return s;
}

export async function reviewMemoDocx(plan: ReviewPlan, docName: string, out: 'buffer' | 'blob' = 'buffer', opts: { preparedFor?: string; today?: string } = {}): Promise<Uint8Array | Blob> {
  const req = plan.findings.filter(f => f.level === 'required'), rec = plan.findings.filter(f => f.level === 'recommended');
  const date = new Date((opts.today || new Date().toISOString().slice(0, 10)) + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const rows = plan.findings.map((f, i) => new TableRow({ cantSplit: true, children: [
    cell([P(String(i + 1), { bold: true })], 5),
    cell([P(f.title, { bold: true }), P(f.level === 'required' ? 'Required' : 'Recommended', { italics: true, color: f.level === 'required' ? '9A3B24' : '6A5847', size: 18 }), ...(f.quote ? [P(`Original: “${f.quote.length > 260 ? f.quote.slice(0, 257) + '…' : f.quote}”`, { size: 18, color: '6A5847' })] : [])], 40),
    cell([P(f.why, { size: 20 })], 35),
    cell([P(f.cite, { size: 18, italics: true })], 20)
  ] }));
  const header = new TableRow({ tableHeader: true, children: ['#', 'Change', 'Why', 'Authority'].map((h, i) => cell([P(h, { bold: true, size: 20 })], [5, 40, 35, 20][i], 'EFE7DD')) });
  const border = { style: BorderStyle.SINGLE, size: 4, color: 'D8CFC4' };
  const doc = new Document({ creator: 'Aldune', title: `Review memo — ${docName}`, sections: [{ children: [
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: 'MEMORANDUM', bold: true, font: F.font, size: 32 })] }),
    P(`Re: Review of “${docName}” (${plan.label.toLowerCase()})`, { bold: true }),
    P(`Date: ${date}`), ...(opts.preparedFor || plan.employer ? [P(`Prepared for: ${opts.preparedFor || plan.employer}`)] : []),
    P('Prepared with Aldune for review by California employment counsel. This memo explains each change in the accompanying redline; it is not legal advice.', { italics: true, color: '6A5847', size: 20, after: 240 }),
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: 'Summary', bold: true, font: F.font, size: 26 })] }),
    P(plan.findings.length ? `Aldune reviewed the document as a ${plan.label.toLowerCase()} and made ${plan.findings.length} change${plan.findings.length === 1 ? '' : 's'}: ${req.length} required by California law and ${rec.length} recommended to make the document defensible. Each change appears in the redline as a tracked change with a comment giving the reason and the authority; the clean version applies all of them and is ready to sign once counsel approves.` : `Aldune reviewed the document as a ${plan.label.toLowerCase()} and found nothing that needs to change under the rules it applies.`),
    ...plan.notes.map(t => P(t, { italics: true })),
    ...(plan.findings.length ? [new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: 'Changes', bold: true, font: F.font, size: 26 })] }),
      new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border }, rows: [header, ...rows] })] : []),
    new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 240 }, children: [new TextRun({ text: 'Next steps', bold: true, font: F.font, size: 26 })] }),
    ...rolloutSteps(plan).map((t, i) => P(`${i + 1}. ${t}`))
  ] }] });
  return out === 'blob' ? Packer.toBlob(doc) : new Uint8Array(await Packer.toBuffer(doc));
}
