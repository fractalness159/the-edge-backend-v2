// Twitter/X OAuth 2.0 + posting proxy
// Uses Twitter API v2 Bearer token for search, OAuth 2.0 PKCE for posting
export const handler = async (event) => {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-twitter-token',
  }
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }

  const action = event.queryStringParameters?.action

  try {
    // ── OAUTH START: redirect user to Twitter auth ──────────────────────
    if (action === 'auth_url') {
      const clientId    = process.env.TWITTER_CLIENT_ID
      const redirectUri = process.env.TWITTER_REDIRECT_URI || `${process.env.URL}/.netlify/functions/twitter?action=callback`
      const state       = Math.random().toString(36).slice(2)
      const codeVerifier = Math.random().toString(36).repeat(3).slice(0, 43)
      // In production store codeVerifier in KV or cookie - simplified here
      const authUrl = `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=tweet.read%20tweet.write%20users.read&state=${state}&code_challenge=${codeVerifier}&code_challenge_method=plain`
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ auth_url: authUrl, code_verifier: codeVerifier }) }
    }

    // ── OAUTH CALLBACK: exchange code for token ─────────────────────────
    if (action === 'callback') {
      const code         = event.queryStringParameters?.code
      const codeVerifier = event.queryStringParameters?.code_verifier || event.headers['x-code-verifier']
      const redirectUri  = process.env.TWITTER_REDIRECT_URI || `${process.env.URL}/.netlify/functions/twitter?action=callback`
      const clientId     = process.env.TWITTER_CLIENT_ID
      const clientSecret = process.env.TWITTER_CLIENT_SECRET

      const res = await fetch('https://api.twitter.com/2/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
        },
        body: new URLSearchParams({ code, grant_type: 'authorization_code', redirect_uri: redirectUri, code_verifier: codeVerifier }).toString(),
      })
      const data = await res.json()
      // Return token to frontend — frontend stores it in localStorage
      return { statusCode: 200, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(data) }
    }

    // ── POST TWEET ──────────────────────────────────────────────────────
    if (action === 'tweet' && event.httpMethod === 'POST') {
      const token = event.headers['x-twitter-token']
      const body  = JSON.parse(event.body || '{}')
      if (!token) return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Missing twitter token' }) }
      const res = await fetch('https://api.twitter.com/2/tweets', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: body.text }),
      })
      const data = await res.json()
      return { statusCode: res.status, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(data) }
    }

    // ── GET USER INFO ───────────────────────────────────────────────────
    if (action === 'me') {
      const token = event.headers['x-twitter-token']
      const res = await fetch('https://api.twitter.com/2/users/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      return { statusCode: res.status, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(data) }
    }

    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: `Unknown action: ${action}` }) }
  } catch (err) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) }
  }
}
