import { notFound } from 'next/navigation';
import { APP } from '@/config/app';
const DOCS: Record<string, { title: string; body: string[] }> = {
  terms: { title: 'Terms of service', body: ['Placeholder. Have counsel draft terms covering: software-only service and no attorney-client relationship; customer responsibility for data accuracy and legal review; acceptable use; data processing and confidentiality; limitation of liability; subscription and cancellation; governing law.'] },
  privacy: { title: 'Privacy policy', body: [`Placeholder. ${APP.name} processes employee payroll and timekeeping data on behalf of customers. Counsel should address: categories of data processed, CCPA/CPRA service-provider terms, retention and deletion (audits and organizations can be deleted), subprocessors (hosting, database, AI provider), security measures, and contact details.`] }
};
export default function Legal({ params }: { params: { doc: string } }) {
  const d = DOCS[params.doc]; if (!d) notFound();
  return <main className="max-w-[760px] mx-auto px-5 py-16"><h1 className="text-3xl font-extrabold">{d.title}</h1>{d.body.map(p => <p key={p} className="mt-4 leading-relaxed">{p}</p>)}</main>;
}
