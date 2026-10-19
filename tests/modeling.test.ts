import { describe, expect, it } from 'vitest';
import { generateDemo } from '@/lib/demo/generate';
import { runAudit } from '@/lib/engine/audit';
import { analyzePatterns } from '@/lib/engine/detective';
import { DEFAULT_SCENARIO, DEFAULT_SETTLEMENT, PERSPECTIVES, buildDiligence, compareSnapshots, runScenario, snapshot, valueSettlement } from '@/lib/engine/modeling';

const d = generateDemo({ employees: 200, months: 12 });
const a = runAudit(d, { auditDate: d.auditDate });

describe('PAGA Detective', () => {
  const p = analyzePatterns(d, a.engine);
  it('finds the seeded supervisor and Saturday patterns', () => {
    console.log(p.anomalies.map(x => `${x.metric} | ${x.headline} | z=${x.z} | excess=${x.excessEvents} | ${x.drivers.map(y => y.value + ' ' + y.share).join(', ')}`).join('\n'));
    expect(p.anomalies.some(x => x.dimension === 'Supervisor' && x.value === 'R. Delgado' && x.metric === 'meal')).toBe(true);
    expect(p.anomalies.some(x => x.metric === 'rest' && (x.value === 'Saturday' || x.drivers.some(y => y.value === 'Saturday')))).toBe(true);
    expect(p.anomalies.every(x => x.z >= 3 && x.lift >= 1.5)).toBe(true);
  });
});

describe('scenario model', () => {
  const base = runScenario(d, a, DEFAULT_SCENARIO);
  it('arbitration lowers class claims but not PAGA', () => {
    const arb = runScenario(d, a, { ...DEFAULT_SCENARIO, excludeArbitration: true });
    expect(arb.wages).toBeLessThan(base.wages); expect(arb.paga).toBe(base.paga); expect(arb.employeesExcluded).toBeGreaterThan(0);
  });
  it('responds monotonically to validity, lookback, caps, stacking', () => {
    expect(runScenario(d, a, { ...DEFAULT_SCENARIO, validityPct: 50 }).total).toBeLessThan(base.total);
    expect(runScenario(d, a, { ...DEFAULT_SCENARIO, lookbackMonths: 48 }).wages).toBeGreaterThan(base.wages);
    expect(runScenario(d, a, { ...DEFAULT_SCENARIO, pagaCap: 'pre' }).paga).toBeCloseTo(base.paga * 0.15, -2);
    expect(runScenario(d, a, { ...DEFAULT_SCENARIO, pagaMode: 'stacked' }).paga).toBeGreaterThanOrEqual(base.paga);
  });
  it('orders perspectives defense < neutral < plaintiff and values settlement inside the range', () => {
    const def = runScenario(d, a, { ...DEFAULT_SCENARIO, ...PERSPECTIVES.defense }), neu = runScenario(d, a, { ...DEFAULT_SCENARIO, ...PERSPECTIVES.neutral }), pl = runScenario(d, a, { ...DEFAULT_SCENARIO, ...PERSPECTIVES.plaintiff });
    expect(def.total).toBeLessThan(neu.total); expect(neu.total).toBeLessThan(pl.total);
    const v = valueSettlement(neu, pl, DEFAULT_SETTLEMENT, d.employees.length);
    expect(v.opening).toBeLessThan(v.target); expect(v.target).toBeLessThan(v.walkaway); expect(v.demandAnchor).toBe(pl.total);
    const dd = buildDiligence(d, a, def, neu, pl, analyzePatterns(d, a.engine).anomalies, { targetName: 'T', dealValue: 50_000_000, processRemediationCost: 25000, probabilityPct: 60 });
    expect(dd.headline.likelyLow).toBe(def.total); expect(dd.adjustment.low).toBeLessThan(dd.adjustment.high); expect(dd.highRiskLocations.length).toBeGreaterThan(0);
  });
});

describe('monitoring', () => {
  it('detects increases between runs', () => {
    const s1 = snapshot('Prior', d, a, []);
    const worse = JSON.parse(JSON.stringify(s1)); worse.categories.meal.ratePerShift *= 1.4; worse.categories.meal.findings = Math.round(worse.categories.meal.findings * 1.4); worse.score += 8;
    const alerts = compareSnapshots(s1, worse, { categoryIncreasePct: 15 });
    expect(alerts.some(x => /Meal periods up 40%/.test(x.title))).toBe(true);
    expect(compareSnapshots(null, s1)[0].title).toBe('Baseline saved');
  });
});
