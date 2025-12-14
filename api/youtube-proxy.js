// api/youtube-proxy.js
/**
 * 🚀 YouTube CORS Proxy API for Vercel (ytdown.io)
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
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Accept, Authorization, X-Requested-With'
  );
  res.setHeader('Access-Control-Allow-Credentials', 'false');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Vary', 'Origin');
};

// ✅ Chỉ chấp nhận YouTube
const isValidYouTubeUrl = (u) => {
  return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i.test(u);
};

// ✅ Chuẩn hóa URL → chỉ còn ?v=VIDEO_ID
const normalizeYouTubeUrl = (rawUrl) => {
  try {
    const u = new URL(rawUrl);

    // youtu.be/VIDEO_ID
    if (u.hostname.includes('youtu.be')) {
      const id = u.pathname.replace('/', '');
      return id
        ? `https://www.youtube.com/watch?v=${id}`
        : null;
    }

    // youtube.com/watch?v=VIDEO_ID&list=...
    const videoId = u.searchParams.get('v');
    if (!videoId) return null;

    return `https://www.youtube.com/watch?v=${videoId}`;
  } catch {
    return null;
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

    const rawUrl =
      req.method === 'GET'
        ? req.query.url
        : req.body?.url || req.body?.data?.url;

    if (!rawUrl) {
      res.status(400).json({
        success: false,
        error: 'Missing parameter: url'
      });
      return;
    }

    if (!isValidYouTubeUrl(rawUrl)) {
      res.status(400).json({
        success: false,
        error: 'Invalid YouTube URL'
      });
      return;
    }

    const cleanUrl = normalizeYouTubeUrl(rawUrl);

    if (!cleanUrl) {
      res.status(400).json({
        success: false,
        error: 'Unsupported YouTube URL format'
      });
      return;
    }

    // 👉 Gửi URL sạch sang ytdown.io
    const params = new URLSearchParams();
    params.append('url', cleanUrl);

    const ytRes = await fetch('https://ytdown.io/proxy.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)'
      },
      body: params
    });

    if (!ytRes.ok) {
      res.status(ytRes.status).json({
        success: false,
        error: `Upstream error: ${ytRes.status}`
      });
      return;
    }

    const text = await ytRes.text();

    // 🧠 ytdown đôi khi trả HTML → chặn luôn
    if (!text.trim().startsWith('{')) {
      res.status(502).json({
        success: false,
        error: 'Upstream returned non-JSON response'
      });
      return;
    }

    const data = JSON.parse(text);

    res.status(200).json({
      success: true,
      input: rawUrl,
      normalized: cleanUrl,
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
