export const handler = async (event) => {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }

  const query     = event.queryStringParameters?.query || 'futures trading'
  const subreddit = event.queryStringParameters?.subreddit || 'Daytrading'
  const limit     = parseInt(event.queryStringParameters?.limit || '25')

  // Trading-specific subreddits to scan
  const TRADING_SUBS = [
    'Daytrading', 'Futures', 'CryptoTrading', 'algotrading', 
    'StocksAndTrading', 'FuturesTrading', 'TradingView', 'CryptoCurrency'
  ]

  const results: any[] = []
  const seen = new Set()

  // Scan multiple subreddits
  const subsToScan = subreddit === 'all' ? TRADING_SUBS : [subreddit]

  for (const sub of subsToScan.slice(0, 3)) {
    try {
      // Try hot posts first (more reliable than search)
      const urls = [
        `https://www.reddit.com/r/${sub}/hot.json?limit=${limit}`,
        `https://www.reddit.com/r/${sub}/new.json?limit=${limit}`,
      ]

      for (const url of urls) {
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept': 'application/json',
          }
        })

        if (!res.ok) continue
        const data = await res.json()
        const posts = data?.data?.children?.map((c: any) => c.data) || []

        for (const post of posts) {
          if (!post.author || post.author === '[deleted]' || post.author === 'AutoModerator') continue
          if (seen.has(post.author)) continue

          // Quality filters — only keep posts relevant to trading
          const text = `${post.title} ${post.selftext}`.toLowerCase()
          const isRelevant = (
            text.includes('trade') || text.includes('trading') ||
            text.includes('future') || text.includes('crypto') ||
            text.includes('btc') || text.includes('nq') ||
            text.includes('reversal') || text.includes('setup') ||
            text.includes('long') || text.includes('short') ||
            text.includes('pnl') || text.includes('profit') ||
            text.includes('loss') || text.includes('entry') ||
            text.includes('scalp') || text.includes('swing')
          )

          if (!isRelevant && sub === 'all') continue

          seen.add(post.author)
          results.push({
            id: post.id,
            username: post.author,
            platform: 'Reddit',
            source: `r/${post.subreddit || sub}`,
            title: post.title?.slice(0, 100) || '',
            preview: post.selftext?.slice(0, 150) || post.title?.slice(0, 150) || '',
            score: post.score || 0,
            comments: post.num_comments || 0,
            engagement: (post.score || 0) + (post.num_comments || 0),
            profileUrl: `https://reddit.com/u/${post.author}`,
            postUrl: `https://reddit.com${post.permalink}`,
            created: new Date((post.created_utc || Date.now()/1000) * 1000).toISOString().slice(0,10),
            status: (post.score > 20 || post.num_comments > 5) ? 'hot' : post.score > 5 ? 'warm' : 'cold',
          })
        }
        if (results.length >= limit) break
      }
    } catch (err) {
      console.log(`Error scraping r/${sub}:`, err)
    }
  }

  // Sort by engagement
  results.sort((a, b) => b.engagement - a.engagement)

  return {
    statusCode: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      users: results.slice(0, limit), 
      total: results.length,
      subreddits_scanned: subsToScan.slice(0, 3),
    }),
  }
}
