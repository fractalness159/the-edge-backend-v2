// Twitter lead scraper proxy via SocialData.tools
export const handler = async (event) => {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-sd-key',
  }
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }

  const sdKey  = event.headers['x-sd-key'] || process.env.SOCIALDATA_KEY
  const query  = event.queryStringParameters?.query || 'crypto futures trading'
  const count  = event.queryStringParameters?.count || '20'

  if (!sdKey) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'SocialData API key required' }) }

  try {
    const res = await fetch(
      `https://api.socialdata.tools/twitter/search?query=${encodeURIComponent(query)}&type=Latest&count=${count}`,
      { headers: { 'Authorization': `Bearer ${sdKey}`, 'Accept': 'application/json' } }
    )
    const data = await res.json()

    if (!res.ok) {
      return { statusCode: res.status, headers: CORS, body: JSON.stringify({ error: data.message || `SocialData error ${res.status}` }) }
    }

    // Extract unique users from tweets
    const users = new Map()
    for (const tweet of (data.tweets || [])) {
      const u = tweet.user
      if (u && !users.has(u.id_str)) {
        users.set(u.id_str, {
          id: u.id_str,
          username: u.screen_name,
          name: u.name,
          description: u.description || '',
          followers_count: u.followers_count || 0,
          following_count: u.friends_count || 0,
          tweet_count: u.statuses_count || 0,
          verified: u.verified || false,
          profile_image_url: u.profile_image_url_https,
          location: u.location || '',
        })
      }
    }

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ users: Array.from(users.values()), total: users.size }),
    }
  } catch (err) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) }
  }
}
