export const handler = async (event) => {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }

  const apiKey    = event.queryStringParameters?.key
  const companyId = 'biz_sAX9PtBrPSoMbN'

  if (!apiKey) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Pass ?key=YOUR_KEY' }) }

  const results: any = {}

  // Get all plans with member counts
  const planEndpoints = [
    { k: 'v1_plans',    url: `https://api.whop.com/api/v1/plans?company_id=${companyId}&per=50` },
    { k: 'v2_plans',    url: `https://api.whop.com/api/v2/plans?company_id=${companyId}` },
    { k: 'v1_products', url: `https://api.whop.com/api/v1/products?company_id=${companyId}` },
  ]

  for (const { k, url } of planEndpoints) {
    try {
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' }
      })
      const data = await res.json()
      const items = data.data || data.plans || data.products || []
      results[k] = {
        http: res.status,
        count: Array.isArray(items) ? items.length : '?',
        items: Array.isArray(items) ? items.map((p: any) => ({
          id: p.id,
          name: p.name || p.title,
          price: p.price_per_period || p.price || p.base_currency_price,
          billing_period: p.billing_period || p.plan_type,
          members_count: p.members_count || p.active_memberships_count,
          stock: p.stock,
          status: p.status || p.visibility,
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
