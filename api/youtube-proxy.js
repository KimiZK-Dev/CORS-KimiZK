// api/youtube-proxy.js
/**
 * 🚀 YouTube CORS Proxy API for Vercel (ytdown.io)
 * 
 * Usage:
 *  - GET  /api/youtube-proxy?url=YOUTUBE_URL
 *  - POST /api/youtube-proxy  { "url": "YOUTUBE_URL" }
 */

const setCorsHeaders = (res, origin) => {
  const allowedOrigins = [
    'https://kimizk-dev.github.io',
    'http://localhost:3000',
    'http://localhost:8080',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:8080',
    'http://127.0.0.1:5500'
  ];

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'false');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Vary', 'Origin');
};

const isValidYouTubeUrl = (u) => {
  try {
    const reg = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
    return reg.test(u);
  } catch {
    return false;
  }
};

export default async function handler(req, res) {
  try {
    const origin = req.headers.origin;
    setCorsHeaders(res, origin);

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    // Extract URL from GET or POST
    const urlParam =
      req.method === 'GET'
        ? req.query.url
        : (req.body && (req.body.url || req.body?.data?.url));

    if (!urlParam) {
      res.status(400).json({
        success: false,
        error: 'Missing parameter: url (YouTube URL required)'
      });
      return;
    }

    if (!isValidYouTubeUrl(urlParam)) {
      res.status(400).json({
        success: false,
        error: 'Invalid YouTube URL'
      });
      return;
    }

    // Build form-encoded body for ytdown.io
    const params = new URLSearchParams();
    params.append('url', urlParam);

    // On Vercel Node 18+, fetch is global
    const ytRes = await fetch('https://ytdown.io/proxy.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        // User-Agent để mô phỏng browser nếu cần
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)'
      },
      body: params
    });

    if (!ytRes.ok) {
      res.status(ytRes.status).json({
        success: false,
        error: `Upstream error: ${ytRes.status} ${ytRes.statusText}`
      });
      return;
    }

    const data = await ytRes.json();

    // Chuẩn hóa response về dạng { success, data }
    res.status(200).json({
      success: true,
      data
    });
  } catch (err) {
    console.error('YouTube proxy error:', err);
    res.status(500).json({
      success: false,
      error: err?.message || 'Internal server error'
    });
  }
}
