// TikTok scraper via public API — no auth needed
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
    // TikTok public hashtag API
    const res = await fetch(
      `https://www.tiktok.com/api/challenge/item_list/?challengeName=${encodeURIComponent(hashtag)}&count=${count}&cursor=0`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Referer': `https://www.tiktok.com/tag/${hashtag}`,
        }
      }
    )

    if (!res.ok) throw new Error(`TikTok error ${res.status}`)
    const data = await res.json()
    const items = data.itemList || data.items || []

    const seen = new Set()
    const users = items
      .filter((item: any) => item.author && !seen.has(item.author.uniqueId) && seen.add(item.author.uniqueId))
      .map((item: any) => ({
        id: item.author.id,
        username: item.author.uniqueId,
        name: item.author.nickname,
        description: item.author.signature || '',
        followers: item.authorStats?.followerCount || item.author.followerCount || 0,
        likes: item.authorStats?.heartCount || 0,
        platform: 'TikTok',
        profileUrl: `https://www.tiktok.com/@${item.author.uniqueId}`,
        videoViews: item.stats?.playCount || 0,
        status: (item.authorStats?.followerCount || 0) > 10000 ? 'hot' : 
                (item.authorStats?.followerCount || 0) > 1000 ? 'warm' : 'cold',
      }))

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ users, total: users.length, hashtag }),
    }
  } catch (err: any) {
    // Fallback: return structured error with helpful message
    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        users: [], 
        total: 0, 
        error: err.message,
        note: 'TikTok blocks server scraping. Use SocialData for TikTok or switch to Twitter.' 
      }),
    }
  }
}
