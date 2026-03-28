// Reddit scraper — uses Reddit's public JSON API (no key needed)
export const handler = async (event) => {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }

  const subreddit = event.queryStringParameters?.subreddit || 'Daytrading'
  const query     = event.queryStringParameters?.query || 'futures crypto'
  const limit     = event.queryStringParameters?.limit || '25'

  try {
    // Reddit public search API — no auth needed
    const searchUrl = `https://www.reddit.com/r/${subreddit}/search.json?q=${encodeURIComponent(query)}&restrict_sr=1&sort=new&limit=${limit}`
    const res = await fetch(searchUrl, {
      headers: { 'User-Agent': 'TheEdgeCRM/1.0' }
    })

    if (!res.ok) throw new Error(`Reddit error ${res.status}`)
    const data = await res.json()

    const posts = (data?.data?.children || []).map((p) => {
      const post = p.data
      return {
        id:        post.id,
        username:  post.author,
        title:     post.title,
        body:      post.selftext?.slice(0, 200) || '',
        score:     post.score,
        comments:  post.num_comments,
        subreddit: post.subreddit,
        url:       `https://reddit.com${post.permalink}`,
        created:   new Date(post.created_utc * 1000).toISOString().slice(0, 10),
        flair:     post.link_flair_text || '',
      }
    }).filter(p => p.username !== '[deleted]' && p.username !== 'AutoModerator')

    // Deduplicate by username — get unique posters
    const seen = new Set()
    const users = posts.filter(p => {
      if (seen.has(p.username)) return false
      seen.add(p.username)
      return true
    }).map(p => ({
      username:    p.username,
      platform:    'Reddit',
      source:      `r/${p.subreddit}`,
      title:       p.title,
      preview:     p.body,
      engagement:  p.score + p.comments,
      profileUrl:  `https://reddit.com/u/${p.username}`,
      postUrl:     p.url,
      created:     p.created,
      // Score lead quality based on engagement + content
      status:      p.score > 50 || p.comments > 10 ? 'hot' : p.score > 10 ? 'warm' : 'cold',
    }))

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ users, total: users.length, subreddit }),
    }
  } catch (err) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) }
  }
}
