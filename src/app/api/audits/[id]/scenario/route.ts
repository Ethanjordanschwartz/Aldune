import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authorizedSource, fail } from '@/lib/api';
import { getModel } from '@/lib/store/model';
import { DEFAULT_SCENARIO, DEFAULT_SETTLEMENT, PERSPECTIVES, runScenario, valueSettlement } from '@/lib/engine/modeling';
const Body = z.object({
  scenario: z.object({ excludeArbitration: z.boolean(), arbitrationPct: z.number().min(0).max(100), validityPct: z.number().min(1).max(100), lookbackMonths: z.number().min(1).max(48), rateFactor: z.number().min(0.5).max(1.5), includeDerivative: z.boolean(), includePenalties: z.boolean(), pagaMode: z.enum(['single', 'stacked']), pagaPenalty: z.number().min(0).max(500), pagaCap: z.enum(['none', 'pre', 'post']), pagaWeeklyHalf: z.boolean(), courtReductionPct: z.number().min(0).max(95) }).partial().default({}),
  settlement: z.object({ liabilityPct: z.number().min(0).max(100), certificationPct: z.number().min(0).max(100), pagaSuccessPct: z.number().min(0).max(100), plaintiffFeePct: z.number().min(0).max(50), defenseCostToTrial: z.number().min(0), defenseCostToMediation: z.number().min(0) }).partial().default({})
});
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const a = await authorizedSource(params.id); if ('error' in a) return a.error;
  const parsed = Body.safeParse(await req.json().catch(() => ({}))); if (!parsed.success) return fail(400, 'Invalid assumptions.');
  const m = await getModel(params.id); if (!m) return fail(404, 'Audit data not found.');
  const sc = { ...DEFAULT_SCENARIO, ...parsed.data.scenario };
  const cur = runScenario(m.input, m.result, sc);
  const persp = Object.fromEntries((['defense', 'neutral', 'plaintiff'] as const).map(p => [p, runScenario(m.input, m.result, { ...DEFAULT_SCENARIO, ...PERSPECTIVES[p] })]));
  const members = m.input.employees.filter(e => e.classification === 'nonexempt' && !(sc.excludeArbitration && e.arbitration)).length;
  const settlement = valueSettlement(cur, persp.plaintiff, { ...DEFAULT_SETTLEMENT, ...parsed.data.settlement }, members);
  return NextResponse.json({ scenario: cur, perspectives: Object.fromEntries(Object.entries(persp).map(([k, v]) => [k, { total: v.total, wages: v.wages, penalties: v.penalties, paga: v.paga }])), settlement, hasArbitrationColumn: m.input.employees.some(e => e.arbitration !== undefined) });
}
