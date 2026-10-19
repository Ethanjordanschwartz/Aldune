import { describe, expect, it } from 'vitest';
import { generateDemo } from '@/lib/demo/generate';
import { runAudit } from '@/lib/engine/audit';
import { makeLocalAccess } from '@/lib/assistant/local';
import { answerOffline } from '@/lib/assistant/offline';
import { searchLaw, LAW } from '@/lib/law/kb';

const d = generateDemo({ employees: 120, months: 4 }); const r = runAudit(d, { auditDate: d.auditDate });
const access = makeLocalAccess({ auditId: 'current', name: 'Demo', input: d, result: r, docs: [], status: {} });
const empty = makeLocalAccess({ auditId: 'none', name: 'x', input: { ...d, employees: [] }, result: r, docs: [], status: {} });
const noAudit = { ...empty, listAudits: async () => [], source: async () => null };
const ids = new Set(r.engine.findings.map(f => f.id)); const emps = new Set(d.employees.map(e => e.id));

describe('built-in investigator (no AI service)', () => {
  it('summarizes risks with only real, validated citations', async () => {
    const a = await answerOffline('What are our biggest risks and what should we investigate first?', access, { auditId: 'current' });
    expect(a.intent).toBe('summary'); expect(a.text).toMatch(/compliance grade [A-F] \(\d+\/100\)/); expect(a.citations.length).toBeGreaterThan(0);
    for (const c of a.citations) { if (c.type === 'finding') expect(ids.has(c.id)).toBe(true); if (c.type === 'employee') expect(emps.has(c.id)).toBe(true); }
  });
  it('lists category findings at a location, citing real findings and the governing law', async () => {
    const a = await answerOffline('Show me the meal-period findings at Oxnard', access, { auditId: 'current' });
    expect(a.intent).toBe('findings'); expect(a.text).toMatch(/at Oxnard/);
    const f = a.citations.filter(c => c.type === 'finding'); expect(f.length).toBeGreaterThan(0); f.forEach(c => expect(ids.has(c.id)).toBe(true));
    expect(a.citations.some(c => c.type === 'law' && c.id === 'meal-periods')).toBe(true);
  });
  it('explains a specific finding and refuses an invented one', async () => {
    const real = r.engine.findings.find(f => f.amount > 0)!.id;
    const a = await answerOffline(`Why was ${real} flagged?`, access, { auditId: 'current' }); expect(a.text).toContain(real); expect(a.citations[0].id).toBe(real);
    const b = await answerOffline('Explain FND-999999', access, { auditId: 'current' }); expect(b.text).toMatch(/couldn’t find FND-999999/); expect(b.citations.some(c => c.id === 'FND-999999')).toBe(false);
  });
  it('runs what-if scenarios through the deterministic engine', async () => {
    const a = await answerOffline('What if we exclude workers with arbitration agreements and fix meal periods?', access, { auditId: 'current' });
    expect(a.intent).toBe('scenario'); expect(a.text).toMatch(/arbitration/); expect(a.text).toMatch(/Meal periods treated as remediated/); expect(a.citations.filter(c => c.type === 'scenario').length).toBe(2);
  });
  it('ranks workers and finds patterns', async () => {
    expect((await answerOffline('Which workers create the most exposure?', access, { auditId: 'current' })).intent).toBe('workers');
    expect((await answerOffline('Which supervisors drive the meal patterns?', access, { auditId: 'current' })).intent).toBe('patterns');
  });
  it('answers closed-universe legal questions without any audit, with citations', async () => {
    const a = await answerOffline('When is a second meal period required in California?', noAudit);
    expect(a.intent).toBe('law'); expect(a.text).toMatch(/tenth hour/); expect(a.citations[0]).toMatchObject({ type: 'law', id: 'meal-periods' });
    const b = await answerOffline('What changed in PAGA in 2024?', noAudit); expect(b.citations.some(c => c.id === 'paga-2024')).toBe(true); expect(b.text).toMatch(/\$25/);
    const c = await answerOffline('What is the minimum wage in Los Angeles?', noAudit); expect(c.citations.some(x => x.id === 'local-minimum-wage')).toBe(true);
    const z = await answerOffline('How do I file a patent in Germany?', noAudit); expect(z.text).not.toMatch(/won’t guess|isn’t covered/); expect(z.text.length).toBeGreaterThan(60); expect(z.citations.every(c => c.type === 'law')).toBe(true);
  });
  it('every knowledge-base topic has citations, a verified date, and is findable', () => {
    for (const t of LAW) { expect(t.citations.length).toBeGreaterThan(0); expect(t.verified).toMatch(/^\d{4}-\d{2}-\d{2}$/); expect(searchLaw(t.title, 3).some(h => h.topic.id === t.id)).toBe(true); }
  });
});

