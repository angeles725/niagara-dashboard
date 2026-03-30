// Vercel Serverless Function — Proxy to Niagara via Cloudflare Tunnel
// This runs server-side, so no CORS issues

export default async function handler(req, res) {
  const niagaraUrl = process.env.NIAGARA_URL;
  const niagaraUser = process.env.NIAGARA_USER;
  const niagaraPass = process.env.NIAGARA_PASS;

  if (!niagaraUrl) {
    return res.status(500).json({ error: 'NIAGARA_URL not configured' });
  }

  // Build the target path from the catch-all route
  // /api/niagara/config → /snls/api/config
  // /api/niagara/equipment/piso4 → /snls/api/equipment/piso4
  const pathSegments = req.query.path;
  const targetPath = '/snls/api/' + (Array.isArray(pathSegments) ? pathSegments.join('/') : pathSegments);

  // Forward query parameters
  const url = new URL(targetPath, niagaraUrl);
  const params = new URL(req.url, 'http://localhost').searchParams;
  for (const [key, value] of params) {
    if (key !== 'path') {
      url.searchParams.set(key, value);
    }
  }

  // Basic Auth header
  const auth = Buffer.from(niagaraUser + ':' + niagaraPass).toString('base64');

  try {
    const response = await fetch(url.toString(), {
      method: req.method,
      headers: {
        'Authorization': 'Basic ' + auth,
        'X-Requested-With': 'XMLHttpRequest',
        'Content-Type': 'application/json'
      },
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
    });

    const data = await response.text();

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(response.status).send(data);
  } catch (error) {
    console.error('Niagara proxy error:', error.message);
    res.status(502).json({
      error: 'Cannot reach Niagara station',
      detail: error.message
    });
  }
}
