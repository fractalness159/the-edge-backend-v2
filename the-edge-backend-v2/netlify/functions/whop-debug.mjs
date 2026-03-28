// Debug endpoint — shows exactly what Whop returns for your account
export const handler = async (event) => {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-whop-key, x-company-id',
  }
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }

  const apiKey    = event.headers['x-whop-key']
  const companyId = event.headers['x-company-id']

  if (!apiKey || !companyId) return { 
    statusCode: 400, headers: CORS, 
    body: JSON.stringify({ error: 'x-whop-key and x-company-id required' }) 
  }

  const results: any = {}

  // Try every possible endpoint and show raw response
  const endpoints = [
    { key: 'v5_members',           url: `https://api.whop.com/api/v5/company/${companyId}/members?pagination[per]=5` },
    { key: 'v5_memberships',       url: `https://api.whop.com/api/v5/company/${companyId}/memberships?pagination[per]=5` },
    { key: 'v5_memberships_active',url: `https://api.whop.com/api/v5/company/${companyId}/memberships?status=active&pagination[per]=5` },
    { key: 'v1_active',            url: `https://api.whop.com/api/v1/memberships?company_id=${companyId}&status=active&per=5` },
  ]

  for (const { key, url } of endpoints) {
    try {
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' }
      })
      const text = await res.text()
      let data: any = {}
      try { data = JSON.parse(text) } catch { data = { raw: text.slice(0, 200) } }
      
      const items = data.data || data.members || data.results || []
      results[key] = {
        status: res.status,
        total: items.length,
        // Show status field for first 5 members
        statuses: Array.isArray(items) ? items.slice(0,5).map((m: any) => ({
          id: m.id,
          status: m.status || m.membership_status || 'UNKNOWN',
          email: m.user?.email || m.email || 'no email',
          name: m.user?.name || m.user?.username || m.name || 'unknown',
          price: m.plan?.price_per_period || m.plan?.price || m.renewal_price || 'no price',
          plan: m.plan?.name || 'no plan name',
        })) : [],
        pagination: data.pagination || data.meta || null,
      }
    } catch (err: any) {
      results[key] = { error: err.message }
    }
  }

  return {
    statusCode: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify(results, null, 2),
  }
}
