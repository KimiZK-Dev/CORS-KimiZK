// api/youtube-proxy.js
/**
 * 🚀 YouTube CORS Proxy API for Vercel (ytdown.io)
 */

const setCorsHeaders = (res, origin) => {
  res.setHeader(
    'Access-Control-Allow-Origin',
    origin || '*'
  );
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, OPTIONS'
  );
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Requested-With'
  );
  res.setHeader(
    'Access-Control-Max-Age',
    '86400'
  );
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
  const origin = req.headers.origin;
  setCorsHeaders(res, origin);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  
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

