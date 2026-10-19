import type { ShiftDTO } from '@/lib/store/types';

const fmt = (m: number) => { const x = ((m % 1440) + 1440) % 1440; const h = Math.floor(x / 60); return `${((h + 11) % 12) + 1}:${String(x % 60).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`; };
export const fmtClock = fmt;

/** A shift drawn to scale from clock-in, with markers at the end of the 5th and 10th hours of work. */
export function TimecardStrip({ s, span, flagged }: { s: ShiftDTO; span: number; flagged: boolean }) {
  const W = 1000, x = (m: number) => (m / span) * W;
  const rel = (m: number) => m - s.clockIn;
  const atWork = (target: number) => { let t = target; s.meals.forEach(ml => { if (rel(ml.start) < t) t += ml.minutes; }); return t; };
  const marks = [s.workedMin > 300 ? atWork(300) : null, s.workedMin > 600 ? atWork(600) : null].filter((v): v is number => v !== null);
  return (
    <svg viewBox={`0 0 ${W} 26`} preserveAspectRatio="none" className="w-full h-[26px] block" role="img" aria-label={`Shift ${fmt(s.clockIn)} to ${fmt(s.clockOut)}${flagged ? ', flagged' : ''}`}>
      <rect x="0" y="7" width={x(s.clockOut - s.clockIn)} height="12" rx="2" fill="#8FA6B3" />
      {s.meals.map((m, i) => <rect key={i} x={x(rel(m.start))} y="4" width={Math.max(2, x(m.minutes))} height="18" fill="#F4F6F3" stroke={m.minutes < 30 ? '#B42318' : '#1E6B52'} strokeWidth="2" />)}
      {marks.map((m, i) => <line key={i} x1={x(m)} x2={x(m)} y1="0" y2="26" stroke="#F2CF3D" strokeWidth="4" />)}
      {flagged && <circle cx={x(s.meals[0] ? rel(s.meals[0].start) : marks[0] ?? 0)} cy="13" r="6" fill="#B42318" />}
    </svg>
  );
}
