import { describe, expect, it } from 'vitest';
import { LAW, searchLaw, lawById } from '@/lib/law/kb';
import { FAQ, ACTIONS, matchFaq } from '@/lib/law/faq';
const CATS = new Set(['Agreements and settlements', 'Breaks', 'Classification', 'Hours and pay', 'Industries', 'Minimum wage', 'PAGA and enforcement', 'Pay records and notices', 'Policies and leave', 'Recent changes', 'Separation']);
describe('law library integrity', () => {
  it('every topic is complete, uniquely identified, categorized, cited, and dated', () => {
    const ids = new Set<string>();
    for (const t of LAW) {
      expect(ids.has(t.id), `duplicate ${t.id}`).toBe(false); ids.add(t.id);
      expect(t.title.length, t.id).toBeGreaterThan(4); expect(t.summary.length, t.id).toBeGreaterThan(80);
      expect(t.citations.length, t.id).toBeGreaterThan(0); expect(t.keywords.length, t.id).toBeGreaterThan(2);
      expect(CATS.has(t.category || ''), `${t.id} category ${t.category}`).toBe(true);
      expect(t.verified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      for (const c of t.citations) expect(c, t.id).toMatch(/§|Cal\.|U\.S\.|Code|Order|AB |SB |Prop|Rules|Regs|ordinance|F\.\d| v\. |Cir\.|Labor Commissioner|Office of Wage Standards/i);
      expect(`${t.summary} ${t.points.join(' ')}`, t.id).not.toMatch(/TODO|TBD|lorem|\?\?/i);
    }
    expect(LAW.length).toBeGreaterThanOrEqual(80);
  });
  it('every FAQ answer cites authority, links to real topics, and uses real actions', () => {
    for (const f of FAQ) { expect(f.cites.length, f.id).toBeGreaterThan(0); for (const t of f.topics) expect(lawById(t), `${f.id} → ${t}`).toBeTruthy(); for (const a of f.actions) expect(ACTIONS[a], `${f.id} → ${a}`).toBeTruthy(); }
  });
  it('new topics are reachable by plain questions', () => {
    const q: [string, string][] = [['Do cashiers have to be given a seat?', 'seating'], ['How many hours can a 16 year old work on a school day?', 'minors'], ['Do we have to give notice before a layoff of 60 people?', 'cal-warn'], ['Can we ask about criminal history on the application?', 'background-checks'], ['How does a 4/10 alternative workweek election work?', 'alternative-workweek'], ['Is our software engineer exempt from overtime?', 'computer-professionals'], ['When do we have to file the pay data report?', 'pay-data-reporting'], ['Can we make employees repay training costs if they quit?', 'stay-or-pay']];
    for (const [question, id] of q) expect(searchLaw(question, 3).map(h => h.topic.id), question).toContain(id);
  });
  it('rounding status is dated and the H-2A rule is cited to § 1208', () => {
    expect(lawById('rounding')!.status).toMatch(/2026/); expect(JSON.stringify(lawById('new-laws-2027'))).toMatch(/1208/);
    expect(matchFaq('what changes for employers in 2027', 1)[0].faq.id).toBe('changes-2027');
  });
});
