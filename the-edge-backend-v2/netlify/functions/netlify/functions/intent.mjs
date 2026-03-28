// Intent signal scraper — finds traders actively expressing pain/need
// These are your highest-converting leads
export const handler = async (event) => {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-sd-key',
  }
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }

  const sdKey = event.headers['x-sd-key'] || process.env.SOCIALDATA_KEY
  if (!sdKey) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'SocialData key required' }) }

  // High-intent pain signals — people who NEED what Jose offers
  const INTENT_QUERIES = [
    'blown account futures need help',
    'losing money futures trading consistency',
    'tired of losing trades crypto futures',
    'need better entries futures NQ',
    'looking for trading mentor futures',
    'frustrated with trading results futures',
    'want to learn reversal levels futures',
    'keep missing entries crypto futures',
    'need a real trading edge futures',
    'how do I stop losing money futures',
  ]

  const seen = new Set()
  const leads: any[] = []

  for (const query of INTENT_QUERIES.slice(0, 5)) {
    try {
      const res = await fetch(
        `https://api.socialdata.tools/twitter/search?query=${encodeURIComponent(query)}&type=Latest&count=10`,
        { headers: { 'Authorization': `Bearer ${sdKey}`, 'Accept': 'application/json' } }
      )
      if (!res.ok) continue
      const data = await res.json()

      for (const tweet of (data.tweets || [])) {
        const u = tweet.user
        if (!u || seen.has(u.id_str)) continue
        seen.add(u.id_str)

        // Score intent — higher = more likely to buy
        const tweetText = (tweet.full_text || tweet.text || '').toLowerCase()
        let intentScore = 5 // base for matching query
        if (tweetText.includes('need') || tweetText.includes('help')) intentScore += 2
        if (tweetText.includes('lost') || tweetText.includes('blow')) intentScore += 2
        if (tweetText.includes('frustrat') || tweetText.includes('tired')) intentScore += 2
        if (tweetText.includes('mentor') || tweetText.includes('community')) intentScore += 3
        if (tweetText.includes('$200') || tweetText.includes('pay')) intentScore -= 1

        leads.push({
          id: u.id_str,
          username: u.screen_name,
          name: u.name,
          description: u.description || '',
          followers: u.followers_count,
          platform: 'Twitter',
          profileUrl: `https://twitter.com/${u.screen_name}`,
          intentTweet: tweet.full_text || tweet.text || '',
          intentQuery: query,
          intentScore,
          tweetUrl: `https://twitter.com/${u.screen_name}/status/${tweet.id_str}`,
          tweetDate: tweet.created_at,
          status: intentScore >= 9 ? 'hot' : intentScore >= 7 ? 'warm' : 'cold',
          // DM hook based on their tweet
          suggestedDm: `Hey ${u.name.split(' ')[0]} — saw your tweet about "${tweetText.slice(0,50)}...". I run a private futures community where we call exact reversal levels. Worth a convo?`,
        })
      }
    } catch (err) {
      console.log(`Query failed: ${query}`, err)
    }
  }

  // Sort by intent score
  leads.sort((a, b) => b.intentScore - a.intentScore)

  return {
    statusCode: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      leads: leads.slice(0, 30),
      total: leads.length,
      scanned_queries: INTENT_QUERIES.slice(0, 5),
      timestamp: new Date().toISOString(),
    }),
  }
}
