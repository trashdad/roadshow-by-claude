/**
 * Netlify Function: deezer-auth
 *
 * Exchanges a Deezer OAuth authorization code for an access token,
 * keeping the App Secret server-side.
 *
 * POST /api/deezer-auth
 * Body: { "code": "<code from Deezer callback>", "redirect_uri": "<callback URL>" }
 * Returns: { "access_token": "...", "user_name": "..." }
 *
 * Required environment variables (Netlify Dashboard → Environment):
 *   DEEZER_APP_ID      — from developers.deezer.com
 *   DEEZER_APP_SECRET   — from developers.deezer.com (NEVER expose client-side)
 */
const https = require('https');

exports.handler = async (event) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const APP_ID = process.env.DEEZER_APP_ID;
  const SECRET = process.env.DEEZER_APP_SECRET;

  if (!APP_ID || !SECRET) {
    return {
      statusCode: 503,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Deezer credentials not configured on the server.' }),
    };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Invalid JSON body.' }) };
  }

  const { code } = body;
  if (!code || typeof code !== 'string') {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: '"code" is required.' }) };
  }

  // Step 1: Exchange code for access token
  const tokenUrl = `https://connect.deezer.com/oauth/access_token.php` +
    `?app_id=${encodeURIComponent(APP_ID)}` +
    `&secret=${encodeURIComponent(SECRET)}` +
    `&code=${encodeURIComponent(code)}` +
    `&output=json`;

  let tokenData;
  try {
    tokenData = await httpGet(tokenUrl);
  } catch (e) {
    return {
      statusCode: 502,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to reach Deezer token endpoint: ' + e.message }),
    };
  }

  if (tokenData.error) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Deezer token exchange failed: ' + (tokenData.error.message || JSON.stringify(tokenData.error)) }),
    };
  }

  const accessToken = tokenData.access_token;
  if (!accessToken) {
    return {
      statusCode: 502,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Deezer did not return an access token. Response: ' + JSON.stringify(tokenData).slice(0, 200) }),
    };
  }

  // Step 2: Fetch user profile to return username
  let userName = '';
  try {
    const userData = await httpGet('https://api.deezer.com/user/me?access_token=' + encodeURIComponent(accessToken));
    userName = userData.name || userData.firstname || '';
  } catch (e) {
    // Non-fatal: token is valid even if we can't fetch the profile
    console.warn('Could not fetch Deezer user profile:', e.message);
  }

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      access_token: accessToken,
      expires: tokenData.expires || null,
      user_name: userName,
    }),
  };
};

// Simple HTTPS GET that returns parsed JSON (handles both JSON and URL-encoded responses)
function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          // Deezer's token endpoint may return URL-encoded body instead of JSON
          // when output=json is not supported; handle both
          if (data.startsWith('{') || data.startsWith('[')) {
            resolve(JSON.parse(data));
          } else {
            // Parse URL-encoded: access_token=xxx&expires=yyy
            const params = new URLSearchParams(data);
            const obj = {};
            for (const [k, v] of params) obj[k] = v;
            resolve(obj);
          }
        } catch (e) {
          reject(new Error('Failed to parse response: ' + data.slice(0, 200)));
        }
      });
    }).on('error', reject);
  });
}
