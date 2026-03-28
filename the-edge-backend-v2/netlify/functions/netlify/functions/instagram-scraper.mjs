// Instagram trading hashtag scraper via public API
export const handler = async (event) => {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }

  const hashtag = (event.queryStringParameters?.hashtag || 'futurestradng').replace('#','')
  const count   = parseInt(event.queryStringParameters?.count || '20')

  try {
    // Instagram public hashtag endpoint
    const res = await fetch(
      `https://www.instagram.com/explore/tags/${hashtag}/?__a=1&__d=dis`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
          'Accept': 'application/json',
          'X-IG-App-ID': '936619743392459',
        }
      }
    )

    if (!res.ok) throw new Error(`Instagram error ${res.status}`)
    const data = await res.json()
    const edges = data?.graphql?.hashtag?.edge_hashtag_to_media?.edges || 
                  data?.data?.top?.sections || []

    const seen = new Set()
    const users: any[] = []

    for (const edge of edges.slice(0, count * 2)) {
      const node = edge.node || edge
      const owner = node.owner || node.media?.owner
      if (!owner || seen.has(owner.id)) continue
      seen.add(owner.id)

      // Extract email from bio if available
      const bio = owner.biography || ''
      const emailMatch = bio.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/)

      users.push({
        id: owner.id,
        username: owner.username,
        name: owner.full_name || owner.username,
        description: bio,
        followers: owner.edge_followed_by?.count || 0,
        platform: 'Instagram',
        profileUrl: `https://instagram.com/${owner.username}`,
        email: emailMatch ? emailMatch[0] : null,
        status: (owner.edge_followed_by?.count || 0) > 10000 ? 'hot' :
                (owner.edge_followed_by?.count || 0) > 1000 ? 'warm' : 'cold',
      })

      if (users.length >= count) break
    }

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ users, total: users.length, hashtag }),
    }
  } catch (err: any) {
    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        users: [], total: 0, error: err.message,
        note: 'Instagram blocks server requests. Consider Phantombuster for reliable Instagram scraping.'
      }),
    }
  }
}
