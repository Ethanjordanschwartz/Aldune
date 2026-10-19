// Penny server — Vercel Serverless Function. Holds your Anthropic API key so every customer gets Penny’s full AI
// without a Claude account. Set ANTHROPIC_API_KEY in Vercel → Settings → Environment Variables, then redeploy.
// Optional: PENNY_MODEL (default claude-sonnet-5-5), AI_WEB_SEARCH=off, PENNY_RATE_PER_MIN (default 20).
const MODELS = new Set(['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-haiku-4-5-20251001']);
const hits = new Map(); // best-effort per-instance rate limit
async function handler(req, res) {
  if (req.method === 'GET') return res.status(200).json({ ok: !!process.env.ANTHROPIC_API_KEY, name: 'penny' });
  if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ error: 'method_not_allowed' }); }
  const key = process.env.ANTHROPIC_API_KEY; if (!key) return res.status(503).json({ error: 'Penny server is not configured (ANTHROPIC_API_KEY missing).' });
  const origin = req.headers.origin; if (origin && req.headers.host && !origin.endsWith(req.headers.host)) return res.status(403).json({ error: 'forbidden_origin' });
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0] || 'anon'; const now = Date.now(); const lim = Number(process.env.PENNY_RATE_PER_MIN || 20);
  const recent = (hits.get(ip) || []).filter(t => now - t < 60000); if (recent.length >= lim) return res.status(429).json({ error: 'rate_limited' }); recent.push(now); hits.set(ip, recent);
  const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  if (!Array.isArray(b.messages) || !b.messages.length) return res.status(400).json({ error: 'messages required' });
  const web = process.env.AI_WEB_SEARCH === 'off' ? [] : [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }];
  const tools = [...(Array.isArray(b.tools) ? b.tools : []), ...web];
  const payload = { model: MODELS.has(b.model) ? b.model : (process.env.PENNY_MODEL || 'claude-sonnet-5-5'), max_tokens: Math.min(Number(b.max_tokens) || 4000, 8000), messages: b.messages, ...(b.system ? { system: b.system } : {}), ...(tools.length ? { tools } : {}), ...(b.stream ? { stream: true } : {}) };
  const r = await fetch(process.env.PENNY_UPSTREAM || 'https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  res.status(r.status); res.setHeader('content-type', r.headers.get('content-type') || 'application/json'); res.setHeader('cache-control', 'no-store');
  if (!r.body) return res.end(await r.text());
  const reader = r.body.getReader(); for (;;) { const { done, value } = await reader.read(); if (done) break; res.write(Buffer.from(value)); }
  res.end();
}
module.exports = handler;
module.exports.config = { maxDuration: 120 };
