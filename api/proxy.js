/**
 * 🚀 TikVid CORS Proxy API for Vercel
 * 
 * Vercel serverless function that proxies requests to TikVid API
 * and handles CORS restrictions
 * 
 * Usage:
 * GET /api/proxy?url=TIKTOK_URL
 */

import https from 'https';
import url from 'url';
import querystring from 'querystring';
import zlib from 'zlib';

const TIKVID_API = 'https://tikvid.io/api/ajaxSearch';

// Function to parse HTML response and extract video data
const parseHtmlResponse = (htmlData) => {
    try {
        // Extract video title
        const titleMatch = htmlData.match(/<h3>(.*?)<\/h3>/);
        const title = titleMatch ? titleMatch[1].trim() : '';
        
        // Extract thumbnail URL (from img tag)
        const thumbnailMatch = htmlData.match(/<img src="(https:\/\/[^"]*?)"/);
        const thumbnail = thumbnailMatch ? thumbnailMatch[1] : '';
        
        // Extract poster URL (from video tag)
        const posterMatch = htmlData.match(/poster="(https:\/\/[^"]*?)"/);
        const poster = posterMatch ? posterMatch[1] : '';
        
        // Extract video ID
        const videoIdMatch = htmlData.match(/id="TikTokId" value="(\d+)"/);
        const videoId = videoIdMatch ? videoIdMatch[1] : '';
        
        // Extract script variables
        const scriptVars = {};
        const kExpMatch = htmlData.match(/k_exp = "(\d+)"/);
        const kTokenMatch = htmlData.match(/k_token = "([^"]+)"/);
        const kUrlConvertMatch = htmlData.match(/k_url_convert = "([^"]+)"/);
        
        if (kExpMatch) scriptVars.k_exp = kExpMatch[1];
        if (kTokenMatch) scriptVars.k_token = kTokenMatch[1];
        if (kUrlConvertMatch) scriptVars.k_url_convert = kUrlConvertMatch[1];
        
        // Extract Convert to Video data (for image slideshows)
        const convertVideoData = {};
        const audioUrlMatch = htmlData.match(/data-audioUrl="([^"]+)"/);
        const imageDataMatch = htmlData.match(/data-imageData="([^"]+)"/);
        
        if (audioUrlMatch) convertVideoData.audioUrl = audioUrlMatch[1];
        if (imageDataMatch) {
            convertVideoData.imageDataEncoded = imageDataMatch[1];
            try {
                // Decode base64 image data
                const decodedImageData = Buffer.from(imageDataMatch[1], 'base64').toString('utf-8');
                const imageUrls = decodedImageData.split(';').filter(url => url.trim().length > 0);
                convertVideoData.imageUrls = imageUrls;
                convertVideoData.imageCount = imageUrls.length;
            } catch (decodeError) {
                console.error('Error decoding image data:', decodeError.message);
                convertVideoData.imageUrls = [];
                convertVideoData.imageCount = 0;
            }
        }
        
        // Extract download links
        const downloadLinks = [];
        
        // Extract all download links with better pattern matching
        const allDownloadMatches = htmlData.matchAll(/<a[^>]*onclick="showAd\(\)"[^>]*href="(https:\/\/[^"]*?)"[^>]*rel="nofollow"[^>]*class="tik-button-dl[^"]*"[^>]*><i class="icon icon-download"><\/i> Download ([^<]+)<\/a>/g);
        
        for (const match of allDownloadMatches) {
            const url = match[1];
            const buttonText = match[2].trim();
            
            let type, quality;
            if (buttonText.includes('MP3')) {
                type = 'audio';
                quality = 'MP3';
            } else if (buttonText.includes('MP4')) {
                type = 'video';
                quality = buttonText; // "MP4 [1]", "MP4 [2]", "MP4 HD", etc.
            } else {
                type = 'unknown';
                quality = buttonText;
            }
            
            downloadLinks.push({
                type: type,
                quality: quality,
                url: url,
                buttonText: buttonText
            });
        }
        
        // Extract video preview URL (data-src)
        const videoPreviewMatch = htmlData.match(/data-src="(https:\/\/[^"]*?)"/);
        const videoPreview = videoPreviewMatch ? videoPreviewMatch[1] : '';
        
        // Extract direct video URLs (from href without onclick)
        const directVideoMatches = htmlData.matchAll(/href="(https:\/\/v\d+[^"]*?)" target="_blank" rel="nofollow" class="tik-button-dl[^"]*"><i class="icon icon-download"><\/i> Download MP4 \[(\d+)\]/g);
        const directVideoLinks = [];
        for (const match of directVideoMatches) {
            directVideoLinks.push({
                type: 'video_direct',
                quality: `MP4 Direct [${match[2]}]`,
                url: match[1]
            });
        }
        
        // Extract photo list (for image slideshows)
        const photoList = [];
        const photoListMatches = htmlData.matchAll(/<div class="download-items">[\s\S]*?<img src="([^"]+)"[^>]*>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*title="Download Image"[^>]*>[\s\S]*?<\/div>/g);
        
        let photoIndex = 1;
        for (const match of photoListMatches) {
            const thumbUrl = match[1];
            const downloadUrl = match[2];
            photoList.push({
                index: photoIndex,
                thumbnail: thumbUrl,
                downloadUrl: downloadUrl,
                type: 'image'
            });
            photoIndex++;
        }
        
        // Extract ads slot info
        const adsMatch = htmlData.match(/data-ad-client="([^"]+)"/);
        const adsSlotMatch = htmlData.match(/data-ad-slot="([^"]+)"/);
        const adsInfo = {};
        if (adsMatch) adsInfo.adClient = adsMatch[1];
        if (adsSlotMatch) adsInfo.adSlot = adsSlotMatch[1];
        
        // Determine content type
        const contentType = photoList.length > 0 ? 'image_slideshow' : 'video';
        
        return {
            status: 'success',
            data: {
                id: videoId,
                title: title,
                contentType: contentType,
                thumbnail: thumbnail,
                poster: poster,
                videoPreview: videoPreview,
                downloads: downloadLinks,
                directVideoLinks: directVideoLinks,
                downloadCount: downloadLinks.length + directVideoLinks.length + photoList.length,
                
                // Image slideshow specific data
                photoList: photoList,
                photoCount: photoList.length,
                convertVideoData: Object.keys(convertVideoData).length > 0 ? convertVideoData : null,
                
                // Technical data
                scriptVars: scriptVars,
                adsInfo: Object.keys(adsInfo).length > 0 ? adsInfo : null,
                
                // Metadata
                metadata: {
                    hasAds: htmlData.includes('adsbygoogle'),
                    hasPopup: htmlData.includes('popup_play'),
                    hasPhotoList: photoList.length > 0,
                    hasConvertToVideo: Object.keys(convertVideoData).length > 0,
                    extractedAt: new Date().toISOString()
                }
            }
        };
    } catch (error) {
        console.error('❌ Error parsing HTML response:', error.message);
        return {
            status: 'error',
            message: 'Failed to parse video data',
            error: error.message
        };
    }
};

