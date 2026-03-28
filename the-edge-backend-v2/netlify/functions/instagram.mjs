// Instagram Graph API proxy (requires Facebook Business account)
export const handler = async (event) => {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-ig-token, x-ig-account-id',
  }
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }

  const action    = event.queryStringParameters?.action
  const token     = event.headers['x-ig-token']
  const accountId = event.headers['x-ig-account-id']

  try {
    // ── OAUTH START ─────────────────────────────────────────────────────
    if (action === 'auth_url') {
      const appId      = process.env.INSTAGRAM_APP_ID
      const redirectUri = process.env.INSTAGRAM_REDIRECT_URI || `${process.env.URL}/.netlify/functions/instagram?action=callback`
      const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement`
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ auth_url: authUrl }) }
    }

    // ── OAUTH CALLBACK ─────────────────────────────────────────────────
    if (action === 'callback') {
      const code       = event.queryStringParameters?.code
      const appId      = process.env.INSTAGRAM_APP_ID
      const appSecret  = process.env.INSTAGRAM_APP_SECRET
      const redirectUri = process.env.INSTAGRAM_REDIRECT_URI || `${process.env.URL}/.netlify/functions/instagram?action=callback`

      const res = await fetch(`https://graph.facebook.com/v18.0/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`)
      const data = await res.json()
      return { statusCode: 200, headers: CORS, body: JSON.stringify(data) }
    }

    // ── POST IMAGE/CAPTION ──────────────────────────────────────────────
    if (action === 'post' && event.httpMethod === 'POST') {
      if (!token || !accountId) return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Missing token or account ID' }) }
      const body = JSON.parse(event.body || '{}')

      // Step 1: create container
      const containerRes = await fetch(`https://graph.facebook.com/v18.0/${accountId}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caption: body.caption, image_url: body.image_url, access_token: token }),
      })
      const container = await containerRes.json()
      if (!container.id) return { statusCode: 400, headers: CORS, body: JSON.stringify(container) }

      // Step 2: publish container
      const publishRes = await fetch(`https://graph.facebook.com/v18.0/${accountId}/media_publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creation_id: container.id, access_token: token }),
      })
      const pub = await publishRes.json()
      return { statusCode: publishRes.status, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(pub) }
    }

    // ── GET ACCOUNTS ────────────────────────────────────────────────────
    if (action === 'accounts') {
      if (!token) return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Missing token' }) }
      const res = await fetch(`https://graph.facebook.com/v18.0/me/accounts?access_token=${token}`)
      const data = await res.json()
      return { statusCode: 200, headers: CORS, body: JSON.stringify(data) }
    }

    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: `Unknown action: ${action}` }) }
  } catch (err) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) }
  }
}
