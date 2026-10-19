import { NextResponse } from 'next/server';
import { z } from 'zod';
import { fail, rateLimit } from '@/lib/api';
import { supabaseAdmin, supabaseConfigured } from '@/lib/supabase/server';
// End-of-shift attestation. Public endpoint authenticated by a per-employee kiosk/SMS token.
const Body = z.object({ token: z.string().min(8).max(80), workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), mealProvided: z.boolean(), restProvided: z.boolean(), offClockWork: z.boolean(), offClockMinutes: z.number().int().min(0).max(600).default(0), language: z.enum(['en', 'es']).default('en') });
export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'local';
  if (!rateLimit(`attest:${ip}`, 30)) return fail(429, 'Too many submissions. Try again shortly.');
  const parsed = Body.safeParse(await req.json().catch(() => null)); if (!parsed.success) return fail(400, 'Answer every question.');
  const b = parsed.data;
  const premium = (b.mealProvided ? 0 : 1) + (b.restProvided ? 0 : 1);
  if (b.token === 'demo-kiosk') return NextResponse.json({ ok: true, premiumHours: premium, demo: true });
  if (!supabaseConfigured()) return fail(503, 'Attestation isn’t configured on this server.');
  const sb = supabaseAdmin();
  const { data: tok } = await sb.from('attestation_tokens').select('organization_id, employee_ref, revoked').eq('token', b.token).maybeSingle();
  if (!tok || tok.revoked) return fail(403, 'This check-out link is no longer valid. Ask HR for a new one.');
  const { error } = await sb.from('attestations').upsert({ organization_id: tok.organization_id, employee_ref: tok.employee_ref, work_date: b.workDate, meal_provided: b.mealProvided, rest_provided: b.restProvided, off_clock_work: b.offClockWork, off_clock_minutes: b.offClockWork ? b.offClockMinutes : 0, language: b.language, premium_due_hours: premium });
  if (error) return fail(500, 'Your answers weren’t saved. Try again.', error);
  return NextResponse.json({ ok: true, premiumHours: premium });
}
