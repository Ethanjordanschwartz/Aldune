# Host Paycure on your own domain (e.g., app.paycure.com)

Hosting the built file on your own domain unlocks Google Drive and Dropbox pickers, linked folders in every Chromium browser, the AI proxy, and your own branding/URL. It takes about 10 minutes.

## Netlify (drag-and-drop)
1. Run `standalone/build.sh` → `dist/paycure-standalone.html`.
2. Make a folder with `index.html` (copy of the built file) plus `_headers` from this directory.
3. Drag the folder onto app.netlify.com → Sites → “Deploy manually”. Add your domain under Domain settings.

## Vercel / Cloudflare Pages
Same folder; `vercel.json` (Vercel) or `_headers` (Cloudflare Pages) set the security headers.

## After deploying
- Admin → Integrations: Dropbox app key (Dropbox App Console → Chooser domains: add your domain); Google OAuth client ID + API key (Google Cloud Console → enable Drive API and Picker API; authorized JavaScript origin = your domain).
- Admin → AI endpoint: your Paycure AI proxy (`standalone/proxy/worker.js`).
- Note: the browser edition stores accounts and audits in each user’s browser. For company-wide accounts across devices, automatic Stripe activation, and server-side payroll connectors (Finch/ADP), deploy the Paycure Cloud (Next.js) app per GO_LIVE.md.
