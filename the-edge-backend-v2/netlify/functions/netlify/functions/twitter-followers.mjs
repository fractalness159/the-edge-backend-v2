// Twitter follower scraper — finds followers of big trading accounts
// Uses SocialData API to search tweets from followers of target accounts
export const handler = async (event) => {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-sd-key',
  }
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }

  const sdKey   = event.headers['x-sd-key'] || process.env.SOCIALDATA_KEY
  const account = event.queryStringParameters?.account || 'investopedia'
  const count   = parseInt(event.queryStringParameters?.count || '20')

  if (!sdKey) return {
    statusCode: 400, headers: CORS,
    body: JSON.stringify({ error: 'SocialData API key required' })
  }

  try {
    // Search for people who engage with/mention the target account
    const queries = [
      `@${account} futures trading`,
      `@${account} crypto trade`,
      `"${account}" trading setup`,
    ]

    const seen = new Set()
    const users = []

    for (const query of queries) {
      const res = await fetch(
        `https://api.socialdata.tools/twitter/search?query=${encodeURIComponent(query)}&type=Latest&count=${Math.ceil(count/queries.length)}`,
        { headers: { 'Authorization': `Bearer ${sdKey}`, 'Accept': 'application/json' } }
      )
      if (!res.ok) continue
      const data = await res.json()
      
      for (const tweet of (data.tweets || [])) {
        const u = tweet.user
        if (!u || seen.has(u.id_str) || u.screen_name === account) continue
        seen.add(u.id_str)
        
        // Quality filter
        if (u.followers_count < 100) continue
        
        const bio = (u.description || '').toLowerCase()
        const score = (bio.includes('trad') ? 2 : 0) + 
                      (bio.includes('futur') ? 2 : 0) +
                      (bio.includes('crypto') ? 1 : 0) +
                      (u.followers_count > 1000 ? 2 : 1)

        users.push({
          id: u.id_str,
          username: u.screen_name,
          name: u.name,
          description: u.description || '',
          followers: u.followers_count,
          platform: 'Twitter',
          profileUrl: `https://twitter.com/${u.screen_name}`,
          engagesWith: account,
          score,
          status: score >= 5 ? 'hot' : score >= 3 ? 'warm' : 'cold',
        })
      }
      if (users.length >= count) break
    }

    users.sort((a, b) => b.score - a.score)

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ users: users.slice(0, count), total: users.length, account }),
    }
  } catch (err: any) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) }
  }
}
