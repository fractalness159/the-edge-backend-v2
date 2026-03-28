export const handler = async (event) => {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-whop-key, x-company-id, x-plan-price',
  }
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }

  const apiKey    = event.headers['x-whop-key']
  const companyId = event.headers['x-company-id']
  const planPrice = parseFloat(event.headers['x-plan-price'] || '200')

  if (!apiKey)    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'x-whop-key header required' }) }
  if (!companyId) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'x-company-id header required' }) }

  const ACTIVE = ['active', 'trialing', 'past_due']

  // Try memberships with status=active filter first — most accurate
  const attempts = [
    `https://api.whop.com/api/v5/company/${companyId}/memberships?status=active&pagination[per]=100`,
    `https://api.whop.com/api/v5/company/${companyId}/memberships?pagination[per]=100`,
    `https://api.whop.com/api/v5/company/${companyId}/members?pagination[per]=100`,
    `https://api.whop.com/api/v1/memberships?company_id=${companyId}&status=active&per=100`,
    `https://api.whop.com/api/v2/memberships?company_id=${companyId}&status=active&per=100`,
  ]

  for (const url of attempts) {
    try {
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' },
      })
      if (!res.ok) continue
      const text = await res.text()
      if (!text?.trim()) continue

      let data
      try { data = JSON.parse(text) } catch { continue }

      const raw = data.data || data.members || data.results || []
      if (!Array.isArray(raw)) continue

      // Filter to active paying members only
      const active = raw.filter(m => {
        const s = (m.status || m.membership_status || '').toLowerCase()
        return ACTIVE.includes(s)
      })

      // Use active if we got some, otherwise use raw (endpoint may have already filtered)
      const billing = active.length > 0 ? active : raw

      // Calculate MRR
      let mrr = 0
      for (const m of billing) {
        const rawCents = m.plan?.price_per_period || m.plan?.price || m.price_per_period || m.renewal_price
        mrr += rawCents ? rawCents / 100 : planPrice
      }
      if (mrr === 0) mrr = billing.length * planPrice

      console.log(`URL: ${url.split('?')[0].split('/').pop()}, raw=${raw.length}, active=${active.length}, billing=${billing.length}, MRR=$${mrr}`)

      return {
        statusCode: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: raw,
          active: billing,
          total_count: raw.length,
          active_count: billing.length,
          calculated_mrr: Math.round(mrr),
          plan_price: planPrice,
        }),
      }
    } catch (err) {
      console.log('Attempt failed:', err.message)
    }
  }

  return {
    statusCode: 500,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: 'All Whop endpoints failed' }),
  }
}
