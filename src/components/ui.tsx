import Link from 'next/link';
import type { ReactNode } from 'react';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
export const money = (n: number, cents = false) => `${n < 0 ? '-' : ''}$${Math.abs(n || 0).toLocaleString('en-US', { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 })}`;
export function approx(n: number) {
  if (n < 1000) return `$${Math.round(n / 10) * 10}`;
  if (n < 100_000) return `$${(Math.round(n / 100) / 10).toFixed(1)}K`;
  if (n < 1_000_000) return `$${Math.round(n / 1000)}K`;
  return `$${(Math.round(n / 10_000) / 100).toFixed(2)}M`;
}
export const fdate = (s?: string) => (s ? new Date(`${s}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '');

export function Card({ children, className, title, action }: { children: ReactNode; className?: string; title?: string; action?: ReactNode }) {
  return (
    <section className={cx('bg-white border border-line rounded-lg', className)}>
      {title && <header className="flex items-center justify-between gap-3 px-5 pt-4"><h2 className="font-bold text-[15px]">{title}</h2>{action}</header>}
      <div className={cx(title ? 'px-5 pb-5 pt-3' : 'p-5')}>{children}</div>
    </section>
  );
}
export function Stat({ value, label, tone }: { value: ReactNode; label: string; tone?: 'risk' | 'muted' }) {
  return <div><div className={cx('text-[28px] leading-tight font-extrabold tracking-tight', tone === 'risk' && 'text-risk-high')}>{value}</div><div className="text-[13px] text-ink-2 mt-1">{label}</div></div>;
}
const TONES: Record<string, string> = {
  high: 'bg-[#FBE4E1] text-[#9F1F14]', medium: 'bg-[#FBEFD5] text-[#8A5300]', low: 'bg-[#E7ECE6] text-ink-2', ok: 'bg-ledger-tint text-ledger', info: 'bg-[#E3ECF5] text-[#1F4B73]'
};
export function Badge({ tone = 'low', children }: { tone?: keyof typeof TONES | string; children: ReactNode }) {
  return <span className={cx('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap', TONES[tone] || TONES.low)}>{children}</span>;
}
export const RISK_COLORS: Record<string, string> = { Low: '#2F7D4F', Moderate: '#B08900', Elevated: '#C2671A', High: '#B42318', Critical: '#7A1410' };
export function Button({ href, children, variant = 'secondary', className, ...rest }: { href?: string; children: ReactNode; variant?: 'primary' | 'secondary' | 'ghost'; className?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const cls = cx('inline-flex items-center justify-center gap-2 rounded px-3.5 py-2 text-sm font-semibold border transition-colors disabled:opacity-50 disabled:cursor-not-allowed no-underline',
    variant === 'primary' && 'bg-ledger text-white border-ledger hover:brightness-110',
    variant === 'secondary' && 'bg-white text-ink border-line hover:border-ink-2',
    variant === 'ghost' && 'bg-transparent border-transparent text-ink-2 hover:text-ink', className);
  return href ? <Link href={href} className={cls}>{children}</Link> : <button className={cls} {...rest}>{children}</button>;
}
export function PageHeader({ title, lede, actions }: { title: string; lede?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div><h1 className="text-[28px] md:text-[32px] font-extrabold tracking-tight leading-tight">{title}</h1>{lede && <p className="text-ink-2 mt-1 max-w-[70ch]">{lede}</p>}</div>
      {actions && <div className="flex gap-2 no-print">{actions}</div>}
    </div>
  );
}
export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="border border-dashed border-line rounded-lg p-10 text-center bg-white"><p className="font-semibold">{title}</p>{children && <div className="text-ink-2 mt-2 text-sm">{children}</div>}</div>;
}
export function Disclaimer() {
  return <p className="text-xs text-ink-2 border-t border-line mt-10 pt-4 max-w-[90ch]">Preliminary compliance-risk findings generated from data you supplied. Not legal advice and not a determination that any violation occurred. Review with qualified California employment counsel.</p>;
}
export const SEVERITY_TONE = { high: 'high', medium: 'medium', low: 'low' } as const;
export const CONF_LABEL = { high: 'High confidence', medium: 'Medium confidence', low: 'Insufficient evidence' } as const;
