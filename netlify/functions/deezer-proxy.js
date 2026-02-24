/**
 * Netlify Function: deezer-proxy
 *
 * Proxies requests to Deezer's internal gateway (gw-light.php) server-side,
 * injecting the user's ARL as a Cookie header. This bypasses the browser's
 * CORS restriction — Deezer's internal API doesn't allow cross-origin requests,
 * but server-to-server calls are unrestricted.
 *
 * The client passes the ARL in the X-Deezer-ARL request header rather than
 * relying on a browser cookie, since cookies can't be forwarded cross-origin.
 *
 * Route: /deezer-proxy?<query> → https://www.deezer.com/ajax/gw-light.php?<query>
 */

const https = require('https');

exports.handler = async (event) => {
  // Handle CORS preflight so the browser proceeds with the real POST
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Deezer-ARL',
      },
      body: '',
    };
  }

  const arl = event.headers['x-deezer-arl'] || '';

  // Reconstruct the query string forwarded from the client
  const qs = event.rawQuery
    ? '?' + event.rawQuery
    : Object.keys(event.queryStringParameters || {}).length
    ? '?' + new URLSearchParams(event.queryStringParameters).toString()
    : '';

  // Decode body first so we can set Content-Length before opening the request.
  // Without Content-Length, Node.js uses chunked transfer encoding which
  // Deezer's internal gw-light.php rejects with GATEWAY_ERROR.
  const bodyStr = event.body
    ? (event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body)
    : '';
  const bodyBytes = Buffer.byteLength(bodyStr, 'utf8');

  return new Promise((resolve) => {
    const options = {
      hostname: 'www.deezer.com',
      path: '/ajax/gw-light.php' + qs,
      method: 'POST',
      headers: {
        'Content-Type': event.headers['content-type'] || 'text/plain;charset=UTF-8',
        'Content-Length': bodyBytes,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Origin': 'https://www.deezer.com',
        'Referer': 'https://www.deezer.com/',
        ...(arl && { Cookie: `arl=${arl}` }),
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body,
        });
      });
    });

    req.on('error', (err) => {
      resolve({
        statusCode: 502,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Proxy error: ' + err.message }),
      });
    });

    if (bodyStr) req.write(bodyStr, 'utf8');
    req.end();
  });
};
