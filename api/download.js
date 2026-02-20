/**
 * 🚀 Download Proxy API for Vercel
 *
 * Vercel serverless function that proxies download/stream requests
 * to bypass CORS restrictions
 *
 * Usage:
 * GET /api/download?url=DOWNLOAD_URL&filename=FILENAME&referer=REFERER(optional)
 */

import https from 'https';
import http from 'http';
import url from 'url';

// CORS headers for Vercel
const setCorsHeaders = (res, origin) => {
    // Allow specific origins including GitHub Pages
    const allowedOrigins = [
        'https://kimizk-dev.github.io',
        'http://localhost:3000',
        'http://localhost:8080',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:8080',
        'http://127.0.0.1:5500'
    ];
    
    // Check if the origin is in the allowed list
    if (origin && allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
        // Fallback to wildcard for development
        res.setHeader('Access-Control-Allow-Origin', '*');
    }
    
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization, X-Requested-With, Range');
    res.setHeader('Access-Control-Allow-Credentials', 'false');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.setHeader('Vary', 'Origin');
};

// Main Vercel serverless function for downloads
export default async function handler(req, res) {
    try {
        // Get origin from request headers
        const origin = req.headers.origin;
        
        console.log(`📥 Download request from origin: ${origin || 'no origin'}`);
        console.log(`📋 Request method: ${req.method}`);
        
        // Set CORS headers
        setCorsHeaders(res, origin);
        
        // Handle preflight OPTIONS request
        if (req.method === 'OPTIONS') {
            console.log('✅ Handling OPTIONS preflight request for download');
            res.status(204).end();
            return;
        }
    } catch (corsError) {
        console.error('❌ CORS setup error in download:', corsError);
        res.status(500).json({ error: 'CORS configuration error' });
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
    
    const downloadUrl = req.query.url;
    const filename = req.query.filename || 'download';
    const referer = req.query.referer;
    
    console.log(`📥 Download request: ${downloadUrl}`);
    
    if (!downloadUrl) {
        res.status(400).json({ 
            error: 'Missing required parameter: url (Download URL)',
            example: 'https://cors-kimizk.vercel.app/api/download?url=https://dl.snapcdn.app/get?token=...'
        });
        return;
    }
    
    try {
        // Parse the download URL
        const downloadUrlObj = url.parse(downloadUrl);
        const isHttps = downloadUrlObj.protocol === 'https:';
        const httpModule = isHttps ? https : http;
        const port = downloadUrlObj.port || (isHttps ? 443 : 80);
        
        const inboundRange = req.headers.range;

        const options = {
            hostname: downloadUrlObj.hostname,
            port: port,
            path: downloadUrlObj.path,
            method: 'GET',
            headers: {
                'Accept': '*/*',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
                'Referer': referer || `${downloadUrlObj.protocol}//${downloadUrlObj.hostname}/`,
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'identity',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                ...(inboundRange ? { 'Range': inboundRange } : {})
            }
        };
        
        console.log('🔄 Proxying download request...');
        
        // Create promise wrapper for the HTTP request
        await new Promise((resolve, reject) => {
            const downloadReq = httpModule.request(options, (downloadRes) => {
                console.log(`📊 Download response status: ${downloadRes.statusCode}`);
                
                // Handle redirects manually - follow redirect automatically
                if (downloadRes.statusCode >= 300 && downloadRes.statusCode < 400 && downloadRes.headers.location) {
                    console.log('🔄 Following redirect to:', downloadRes.headers.location);
                    
                    // Recursively follow redirect
                    const redirectUrl = downloadRes.headers.location;
                    
                    // Create new request for redirect URL
                    const redirectUrlObj = url.parse(redirectUrl);
                    const isRedirectHttps = redirectUrlObj.protocol === 'https:';
                    const redirectHttpModule = isRedirectHttps ? https : http;
                    const redirectPort = redirectUrlObj.port || (isRedirectHttps ? 443 : 80);
                    
                    const redirectOptions = {
                        hostname: redirectUrlObj.hostname,
                        port: redirectPort,
                        path: redirectUrlObj.path,
                        method: 'GET',
                        headers: {
                            'Accept': '*/*',
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
                            'Referer': referer || `${redirectUrlObj.protocol}//${redirectUrlObj.hostname}/`,
                            'Accept-Language': 'en-US,en;q=0.9',
                            'Cache-Control': 'no-cache',
                            'Connection': 'keep-alive',
                            ...(inboundRange ? { 'Range': inboundRange } : {})
                        }
                    };
                    
                    const redirectReq = redirectHttpModule.request(redirectOptions, (redirectRes) => {
                        console.log(`📊 Redirect response status: ${redirectRes.statusCode}`);
                        
                        // Set headers for final response
                        const contentType = redirectRes.headers['content-type'] || 'application/octet-stream';
                        const contentLength = redirectRes.headers['content-length'];
                        const contentRange = redirectRes.headers['content-range'];
                        const acceptRanges = redirectRes.headers['accept-ranges'];
                        
                        setCorsHeaders(res);
                        res.setHeader('Content-Type', contentType);
                        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
                        
                        if (contentLength) {
                            res.setHeader('Content-Length', contentLength);
                            console.log(`📦 File size: ${contentLength} bytes`);
                        }
                        if (contentRange) res.setHeader('Content-Range', contentRange);
                        if (acceptRanges) res.setHeader('Accept-Ranges', acceptRanges);
                        
                        res.status(redirectRes.statusCode);
                        
                        redirectRes.on('error', (streamError) => {
                            console.error('❌ Redirect stream error:', streamError.message);
                            if (!res.headersSent) {
                                res.status(500).json({ 
                                    error: 'Redirect stream error', 
                                    details: streamError.message 
                                });
                            }
                            reject(streamError);
                        });
                        
                        redirectRes.on('end', () => {
                            console.log('✅ Redirect download completed successfully');
                            resolve();
                        });
                        
                        redirectRes.pipe(res);
                    });
                    
                    redirectReq.on('error', (error) => {
                        console.error('❌ Redirect request error:', error.message);
                        res.status(500).json({ 
                            error: 'Redirect request failed', 
                            details: error.message 
                        });
                        reject(error);
                    });
                    
                    redirectReq.setTimeout(9000, () => {
                        console.error('⏰ Redirect request timeout');
                        redirectReq.abort();
                        if (!res.headersSent) {
                            res.status(408).json({ 
                                error: 'Redirect timeout', 
                                message: 'Redirect took too long' 
                            });
                        }
                        reject(new Error('Redirect Timeout'));
                    });
                    
                    redirectReq.end();
                    return;
                }
                
                // Set appropriate headers for file download
                const contentType = downloadRes.headers['content-type'] || 'application/octet-stream';
                const contentLength = downloadRes.headers['content-length'];
                const contentRange = downloadRes.headers['content-range'];
                const acceptRanges = downloadRes.headers['accept-ranges'];
                
                // Override CORS headers and set download headers
                setCorsHeaders(res);
                res.setHeader('Content-Type', contentType);
                res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
                
                if (contentLength) {
                    res.setHeader('Content-Length', contentLength);
                    console.log(`📦 File size: ${contentLength} bytes`);
                }
                if (contentRange) res.setHeader('Content-Range', contentRange);
                if (acceptRanges) res.setHeader('Accept-Ranges', acceptRanges);
                
                res.status(downloadRes.statusCode);
                
                // Pipe the response directly with error handling
                downloadRes.on('error', (streamError) => {
                    console.error('❌ Download stream error:', streamError.message);
                    if (!res.headersSent) {
                        res.status(500).json({ 
                            error: 'Stream error', 
                            details: streamError.message 
                        });
                    }
                    reject(streamError);
                });
                
                downloadRes.on('end', () => {
                    console.log('✅ Download completed successfully');
                    resolve();
                });
                
                downloadRes.pipe(res);
            });
            
            downloadReq.on('error', (error) => {
                console.error('❌ Download request error:', error.message);
                res.status(500).json({ 
                    error: 'Download request failed', 
                    details: error.message 
                });
                reject(error);
            });
            
            // Set timeout for Vercel (max 10s for hobby plan)
            downloadReq.setTimeout(9000, () => {
                console.error('⏰ Download request timeout (9 seconds)');
                downloadReq.abort();
                if (!res.headersSent) {
                    res.status(408).json({ 
                        error: 'Download timeout', 
                        message: 'File download took too long. Please try again with a smaller file.' 
                    });
                }
                reject(new Error('Timeout'));
            });
            
            downloadReq.end();
        });
        
    } catch (error) {
        console.error('❌ Download proxy error:', error.message);
        if (!res.headersSent) {
            res.status(500).json({ 
                error: 'Download proxy error', 
                details: error.message 
            });
        }
    }
}
