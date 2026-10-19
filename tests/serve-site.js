// Serves dist/site with the real Penny function at /api/penny, backed by a mock Anthropic API (JSON or SSE).
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', 'dist', 'site');
const TEXT = '## Overtime basics\nCalifornia requires **daily** overtime:\n- 1.5× after 8 hours\n- 2× after 12 hours\n\n| Hours | Rate |\n|---|---|\n| 8–12 | 1.5× |\n| 12+ | 2× |\n\nSee Lab. Code § 510.';
const up = http.createServer((q, r) => { let b = ''; q.on('data', c => b += c); q.on('end', () => { const body = JSON.parse(b || '{}');
  if (body.stream) { r.writeHead(200, { 'content-type': 'text/event-stream' }); const ev = (t, d) => r.write(`event: ${t}\ndata: ${JSON.stringify(d)}\n\n`);
    ev('message_start', { type: 'message_start', message: { id: 'm', content: [], usage: { input_tokens: 5, output_tokens: 0 } } }); ev('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }); ev('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: TEXT } }); ev('content_block_stop', { type: 'content_block_stop', index: 0 }); ev('message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 40 } }); ev('message_stop', { type: 'message_stop' }); r.end(); }
  else { r.writeHead(200, { 'content-type': 'application/json' }); r.end(JSON.stringify({ content: [{ type: 'text', text: TEXT }], stop_reason: 'end_turn', usage: { input_tokens: 5, output_tokens: 40 } })); } }); });
up.listen(0, () => {
  process.env.PENNY_UPSTREAM = `http://127.0.0.1:${up.address().port}/v1/messages`; process.env.ANTHROPIC_API_KEY = 'sk-test';
  const penny = require(path.join(ROOT, 'api', 'penny.js'));
  http.createServer((q, r) => {
    if (q.url.startsWith('/api/penny')) { let b = ''; q.on('data', c => b += c); q.on('end', () => { const res = { status(c) { r.statusCode = c; return res; }, setHeader: (k, v) => r.setHeader(k, v), json(o) { r.setHeader('content-type', 'application/json'); r.end(JSON.stringify(o)); }, write: c => r.write(c), end: t => r.end(t) }; penny({ method: q.method, headers: q.headers, body: b ? JSON.parse(b) : {} }, res); }); return; }
    fs.readFile(path.join(ROOT, 'index.html'), (e, d) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(d); });
  }).listen(Number(process.env.PORT || 8765), () => console.log('ready'));
});
