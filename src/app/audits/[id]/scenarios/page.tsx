import { PageHeader, Disclaimer } from '@/components/ui';
import { ScenarioStudio } from '@/components/ScenarioStudio';
export default function Scenarios({ params }: { params: { id: string } }) {
  return <><PageHeader title="Scenarios and settlement" lede="A live litigation model of this workforce. Change an assumption and exposure, PAGA, and settlement value recalculate from the underlying findings." /><ScenarioStudio auditId={params.id} /><Disclaimer /></>;
}
