import { getSource } from '@/lib/store';
import { PageHeader } from '@/components/ui';
import { DocumentStudio } from '@/components/DocumentStudio';
export default async function Docs({ params, searchParams }: { params: { id: string }; searchParams: { employee?: string } }) {
  const s = await getSource(params.id).summary();
  return <><PageHeader title="Documents" lede="Generate letters, settlement packets, waivers, and policies from this audit’s data. Every template is a draft for counsel to review." /><DocumentStudio auditId={params.id} employerName={s.employerName} initialEmployee={searchParams.employee} /></>;
}
