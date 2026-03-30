// Vercel Serverless Function — Proxy to Niagara via Cloudflare Tunnel
// Route: /api/niagara?path=config or /api/niagara?path=equipment/piso4

export default async function handler(req, res) {
  var niagaraUrl = process.env.NIAGARA_URL;
  var niagaraUser = process.env.NIAGARA_USER;
  var niagaraPass = process.env.NIAGARA_PASS;
  var apiKey = process.env.API_KEY;

  if (!niagaraUrl) {
    return res.status(500).json({ error: 'NIAGARA_URL not configured' });
  }

  // Validate API key if configured (add API_KEY env var in Vercel)
  if (apiKey) {
    var clientKey = req.headers['x-api-key'];
    if (clientKey !== apiKey) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  // Get the API path from query parameter
  var apiPath = req.query.path || 'config';

  // Whitelist: only allow known API paths (prevents path traversal)
  var allowedPrefixes = ['config', 'equipment/', 'monitor/', 'alarms', 'history/', 'schedules'];
  var isAllowed = allowedPrefixes.some(function(prefix) {
    return apiPath === prefix || apiPath.startsWith(prefix);
  });
  if (!isAllowed) {
    return res.status(403).json({ error: 'Path not allowed' });
  }

  // Build target URL: /snls/api/{path}
  var targetUrl = niagaraUrl.replace(/\/+$/, '') + '/snls/api/' + apiPath;

  // Forward additional query params (exclude 'path')
  var extraParams = [];
  Object.keys(req.query).forEach(function(key) {
    if (key !== 'path') {
      extraParams.push(key + '=' + encodeURIComponent(req.query[key]));
    }
  });
  if (extraParams.length > 0) {
    targetUrl += '?' + extraParams.join('&');
  }

  // Basic Auth header
  var auth = Buffer.from(niagaraUser + ':' + niagaraPass).toString('base64');

  try {
    var response = await fetch(targetUrl, {
      method: req.method || 'GET',
      headers: {
        'Authorization': 'Basic ' + auth,
        'X-Requested-With': 'XMLHttpRequest',
        'Content-Type': 'application/json'
      },
      body: req.method !== 'GET' && req.body ? JSON.stringify(req.body) : undefined,
    });

    var data = await response.text();

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.status(response.status).send(data);
  } catch (error) {
    console.error('Niagara proxy error:', error.message);
    res.status(502).json({
      error: 'Cannot reach Niagara station',
      detail: error.message
    });
  }
}
