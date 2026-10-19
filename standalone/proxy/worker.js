// Paycure AI proxy — Cloudflare Worker. Holds your Anthropic API key server-side so customers never see it.
// Deploy: `npx wrangler deploy proxy/worker.js --name paycure-ai`, then `npx wrangler secret put ANTHROPIC_API_KEY`
// and set ALLOWED_ORIGINS (comma-separated, e.g. https://app.yourdomain.com). Enter the worker URL + "/messages" in Paycure → Admin.
const MODELS = new Set(['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-haiku-4-5-20251001']);
export default {
  async fetch(req, env) {
    const origin = req.headers.get('origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
    const cors = { 'access-control-allow-origin': allowed.includes(origin) ? origin : allowed[0] || 'null', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type', vary: 'origin' };
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (req.method !== 'POST' || !new URL(req.url).pathname.endsWith('/messages')) return new Response('Not found', { status: 404, headers: cors });
    if (allowed.length && !allowed.includes(origin)) return new Response(JSON.stringify({ error: 'Origin not allowed' }), { status: 403, headers: cors });
    let body; try { body = await req.json(); } catch { return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: cors }); }
    // Only forward the fields Paycure uses; cap tokens and size to control cost and abuse.
    if (!MODELS.has(body.model)) body.model = 'claude-sonnet-5-5';
    const payload = { model: body.model, max_tokens: Math.min(Number(body.max_tokens) || 1200, 2000), system: String(body.system || '').slice(0, 20000), messages: body.messages, ...(Array.isArray(body.tools) ? { tools: body.tools.slice(0, 20) } : {}) };
    if (JSON.stringify(payload).length > 400000) return new Response(JSON.stringify({ error: 'Request too large' }), { status: 413, headers: cors });
    const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' }, body: JSON.stringify(payload) });
    return new Response(r.body, { status: r.status, headers: { ...cors, 'content-type': 'application/json' } });
  }
};
