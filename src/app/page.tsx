import Link from 'next/link';
import { APP, PLANS } from '@/config/app';

function HeroCard() {
  // A real shift from the demo data, drawn the way the product draws it.
  return (
    <div className="bg-white rounded-xl border border-line shadow-[0_20px_60px_-30px_rgba(23,42,58,.45)] p-5 w-full max-w-[520px]">
      <div className="flex justify-between text-sm"><b>Tue, Jun 17 · Line lead</b><span className="text-ink-2">9h 08m</span></div>
      <svg viewBox="0 0 1000 40" preserveAspectRatio="none" className="w-full h-10 mt-3" role="img" aria-label="Shift with a meal starting after the fifth hour">
        <rect x="0" y="14" width="1000" height="14" rx="3" fill="#8FA6B3" />
        <rect x="580" y="9" width="55" height="24" fill="#F4F6F3" stroke="#1E6B52" strokeWidth="2.5" />
        <line x1="532" x2="532" y1="2" y2="40" stroke="#F2CF3D" strokeWidth="6" />
        <circle cx="580" cy="21" r="8" fill="#B42318" />
      </svg>
      <div className="flex justify-between text-xs text-ink-2 mt-1"><span>8:04 AM</span><span>end of 5th hour</span><span>5:12 PM</span></div>
      <p className="mt-4 text-sm"><span className="text-risk-high font-semibold">Potential late meal period.</span> The meal began 5.6 hours after clock-in. Payroll shows no premium paid for this day.</p>
      <div className="mt-3 flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-[#FBE4E1] text-[#9F1F14] px-2 py-0.5">Lab. Code § 512</span><span className="rounded-full bg-[#E3ECF5] text-[#1F4B73] px-2 py-0.5">High confidence</span><span className="rounded-full bg-[#E7ECE6] px-2 py-0.5">Est. $22.75 premium</span></div>
    </div>
  );
}

export default function Landing() {
  return (
    <div className="bg-paper">
      <header className="max-w-[1180px] mx-auto px-5 py-5 flex items-center justify-between">
        <Link href="/" className="no-underline text-ink font-extrabold text-xl tracking-tight">{APP.name}</Link>
        <nav className="flex items-center gap-5 text-sm"><a href="#how" className="text-ink no-underline">How it works</a><a href="#pricing" className="text-ink no-underline">Pricing</a><Link href="/login" className="text-ink no-underline">Sign in</Link><Link href="/audits/demo" className="rounded bg-ink text-white px-3.5 py-2 font-semibold no-underline">Explore demo</Link></nav>
      </header>
      <section className="max-w-[1180px] mx-auto px-5 pt-10 pb-20 grid gap-12 lg:grid-cols-[1.05fr_1fr] items-center">
        <div>
          <h1 className="text-[40px] md:text-[56px] leading-[1.04] font-extrabold tracking-tight max-w-[14ch]">Find labor compliance risk before it becomes a claim.</h1>
          <p className="text-lg text-ink-2 mt-5 max-w-[52ch]">Upload payroll and timekeeping data. {APP.name} tests every shift and pay period against California wage-and-hour rules, estimates potential exposure, and shows the records behind each finding.</p>
          <div className="flex flex-wrap gap-3 mt-8"><Link href="/signup" className="rounded bg-ledger text-white px-5 py-3 font-semibold no-underline">Start an audit</Link><Link href="/audits/demo" className="rounded border border-line bg-white text-ink px-5 py-3 font-semibold no-underline">See a sample audit</Link></div>
          <p className="text-sm text-ink-2 mt-6">Built by California employment litigators. Deterministic rules, versioned and cited. AI explains; it never calculates.</p>
        </div>
        <HeroCard />
      </section>
      <section className="bg-white border-y border-line">
        <div className="max-w-[1180px] mx-auto px-5 py-16 grid gap-10 md:grid-cols-3">
          {[['Detect', 'Meal and rest periods, overtime and regular-rate errors, minimum wage, wage statements, final pay, pay timing, expense reimbursement, and misclassification.'], ['Quantify', 'Exposure ranges by confidence, lookback by limitations period, PAGA penalties under the 2024 reforms, and a transparent risk score.'], ['Fix', 'Unconditional back-pay letters, settlement packets for pending class actions, compliant waivers, shift attestation, and a reasonable-steps record.']].map(([h, b]) => <div key={h}><h2 className="text-xl font-bold">{h}</h2><p className="text-ink-2 mt-2 leading-relaxed">{b}</p></div>)}
        </div>
      </section>
      <section id="how" className="max-w-[1180px] mx-auto px-5 py-20">
        <h2 className="text-3xl font-extrabold tracking-tight">How it works</h2>
        <ol className="grid gap-6 md:grid-cols-4 mt-8">
          {[['Upload', 'Export employees, time punches, and payroll from your systems as CSV or Excel.'], ['Map and validate', 'Columns are matched automatically with confidence scores. Data-quality problems are shown, never hidden.'], ['Review', 'Drill from risk score to category, worker, shift, and the punches behind each finding.'], ['Act', 'Pay what’s owed, document corrective steps, and export a report for counsel.']].map(([h, b], i) => <li key={h} className="border-t-4 border-ink pt-4"><span className="text-sm text-ink-2">Step {i + 1}</span><h3 className="font-bold text-lg mt-1">{h}</h3><p className="text-ink-2 mt-1 text-[15px]">{b}</p></li>)}
        </ol>
      </section>
      <section id="pricing" className="bg-white border-y border-line">
        <div className="max-w-[1180px] mx-auto px-5 py-20">
          <h2 className="text-3xl font-extrabold tracking-tight">Pricing</h2>
          <div className="grid gap-5 md:grid-cols-4 mt-8">
            {Object.entries(PLANS).filter(([k]) => k !== 'trial').map(([, p]) => <div key={p.name} className="border border-line rounded-lg p-6 flex flex-col"><h3 className="font-bold text-lg">{p.name}</h3><p className="text-3xl font-extrabold mt-2">{p.monthly ? `$${p.monthly}` : 'Custom'}<span className="text-base font-normal text-ink-2">{p.monthly ? '/month' : ''}</span></p><ul className="mt-4 space-y-2 text-sm text-ink-2 flex-1">{p.marketing.map(f => <li key={f}>{f}</li>)}</ul><Link href="/signup" className="mt-6 rounded border border-line text-center py-2 font-semibold text-ink no-underline">{p.monthly ? 'Start free trial' : 'Contact us'}</Link></div>)}
          </div>
        </div>
      </section>
      <footer className="max-w-[1180px] mx-auto px-5 py-10 text-sm text-ink-2">
        <p className="max-w-[90ch]">{APP.name} is software that performs preliminary analysis of data you supply. It does not provide legal advice, and results should be reviewed by qualified California employment counsel. Requirements change; results depend on the data provided.</p>
        <p className="mt-4"><Link href="/legal/terms">Terms</Link> · <Link href="/legal/privacy">Privacy</Link></p>
      </footer>
    </div>
  );
}
