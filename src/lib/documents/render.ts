import { AlignmentType, BorderStyle, Document, Packer, PageBreak, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from 'docx';

// A small document model so every template renders identically to Word (.docx) and to an on-screen preview.
export type Inline = string | { text: string; bold?: boolean; italic?: boolean; underline?: boolean };
export type Block =
  | { t: 'title'; text: string }
  | { t: 'heading'; text: string }
  | { t: 'p'; runs: Inline[]; align?: 'left' | 'center' | 'justify'; indent?: boolean }
  | { t: 'numbered'; n: string; heading?: string; runs: Inline[] }
  | { t: 'bullets'; items: Inline[][] }
  | { t: 'table'; head: string[]; rows: string[][]; widths?: number[] }
  | { t: 'signature'; lines: { label: string; name?: string }[] }
  | { t: 'notice'; runs: Inline[] }
  | { t: 'spacer' }
  | { t: 'pagebreak' };

export interface DocModel { title: string; blocks: Block[]; draftBanner?: string }

const run = (i: Inline, base: { bold?: boolean; size?: number } = {}) =>
  typeof i === 'string' ? new TextRun({ text: i, bold: base.bold, size: base.size }) : new TextRun({ text: i.text, bold: i.bold ?? base.bold, italics: i.italic, underline: i.underline ? {} : undefined, size: base.size });

/** Any template field still unfilled prints as a labeled blank line (a form to complete), never as [[BRACKETS]]. */
export function fillBlanks<T>(models: T): T {
  return JSON.parse(JSON.stringify(models).replace(/\[\[([^\]"]{1,120})\]\]/g, (_m, l: string) => `______________ (${l.trim().toLowerCase()})`));
}
export async function toDocx(models: DocModel[]): Promise<Buffer> {
  models = fillBlanks(models);
  const children: (Paragraph | Table)[] = [];
  models.forEach((m, mi) => {
    if (mi > 0) children.push(new Paragraph({ children: [new PageBreak()] }));
    if (m.draftBanner) children.push(new Paragraph({ children: [new TextRun({ text: m.draftBanner, color: 'B42318', size: 18 })] }));
    for (const b of m.blocks) {
      switch (b.t) {
        case 'title': children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 }, children: [new TextRun({ text: b.text, bold: true, size: 26 })] })); break;
        case 'heading': children.push(new Paragraph({ spacing: { before: 200, after: 120 }, children: [new TextRun({ text: b.text, bold: true, size: 23 })] })); break;
        case 'p': children.push(new Paragraph({ alignment: b.align === 'center' ? AlignmentType.CENTER : b.align === 'justify' ? AlignmentType.JUSTIFIED : AlignmentType.LEFT, indent: b.indent ? { firstLine: 720 } : undefined, spacing: { after: 160, line: 276 }, children: b.runs.map(r => run(r)) })); break;
        case 'numbered': children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 160, line: 276 }, children: [new TextRun({ text: `${b.n}.\t`, bold: true }), ...(b.heading ? [new TextRun({ text: `${b.heading}. `, bold: true })] : []), ...b.runs.map(r => run(r))] })); break;
        case 'bullets': b.items.forEach(it => children.push(new Paragraph({ bullet: { level: 0 }, spacing: { after: 80 }, children: it.map(r => run(r)) }))); break;
        case 'notice': children.push(new Paragraph({ spacing: { before: 120, after: 160 }, border: { top: { style: BorderStyle.SINGLE, size: 6, color: '000000' }, bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000' } }, children: b.runs.map(r => run(r, { bold: true })) })); break;
        case 'spacer': children.push(new Paragraph({ children: [] })); break;
        case 'pagebreak': children.push(new Paragraph({ children: [new PageBreak()] })); break;
        case 'signature':
          b.lines.forEach(l => {
            children.push(new Paragraph({ spacing: { before: 360 }, children: [new TextRun('______________________________________        Date: ________________')] }));
            children.push(new Paragraph({ children: [new TextRun({ text: l.label, bold: true }), ...(l.name ? [new TextRun(`  ${l.name}`)] : [])] }));
          });
          break;
        case 'table': {
          const cell = (txt: string, bold = false) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: txt, bold, size: 20 })] })] });
          children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [new TableRow({ tableHeader: true, children: b.head.map(h => cell(h, true)) }), ...b.rows.map(r => new TableRow({ children: r.map(c => cell(c)) }))] }));
          children.push(new Paragraph({ children: [] }));
        }
      }
    }
  });
  const doc = new Document({ styles: { default: { document: { run: { font: 'Times New Roman', size: 24 } } } }, sections: [{ properties: { page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } }, children }] });
  return Packer.toBuffer(doc);
}

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const html = (i: Inline) => { if (typeof i === 'string') return esc(i); let s = esc(i.text); if (i.bold) s = `<b>${s}</b>`; if (i.italic) s = `<i>${s}</i>`; if (i.underline) s = `<u>${s}</u>`; return s; };

export function toHtml(models: DocModel[]): string {
  models = fillBlanks(models);
  return models.map(m => {
    const body = m.blocks.map(b => {
      switch (b.t) {
        case 'title': return `<h2 class="doc-title">${esc(b.text)}</h2>`;
        case 'heading': return `<h3>${esc(b.text)}</h3>`;
        case 'p': return `<p style="text-align:${b.align || 'left'}${b.indent ? ';text-indent:2em' : ''}">${b.runs.map(html).join('')}</p>`;
        case 'numbered': return `<p style="text-align:justify"><b>${esc(b.n)}.</b> ${b.heading ? `<b>${esc(b.heading)}.</b> ` : ''}${b.runs.map(html).join('')}</p>`;
        case 'bullets': return `<ul>${b.items.map(it => `<li>${it.map(html).join('')}</li>`).join('')}</ul>`;
        case 'notice': return `<p class="doc-notice">${b.runs.map(html).join('')}</p>`;
        case 'table': return `<table class="doc-table"><thead><tr>${b.head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${b.rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
        case 'signature': return b.lines.map(l => `<p class="doc-sig">______________________________ &nbsp; Date: __________<br><b>${esc(l.label)}</b> ${l.name ? esc(l.name) : ''}</p>`).join('');
        case 'spacer': return '<br>';
        case 'pagebreak': return '<hr class="doc-break">';
      }
    }).join('\n');
    return `<article class="doc">${m.draftBanner ? `<p class="doc-draft">${esc(m.draftBanner)}</p>` : ''}${body}</article>`;
  }).join('<hr class="doc-break">');
}
