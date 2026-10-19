// Law-update feed for your Aldune deployment. Serves the current attorney-verified rule pack (JSON) so every
// customer’s app applies new minimum wages, local rates, and law-library updates automatically.
// Set LAW_FEED_JSON (the pack itself) or LAW_FEED_URL (where your compliance team publishes it).
async function handler(req, res) {
  res.setHeader('cache-control', 'public, max-age=3600');
  try {
    if (process.env.LAW_FEED_JSON) return res.status(200).json(JSON.parse(process.env.LAW_FEED_JSON));
    if (process.env.LAW_FEED_URL) { const r = await fetch(process.env.LAW_FEED_URL); return res.status(r.ok ? 200 : 502).json(r.ok ? await r.json() : { error: 'feed unavailable' }); }
    return res.status(200).json({ version: 'none', published: null, items: [] });
  } catch (e) { return res.status(500).json({ error: 'invalid feed' }); }
}
module.exports = handler;
