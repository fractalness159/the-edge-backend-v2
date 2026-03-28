export const handler = async (event) => {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-whop-key, x-company-id',
  }
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }

  const apiKey    = event.headers['x-whop-key']
  const companyId = event.headers['x-company-id']

  if (!apiKey)    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'x-whop-key header required' }) }
  if (!companyId) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'x-company-id header required' }) }

  const results = []

  const attempts = [
    { label: 'v5-company-members',      url: `https://api.whop.com/api/v5/company/${companyId}/members` },
    { label: 'v5-company-memberships',  url: `https://api.whop.com/api/v5/company/${companyId}/memberships` },
    { label: 'v1-memberships',          url: `https://api.whop.com/api/v1/memberships?company_id=${companyId}` },
    { label: 'v2-memberships',          url: `https://api.whop.com/api/v2/memberships?company_id=${companyId}` },
    { label: 'v5-app-members',          url: `https://api.whop.com/api/v5/app/members?company_id=${companyId}` },
  ]

  for (const { label, url } of attempts) {
    try {
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' },
      })
      const text = await res.text()
      results.push({ label, url, status: res.status, body: text.slice(0, 300) })

      if (res.ok && text && text.trim()) {
        try {
          const data = JSON.parse(text)
          const members = data.data || data.members || data.results || data || []
          return {
            statusCode: 200,
            headers: { ...CORS, 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: Array.isArray(members) ? members : [members], _endpoint: label }),
          }
        } catch {}
      }
    } catch (err) {
      results.push({ label, url, error: err.message })
    }
  }

  return {
    statusCode: 500,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: 'All Whop endpoints failed', debug: results }),
  }
}