// CORS headers for Vercel
const setCorsHeaders = (res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');
};

// Main Vercel serverless function
export default async function handler(req, res) {
    // Set CORS headers
    setCorsHeaders(res);
    
    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }
    
    // Only allow GET requests
    if (req.method !== 'GET') {
        res.status(405).json({ 
            error: 'Method not allowed',
            allowed: ['GET'] 
        });
        return;
    }
    
    console.log(`📥 API request: ${req.method} ${req.url}`);
    
    // Get URL parameter from query string
    const tikTokUrl = req.query.url;
    const lang = req.query.lang || 'en';
    
    console.log('📋 Request data:', { url: tikTokUrl, lang });
    
    if (!tikTokUrl) {
        res.status(400).json({ 
            error: 'Missing required parameter: url (TikTok URL)',
            example: 'https://cors-kimizk.vercel.app/api/proxy?url=https://www.tiktok.com/@user/video/123'
        });
        return;
    }
    
    try {
        // Prepare data for TikVid API
        const tikvidData = querystring.stringify({
            q: tikTokUrl,
            lang: lang
        });
        
        // TikVid API headers
        const tikvidHeaders = {
            'Accept': '*/*',
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept-Language': 'vi;q=0.5',
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'Content-Length': Buffer.byteLength(tikvidData),
            'Origin': 'https://tikvid.io',
            'Referer': 'https://tikvid.io/en',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
            'X-Requested-With': 'XMLHttpRequest'
        };
        
        // Parse TikVid URL
        const tikvidUrl = url.parse(TIKVID_API);
        
        // Create request to TikVid API
        const options = {
            hostname: tikvidUrl.hostname,
            port: 443,
            path: tikvidUrl.path,
            method: 'POST',
            headers: tikvidHeaders
        };
        
        console.log('🚀 Proxying request to TikVid API...');
        
        // Create promise wrapper for the HTTP request
        const response = await new Promise((resolve, reject) => {
            const tikvidReq = https.request(options, (tikvidRes) => {
                console.log(`📈 TikVid response status: ${tikvidRes.statusCode}`);
                
                let responseData = Buffer.alloc(0);
                
                tikvidRes.on('data', chunk => {
                    responseData = Buffer.concat([responseData, chunk]);
                });
                
                tikvidRes.on('end', () => {
                    try {
                        // Handle different encodings
                        let textData;
                        const encoding = tikvidRes.headers['content-encoding'];
                        
                        if (encoding === 'gzip') {
                            textData = zlib.gunzipSync(responseData).toString('utf8');
                        } else if (encoding === 'deflate') {
                            textData = zlib.inflateSync(responseData).toString('utf8');
                        } else if (encoding === 'br') {
                            textData = zlib.brotliDecompressSync(responseData).toString('utf8');
                        } else {
                            textData = responseData.toString('utf8');
                        }
                        
                        console.log('📄 Raw response length:', textData.length);
                        
                        // Check if response is JSON or HTML
                        let finalResponse;
                        try {
                            // Try to parse as JSON first
                            const jsonData = JSON.parse(textData);
                            console.log('✅ TikVid API returned JSON response');
                            
                            // Check if it's HTML content in data field
                            if (jsonData.status === 'ok' && jsonData.data && typeof jsonData.data === 'string' && jsonData.data.includes('<div')) {
                                console.log('🔍 Parsing HTML content from JSON response...');
                                finalResponse = parseHtmlResponse(jsonData.data);
                            } else {
                                finalResponse = jsonData;
                            }
                        } catch (jsonError) {
                            // If not JSON, try to parse as HTML directly
                            console.log('🔍 Parsing HTML response directly...');
                            finalResponse = parseHtmlResponse(textData);
                        }
                        
                        console.log('✅ Final response prepared');
                        resolve(finalResponse);
                        
                    } catch (parseError) {
                        console.error('❌ Failed to parse TikVid response:', parseError.message);
                        reject({
                            error: 'Failed to parse TikVid response',
                            details: parseError.message
                        });
                    }
                });
            });
            
            tikvidReq.on('error', (error) => {
                console.error('❌ TikVid API request error:', error.message);
                reject({
                    error: 'TikVid API request failed', 
                    details: error.message 
                });
            });
            
            // Set timeout (Vercel has max 10s for hobby plan)
            tikvidReq.setTimeout(9000, () => {
                console.error('⏰ TikVid API request timeout');
                tikvidReq.abort();
                reject({ error: 'TikVid API request timeout' });
            });
            
            // Send the request
            tikvidReq.write(tikvidData);
            tikvidReq.end();
        });
        
        // Return successful response
        res.status(200).json(response);
        
    } catch (error) {
        console.error('❌ Server error:', error);
        res.status(500).json({ 
            error: 'Internal server error', 
            details: error.message || error.error || 'Unknown error'
        });
    }
}
