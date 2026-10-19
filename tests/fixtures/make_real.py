# Harder, real-world-style layouts that broke the first reader: split label/value lines, LAST, FIRST names,
# month-name dates, week-ending only, 24-hour timesheets without years, split W-2 boxes, a roster, and a scanned page.
import os, sys
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), 'real')
os.makedirs(OUT, exist_ok=True)
def pdf(name, lines):
    c = canvas.Canvas(os.path.join(OUT, name), pagesize=letter); y = 750
    for l in lines:
        if isinstance(l, tuple):  # two columns on the same visual row but different baselines (common in real stubs)
            c.drawString(50, y, l[0]); c.drawString(300, y - 14, l[1]); y -= 30
        else:
            c.drawString(50, y, l); y -= 16
    c.save()
# A) label and value on separate lines (Paychex-like)
pdf('Paychex_stub_0001.pdf', ['VALLEY FRESH PACKING INC', '1200 HARVEST RD SALINAS CA 93901', ('Emp #', 'E2001'), ('Employee Name', 'LOPEZ, MARIA'),
    ('Period Start', '02/01/2026'), ('Period End', '02/14/2026'), ('Check Date', '02/20/2026'), 'Description   Rate   Hours   Current',
    'Regular   18.25   80.00   1,460.00', 'Overtime   27.38   4.00   109.52', ('Total Gross', '$ 1,569.52'), 'Fed Income Tax   125.56', 'Social Security   97.31', ('Net Pay', '$ 1,197.10'), ('Sick Bal', '24.00')])
# B) Associate ID, uppercase, two decimals
pdf('ADP_EARNINGS_STATEMENT_E2002.pdf', ['Earnings Statement', 'VALLEY FRESH PACKING, INC.', '1200 Harvest Road, Salinas, CA 93901', 'Associate ID: E2002', 'HERNANDEZ, JOSE A.',
    'Period Beginning: 02/01/2026', 'Period Ending: 02/14/2026', 'Pay Date: 02/20/2026', 'Earnings rate hours this period', 'Regular 17.5000 76.00 1,330.00', 'Overtime 26.2500 0.00 0.00',
    'Gross Pay $1,330.00', 'Statutory Deductions', 'Federal Income Tax -106.40', 'Social Security Tax -82.46', 'Net Pay $1,060.15', 'Your sick leave balance: 16.00 hours'])
# C) Gusto-like: no name label; month-name dates; name only in file name
pdf('Paystub-Ana-Ruiz-2026-02-20.pdf', ['Valley Fresh Packing, Inc.', 'Pay period Feb 1, 2026 - Feb 14, 2026', 'Pay day: Feb 20, 2026', 'Earnings   Rate   Hours   Current',
    'Regular Hours   $19.00   80.0   $1,520.00', 'Gross earnings $1,520.00', 'Employee taxes $243.20', 'Net pay $1,276.80'])
# D) week ending only
pdf('stub_week_ending_E2004.pdf', ['VALLEY FRESH PACKING INC  SALINAS CA 93901', 'Employee: Carmen Diaz   Employee No: E2004', 'Week Ending: 02/07/2026', 'Check Date: 02/11/2026',
    'Earnings Rate Hours Amount', 'Regular 16.90 40.00 676.00', 'Gross Pay 676.00', 'Medicare 9.80', 'Net Pay 620.12'])
# Timesheet: 24h times, dates without year
pdf('Timecard_Pedro_Ramirez.pdf', ['WEEKLY TIME CARD  2026', 'Employee: RAMIREZ, PEDRO    Clock #: E2005', 'Week of 02/01/2026',
    'Day      In     Out    In     Out', 'Mon 2/2  06:30  12:15  12:45  15:00', 'Tue 2/3  06:30  12:40  13:10  15:00', 'Wed 2/4  06:30  11:00  11:30  15:00', 'Thu 2/5  06:30  15:00', 'Fri 2/6  06:30  12:00  12:30  17:30'])
# W-2: labels and values on separate lines
pdf('W2_Rosa_Flores_2025.pdf', ['2025 Form W-2 Wage and Tax Statement', ('a Employee\'s social security number', '123-45-6789'), ('1 Wages, tips, other compensation', '41,200.00'),
    ('3 Social security wages', '41,200.00'), ('5 Medicare wages and tips', '41,200.00'), ('c Employer\'s name, address, and ZIP code', 'Valley Fresh Packing, Inc.'), ("e Employee's first name and initial   Last name", 'Rosa Flores')])
# Roster
pdf('Employee_Roster.pdf', ['EMPLOYEE ROSTER - VALLEY FRESH PACKING', 'ID      Name              Title       Rate     Hire Date', 'E2001   Maria Lopez       Packer      $18.25   03/01/2022',
    'E2002   Jose Hernandez    Loader      $17.50   06/15/2023', 'E2003   Ana Ruiz          Sorter      $19.00   01/10/2021', 'E2004   Carmen Diaz       Packer      $16.90   09/01/2025', 'E2005   Pedro Ramirez     Driver      $21.00   04/04/2020'])
# Scanned (image only, no text layer)
from reportlab.lib.utils import ImageReader
try:
    from PIL import Image, ImageDraw
    img = Image.new('RGB', (1200, 600), 'white'); d = ImageDraw.Draw(img); d.text((40, 40), 'EARNINGS STATEMENT  Employee: Luis Garcia  Pay Period 02/01/2026 - 02/14/2026  Gross Pay 1,400.00', fill='black')
    c = canvas.Canvas(os.path.join(OUT, 'scanned_stub.pdf'), pagesize=letter); c.drawImage(ImageReader(img), 30, 400, width=550, height=275); c.save()
except Exception as e: print('no PIL', e)
print(sorted(os.listdir(OUT)))
