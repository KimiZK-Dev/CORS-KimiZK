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
    const inputUrl =
      req.method === "POST"
        ? req.body.url
        : req.query.url;

    if (!inputUrl) {
      return res.status(400).json({
        success: false,
        error: "Missing url"
      });
    }

    const ytIdMatch = inputUrl.match(/[?&]v=([^&]+)/);
    if (!ytIdMatch) {
      return res.status(400).json({
        success: false,
        error: "Invalid YouTube URL"
      });
    }

    const videoId = ytIdMatch[1];

    const apiUrl = "https://ytdown.to/proxy.php";

    const ytRes = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        url: `https://www.youtube.com/watch?v=${videoId}`
      })
    });

    const data = await ytRes.json();

    return res.status(200).json({
      success: true,
      data
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
}

