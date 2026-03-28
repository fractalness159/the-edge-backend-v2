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
    { label: 'v5-company-members',     url: `https://api.whop.com/api/v5/company/${companyId}/members` },
    { label: 'v5-company-memberships', url: `https://api.whop.com/api/v5/company/${companyId}/memberships` },
    { label: 'v1-memberships',         url: `https://api.whop.com/api/v1/memberships?company_id=${companyId}&status=active&per=100` },
    { label: 'v2-memberships',         url: `https://api.whop.com/api/v2/memberships?company_id=${companyId}&status=active` },
    { label: 'v5-app-members',         url: `https://api.whop.com/api/v5/app/members?company_id=${companyId}` },
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
      if (!Array.isArray(raw)) { results.push({ label, error: 'not array' }); continue }

      // ── FILTER TO ACTIVE ONLY & CALCULATE REAL MRR ──────────────────
      // Whop statuses: 'active', 'trialing', 'past_due', 'canceled', 'expired'
      const ACTIVE_STATUSES = ['active', 'trialing', 'past_due']
      
      const allMembers = raw
      const activeMembers = raw.filter(m => {
        const status = m.status || m.membership_status || m.subscription_status || ''
        return ACTIVE_STATUSES.includes(status.toLowerCase())
      })

      // Calculate real MRR from plan prices
      let calculatedMrr = 0
      for (const m of activeMembers) {
        // Try to get actual price from plan
        const price = m.plan?.price_per_period 
          || m.plan?.price 
          || m.price_per_period
          || m.renewal_price
          || 50 // fallback to $50 default
        calculatedMrr += price / 100 // Whop stores in cents
      }

      // If we couldn't get prices, use $50 default x active count
      if (calculatedMrr === 0 && activeMembers.length > 0) {
        calculatedMrr = activeMembers.length * 50
      }

      console.log(`Endpoint: ${label}, Total: ${allMembers.length}, Active: ${activeMembers.length}, MRR: $${calculatedMrr}`)

      return {
        statusCode: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: allMembers,           // all members for display
          active: activeMembers,      // active only
          total_count: allMembers.length,
          active_count: activeMembers.length,
          calculated_mrr: calculatedMrr,
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
