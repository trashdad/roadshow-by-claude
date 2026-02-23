/**
 * Netlify Function: config
 *
 * Exposes non-secret public configuration to the frontend so users can
 * authorize with Spotify and Last.fm without creating their own developer apps.
 *
 * Set these environment variables in Netlify Dashboard → Site settings → Environment:
 *   SPOTIFY_CLIENT_ID     — from developer.spotify.com (add site URL as redirect URI)
 *   LASTFM_API_KEY        — from last.fm/api/account/create
 *
 * Note: the Last.fm Shared Secret stays SERVER-SIDE only (in lastfm-auth.js).
 */
exports.handler = async () => {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
    body: JSON.stringify({
      spotifyClientId: process.env.SPOTIFY_CLIENT_ID || '',
      lastfmApiKey: process.env.LASTFM_API_KEY || '',
    }),
  };
};
