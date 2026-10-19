// Wave 3 messy fixtures (synthetic): year-less dates, two-row headers, one sheet per employee, messy census.
import * as XLSX from 'xlsx';
import { readFileSync, writeFileSync } from 'node:fs';
const OUT = 'tests/fixtures/messy/';
const { people, truth } = JSON.parse(readFileSync(OUT + 'truth.json', 'utf8'));
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ampm = (m: number) => { const x = m % 1440; const h = Math.floor(x / 60); return `${((h + 11) % 12) + 1}:${String(x % 60).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`; };
const DOW = (d: string) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(d + 'T12:00:00Z').getUTCDay()];
const noYear = (d: string) => { const [, mo, da] = d.split('-'); return `${DOW(d)}, ${MON[+mo - 1]} ${+da}`; };
const csv = (rows: (string | number)[][]) => rows.map(r => r.map(c => { const s = String(c); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(',')).join('\r\n');
// 1 When I Work-style: year-less dates; year comes from the pay-period line
writeFileSync(OUT + 'wheniwork_timesheets.csv', csv([['Timesheets — Pay period Mar 1, 2026 to Mar 14, 2026'], [], ['Employee', 'Date', 'Start', 'End', 'Break Start', 'Break End', 'Hours'], ...truth.map((s: any) => [`${s.first} ${s.last}`, noYear(s.date), ampm(s.in), ampm(s.out), s.mo !== undefined ? ampm(s.mo) : '', s.mi !== undefined ? ampm(s.mi) : '', ''])]));
// 2 Two-row header: group labels above generic sub-labels
writeFileSync(OUT + 'two_row_header.csv', csv([['Employee', '', 'Shift', 'Clock', '', 'Meal', ''], ['Name', 'ID', 'Date', 'In', 'Out', 'Start', 'End'], ...truth.map((s: any) => [`${s.first} ${s.last}`, s.id, s.date, ampm(s.in), ampm(s.out), s.mo !== undefined ? ampm(s.mo) : '', s.mi !== undefined ? ampm(s.mi) : ''])]));
// 3 One sheet per employee; the name exists only in the sheet tab
const wb = XLSX.utils.book_new();
for (const p of people) { const rows = truth.filter((t: any) => t.id === p.id).map((s: any) => [s.date, ampm(s.in), s.mo !== undefined ? ampm(s.mo) : '', s.mi !== undefined ? ampm(s.mi) : '', ampm(s.out)]); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Date', 'In', 'Lunch Out', 'Lunch In', 'Out'], ...rows]), `${p.first} ${p.last}`.slice(0, 31)); }
writeFileSync(OUT + 'sheet_per_employee.xlsx', XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
// 4 Messy census
writeFileSync(OUT + 'census_messy.csv', csv([['ACTIVE & TERMED EMPLOYEES'], ['Emp #', 'Employee', 'Position', 'Pay Rate', 'Hire Date', 'Status'], ['00123', 'Garcia, Maria', 'Line Cook', '$18.50/hr', 'Jan 5 2024', 'Active'], ['00456', "O'Neil, John", 'Server', '$17.40/hr', '3/14/2023', 'Term - 3/13/26'], ['00789', 'Le, Anh', 'Prep Cook', '19', '2022-08-01', 'Terminated 03/12/2026 (Quit)'], ['01011', 'Brooks, DeShawn', 'Dishwasher', '$18.00 per hour', '11/1/2025', 'Active - FT'], ['01200', 'Smith-Jones, Pat', 'Host', '$17.40', '01/15/2026', 'LOA']]));
console.log('wave 3 fixtures written');
