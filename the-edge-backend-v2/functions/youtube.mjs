// YouTube channel scraper — finds trading channels and extracts public contact info
export const handler = async (event) => {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-yt-key',
  }
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }

  const apiKey = event.headers['x-yt-key'] || process.env.YOUTUBE_API_KEY
  const query  = event.queryStringParameters?.query || 'crypto futures trading'
  const limit  = event.queryStringParameters?.limit || '20'

  if (!apiKey) return {
    statusCode: 400, headers: CORS,
    body: JSON.stringify({ error: 'YouTube API key required. Get free key at console.cloud.google.com → YouTube Data API v3' })
  }

  try {
    // Step 1: Search for channels
    const searchRes = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=channel&maxResults=${limit}&key=${apiKey}`
    )
    if (!searchRes.ok) {
      const err = await searchRes.json()
      throw new Error(err.error?.message || `YouTube search error ${searchRes.status}`)
    }
    const searchData = await searchRes.json()
    const channelIds = searchData.items?.map((i) => i.snippet.channelId).join(',') || ''

    if (!channelIds) return {
      statusCode: 200, headers: CORS,
      body: JSON.stringify({ users: [], total: 0 })
    }

    // Step 2: Get channel details including email from description
    const detailRes = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,brandingSettings&id=${channelIds}&key=${apiKey}`
    )
    const detailData = await detailRes.json()

    const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g

    const users = (detailData.items || []).map((ch) => {
      const desc = ch.snippet.description || ''
      const emails = desc.match(emailRegex) || []
      const subs = parseInt(ch.statistics?.subscriberCount || '0')

      return {
        username:      ch.snippet.title,
        platform:      'YouTube',
        channelId:     ch.id,
        description:   desc.slice(0, 200),
        subscribers:   subs,
        videoCount:    ch.statistics?.videoCount || 0,
        emails:        emails, // publicly listed emails from their About page
        email:         emails[0] || null,
        profileUrl:    `https://youtube.com/channel/${ch.id}`,
        country:       ch.snippet.country || '',
        status:        subs > 10000 ? 'hot' : subs > 1000 ? 'warm' : 'cold',
        hasEmail:      emails.length > 0,
      }
    })

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ users, total: users.length, withEmail: users.filter(u => u.hasEmail).length }),
    }
  } catch (err) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) }
  }
}
