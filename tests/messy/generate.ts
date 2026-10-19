// Generates realistic, messy vendor-style timekeeping exports from one ground truth (synthetic people and data).
import * as XLSX from 'xlsx';
import { writeFileSync } from 'node:fs';
const OUT = 'tests/fixtures/messy/';
type Shift = { id: string; first: string; last: string; date: string; in: number; out: number; mo?: number; mi?: number };
const people = [{ id: '00123', first: 'Maria', last: 'Garcia' }, { id: '00456', first: 'John', last: "O'Neil" }, { id: '00789', first: 'Anh', last: 'Le' }, { id: '01011', first: 'DeShawn', last: 'Brooks' }, { id: '01200', first: 'Pat', last: 'Smith-Jones' }];
const days = ['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06', '2026-03-09', '2026-03-10', '2026-03-11', '2026-03-12', '2026-03-13'];
const truth: Shift[] = [];
people.forEach((p, pi) => days.forEach((d, di) => {
  const k = pi * 10 + di; const start = 420 + ((k * 7) % 95); // 7:00–8:34
  if (pi === 3 && di === 4) { truth.push({ ...p, date: d, in: 1320, out: 375, mo: 120, mi: 151 }); return; } // overnight 22:00–06:15, meal 02:00–02:31
  if (k % 6 === 5) { truth.push({ ...p, date: d, in: start, out: start + 330 }); return; } // 5.5 h, no meal
  const mo = start + 240 + (k % 3) * 37, len = 30 + (k % 4 === 0 ? -9 : k % 2); truth.push({ ...p, date: d, in: start, out: start + 510 + (k % 5) * 11, mo, mi: mo + len });
}));
const hm = (m: number) => `${String(Math.floor((m % 1440) / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const ampm = (m: number, style: 'sp' | 'nosp' | 'short' = 'sp') => { const x = m % 1440; const h = Math.floor(x / 60), mm = String(x % 60).padStart(2, '0'); const hh = ((h + 11) % 12) + 1; const ap = h >= 12 ? 'PM' : 'AM'; return style === 'sp' ? `${hh}:${mm} ${ap}` : style === 'nosp' ? `${hh}:${mm}${ap.toLowerCase()}` : `${hh}:${mm}${ap[0].toLowerCase()}`; };
const noap = (m: number) => { const x = m % 1440; const h = Math.floor(x / 60); return `${((h + 11) % 12) + 1}:${String(x % 60).padStart(2, '0')}`; };
const us = (d: string, yy = false) => { const [y, mo, da] = d.split('-'); return `${+mo}/${+da}/${yy ? y.slice(2) : y}`; };
const next = (d: string) => new Date(Date.parse(d + 'T12:00:00Z') + 864e5).toISOString().slice(0, 10);
const outDate = (s: Shift) => (s.out < s.in ? next(s.date) : s.date);
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pretty = (d: string) => { const [y, mo, da] = d.split('-'); return `${MON[+mo - 1]} ${+da}, ${y}`; };
const DOW = (d: string) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(d + 'T12:00:00Z').getUTCDay()];
const csv = (rows: (string | number)[][], sep = ',') => rows.map(r => r.map(c => { const s = String(c); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(sep)).join('\r\n');
const files: Record<string, string> = {};
// 1 Toast-style
files['toast_time_entries.csv'] = csv([['Harbor Grill - Time Entries'], ['Date range: 03/02/2026 - 03/13/2026'], [], ['Employee', 'Job Title', 'In Date', 'Out Date', 'Total Hours', 'Unpaid Break Time', 'Regular Hours', 'Overtime Hours'], ...truth.map(s => [`${s.last}, ${s.first}`, 'Line Cook', `${us(s.date, true)} ${ampm(s.in)}`, `${us(outDate(s), true)} ${ampm(s.out)}`, '', s.mo !== undefined ? String(s.mi! - s.mo) : '0', '', '']), [], ['Total', '', '', '', '', '', '', '']]);
// 2 Square-style
files['square_timecards.csv'] = csv([['Team Member', 'Team Member ID', 'Clock-In Date', 'Clock-In Time', 'Clock-Out Date', 'Clock-Out Time', 'Break Start', 'Break End', 'Total Paid Hours'], ...truth.map(s => [`${s.first} ${s.last}`, s.id.replace(/^0+/, ''), s.date, ampm(s.in, 'nosp'), outDate(s), ampm(s.out, 'nosp'), s.mo !== undefined ? ampm(s.mo, 'nosp') : '', s.mi !== undefined ? ampm(s.mi, 'nosp') : '', ''])]);
// 3 ADP-style segments with fill-down and totals
const adp: (string | number)[][] = [['Timecard Report'], ['Company: Harbor Grill Inc.', '', 'Pay Period: 03/02/2026 - 03/15/2026'], [], ['Payroll Name', 'File #', 'Date', 'In Punch', 'Out Punch', 'Pay Code', 'Hours']];
for (const p of people) { let first = true; for (const s of truth.filter(t => t.id === p.id)) { const segs = s.mo !== undefined ? [[s.in, s.mo], [s.mi!, s.out]] : [[s.in, s.out]]; segs.forEach((g, gi) => { adp.push([first ? `${p.last.toUpperCase()}, ${p.first.toUpperCase()}` : '', first ? p.id : '', gi === 0 ? `${DOW(s.date)} ${us(s.date)}` : '', ampm(g[0]), ampm(g[1]), 'REG', '']); first = false; }); } adp.push([`Totals for ${p.last.toUpperCase()}, ${p.first.toUpperCase()}`, '', '', '', '', '', '80.00']); adp.push([]); }
files['adp_timecard.csv'] = csv(adp);
// 4 Kronos/UKG-style long punch rows, 24-hour
const kr: (string | number)[][] = [['Employee', 'Employee ID', 'Punch Date', 'Punch Time', 'Punch Type']];
for (const s of truth) { const n = `${s.first} ${s.last}`; kr.push([n, s.id, s.date, hm(s.in), 'In']); if (s.mo !== undefined) { kr.push([n, s.id, s.mo < s.in ? next(s.date) : s.date, hm(s.mo), 'Meal Out']); kr.push([n, s.id, s.mi! < s.in ? next(s.date) : s.date, hm(s.mi!), 'Meal In']); } kr.push([n, s.id, outDate(s), hm(s.out), 'Out']); }
files['kronos_punches.csv'] = csv(kr);
// 5 QuickBooks Time-style ISO with offsets
const iso = (d: string, m: number) => `${d}T${hm(m)}:00-08:00`;
files['qbtime_export.csv'] = csv([['fname', 'lname', 'username', 'local_start_time', 'local_end_time', 'hours', 'jobcode'], ...truth.map(s => [s.first, s.last, `${s.first[0]}${s.last}`.toLowerCase().replace(/[^a-z]/g, ''), iso(s.date, s.in), iso(outDate(s), s.out), '', 'Kitchen'])]);
// 6 Paychex-style section headers, no AM/PM, footers
const px: (string | number)[][] = [['Harbor Grill Inc.'], ['Employee Time Detail Report'], ['Report printed 10/06/2026 9:14 AM'], []];
people.forEach((p, i) => { px.push([`Employee: ${p.id} - ${p.first} ${p.last}`]); px.push(['Date', 'Time In', 'Lunch Out', 'Lunch In', 'Time Out', 'Hours']); for (const s of truth.filter(t => t.id === p.id)) px.push([us(s.date), noap(s.in), s.mo !== undefined ? noap(s.mo) : '', s.mi !== undefined ? noap(s.mi) : '', noap(s.out), '']); px.push(['', '', '', '', 'Employee Total:', '80.00']); px.push([]); if (i === 2) { px.push(['Page 1 of 2']); px.push([]); } });
px.push(['Page 2 of 2']);
files['paychex_time_detail.csv'] = csv(px);
// 8 Homebase-style
const hb: (string | number)[][] = [['Name', 'Role', 'Clock in', 'Clock out', 'Breaks', 'Total hours']];
truth.forEach((s, i) => { const row = [`${s.first} ${s.last}`, 'Server', `${pretty(s.date)} ${ampm(s.in)}`, `${pretty(outDate(s))} ${ampm(s.out)}`, s.mo !== undefined ? `${ampm(s.mo)} - ${ampm(s.mi!)}` : '', '']; hb.push(row); if (i === 7) hb.push(row); });
hb.push(['Maria Garcia', 'Server', `${pretty('2026-03-14')} ${ampm(480)}`, '—', '', '']);
files['homebase_timesheets.csv'] = csv(hb);
for (const [n, c] of Object.entries(files)) writeFileSync(OUT + n, '\uFEFF' + c);
// 7 Excel with serial dates and time fractions
const ser = (d: string) => Math.round(Date.parse(d + 'T00:00:00Z') / 864e5) + 25569;
const ws = XLSX.utils.aoa_to_sheet([['Emp No', 'Employee Name', 'Work Date', 'Start', 'Meal Start', 'Meal End', 'Finish'], ...truth.map(s => [Number(s.id), `${s.last}, ${s.first}`, ser(s.date), (s.in % 1440) / 1440, s.mo !== undefined ? (s.mo % 1440) / 1440 : '', s.mi !== undefined ? (s.mi % 1440) / 1440 : '', (s.out % 1440) / 1440])]);
const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Timesheet'); writeFileSync(OUT + 'excel_serials.xlsx', XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
writeFileSync(OUT + 'truth.json', JSON.stringify({ people, truth }, null, 1));
console.log('generated', Object.keys(files).length + 1, 'files;', truth.length, 'true shifts');
