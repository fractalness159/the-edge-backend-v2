export const handler = async (event) => {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-whop-key, x-company-id',
  }
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }

  // Accept key via URL params OR headers
  const apiKey    = event.queryStringParameters?.key || event.headers['x-whop-key']
  const companyId = event.queryStringParameters?.company || event.headers['x-company-id'] || 'biz_sAX9PtBrPSoMbN'

  if (!apiKey) return { 
    statusCode: 400, headers: CORS, 
    body: JSON.stringify({ error: 'Pass ?key=YOUR_WHOP_KEY in the URL' }) 
  }

  const results = {}

  const endpoints = [
    { k: 'v5_memberships_active', url: `https://api.whop.com/api/v5/company/${companyId}/memberships?status=active&pagination[per]=10` },
    { k: 'v5_memberships_all',    url: `https://api.whop.com/api/v5/company/${companyId}/memberships?pagination[per]=5` },
    { k: 'v5_members',            url: `https://api.whop.com/api/v5/company/${companyId}/members?pagination[per]=5` },
    { k: 'v1_active',             url: `https://api.whop.com/api/v1/memberships?company_id=${companyId}&status=active&per=10` },
  ]

  for (const { k, url } of endpoints) {
    try {
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' }
      })
      const data = await res.json()
      const items = data.data || data.members || data.results || []
      results[k] = {
        http_status: res.status,
        count: items.length,
        members: Array.isArray(items) ? items.slice(0, 10).map(m => ({
          id: m.id,
          status: m.status,
          membership_status: m.membership_status,
          valid: m.valid,
          email: m.user?.email || m.email,
          name: m.user?.name || m.user?.username || m.name,
          price: m.plan?.price_per_period || m.plan?.price || m.renewal_price,
          plan_name: m.plan?.name,
          expires_at: m.expires_at,
          cancel_at_period_end: m.cancel_at_period_end,
        })) : data
      }
    } catch (err) {
      results[k] = { error: err.message }
    }
  }

  return {
    statusCode: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify(results, null, 2),
  }
}
