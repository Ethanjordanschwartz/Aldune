'use client';
export function PrintButton() { return <button onClick={() => window.print()} className="inline-flex rounded px-3.5 py-2 text-sm font-semibold bg-ledger text-white">Save as PDF</button>; }
