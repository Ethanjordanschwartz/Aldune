import Link from 'next/link';
import { AuthForm } from '@/components/AuthForm';
import { APP } from '@/config/app';
import { supabaseConfigured } from '@/lib/supabase/server';
export default function Page() {
  return <main className="min-h-screen grid place-items-center px-5"><div className="w-full max-w-md bg-white border border-line rounded-lg p-8"><Link href="/" className="no-underline text-ink font-extrabold text-xl">{APP.name}</Link><h1 className="text-2xl font-extrabold mt-6 mb-5">Create your account</h1><AuthForm mode="signup" configured={supabaseConfigured()} /></div></main>;
}
