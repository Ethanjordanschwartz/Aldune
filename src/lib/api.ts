import 'server-only';
import { NextResponse } from 'next/server';
import { requireUser, supabaseConfigured } from './supabase/server';
import { getSource } from './store';

/** Errors never expose stack traces; they carry an ID that is logged server-side. */
export function fail(status: number, message: string, err?: unknown) {
  const errorId = `ERR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  if (err) console.error(errorId, err instanceof Error ? err.message : err); // never log employee data
  return NextResponse.json({ error: message, errorId }, { status });
}

/** Resolve a source after authorization. Demo is public; real audits require a signed-in member (enforced again by RLS). */
export async function authorizedSource(auditId: string) {
  if (auditId === 'demo') return { source: getSource('demo'), user: null };
  if (!supabaseConfigured()) return { error: fail(503, 'Accounts are not configured on this server yet.') };
  const { user } = await requireUser();
  if (!user) return { error: fail(401, 'Sign in to view this audit.') };
  return { source: getSource(auditId), user };
}

// Simple fixed-window limiter (per instance). Replace with a shared store (e.g., Redis) for multi-instance deployments.
const hits = new Map<string, { n: number; t: number }>();
export function rateLimit(key: string, max = 20, windowMs = 60_000) {
  const now = Date.now(); const h = hits.get(key);
  if (!h || now - h.t > windowMs) { hits.set(key, { n: 1, t: now }); return true; }
  h.n++; return h.n <= max;
}
