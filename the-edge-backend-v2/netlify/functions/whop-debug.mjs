export const handler = async (event) => {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-whop-key, x-company-id',
  }
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }

  const apiKey    = event.queryStringParameters?.key || event.headers['x-whop-key']
  const companyId = event.queryStringParameters?.company || event.headers['x-company-id'] || 'biz_sAX9PtBrPSoMbN'

  if (!apiKey) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Pass ?key=YOUR_KEY' }) }

  const results: any = {}

  const endpoints = [
    // Plans/tiers
    { k: 'v1_plans',          url: `https://api.whop.com/api/v1/plans?company_id=${companyId}` },
    { k: 'v2_plans',          url: `https://api.whop.com/api/v2/plans?company_id=${companyId}` },
    { k: 'v5_plans',          url: `https://api.whop.com/api/v5/company/${companyId}/plans` },
    // Products
    { k: 'v5_products',       url: `https://api.whop.com/api/v5/company/${companyId}/products` },
    { k: 'v1_products',       url: `https://api.whop.com/api/v1/products?company_id=${companyId}` },
    // Memberships per plan
    { k: 'v1_memberships_active', url: `https://api.whop.com/api/v1/memberships?company_id=${companyId}&status=active&per=100&page=1` },
    { k: 'v1_memberships_valid',  url: `https://api.whop.com/api/v1/memberships?company_id=${companyId}&valid=true&per=100` },
  ]

  for (const { k, url } of endpoints) {
    try {
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' }
      })
      const data = await res.json()
      const items = data.data || data.plans || data.products || data.memberships || []
      
      results[k] = {
        http: res.status,
        count: Array.isArray(items) ? items.length : '?',
        sample: Array.isArray(items) ? items.slice(0, 3).map((m: any) => ({
          id: m.id,
          name: m.name || m.title,
          status: m.status,
          valid: m.valid,
          price: m.price_per_period || m.price || m.base_currency_price,
          billing: m.billing_period,
          visibility: m.visibility,
          stock: m.stock,
          members_count: m.members_count,
          plan_type: m.plan_type,
        })) : data
      }
    } catch (err: any) {
      results[k] = { error: err.message }
    }
  }

  return {
    statusCode: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify(results, null, 2),
  }
}
