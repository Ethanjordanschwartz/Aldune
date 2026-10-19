import { PageHeader, Disclaimer } from '@/components/ui';
import { AskChat } from '@/components/AskChat';
export default function Ask({ params }: { params: { id: string } }) {
  return <><PageHeader title="Ask the audit" lede="Ask questions in plain English. Claude answers by querying this audit’s findings, workers, and totals — it doesn’t guess." /><AskChat auditId={params.id} /><Disclaimer /></>;
}
