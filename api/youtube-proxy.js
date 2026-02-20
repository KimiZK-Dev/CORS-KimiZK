// api/youtube-proxy.js
/**
 * 🚀 Media CORS Proxy API for Vercel (downr.org)
 * - Fetches a session cookie from downr.org to avoid 403
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


// ✅ Kiểm tra URL hợp lệ
const isValidUrl = (u) => {
  try {
    const parsed = new URL(u);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

let cachedSess = null;
let cachedSessAt = 0;
const SESS_TTL_MS = 5 * 60 * 1000;

const getDownrSession = async () => {
  const now = Date.now();
  if (cachedSess && now - cachedSessAt < SESS_TTL_MS) {
    return cachedSess;
  }

  const resp = await fetch("https://downr.org/", {
    method: "GET",
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Origin": "https://downr.org",
      "Referer": "https://downr.org/"
    }
  });

  const setCookie = resp.headers.get("set-cookie");
  if (!setCookie) return null;

  const sess = setCookie.split(",").map(s => s.trim()).find(s => s.startsWith("sess="));
  if (!sess) return null;

  cachedSess = sess.split(";")[0];
  cachedSessAt = now;
  return cachedSess;
};

// ✅ Nhận diện YouTube để chuẩn hóa (nếu có)
const isYouTubeUrl = (u) => {
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
    const inputSess =
      req.headers["x-downr-sess"] ||
      (req.method === "POST" ? req.body.sess : req.query.sess) ||
      null;

    if (!inputUrl) {
      return res.status(400).json({
        success: false,
        error: "Missing url"
      });
    }

    if (!isValidUrl(inputUrl)) {
      return res.status(400).json({
        success: false,
        error: "Invalid URL"
      });
    }

    const normalizedUrl = isYouTubeUrl(inputUrl)
      ? normalizeYouTubeUrl(inputUrl)
      : inputUrl;

    if (!normalizedUrl) {
      return res.status(400).json({
        success: false,
        error: "Invalid YouTube URL"
      });
    }

    const apiUrl = "https://downr.org/.netlify/functions/nyt";

    const sessCookie = inputSess ? `sess=${String(inputSess)}` : await getDownrSession();
    const sessionUsed = !!sessCookie;

    const ytRes = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
        "Accept": "application/json",
        "Origin": "https://downr.org",
        "Referer": "https://downr.org/",
        ...(sessCookie ? { "Cookie": sessCookie } : {})
      },
      body: JSON.stringify({
        url: normalizedUrl
      })
    });

    if (!ytRes.ok) {
      const errorText = await ytRes.text();
      return res.status(ytRes.status).json({
        success: false,
        error: `Downr API error: ${ytRes.status}`,
        details: errorText?.slice(0, 1000) || null,
        downrStatus: ytRes.status,
        downrStatusText: ytRes.statusText,
        sessionUsed
      });
    }

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

