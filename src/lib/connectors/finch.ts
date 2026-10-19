// Finch unified payroll/HRIS API (covers ADP, Paychex, Gusto, UKG, Paylocity, Rippling, and others through one Connect flow).
// Server-only. Field names follow Finch's published Organization and Payroll endpoints; verify against the live sandbox before launch.
import type { ConnectorPull, Row } from './types';
const BASE = 'https://api.tryfinch.com'; const VERSION = '2020-09-17';
const cents = (v?: { amount?: number | null } | null) => (v && typeof v.amount === 'number' ? Math.round(v.amount) / 100 : undefined);

export interface FinchIndividual { id: string; first_name?: string; last_name?: string; preferred_name?: string | null }
export interface FinchEmployment { id: string; title?: string | null; department?: { name?: string | null } | null; location?: { city?: string | null } | null; manager?: { id?: string } | null; employment?: { type?: string; subtype?: string } | null; flsa_status?: 'exempt' | 'non_exempt' | null; is_active?: boolean; start_date?: string | null; end_date?: string | null; income?: { unit?: string; amount?: number } | null; custom_fields?: unknown }
export interface FinchPayment { id: string; pay_date?: string; pay_period?: { start_date?: string; end_date?: string } }
export interface FinchEarning { type?: string | null; name?: string | null; amount?: number | null; hours?: number | null }
export interface FinchPayStatement { individual_id: string; earnings?: FinchEarning[] | null; gross_pay?: { amount?: number } | null; net_pay?: { amount?: number } | null; total_hours?: number | null }

/** Map Finch individuals + employment records to Aldune census rows. */
export function mapCensus(ind: FinchIndividual[], emp: FinchEmployment[]): Row[] {
  const byId = new Map(emp.map(e => [e.id, e]));
  return ind.map(i => { const e = byId.get(i.id); const hourly = e?.income?.unit === 'hourly' && e.income.amount ? e.income.amount / 100 : undefined; const annual = e?.income?.unit === 'yearly' && e.income.amount ? e.income.amount / 100 : undefined;
    const row: Row = { employee_id: i.id, name: `${i.preferred_name || i.first_name || ''} ${i.last_name || ''}`.trim() || i.id, classification: e?.flsa_status === 'exempt' ? 'exempt' : e?.employment?.type === 'contractor' ? 'contractor' : 'nonexempt' };
    if (e?.title) row.job_title = e.title; if (e?.department?.name) row.department = e.department.name; if (e?.location?.city) row.location = e.location.city;
    if (e?.manager?.id) row.supervisor = e.manager.id; if (hourly) row.hourly_rate = hourly; if (annual) row.annual_salary = annual; if (e?.start_date) row.hire_date = e.start_date; if (e?.end_date) row.termination_date = e.end_date;
    return row; });
}
/** Map Finch payments + pay statements to Aldune payroll-register rows (one per worker per pay period). */
export function mapPayroll(payments: FinchPayment[], statements: Map<string, FinchPayStatement[]>): Row[] {
  const out: Row[] = [];
  for (const p of payments) for (const s of statements.get(p.id) || []) {
    const sum = (types: string[], f: 'amount' | 'hours') => (s.earnings || []).filter(e => types.includes(String(e.type))).reduce((t, e) => t + (Number(e[f]) || 0), 0);
    const regHours = sum(['wage', 'salary'], 'hours'), regAmt = sum(['wage', 'salary'], 'amount') / 100, otHours = sum(['overtime'], 'hours'), otAmt = sum(['overtime'], 'amount') / 100, dtHours = sum(['double_overtime'], 'hours'), dtAmt = sum(['double_overtime'], 'amount') / 100;
    const row: Row = { employee_id: s.individual_id, period_start: p.pay_period?.start_date || '', period_end: p.pay_period?.end_date || '', pay_date: p.pay_date || '', reg_hours: regHours, ot_hours: otHours, dt_hours: dtHours, bonus: sum(['bonus'], 'amount') / 100, commission: sum(['commission'], 'amount') / 100 };
    if (regHours) row.reg_rate = Math.round(regAmt / regHours * 100) / 100; if (otHours) row.ot_rate = Math.round(otAmt / otHours * 100) / 100; if (dtHours) row.dt_rate = Math.round(dtAmt / dtHours * 100) / 100;
    const g = cents(s.gross_pay); if (g !== undefined) row.gross = g;
    const prem = (s.earnings || []).filter(e => /meal|rest|break|premium/i.test(String(e.name || ''))); if (prem.length) { row.premium_hours = prem.reduce((t, e) => t + (Number(e.hours) || 1), 0); }
    out.push(row);
  }
  return out;
}
async function finch<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${BASE}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, 'Finch-API-Version': VERSION, 'Content-Type': 'application/json', ...(init?.headers || {}) } });
  if (!r.ok) throw new Error(`Finch ${path} → HTTP ${r.status}`); return r.json() as Promise<T>;
}
/** Create a Finch Connect session for an organization (embedded "connect your payroll" flow). */
export async function createConnectSession(clientId: string, clientSecret: string, customerId: string, customerName: string) {
  const r = await fetch(`${BASE}/connect/sessions`, { method: 'POST', headers: { Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`, 'Finch-API-Version': VERSION, 'Content-Type': 'application/json' }, body: JSON.stringify({ customer_id: customerId, customer_name: customerName, products: ['company', 'directory', 'individual', 'employment', 'payment', 'pay_statement'] }) });
  if (!r.ok) throw new Error(`Finch connect session → HTTP ${r.status}`); return r.json() as Promise<{ session_id: string; connect_url: string }>;
}
export async function exchangeCode(clientId: string, clientSecret: string, code: string) {
  const r = await fetch(`${BASE}/auth/token`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }) });
  if (!r.ok) throw new Error(`Finch token exchange → HTTP ${r.status}`); return r.json() as Promise<{ access_token: string; connection_id?: string }>;
}
/** Pull census and payroll for a date range. Time punches are not part of Finch’s payroll products; use timekeeping exports. */
export async function pullFinch(token: string, from: string, to: string): Promise<ConnectorPull> {
  const dir = await finch<{ individuals: { id: string }[] }>(token, '/employer/directory');
  const ids = dir.individuals.map(i => ({ individual_id: i.id }));
  const ind = await finch<{ responses: { body: FinchIndividual }[] }>(token, '/employer/individual', { method: 'POST', body: JSON.stringify({ requests: ids }) });
  const emp = await finch<{ responses: { body: FinchEmployment }[] }>(token, '/employer/employment', { method: 'POST', body: JSON.stringify({ requests: ids }) });
  const payments = await finch<FinchPayment[]>(token, `/employer/payment?start_date=${from}&end_date=${to}`);
  const ps = await finch<{ responses: { payment_id: string; body: { pay_statements: FinchPayStatement[] } }[] }>(token, '/employer/pay-statement', { method: 'POST', body: JSON.stringify({ requests: payments.map(p => ({ payment_id: p.id })) }) });
  const byPay = new Map(ps.responses.map(r => [r.payment_id, r.body.pay_statements]));
  return { employees: mapCensus(ind.responses.map(r => r.body), emp.responses.map(r => r.body)), payroll: mapPayroll(payments, byPay), time: [], notes: ['Time punches come from your timekeeping system’s exports or a linked folder.'] };
}
