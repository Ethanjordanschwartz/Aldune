import { describe, expect, it } from 'vitest';
import { tacticViability, standingCheck, playbook, type Tactic } from '@/lib/litigation/tactics';
describe('pick-off / pick-up-sticks strategy engine', () => {
  it('matrix matches the law; individual pick-off NEVER defeats PAGA', () => {
    expect(tacticViability('voluntary_buyout', 'class').viability).toBe('works');
    expect(tacticViability('involuntary_pickoff', 'class').viability).toBe('does_not_work');
    expect(tacticViability('unaccepted_offer', 'flsa').viability).toBe('leverage_only');
    expect(tacticViability('deposit_judgment', 'class').viability).toBe('open_question');
    expect(tacticViability('race_to_settle', 'paga').viability).toBe('works');
    expect(tacticViability('arbitration_first', 'paga').viability).toBe('leverage_only');
    for (const t of ['voluntary_buyout', 'involuntary_pickoff'] as Tactic[]) { const r = tacticViability(t, 'paga'); expect(r.viability).toBe('does_not_work'); expect(r.authorities.join()).toMatch(/Kim/); }
  });
  it('standing: each-violation test for 2024-reform notices; one-or-more before', () => {
    const s = standingCheck(['meal', 'rest', 'wage_statement'], ['meal'], '2025-02-01'); expect(s.standing).toBe(false); expect(s.challengeable).toEqual(['rest', 'wage_statement']);
    expect(standingCheck(['meal', 'rest'], ['meal'], '2023-05-01').standing).toBe(true);
  });
  it('defense playbook sequences tactics and recomputes residual exposure; plaintiff mode counters', () => {
    const p = playbook({ mode: 'defense', claims: ['class', 'paga'], arbitration: true, overlapping: true, employeesUnder100: false, complaintServed: true, noticeDate: '2025-03-01', alleged: ['meal', 'rest'], suffered: ['meal'], exposure: { class: 500000, paga: 200000, individual: 20000, pagaByViolation: { rest: 80000 } } });
    expect(p.steps.map(s => s.step).join(' ')).toMatch(/arbitration.*standing.*998.*early evaluation.*global PAGA/s);
    expect(p.steps[0].residual).toBe(220000); expect(p.end).toBeLessThan(p.start); expect(p.guardrails![0]).toMatch(/does not defeat/);
    const pl = playbook({ mode: 'plaintiff', claims: ['class', 'paga'], arbitration: true, overlapping: true, employeesUnder100: false, complaintServed: true, exposure: { class: 1, paga: 1, individual: 1 } });
    expect(pl.steps[0].step).toMatch(/Do not voluntarily settle/);
  });
});
