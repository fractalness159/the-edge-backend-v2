export const handler = async (event) => {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-whop-key, x-company-id, x-plan-price',
  }
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }

  const apiKey    = event.headers['x-whop-key']
  const companyId = event.headers['x-company-id']
  const planPrice = parseFloat(event.headers['x-plan-price'] || '50') // your actual price

  if (!apiKey)    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'x-whop-key header required' }) }
  if (!companyId) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'x-company-id header required' }) }

  const results = []
  const ACTIVE_STATUSES = ['active', 'trialing', 'past_due']

  const attempts = [
    { label: 'v5-members',      url: `https://api.whop.com/api/v5/company/${companyId}/members` },
    { label: 'v5-memberships',  url: `https://api.whop.com/api/v5/company/${companyId}/memberships` },
    { label: 'v1-active',       url: `https://api.whop.com/api/v1/memberships?company_id=${companyId}&status=active&per=100` },
    { label: 'v2-active',       url: `https://api.whop.com/api/v2/memberships?company_id=${companyId}&status=active` },
  ]

  for (const { label, url } of attempts) {
    try {
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' },
      })
      const text = await res.text()
      if (!res.ok || !text?.trim()) { results.push({ label, status: res.status }); continue }

      let data
      try { data = JSON.parse(text) } catch { continue }

      const raw = data.data || data.members || data.results || []
      if (!Array.isArray(raw) || raw.length === 0) { results.push({ label, count: raw.length }); continue }

      // Filter active members
      const activeMembers = raw.filter(m => {
        const status = (m.status || m.membership_status || m.subscription_status || '').toLowerCase()
        return ACTIVE_STATUSES.includes(status)
      })

      // Use active count if filtering worked, otherwise use all (v5 members endpoint returns active only by default)
      const billingMembers = activeMembers.length > 0 ? activeMembers : raw

      // Calculate MRR — try plan price first, fall back to x-plan-price header, then $50
      let calculatedMrr = 0
      for (const m of billingMembers) {
        const rawPrice = m.plan?.price_per_period || m.plan?.price || m.price_per_period || m.renewal_price || null
        const price = rawPrice ? rawPrice / 100 : planPrice // divide by 100 only if from Whop (cents)
        calculatedMrr += price
      }

      console.log(`${label}: total=${raw.length}, active=${activeMembers.length}, billing=${billingMembers.length}, MRR=$${calculatedMrr}`)

      return {
        statusCode: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: raw,
          active: billingMembers,
          total_count: raw.length,
          active_count: billingMembers.length,
          calculated_mrr: Math.round(calculatedMrr),
          plan_price: planPrice,
          _endpoint: label,
        }),
      }
    } catch (err) {
      results.push({ label, error: err.message })
    }
  }

  return {
    statusCode: 500,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: 'All Whop endpoints failed', debug: results }),
  }
}
