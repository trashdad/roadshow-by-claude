/**
 * Netlify Function: lastfm-auth
 *
 * Exchanges a Last.fm OAuth token for a session key, keeping the Shared Secret
 * server-side so it is never exposed to the browser.
 *
 * POST /api/lastfm-auth
 * Body: { "token": "<token from Last.fm callback>" }
 * Returns: Last.fm auth.getSession JSON response (session key + username)
 *
 * Required environment variables (Netlify Dashboard → Environment):
 *   LASTFM_API_KEY        — your Last.fm API key (public, also used client-side)
 *   LASTFM_SHARED_SECRET  — your Last.fm Shared Secret (NEVER expose this client-side)
 */
const https = require('https');
const crypto = require('crypto');

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

  const API_KEY = process.env.LASTFM_API_KEY;
  const SECRET  = process.env.LASTFM_SHARED_SECRET;

  if (!API_KEY || !SECRET) {
    return {
      statusCode: 503,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Last.fm credentials not configured on the server.' }),
    };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Invalid JSON body.' }) };
  }

  const { token } = body;
  if (!token || typeof token !== 'string') {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: '"token" is required.' }) };
  }

  // Build the api_sig: sort params alphabetically, concatenate key+value, append secret, MD5
  const sigParams = { api_key: API_KEY, method: 'auth.getSession', token };
  const sigStr = Object.keys(sigParams).sort().map(k => k + sigParams[k]).join('') + SECRET;
  const api_sig = crypto.createHash('md5').update(sigStr, 'utf8').digest('hex');

  const url = 'https://ws.audioscrobbler.com/2.0/?method=auth.getSession' +
    `&api_key=${encodeURIComponent(API_KEY)}` +
    `&token=${encodeURIComponent(token)}` +
    `&api_sig=${api_sig}` +
    '&format=json';

  return new Promise((resolve) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        resolve({ statusCode: 200, headers: corsHeaders, body: data });
      });
    }).on('error', (err) => {
      resolve({
        statusCode: 502,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Failed to reach Last.fm: ' + err.message }),
      });
    });
  });
};
