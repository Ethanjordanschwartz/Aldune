import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { detectPlaceholders, fillTemplate, mapField, amountInWords } from '@/lib/documents/customTemplate';

// a minimal .docx whose placeholders are split across runs the way Word saves them
async function docx(paras: string[][]): Promise<Uint8Array> {
  const z = new JSZip();
  z.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  const body = paras.map(runs => `<w:p><w:pPr><w:jc w:val="left"/></w:pPr>${runs.map(r => `<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${r.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</w:t></w:r>`).join('')}</w:p>`).join('');
  z.file('word/document.xml', `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`);
  return z.generateAsync({ type: 'uint8array' });
}
const text = async (b: Uint8Array) => { const x = await (await JSZip.loadAsync(b)).file('word/document.xml')!.async('string'); return [...x.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)].map(p => [...p[0].matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>|<w:br\/>/g)].map(t => t[0] === '<w:br/>' ? '\n' : t[1]).join('')); };

describe('customer templates filled with audit data', () => {
  it('maps the words people use to fields', () => {
    expect(mapField('Employee Name')).toBe('employee_name');
    expect(mapField('EMPLOYEE_NAME')).toBe('employee_name');
    expect(mapField('Releasor')).toBe('employee_name');
    expect(mapField('Company')).toBe('employer_name');
    expect(mapField('Settlement Amount')).toBe('payment_amount');
    expect(mapField('Total Amount')).toBe('total_amount');
    expect(mapField('amount in words')).toBe('total_amount_words');
    expect(mapField('Date')).toBe('date');
    expect(mapField('Findings Table')).toBe('findings_list');
    expect(mapField('sic')).toBeNull();
  });
  it('finds braces, brackets, guillemets, and blanks — including placeholders split across runs', async () => {
    const b = await docx([['Dear {{Emp', 'loyee Na', 'me}},'], ['[Company] agrees to pay «Total Amount» on [Payment Date].'], ['Employee ID: ________   Date: ________'], ['As noted [sic], and {Custom Clause}.']]);
    const ph = await detectPlaceholders(b);
    const by = Object.fromEntries(ph.map(p => [p.label, p.field]));
    expect(by['Employee Name']).toBe('employee_name');
    expect(by['Company']).toBe('employer_name');
    expect(by['Total Amount']).toBe('total_amount');
    expect(by['Payment Date']).toBe('payment_date');
    expect(by['Employee ID']).toBe('employee_id');
    expect(by['Date']).toBe('date');
    expect(by['Custom Clause']).toBeNull();
    expect(ph.some(p => p.label === 'sic')).toBe(false);
  });
  it('fills the template in place, keeps run formatting, and reports what was left unfilled', async () => {
    const b = await docx([['Dear {{Emp', 'loyee Na', 'me}},'], ['[Company] agrees to pay «Total Amount» (', '{{amount in words}}', ').'], ['Employee ID: ________'], ['Itemized:'], ['{{Findings List}}'], ['{Custom Clause}']]);
    const r = await fillTemplate(b, { fields: { employee_name: 'Ana Torres', employer_name: 'Acme Retail Group, Inc.', total_amount: '$1,234.50', total_amount_words: amountInWords(1234.5), employee_id: 'E-1001', findings_list: 'Meal periods: $95.00\nRest periods: $120.00' } });
    const t = await text(r.bytes);
    expect(t[0]).toBe('Dear Ana Torres,');
    expect(t[1]).toBe('Acme Retail Group, Inc. agrees to pay $1,234.50 (One thousand two hundred thirty-four dollars and 50/100).');
    expect(t[2]).toBe('Employee ID: E-1001');
    expect(t[4]).toBe('Meal periods: $95.00\nRest periods: $120.00');
    expect(t[5]).toBe('{Custom Clause}');
    expect(r.missing).toEqual(['Custom Clause']);
    const xml = await (await JSZip.loadAsync(r.bytes)).file('word/document.xml')!.async('string');
    expect(xml).toContain('<w:b/>');
    // values typed by the user for unrecognized labels
    const r2 = await fillTemplate(b, { fields: {}, byLabel: { 'Custom Clause': 'Section 7 applies.' } });
    expect((await text(r2.bytes))[5]).toBe('Section 7 applies.');
  });
  it('escapes values so the document stays valid', async () => {
    const b = await docx([['{{Company}}']]);
    const r = await fillTemplate(b, { fields: { employer_name: 'Smith & Sons <West>' } });
    expect((await text(r.bytes))[0]).toBe('Smith &amp; Sons &lt;West&gt;');
  });
  it('writes amounts in words', () => {
    expect(amountInWords(0.5)).toBe('zero dollars and 50/100');
    expect(amountInWords(2304)).toBe('Two thousand three hundred four dollars and 00/100');
    expect(amountInWords(1000000)).toBe('One million dollars and 00/100');
  });
});
