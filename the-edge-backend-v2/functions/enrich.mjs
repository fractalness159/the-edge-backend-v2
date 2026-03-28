// Email enrichment via Apollo.io — finds emails from name/domain
// Free tier: 50 credits/month
export const handler = async (event) => {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-apollo-key',
  }
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: 'POST only' }

  const apolloKey = event.headers['x-apollo-key'] || process.env.APOLLO_KEY
  if (!apolloKey) return {
    statusCode: 400, headers: CORS,
    body: JSON.stringify({ error: 'Apollo API key required. Get free at apollo.io (50 emails/month free)' })
  }

  const { name, domain, linkedin_url } = JSON.parse(event.body || '{}')
  if (!name) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'name required' }) }

  try {
    const res = await fetch('https://api.apollo.io/api/v1/people/match', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apolloKey,
      },
      body: JSON.stringify({
        name,
        domain: domain || undefined,
        linkedin_url: linkedin_url || undefined,
        reveal_personal_emails: true,
      }),
    })

    const data = await res.json()
    if (!res.ok) throw new Error(data.message || `Apollo error ${res.status}`)

    const person = data.person || {}
    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email:       person.email || null,
        emails:      person.personal_emails || [],
        name:        person.name,
        title:       person.title,
        linkedin:    person.linkedin_url,
        twitter:     person.twitter_url,
        found:       !!person.email,
      }),
    }
  } catch (err) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) }
  }
}
