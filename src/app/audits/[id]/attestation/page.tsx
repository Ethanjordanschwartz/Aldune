import Link from 'next/link';
import { getSource } from '@/lib/store';
import { Card, Disclaimer, PageHeader, Stat } from '@/components/ui';

export default async function Attestation({ params }: { params: { id: string } }) {
  const s = await getSource(params.id).summary();
  const restGap = s.quality.checks.find(c => /rest-break/i.test(c.label));
  return (
    <>
      <PageHeader title="Shift attestation" lede="Rest breaks usually aren’t recorded, so most employers can’t prove they were provided. At clock-out, workers answer three questions in English or Spanish. Every “no” becomes a premium on the next payroll and a dated record for your reasonable-steps showing." />
      <div className="grid gap-4 md:grid-cols-3">
        <Card><Stat value={s.counts.attestedShifts.toLocaleString()} label="Shifts with an attestation in this audit" /></Card>
        <Card><Stat value={`${s.counts.shifts ? Math.round((s.counts.attestedShifts / s.counts.shifts) * 100) : 0}%`} label="Attestation coverage" /></Card>
        <Card><Stat value={restGap?.count?.toLocaleString() ?? '—'} label="Shifts with no rest-break evidence" /></Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2 mt-4">
        <Card title="How it works">
          <ol className="list-decimal pl-5 space-y-2 text-sm leading-relaxed">
            <li>Each worker gets a personal check-out link (QR code at the timeclock, text message, or shared kiosk).</li>
            <li>At clock-out they answer: Did you get your full meal break on time? Every rest break, off duty? Any work not on your time record?</li>
            <li>Answers feed the audit engine. A “no” on meal or rest creates a premium of one hour at the regular rate of compensation, paid on the next payroll; reported off-the-clock minutes are queued for review and payment.</li>
            <li>Supervisors can’t see or change individual answers. The policy forbids retaliation, and the record shows premiums were actually paid — which is what makes attestations credible in litigation.</li>
          </ol>
          <div className="mt-4 flex gap-2"><Link href="/attest/demo-kiosk" className="inline-flex rounded px-3.5 py-2 text-sm font-semibold bg-ledger text-white no-underline">Open the worker check-out screen</Link><Link href={`/audits/${params.id}/documents`} className="inline-flex rounded px-3.5 py-2 text-sm font-semibold border border-line bg-white no-underline text-ink">Generate the policy</Link></div>
        </Card>
        <Card title="Why it holds up">
          <ul className="text-sm space-y-3 leading-relaxed">
            <li><b>It closes the rest-break evidence gap.</b> Without records, rest claims come down to testimony. Daily attestations give you dated, worker-made records.</li>
            <li><b>It turns violations into cures.</b> Premiums paid promptly for reported misses reduce wage exposure and the derivative wage-statement and waiting-time claims that follow them.</li>
            <li><b>It supports the PAGA caps.</b> A working process that detects and pays for missed breaks is strong evidence of reasonable steps.</li>
            <li><b>It must be honest to work.</b> Courts discount attestation systems that pressure workers or never pay premiums. Keep answers voluntary, pay every “no,” and audit for supervisor interference.</li>
          </ul>
        </Card>
      </div>
      <Disclaimer />
    </>
  );
}
