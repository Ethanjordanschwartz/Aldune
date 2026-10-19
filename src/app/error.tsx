'use client';
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="min-h-screen grid place-items-center p-6 text-center"><div><h1 className="text-2xl font-extrabold">Something went wrong</h1><p className="text-ink-2 mt-2">Error ID: {error.digest || 'unknown'}. Try again; if it keeps happening, contact support with this ID.</p><button onClick={reset} className="mt-4 rounded bg-ledger text-white px-4 py-2 font-semibold">Try again</button></div></main>;
}
