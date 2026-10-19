import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authorizedSource, fail, rateLimit } from '@/lib/api';
import { aiConfigured, askAudit, complete, PROMPTS } from '@/lib/ai/claude';
const Body = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('explain'), findingId: z.string().max(40) }),
  z.object({ kind: z.literal('summary') }),
  z.object({ kind: z.literal('employee'), employeeId: z.string().max(80) }),
  z.object({ kind: z.literal('ask'), question: z.string().min(2).max(500), history: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(4000) })).max(10).optional() })
]);
export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!aiConfigured()) return fail(503, 'AI explanations aren’t configured. Add ANTHROPIC_API_KEY.');
  const a = await authorizedSource(params.id); if ('error' in a) return a.error;
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'local';
  if (!rateLimit(`ai:${a.user?.id || ip}`, 20)) return fail(429, 'Too many AI requests. Wait a minute and try again.');
  const parsed = Body.safeParse(await req.json().catch(() => null)); if (!parsed.success) return fail(400, 'Invalid request.');
  const b = parsed.data;
  try {
    if (b.kind === 'explain') { const f = await a.source.finding(b.findingId); if (!f) return fail(404, 'Finding not found.'); return NextResponse.json({ text: await complete(PROMPTS.explainFinding(f)) }); }
    if (b.kind === 'summary') return NextResponse.json({ text: await complete(PROMPTS.executiveSummary(await a.source.summary())) });
    if (b.kind === 'employee') { const d = await a.source.employee(b.employeeId); if (!d) return fail(404, 'Employee not found.'); return NextResponse.json({ text: await complete(PROMPTS.employeeSummary(d.employee.name, d.findings.map(f => ({ ...f, employeeName: d.employee.name })))) }); }
    return NextResponse.json({ text: await askAudit(a.source, b.question, b.history) });
  } catch (e) { return fail(502, 'The AI service didn’t respond. Try again.', e); }
}
