// Direct ADP Workforce Now connector (employer’s own ADP API Central project). Server-only: ADP requires OAuth 2.0 client
// credentials AND a mutual-TLS client certificate on every call, including the token request.
// Env: ADP_CLIENT_ID, ADP_CLIENT_SECRET, ADP_CERT_PEM, ADP_KEY_PEM (PEM text). Verify field paths against your API Central entitlements.
import type { ConnectorPull, Row } from './types';

export interface AdpWorker { associateOID: string; workerID?: { idValue?: string }; person?: { legalName?: { givenName?: string; familyName1?: string; formattedName?: string } }; workerDates?: { originalHireDate?: string; terminationDate?: string };
  workAssignments?: { primaryIndicator?: boolean; jobTitle?: string; homeOrganizationalUnits?: { typeCode?: { codeValue?: string }; nameCode?: { shortName?: string } }[]; homeWorkLocation?: { address?: { cityName?: string } }; reportsTo?: { positionID?: string; reportsToWorkerName?: { formattedName?: string } }[]; baseRemuneration?: { hourlyRateAmount?: { amountValue?: number }; annualRateAmount?: { amountValue?: number } }; payCycleCode?: { codeValue?: string; shortName?: string }; wageLawCoverage?: { coverageCode?: { codeValue?: string; shortName?: string } }; workerTypeCode?: { codeValue?: string } }[] }
/** Map ADP Workers API (hr/v2/workers) records to Aldune census rows. */
export function mapAdpWorkers(workers: AdpWorker[]): Row[] {
  return workers.map(w => { const a = (w.workAssignments || []).find(x => x.primaryIndicator) || (w.workAssignments || [])[0] || {};
    const n = w.person?.legalName; const flsa = String(a.wageLawCoverage?.coverageCode?.codeValue || a.wageLawCoverage?.coverageCode?.shortName || '').toLowerCase();
    const row: Row = { employee_id: w.workerID?.idValue || w.associateOID, name: n?.formattedName || `${n?.givenName || ''} ${n?.familyName1 || ''}`.trim() || w.associateOID, classification: /^e|exempt/.test(flsa) && !/non/.test(flsa) ? 'exempt' : 'nonexempt' };
    if (a.jobTitle) row.job_title = a.jobTitle; const dept = (a.homeOrganizationalUnits || []).find(u => /department/i.test(u.typeCode?.codeValue || '')); if (dept?.nameCode?.shortName) row.department = dept.nameCode.shortName;
    if (a.homeWorkLocation?.address?.cityName) row.location = a.homeWorkLocation.address.cityName; const sup = a.reportsTo?.[0]?.reportsToWorkerName?.formattedName; if (sup) row.supervisor = sup;
    const hr = a.baseRemuneration?.hourlyRateAmount?.amountValue, yr = a.baseRemuneration?.annualRateAmount?.amountValue; if (hr) row.hourly_rate = hr; if (yr) row.annual_salary = yr;
    const pc = String(a.payCycleCode?.shortName || a.payCycleCode?.codeValue || '').toLowerCase(); if (pc) row.pay_frequency = /bi.?week|^2$/.test(pc) ? 'biweekly' : /semi|^3$/.test(pc) ? 'semimonthly' : /week|^1$/.test(pc) ? 'weekly' : /month/.test(pc) ? 'monthly' : pc;
    if (w.workerDates?.originalHireDate) row.hire_date = w.workerDates.originalHireDate; if (w.workerDates?.terminationDate) row.termination_date = w.workerDates.terminationDate;
    return row; });
}
async function adpAgent() {
  const { Agent } = await import('undici');
  return new Agent({ connect: { cert: process.env.ADP_CERT_PEM, key: process.env.ADP_KEY_PEM } });
}
export async function pullAdp(): Promise<ConnectorPull> {
  if (!process.env.ADP_CLIENT_ID || !process.env.ADP_CERT_PEM) throw new Error('ADP connector is not configured (client credentials and mutual-TLS certificate required).');
  const dispatcher = await adpAgent();
  const tok = await fetch('https://accounts.adp.com/auth/oauth/v2/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'client_credentials', client_id: process.env.ADP_CLIENT_ID!, client_secret: process.env.ADP_CLIENT_SECRET! }), dispatcher } as RequestInit & { dispatcher: unknown });
  if (!tok.ok) throw new Error(`ADP token → HTTP ${tok.status}`); const { access_token } = await tok.json() as { access_token: string };
  const workers: AdpWorker[] = []; for (let skip = 0; ; skip += 100) { const r = await fetch(`https://api.adp.com/hr/v2/workers?$top=100&$skip=${skip}`, { headers: { Authorization: `Bearer ${access_token}` }, dispatcher } as RequestInit & { dispatcher: unknown }); if (r.status === 204) break; if (!r.ok) throw new Error(`ADP workers → HTTP ${r.status}`); const j = await r.json() as { workers?: AdpWorker[] }; if (!j.workers?.length) break; workers.push(...j.workers); if (j.workers.length < 100) break; }
  return { employees: mapAdpWorkers(workers), time: [], payroll: [], notes: ['Census pulled from ADP Workers API. Payroll output and time cards require the corresponding API Central entitlements; until enabled, use a linked folder of ADP reports.'] };
}
