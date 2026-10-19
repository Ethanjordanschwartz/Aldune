import { approx, RISK_COLORS } from './ui';

export function RiskGauge({ score, level }: { score: number; level: string }) {
  const r = 70, c = Math.PI * r, pct = Math.max(0, Math.min(100, score)) / 100;
  return (
    <svg viewBox="0 0 180 104" className="w-[200px] h-auto" role="img" aria-label={`Risk score ${score} of 100, ${level}`}>
      <path d="M20 94 A70 70 0 0 1 160 94" fill="none" stroke="#E7ECE6" strokeWidth="16" strokeLinecap="round" />
      <path d="M20 94 A70 70 0 0 1 160 94" fill="none" stroke={RISK_COLORS[level] || '#172A3A'} strokeWidth="16" strokeLinecap="round" strokeDasharray={`${c * pct} ${c}`} />
      <text x="90" y="80" textAnchor="middle" fontSize="34" fontWeight="800" fill="#172A3A">{score}</text>
      <text x="90" y="99" textAnchor="middle" fontSize="12" fill="#4A5B67">of 100</text>
    </svg>
  );
}

export function HBars({ rows, valueLabel = approx }: { rows: { label: string; sub?: string; value: number; tone?: 'penalty' | 'wage' }[]; valueLabel?: (n: number) => string }) {
  const max = Math.max(1, ...rows.map(r => r.value));
  return (
    <div className="flex flex-col gap-3">
      {rows.map(r => (
        <div key={r.label} className="grid grid-cols-[minmax(140px,220px)_1fr_90px] gap-3 items-center text-sm max-sm:grid-cols-[1fr_80px]">
          <div><div>{r.label}</div>{r.sub && <div className="text-xs text-ink-2">{r.sub}</div>}</div>
          <div className="h-3.5 bg-[#E7ECE6] rounded-sm overflow-hidden max-sm:col-span-2 max-sm:order-3" aria-hidden><div className="h-full" style={{ width: `${Math.max(r.value ? 1.5 : 0, (r.value / max) * 100)}%`, background: r.tone === 'penalty' ? '#9A5B00' : '#1E6B52' }} /></div>
          <div className="text-right font-semibold">{valueLabel(r.value)}</div>
        </div>
      ))}
    </div>
  );
}

export function MonthBars({ data }: { data: { month: string; findings: number; exposure: number }[] }) {
  if (!data.length) return null;
  const max = Math.max(1, ...data.map(d => d.exposure)); const W = 640, H = 140, bw = W / data.length;
  return (
    <svg viewBox={`0 0 ${W} ${H + 22}`} className="w-full h-auto" role="img" aria-label="Estimated exposure by month">
      {data.map((d, i) => { const h = (d.exposure / max) * H; return (
        <g key={d.month}><title>{`${d.month}: ${approx(d.exposure)}, ${d.findings} findings`}</title>
          <rect x={i * bw + 4} y={H - h} width={bw - 8} height={h} rx="2" fill="#1E6B52" />
          <text x={i * bw + bw / 2} y={H + 16} textAnchor="middle" fontSize="11" fill="#4A5B67">{new Date(`${d.month}-01T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })}</text></g>); })}
    </svg>
  );
}
