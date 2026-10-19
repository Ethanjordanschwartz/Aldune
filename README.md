# Aldune: California wage-and-hour audit workflow

**A legal-engineering portfolio project by Ethan Schwartz, a California attorney.**

Aldune turns a California wage-and-hour and PAGA audit into a workflow you can repeat. That kind of audit is normally weeks of attorney time in spreadsheets. Aldune reads messy payroll and timekeeping records, including scanned and handwritten timecards. It tests them against versioned rules built from the Labor Code and the PAGA statute. Then it produces findings, exposure estimates, and the documents to fix what it finds.

The organizing principle: **AI reads and explains, versioned rules decide, and a person confirms.**

**Try it:** download [`demo/index.html`](demo/index.html) and open it in any browser, or use the hosted copy linked in this repo's About section. The demo is one HTML file that runs entirely in your browser; nothing is uploaded. To get full access, sign in with `demo@aldune.dev` / `AlduneDemo2026`, then click **Load demo company**. All data in the demo is fictional.

---

## Why I built it

I practice California civil litigation, including employment matters, and I've worked in-house. I kept seeing the same gap from both sides. Wage-and-hour exposure builds up quietly in payroll data. Nobody looks until a PAGA notice arrives.

The 2024 PAGA reform changed the incentive. Employers who take "reasonable steps," such as regular payroll audits, get civil penalties capped at 15% (before a notice) or 30% (after one) (Lab. Code § 2699(g)–(h)). The law now rewards self-auditing, but a mid-size employer had no practical way to do it.

I mapped the workflow first and built the software second.

## Pain points → workflows

| Who feels it | Pain point | Workflow built |
| --- | --- | --- |
| HR / payroll | Records arrive as exports, PDFs, and scanned or handwritten timecards | One intake that reads every format into one data model and flags what it can't read |
| In-house counsel | No early view of exposure; the first warning is a PAGA notice | A rules engine that tests every shift and pay line, splitting exposure into proven and potential |
| Defense counsel | Complaint, PAGA notice, and LWDA letter arrive with deadlines and standing to check | Case-paper analysis: § 2699.3 deadlines, § 2699(c)(1) standing, each allegation tied to the payroll records |
| Reviewing attorney | Automated results nobody can explain or reproduce | Every finding shows its math, citation, and rule version; changes go into an audit trail |
| Business owner | Findings that never turn into action | Fix queue, back-pay planner, and attorney-reviewable letters and policies |

## Design decisions

- **Deterministic core.** Every dollar figure comes from tested code that gives the same answer for the same inputs. AI output is never used for a number or a legal conclusion.
- **Evidence standards in the data model.** Each finding is `VIOLATION`, `POTENTIAL` (with the missing fact named), or `SUPPRESSED` (with the reason, such as a valid meal waiver). Missing data never becomes a violation, and headline totals count proven findings only.
- **Versioned, effective-dated law.** Rules carry versions (for example `CA-MEAL-2026-02`) and parameters like the minimum wage carry effective dates. When the law or my reading of it changes, I add a new version, so old audits still reproduce exactly.
- **Human in the loop where automation is weakest.** If text recognition is unsure about a digit on a scanned timecard, it doesn't guess. It flags the day, keeps that day's findings "potential," and asks a reviewer to confirm or correct the punches. Each confirmation is logged and the audit re-runs.
- **Grounded assistant.** The built-in assistant ("Penny") answers only from structured findings and a primary-law library. Its citations are checked against that library before they are shown. If the model isn't available, it falls back to the built-in library instead of failing.
- **Primary law only.** The legal layer is built from statutes, regulations, published opinions, and agency publications, written in the project's own words. A test enforces that no third-party editorial content appears in the code.
- **Privacy by default.** The demo processes files in the browser. The hosted version is designed for per-organization row-level security and keeps employee data out of logs.

## Architecture

```
Messy inputs ──► Readers ──► One data model ──► Rules engine ──► Findings & work product
(CSV, Excel,     (parsers,    (employees,        (versioned        (dashboard, letters,
 PDF, scans,      OCR, AI      shifts, meals,     rules; all        back pay, litigation
 case papers)     vision)      pay lines)         math here)        memo, Penny)
                    ▲               ▲                   │
               AI reads text   Person confirms    Rule registry +
                               flagged punches    audit trail
```

| Area | Location |
| --- | --- |
| Rules engine and rule registry | `src/lib/engine/` (`engine.ts`, `rules/registry.ts`, `exposure.ts`, `time.ts`) |
| Intake: column mapping, documents, OCR repair | `src/lib/ingest/` |
| Litigation: case-paper analysis, deadlines, PAGA measures | `src/lib/litigation/`, `src/lib/deadlines/` |
| Assistant with citation validation | `src/lib/assistant/`, `src/lib/law/` |
| Document templates (Word / HTML) | `src/lib/documents/` |
| Hosted version: Next.js app, Supabase schema and RLS, billing | `src/app/`, `supabase/migrations/`, `src/lib/billing/` |
| Single-file demo build | `standalone/` → `demo/index.html` |

## Testing

- **473 unit tests** (Vitest) cover legal edge cases with known answers: meal and rest periods, overtime, the PAGA penalty math and caps, deadlines, and document parsing.
- **45 end-to-end browser tests** (Playwright) run against the built app.
- **Messy-data test sets:** scanned and photographed timecards, handwritten cards transcribed line by line, pleading-paper case documents, and deliberately odd column names.

```bash
npm install
npm test                       # unit tests
sh standalone/build.sh         # builds dist/paycure-standalone.html
OWNER_PW=AlduneDemo2026 python3 tests/e2e-phase50.py   # example end-to-end test
npm run dev                    # hosted version; /audits/demo works with no configuration
```

## Status and limits

This is a working prototype, not a launched product.

- The multi-user hosted version (accounts, database, billing) is built but not deployed.
- Handwriting reads best with the AI model enabled.
- I built many features to explore the problem. For customers, I'd narrow it to the five workflows in the table above.

## How it was built

I built Aldune with an AI coding assistant as a pair programmer. I owned the legal spec, the architecture, and every rule decision. I required tests for each change, and I verified the output against the statute text.

## Legal

This is software, not legal advice. Unresolved legal questions are flagged rather than decided; for example, time-clock rounding, which the California Supreme Court agreed to review in *Camp v. Home Depot* (S277518). Document templates are drafts and must be reviewed by counsel before use.

© 2026 Ethan Schwartz. All rights reserved. The code is published for review as a portfolio sample; it is not licensed for reuse.
