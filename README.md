# 🚀 CORS-KimiZK Proxy API

**TikVid CORS Proxy API for Vercel** - Bypass CORS restrictions for TikTok video downloads

## 🎯 Purpose

This serverless API proxy allows you to:
- Get TikTok video download links via TikVid
- Download TikTok videos, audio (MP3), and images
- Bypass CORS restrictions in browsers
- No backend server required

## 📡 API Endpoints

### 1. **Proxy API** - Get download links
```
GET https://cors-kimizk.vercel.app/api/proxy?url=TIKTOK_URL
```

**Example:**
```
https://cors-kimizk.vercel.app/api/proxy?url=https://www.tiktok.com/@jessica.laaaa/video/7534690000865168654
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "id": "7534690000865168654",
    "title": "Video title...",
    "contentType": "video",
    "thumbnail": "https://...",
    "downloads": [
      {
        "type": "video",
        "quality": "MP4 HD",
        "url": "https://dl.snapcdn.app/get?token=..."
      },
      {
        "type": "audio", 
        "quality": "MP3",
        "url": "https://dl.snapcdn.app/get?token=..."
      }
    ]
  }
}
```

### 2. **Download API** - Proxy file downloads
```
GET https://cors-kimizk.vercel.app/api/download?url=DOWNLOAD_URL&filename=video.mp4
```

**Example:**
```
https://cors-kimizk.vercel.app/api/download?url=https://dl.snapcdn.app/get?token=abc123&filename=tiktok_video.mp4
```

## 🔧 Usage in JavaScript

```javascript
// Get download links
const response = await fetch('https://cors-kimizk.vercel.app/api/proxy?url=' + encodeURIComponent(tiktokUrl));
const data = await response.json();

// Download file via proxy
const downloadUrl = data.data.downloads[0].url;
const proxyDownloadUrl = `https://cors-kimizk.vercel.app/api/download?url=${encodeURIComponent(downloadUrl)}&filename=video.mp4`;

// Create download link
const link = document.createElement('a');
link.href = proxyDownloadUrl;
link.download = 'video.mp4';
link.click();
```

## ⚡ Features

- ✅ **Serverless** - No server maintenance required
- ✅ **CORS-free** - Works from any domain
- ✅ **Fast** - Edge-deployed on Vercel
- ✅ **Reliable** - Built-in error handling
- ✅ **Multiple formats** - Video, Audio, Images
- ✅ **High quality** - HD video downloads

## 🚀 Deploy Your Own

1. **Fork this repository**
2. **Connect to Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Import this repository
   - Deploy automatically
3. **Update your URLs** to use your new domain

## 📝 Supported Content

- ✅ TikTok videos (MP4)
- ✅ TikTok audio (MP3)
- ✅ TikTok image slideshows
- ✅ HD quality downloads
- ✅ Direct download links

## 🔒 Rate Limits

- **Vercel Free Plan:** 100GB bandwidth/month
- **Function timeout:** 10 seconds
- **No API key required**

## 🐛 Error Handling

```json
{
  "error": "Error description",
  "details": "Detailed error message"
}
```

## 📞 Support

- Issues: [GitHub Issues](https://github.com/KimiZK-Dev/CORS-KimiZK/issues)
- Deploy: [Vercel Dashboard](https://vercel.com/dashboard)

---

⭐ **Star this repo if it helped you bypass CORS!**
