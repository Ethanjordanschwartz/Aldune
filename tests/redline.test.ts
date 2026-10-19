// Document review → redline: real tracked changes in the user's own Word file, Word comments with reasons and authority,
// a clean ready-to-sign version, and a memo. Forms are reviewed as forms (never padded with handbook policies).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import JSZip from 'jszip';
import { extractDocument, legacyDocText } from '@/lib/documents/browserExtract';
import { reviewParagraphs, detectKind, employerIn } from '@/lib/documents/redline/rules';
import { reviseDocument, scanParagraphs } from '@/lib/documents/redline/docx';
import { reviewMemoDocx } from '@/lib/documents/redline/memo';
import { REQUIRED } from '@/lib/documents/handbook';

const ab = (f: string) => { const b = readFileSync(f); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
const docText = async (bytes: Uint8Array) => { const z = await JSZip.loadAsync(bytes); return scanParagraphs(await z.file('word/document.xml')!.async('string')).map(p => p.text).join('\n'); };
const wellFormed = (xml: string) => { const stack: string[] = []; const re = /<\/?([A-Za-z][\w:.-]*)[^>]*?(\/?)>/g; let m; xml = xml.replace(/<\?[\s\S]*?\?>/g, ''); while ((m = re.exec(xml))) { if (m[0].startsWith('</')) { if (stack.pop() !== m[1]) return false; } else if (!m[2]) stack.push(m[1]); } return stack.length === 0; };

describe('legacy Word (.doc) text', () => {
  it('reads the real text through the piece table — no picture/Photoshop/XMP bytes', async () => {
    const t = legacyDocText(ab('tests/fixtures/policies/meal_waiver.doc'));
    expect(t).toMatch(/^MEAL PERIOD & BREAK WAIVER/);
    expect(t).toContain('Rev. 4/2020');
    expect(t).not.toMatch(/JFIF|8BIM|Photoshop|xpacket|Adobe|rdf:/);
    expect(t.split('\n').length).toBeLessThan(40);
  });
});

describe('meal period waiver review', () => {
  const load = async (f: string) => extractDocument(f, ab(`tests/fixtures/policies/${f}`));
  it('is reviewed as a meal waiver with targeted changes — never as a handbook', async () => {
    const t = await load('meal_waiver.doc');
    expect(detectKind(t)).toBe('meal_waiver'); expect(employerIn(t)).toBe('Sample Pizza Co., Inc.');
    const plan = reviewParagraphs(t.split('\n'), { today: '2026-10-07' });
    const titles = plan.findings.map(f => f.title);
    expect(titles).toEqual(expect.arrayContaining(['Meal period entitlement misstated', 'Title promises a “break” waiver', 'Spanish version does not match the English', 'Confirm rest periods are not waived']));
    expect(titles.some(x => /required policy|harassment|cannabis|sick leave/i.test(x))).toBe(false);
    expect(plan.findings.every(f => f.cite && f.why.length > 40)).toBe(true);
  });
  for (const f of ['meal_waiver.docx', 'meal_waiver.doc']) it(`${f}: redline has tracked changes + comments, clean version is ready to sign`, async () => {
    const text = await load(f);
    const red = await reviseDocument({ name: f, text, bytes: ab(`tests/fixtures/policies/${f}`) }, 'redline', { today: '2026-10-07' });
    const z = await JSZip.loadAsync(red.bytes); const doc = await z.file('word/document.xml')!.async('string'); const com = await z.file('word/comments.xml')!.async('string');
    expect(wellFormed(doc)).toBe(true); expect(wellFormed(com)).toBe(true);
    expect((doc.match(/<w:ins /g) || []).length).toBeGreaterThan(10); expect((doc.match(/<w:del /g) || []).length).toBeGreaterThan(10);
    const nC = (com.match(/<w:comment /g) || []).length; expect(nC).toBeGreaterThan(8);
    expect((doc.match(/<w:commentReference /g) || []).length).toBe(nC);
    expect(com).toContain('Lab. Code § 512(a)'); expect(com).toContain('Augustus');
    expect(await z.file('[Content_Types].xml')!.async('string')).toContain('/word/comments.xml');
    if (f.endsWith('.docx')) { expect(doc).toContain('<w:drawing>'); expect(z.file('word/media/image1.jpg')).toBeTruthy(); }
    const clean = await reviseDocument({ name: f, text, bytes: ab(`tests/fixtures/policies/${f}`) }, 'clean', { today: '2026-10-07' });
    const c = await docText(clean.bytes); const cz = await JSZip.loadAsync(clean.bytes); const cdoc = await cz.file('word/document.xml')!.async('string');
    expect(cdoc).not.toMatch(/<w:(ins|del) /); expect(cz.file('word/comments.xml')).toBeFalsy();
    expect(c).toMatch(/^MEAL PERIOD WAIVER/m);
    for (const must of ['end of my fifth hour', 'end of my tenth hour', 'no more than six (6) hours', 'Labor Code section 226.7', 'This form does not waive rest periods', 'not a condition of employment', 'Second Meal Period (optional)', 'no more than twelve (12)', 'RENUNCIA AL PERIODO DE COMIDA', 'quinta hora', 'Sample Pizza Co., Inc.', 'Rev. 10/2026', 'Employee signature: ____'])
      expect(c, must).toContain(must);
    for (const gone of ['for every five (5) hour period', 'BREAK WAIVER', 'periodo de descanso\n', '___ periodo de descanso', 'sugerente', 'Rev. 4/2020', 'PERIODO DE COMIDA Y DE DESCANSO'])
      expect(c, gone).not.toContain(gone);
  });
  it('an employer’s original Word form is revised in place (logo and layout kept)', async () => {
    const f = 'tests/fixtures/Meal_Break_Waiver.docx'; const text = await extractDocument('w.docx', ab(f));
    const red = await reviseDocument({ name: 'Meal_Break_Waiver.docx', text, bytes: ab(f) }, 'redline', { today: '2026-10-07' });
    const z = await JSZip.loadAsync(red.bytes); const doc = await z.file('word/document.xml')!.async('string');
    expect(wellFormed(doc)).toBe(true); expect(red.plan.kind).toBe('meal_waiver');
    const orig = await (await JSZip.loadAsync(ab(f))).file('word/document.xml')!.async('string');
    expect((doc.match(/<w:drawing>|<w:pict>/g) || []).length).toBe((orig.match(/<w:drawing>|<w:pict>/g) || []).length);
    const clean = await docText((await reviseDocument({ name: 'Meal_Break_Waiver.docx', text, bytes: ab(f) }, 'clean', { today: '2026-10-07' })).bytes);
    expect(clean).toContain('end of my fifth hour'); expect(clean).not.toContain('for every five (5) hour period');
  });
  it('writes a review memo listing every change with its authority', async () => {
    const t = await load('meal_waiver.doc'); const plan = reviewParagraphs(t.split('\n'), { today: '2026-10-07' });
    const memo = await reviewMemoDocx(plan, 'Meal Break Waiver', 'buffer', { today: '2026-10-07' }) as Uint8Array;
    const z = await JSZip.loadAsync(memo); const x = await z.file('word/document.xml')!.async('string');
    expect(x).toContain('MEMORANDUM'); expect(x).toContain('Next steps'); expect(x).toContain('Collect a newly signed form');
    expect((x.match(/<w:tr>|<w:tr /g) || []).length).toBe(plan.findings.length + 1);
  });
});

describe('handbooks, single policies, other forms', () => {
  it('a handbook gets unlawful language replaced and missing policies added (no placeholders)', async () => {
    const text = readFileSync('tests/fixtures/bad_handbook.txt', 'utf8');
    const plan = reviewParagraphs(text.split('\n'), { today: '2026-10-07' }); expect(plan.kind).toBe('handbook');
    const clean = await docText((await reviseDocument({ name: 'bad_handbook.txt', text }, 'clean')).bytes);
    for (const gone of ['use-it-or-lose-it', 'rounded to the nearest quarter hour', 'automatically deducted', 'will not be paid', 'mailed on the next regular payday', 'at their own expense', 'Cash shortages will be deducted', 'may not discuss wages', '24 hours of paid sick leave', 'not to compete'])
      expect(clean, gone).not.toContain(gone);
    expect(clean).toContain('Lactation accommodation'); expect(clean).toContain('end of the fifth hour');
    expect(clean).not.toMatch(/\[(__|contact|alternate contact|Removed)[^\]]*\]/);
  });
  it('a single meal and rest policy is checked for its own rules only', () => {
    const plan = reviewParagraphs(['Meal and Rest Break Policy', 'Employees working more than six hours receive a 30-minute lunch.', 'Supervisors schedule breaks.'], { today: '2026-10-07' });
    expect(plan.kind).toBe('policy');
    expect(plan.findings.some(f => /required policy/i.test(f.title))).toBe(false);
    expect(plan.findings.filter(f => /missing a required rule/.test(f.title)).length).toBeGreaterThanOrEqual(3);
    expect(plan.notes.join(' ')).toMatch(/single policy/);
  });
  it('an on-duty meal agreement gets its three legal conditions', () => {
    const plan = reviewParagraphs(['ON-DUTY MEAL PERIOD AGREEMENT', 'I agree to take on-duty meal periods. This agreement may be revoked only with 30 days’ notice to the Company.'], { today: '2026-10-07' });
    expect(plan.kind).toBe('on_duty_meal');
    const t = plan.findings.map(f => f.title).join(' | ');
    expect(t).toMatch(/nature|necessary/i); expect(t).toMatch(/Revocation cannot be restricted/); expect(t).toMatch(/paid time/);
  });
  it('a non-employment document gets no edits', () => {
    const plan = reviewParagraphs(['Gift card terms', 'This card has no cash value and cannot be reloaded.'], {});
    expect(plan.edits.length).toBe(0);
  });
  it('a full handbook missing policies gets each added as a tracked insertion', () => {
    const paras = ['EMPLOYEE HANDBOOK', ...REQUIRED.slice(0, 8).map(r => `${r.title}. ${r.text}`)];
    const plan = reviewParagraphs(paras); expect(plan.kind).toBe('handbook');
    const added = plan.findings.filter(f => /^Add required policy/.test(f.title)).length;
    expect(added).toBe(REQUIRED.filter(r => !r.detect.test(paras.join('\n'))).length);
  });
});
