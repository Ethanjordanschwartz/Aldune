# Legal sources consulted (verified 2026-10-05)

Every figure below is implemented in `src/lib/engine/time.ts`, `modeling.ts`, `rules/registry.ts`, or `src/lib/law/kb.ts`. Re-verify each January and July.

| Topic | What Aldune applies | Sources |
|---|---|---|
| State minimum wage | $16.50 (2025), $16.90 (2026); exempt floor 2× ($70,304 in 2026) | DIR Minimum Wage FAQ (dir.ca.gov/dlse/faq_minimumwage.htm); Thompson Coburn; Renne Public Law Group |
| Computer professional exemption | $56.97/hr, $118,657.43/yr (2025); $58.85/hr, $122,573.13/yr (2026) | DIR adjustment as reported by Hixson Nagatani, Rosasco Law Group, Renne |
| Local minimum wages | ~33 localities, effective-dated, large-employer tier | UC Berkeley Labor Center inventory (July 1, 2026 table and archive); CalChamber HRWatchdog (Dec. 2025) |
| Fast food | $20.00 from Apr. 1, 2024 (AB 1228) | DIR FAQ; Wikipedia summary of AB 1228 |
| Health care (SB 525) | Large systems/dialysis: $23 (10/16/2024), $24 (7/1/2025), $25 (7/1/2026); other covered: $21 → $23 (7/1/2026); clinics: $21 → $22 (7/1/2026) | California Hospital Association SB 525 FAQ; CMA (2026); WorkAxle summary of DIR MW-7/2026 supplement |
| Agricultural overtime | AB 1066 phase-in by size; 8/40 + DT>12 for all from 2025; seventh-day rule applies | DIR / AB 1066 summaries (AFS Law, LA Employee Lawyer, CCGGA, Cornell Ag Workforce) |
| PAGA 2024 amendments | 15%/30% caps; $25 wage-statement; $50 isolated (≤30 days or ≤4 pay periods); $200 only after prior finding (5 yrs) or malicious conduct; 50% for weekly payroll; 35% employee share; notices on/after June 19, 2024 | Faegre Drinker; Liebert Cassidy Whitmore; Seyfarth; Benesch; Lagasse Branch Bell Kinkead |
| PAGA cure procedure | <100 employees: confidential cure proposal within 33 days; LWDA conference within 14 days; cure within 45 days; 3 yrs wages + 7% + liquidated + fees; 100+: early evaluation conference | Walsworth; Lewitt Hackman; Advocate Magazine (2025); NFC Legal; Gunderson Dettmer; Morgan Lewis |
| 2026 notices and pay equity | SB 294 Know Your Rights notice (Lab. Code §§ 1550–1559; by Feb. 1, 2026; $500/employee); SB 642 pay scale = good-faith estimate; EPA 6-year back wages; SB 261 judgment enforcement | CalChamber HRWatchdog; K&L Gates; Holland & Knight; Fennemore; CDF |
| Split shifts | Wage Order § 4(C); premium offset by pay above minimum wage | Aleman v. AirTouch Cellular (2012) 209 Cal.App.4th 556 |
| Compensable time | Exit security time and on-premises-restricted meal periods are hours worked | Huerta v. CSI Electrical Contractors (2024) 15 Cal.5th 908 (Justia; Morgan Lewis; DLA Piper) |
| Rounding | See’s Candy standard; meal rounding barred (Donohue); Camp v. Home Depot (S277518) review granted Feb. 2023, pending as of 2026 | NatLawReview; Horvitz & Levy docket list; Treger Consulting (Apr. 2026) |

Defect found through research and fixed: the engine previously skipped the seventh-day overtime rule for agricultural employees. California applies it (first 8 hours at 1.5×, beyond 8 at 2×).