describe('law search ranking regressions', () => {
  it('routes common questions to the most specific topic', () => {
    const top = (q: string) => searchLaw(q, 1)[0]?.topic.id;
    expect(top('What is required to cure a PAGA notice?')).toBe('paga-cure');
    expect(top('Do we have to pay out vacation when someone quits?')).toBe('vacation');
    expect(top('How long do we have to respond to a personnel file request?')).toBe('records-requests');
    expect(top('split shift premium')).toBe('split-reporting');
    expect(top('What is the SB 294 notice?')).toBe('know-your-rights-2026');
  });
});

describe('answer library and in-app actions', () => {
  it('answers PAGA notice questions comprehensively and routes to cure tools', async () => {
    const a = await answerOffline('We just received a PAGA notice — what should we do?', noAudit);
    expect(a.text).toMatch(/33 days/); expect(a.text).toMatch(/65 days/); expect(a.text).toMatch(/\$75/); expect(a.text).toMatch(/7% interest/);
    expect(a.actions).toContain('paga_cure'); expect(a.citations.some(c => c.id === 'paga-cure')).toBe(true);
  });
  it('routes settlement questions to the Pick Up Stix packet', async () => {
    const a = await answerOffline('Can we settle individually with employees while the class action is pending?', noAudit);
    expect(a.text).toMatch(/Chindarah/); expect(a.text).toMatch(/206\.5/); expect(a.actions).toContain('settlement_packet');
  });
  it('legal how-to questions win even with an audit loaded; data questions get tool actions', async () => {
    const a = await answerOffline('Can we require employees to sign a release to receive back pay?', access, { auditId: 'current' });
    expect(a.intent).toBe('law'); expect(a.text).toMatch(/206\.5/); expect(a.actions).toContain('backpay');
    const b = await answerOffline('Show me the meal-period findings at Oxnard', access, { auditId: 'current' });
    expect(b.actions).toEqual(expect.arrayContaining(['solutions', 'backpay']));
  });
  it('every answer-library entry cites authorities, links real topics, and offers actions', async () => {
    const { FAQ, ACTIONS } = await import('@/lib/law/faq'); const { lawById } = await import('@/lib/law/kb');
    expect(FAQ.length).toBeGreaterThanOrEqual(30);
    for (const f of FAQ) { expect(f.cites.length).toBeGreaterThan(0); f.topics.forEach(t => expect(lawById(t), t).not.toBeNull()); f.actions.forEach(k => expect(ACTIONS[k], k).toBeTruthy()); }
  });
});

describe('Penny drafting (built-in)', () => {
  it('drafts real policies with citations and routes agreements to generators', async () => {
    const a = await answerOffline('Draft a lactation policy for our employees', noAudit);
    expect(a.intent).toBe('draft'); expect(a.text).toContain('<<<DRAFT'); expect(a.text).toMatch(/1030/);
    const h = await answerOffline('Write our employee handbook policies', noAudit); expect((h.text.match(/^## /gm) || []).length).toBeGreaterThan(15);
    const s = await answerOffline('Draft a severance agreement for a 52-year-old manager', noAudit); expect(s.actions).toContain('separation'); expect(s.text).toMatch(/12964\.5/);
    const g = await answerOffline('Write an email to employees about paid sick leave', noAudit); expect(g.text).toContain('<<<DRAFT');
  });
});

describe('Penny deadline skill (built-in)', () => {
  it('computes exact PAGA and final-pay dates from a plain question', async () => {
    const a = await answerOffline('We got a PAGA notice on January 4, 2026 — when is our cure deadline?', noAudit);
    expect(a.intent).toBe('deadlines'); expect(a.text).toMatch(/February 6, 2026/); expect(a.text).toMatch(/2699\.3/);
    const q = await answerOffline('An employee quit without notice on 10/01/2026. When are final wages due?', noAudit);
    expect(q.text).toMatch(/October 5, 2026/);
  });
});
