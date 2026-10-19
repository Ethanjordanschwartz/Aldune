# Generates realistic bulk test documents: pay stubs (two layouts), weekly timesheets, and W-2s as text PDFs.
import os, random, datetime, zipfile, sys
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
random.seed(42)
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), 'bulk')
os.makedirs(OUT, exist_ok=True)
EMPS = [(f"E{1000+i}", n, round(random.choice([16.90, 17.50, 18.25, 19.00, 21.00]), 2)) for i, n in enumerate(
  ["Maria Lopez", "Jose Hernandez", "Ana Ruiz", "Luis Garcia", "Carmen Diaz", "Pedro Ramirez", "Rosa Flores", "Miguel Torres", "Elena Castro", "Juan Morales",
   "Sofia Vargas", "Diego Reyes", "Lucia Mendoza", "Carlos Ortiz", "Isabel Navarro", "Andres Silva", "Teresa Rojas", "Jorge Medina", "Patricia Soto", "Ramon Cruz"])]
EMPLOYER = ("Valley Fresh Packing, Inc.", "1200 Harvest Road, Salinas, CA 93901")
def page(path, lines, size=10):
    c = canvas.Canvas(path, pagesize=letter); y = 750
    for l in lines:
        c.setFont("Helvetica", size); c.drawString(50, y, l); y -= 15
        if y < 60: c.showPage(); y = 750
    c.save()
start = datetime.date(2026, 1, 4)  # Sunday
files = 0
for pi in range(8):  # 8 biweekly periods
    ps = start + datetime.timedelta(days=14 * pi); pe = ps + datetime.timedelta(days=13); pd = pe + datetime.timedelta(days=5)
    for idx, (eid, name, rate) in enumerate(EMPS):
        days = []
        for d in range(14):
            day = ps + datetime.timedelta(days=d)
            if day.weekday() >= 5: continue
            long = random.random() < 0.25; late = random.random() < 0.3
            cin = datetime.datetime.combine(day, datetime.time(6, 30)); mo = cin + datetime.timedelta(hours=5, minutes=30 if late else 0) if late else cin + datetime.timedelta(hours=4, minutes=30)
            mi = mo + datetime.timedelta(minutes=30); cout = cin + datetime.timedelta(hours=10.5 if long else 8.5)
            days.append((day, cin, mo, mi, cout))
        reg = sum(min(8, (c[4]-c[1]).seconds/3600 - 0.5) for c in days); ot = sum(max(0, (c[4]-c[1]).seconds/3600 - 0.5 - 8) for c in days)
        gross = round(reg * rate + ot * rate * 1.5, 2); net = round(gross * 0.82, 2)
        f = lambda dt: dt.strftime('%I:%M %p').lstrip('0')
        ds = lambda d: d.strftime('%m/%d/%Y')
        if idx % 2 == 0:  # generic earnings statement (has everything except sick leave on some)
            lines = [EMPLOYER[0].upper(), EMPLOYER[1], "EARNINGS STATEMENT", f"Employee: {name}    Employee ID: {eid}    SSN: XXX-XX-{random.randint(1000,9999)}",
                     f"Pay Period: {ds(ps)} - {ds(pe)}    Pay Date: {ds(pd)}", "Earnings        Rate      Hours     Amount",
                     f"Regular         {rate:.2f}     {reg:.2f}     {reg*rate:,.2f}", f"Overtime        {rate*1.5:.2f}     {ot:.2f}     {ot*rate*1.5:,.2f}",
                     f"Gross Pay       {gross:,.2f}", f"Federal Income Tax  {gross*0.08:,.2f}", f"Social Security  {gross*0.062:,.2f}", f"Medicare  {gross*0.0145:,.2f}", f"CA SDI  {gross*0.012:,.2f}",
                     f"Net Pay         {net:,.2f}"] + ([f"Sick Leave Available: {random.randint(8,40)}.00 hours"] if idx % 4 == 0 else [])
        else:  # ADP-like layout: hours before rate; period beginning/ending; no employer address (missing § 226 item)
            lines = ["Statement of Earnings and Deductions", f"Company: {EMPLOYER[0]}", f"File Number: {eid}", f"Name: {name}",
                     f"Period Beginning: {ds(ps)}", f"Period Ending: {ds(pe)}", f"Pay Date: {ds(pd)}", "Earnings   hours   rate   this period",
                     f"Regular    {reg:.2f}   {rate:.4f}   {reg*rate:,.2f}", f"Overtime   {ot:.2f}   {rate*1.5:.4f}   {ot*rate*1.5:,.2f}",
                     f"Gross Pay  ${gross:,.2f}", "Deductions  Statutory", f"Federal Income Tax  -{gross*0.08:,.2f}", f"Net Pay  ${net:,.2f}"]
        page(os.path.join(OUT, f"paystub_{eid}_{ps.isoformat()}.pdf"), lines); files += 1
        if pi < 4:  # timesheets for first 4 periods
            tl = ["TIMESHEET", f"{EMPLOYER[0]}", f"Employee: {name}    Employee ID: {eid}", f"Period: {ds(ps)} to {ds(pe)}", "Date         Time In    Meal Out   Meal In    Time Out"]
            tl += [f"{ds(d)}   {f(ci)}   {f(mo)}   {f(mi)}   {f(co)}" for d, ci, mo, mi, co in days]
            page(os.path.join(OUT, f"timesheet_{eid}_{ps.isoformat()}.pdf"), tl); files += 1
for eid, name, rate in EMPS:
    page(os.path.join(OUT, f"W2_2025_{eid}.pdf"), ["Form W-2 Wage and Tax Statement 2025", f"a Employee's social security number 123-45-{(random.randint(1000,9999), 6789)[1]}", f"c Employer's name, address, and ZIP code {EMPLOYER[0]}, {EMPLOYER[1]}",
         f"e Employee's first name and initial Last name {name}", f"1 Wages, tips, other compensation {rate*2080:,.2f}", f"3 Social security wages {rate*2080:,.2f}", f"5 Medicare wages and tips {rate*2080:,.2f}"]); files += 1
with zipfile.ZipFile(os.path.join(os.path.dirname(OUT), 'bulk.zip'), 'w') as z:
    for n in sorted(os.listdir(OUT)): z.write(os.path.join(OUT, n), n)
print(files, 'files')
