// Google search scraper — finds trading blogs/sites with contact emails
export const handler = async (event) => {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-google-key, x-google-cx',
  }
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }

  const googleKey = event.headers['x-google-key'] || process.env.GOOGLE_API_KEY
  const googleCx  = event.headers['x-google-cx'] || process.env.GOOGLE_CX
  const query     = event.queryStringParameters?.query || 'crypto futures trading blog contact email'
  const count     = Math.min(parseInt(event.queryStringParameters?.count || '10'), 10)

  if (!googleKey || !googleCx) {
    // Fallback: use DuckDuckGo instant answers (no key needed)
    try {
      const res = await fetch(
        `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&t=TheEdgeCRM`,
        { headers: { 'User-Agent': 'TheEdgeCRM/1.0' } }
      )
      const data = await res.json()
      const results = (data.Results || data.RelatedTopics || []).slice(0, count).map((r: any) => ({
        title: r.Text || r.FirstURL,
        url: r.FirstURL || r.URL,
        platform: 'Web',
        status: 'cold',
      }))
      return {
        statusCode: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          users: results, total: results.length,
          note: 'Using DuckDuckGo. Add Google Custom Search API for better results.'
        }),
      }
    } catch (e: any) {
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: e.message }) }
    }
  }

  try {
    // Google Custom Search API
    const res = await fetch(
      `https://www.googleapis.com/customsearch/v1?key=${googleKey}&cx=${googleCx}&q=${encodeURIComponent(query)}&num=${count}`
    )
    const data = await res.json()
    const items = data.items || []

    const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g

    const users = items.map((item: any) => {
      const text = `${item.title} ${item.snippet}`
      const emails = text.match(emailRegex) || []
      return {
        id: item.link,
        username: item.displayLink,
        name: item.title,
        description: item.snippet,
        email: emails[0] || null,
        url: item.link,
        platform: 'Web',
        profileUrl: item.link,
        status: emails.length > 0 ? 'hot' : 'cold',
      }
    })

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ users, total: users.length, withEmail: users.filter((u: any) => u.email).length }),
    }
  } catch (err: any) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) }
  }
}
