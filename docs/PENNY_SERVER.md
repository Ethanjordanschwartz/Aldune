# Penny server — full AI for every customer, no Claude account

1. Deploy `paycure-site.zip` (contains `index.html` + `api/penny.js`) to Vercel: New Project → upload/import → Deploy.
2. Vercel → Project → Settings → Environment Variables: add `ANTHROPIC_API_KEY` (from console.anthropic.com). Redeploy.
3. Open your site. Penny detects `/api/penny` automatically — every visitor gets her full AI: any question, full drafts with Word export, live web search for current law.

Optional settings: `PENNY_MODEL` (default `claude-sonnet-5-5`), `AI_WEB_SEARCH=off`, `PENNY_RATE_PER_MIN` (default 20 per visitor).
Security: the key never reaches the browser; requests from other websites are rejected; models and response length are restricted. Add Vercel spending limits on your Anthropic account. For accounts, billing, and payroll connections, deploy Aldune Cloud (docs/CLAUDE_CODE_PROMPTS.md).
