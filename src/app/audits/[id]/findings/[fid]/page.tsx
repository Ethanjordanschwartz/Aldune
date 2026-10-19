import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSource } from '@/lib/store';
import { RULES } from '@/lib/engine/rules/registry';
import { CATEGORY_LABELS } from '@/lib/engine/exposure';
import { Badge, CONF_LABEL, Card, Disclaimer, PageHeader, fdate, money } from '@/components/ui';
import { StatusControl } from '@/components/StatusControl';
import { AiPanel } from '@/components/AiPanel';

const label = (k: string) => k.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase());
export default async function FindingPage({ params }: { params: { id: string; fid: string } }) {
  const f = await getSource(params.id).finding(params.fid); if (!f) notFound();
  const rule = RULES[f.ruleId];
  return (
    <>
      <p className="text-sm mb-2 no-print"><Link href={`/audits/${params.id}/findings`}>← Findings</Link></p>
      <PageHeader title={f.title} lede={<>{f.id} · <Link href={`/audits/${params.id}/employees/${encodeURIComponent(f.employeeId)}${f.date ? `#d-${f.date}` : ''}`}>{f.employeeName}</Link> · {f.date ? fdate(f.date) : `Pay period ${fdate(f.periodStart)} – ${fdate(f.periodEnd)}`}</>} />
      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-4">
          <Card title="Audit result">
            <div className="flex flex-wrap gap-2 mb-3"><Badge tone={f.severity}>{f.severity} severity</Badge><Badge tone={f.confidence === 'low' ? 'low' : 'info'}>{CONF_LABEL[f.confidence]}</Badge><Badge>{CATEGORY_LABELS[f.category]}</Badge>{f.premiumIndicated && <Badge tone="ok">Payroll indicates a premium may have been paid</Badge>}</div>
            <p className="leading-relaxed">{f.explanation}</p>
            <p className="mt-3 text-sm"><b>Estimated potential exposure:</b> {money(f.amount, true)} <span className="text-ink-2">({f.amountKind === 'none' ? 'flag only' : f.amountKind})</span></p>
          </Card>
          <Card title="Evidence from your records">
            <table className="tbl"><tbody>{Object.entries(f.evidence).filter(([, v]) => v !== null && v !== '').map(([k, v]) => <tr key={k}><th className="w-1/3">{label(k)}</th><td>{String(v)}</td></tr>)}</tbody></table>
          </Card>
          <Card title="Explain with AI"><AiPanel auditId={params.id} body={{ kind: 'explain', findingId: f.id }} label="Explain this finding" intro="Get a plain-English explanation of what the records show and what to check." /></Card>
        </div>
        <div className="space-y-4">
          <Card title="Review"><StatusControl auditId={params.id} findingId={f.id} status={f.status} /></Card>
          <Card title="Rule applied">
            <p className="text-sm"><b>{rule?.name}</b><br /><span className="text-ink-2">Version {f.ruleVersion}, effective {rule?.effectiveDate}</span></p>
            <p className="text-sm mt-2">{rule?.calculation}</p>
            <ul className="text-xs text-ink-2 mt-3 space-y-1">{f.authorities.map(a => <li key={a}>{a}</li>)}</ul>
          </Card>
        </div>
      </div>
      <Disclaimer />
    </>
  );
}
