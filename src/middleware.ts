import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Refreshes the Supabase session cookie and guards signed-in areas. Authorization is enforced again server-side and by RLS.
export async function middleware(req: NextRequest) {
  const res = NextResponse.next({ request: req });
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return res;
  const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: { getAll: () => req.cookies.getAll(), setAll: (list: { name: string; value: string; options?: Record<string, unknown> }[]) => list.forEach(({ name, value, options }) => res.cookies.set(name, value, options)) }
  });
  const { data } = await sb.auth.getUser();
  const p = req.nextUrl.pathname;
  const isPrivateAudit = p.startsWith('/audits/') && !p.startsWith('/audits/demo');
  if (!data.user && (['/dashboard', '/documents', '/monitoring', '/settings'].some(x => p.startsWith(x)) || isPrivateAudit)) return NextResponse.redirect(new URL('/login', req.url));
  return res;
}
export const config = { matcher: ['/dashboard/:path*', '/audits/:path*', '/documents/:path*', '/monitoring/:path*', '/settings/:path*'] };
