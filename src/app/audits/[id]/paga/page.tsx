import { getSource } from '@/lib/store';
import { Card, Disclaimer, PageHeader, Stat, approx } from '@/components/ui';
import { HBars } from '@/components/charts';

export default async function Paga({ params }: { params: { id: string } }) {
  const s = await getSource(params.id).summary(); const p = s.paga; const a = s.meta.assumptions;
  return (
    <>
      <PageHeader title="PAGA penalty exposure" lede="Civil penalties under Labor Code § 2699 as amended by AB 2288 and SB 92 (notices filed on or after June 19, 2024). One-year period, counted per aggrieved employee per pay period." />
      <div className="grid gap-4 md:grid-cols-4">
        <Card><Stat value={p.aggrievedEmployees.toLocaleString()} label="Potential aggrieved employees" /></Card>
        <Card><Stat value={p.employeePayPeriods.toLocaleString()} label="Employee pay periods with findings" /></Card>
        <Card><Stat tone="risk" value={`${approx(p.cappedLow)}–${approx(p.cappedHigh)}`} label={`Annual range${p.capPct < 1 ? ` after ${Math.round(p.capPct * 100)}% cap` : ''}`} /></Card>
        <Card><Stat value={approx(p.cappedHigh * p.employeeShare)} label="Employees’ 35% share at the high end" /></Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2 mt-4">
        <Card title="How the range is built">
          <p className="text-sm leading-relaxed">The low end counts one ${a.pagaPenalty} penalty per employee per pay period with any finding{a.pagaWeeklyHalf ? ' (halved for weekly pay periods)' : ''}. The high end counts each violation category separately, the way plaintiffs typically plead. Findings marked insufficient evidence, or where payroll indicates a premium may have been paid, are excluded.</p>
          <div className="mt-4"><HBars rows={p.byCategory.map(c => ({ label: c.label, value: c.amount }))} /></div>
        </Card>
        <Card title="What the 2024 reforms mean for this employer">
          <ul className="text-sm space-y-3 leading-relaxed">
            <li><b>Reasonable-steps caps.</b> Penalties can be capped at 15% if the employer took all reasonable steps to comply before receiving a notice or records request, or 30% if it takes them within 60 days after. Reasonable steps can include periodic payroll audits and acting on the results, lawful written policies, supervisor training, and corrective action with supervisors. This audit, the attestation program, and the audit record document help build that showing.</li>
            <li><b>Cure.</b> Employers with fewer than 100 employees can propose a cure to the LWDA within 33 days of a notice; larger employers can request an early evaluation conference. Curing wage violations generally means paying wages owed plus 7% interest, liquidated damages where applicable, and reasonable fees.</li>
            <li><b>Standing.</b> The plaintiff must have personally suffered each violation alleged within the one-year period.</li>
            <li><b>Enhanced penalties.</b> $200 per pay period can apply where the policy was found unlawful within the prior five years or the conduct was malicious, fraudulent, or oppressive.</li>
          </ul>
          <p className="text-xs text-ink-2 mt-4">Adjust the penalty amount, weekly-pay reduction, and cap in the audit assumptions. Confirm current requirements against Labor Code §§ 2699 and 2699.3.</p>
        </Card>
      </div>
      <Disclaimer />
    </>
  );
}
