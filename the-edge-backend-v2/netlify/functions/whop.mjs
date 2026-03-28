const ALLOWED_ORIGINS = [
  'https://the-edge-dashboard.netlify.app',
  'http://localhost:5173',
  'file://',
  'null', // local file://
]

const getCORS = (origin) => {
  const allowed = ALLOWED_ORIGINS.includes(origin) || !origin || origin === 'null' 
    ? origin || '*' 
    : 'https://the-edge-dashboard.netlify.app'
  return {
    'Access-Control-Allow-Origin': '*', // allow all for now
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-whop-key, x-company-id, x-plan-price',
  }
}

export const handler = async (event) => {
  const origin = event.headers?.origin || ''
  const CORS = getCORS(origin)

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }

  const apiKey    = event.headers['x-whop-key']
  const companyId = event.headers['x-company-id']
  const planPrice = parseFloat(event.headers['x-plan-price'] || '200')

  if (!apiKey || !companyId) return { 
    statusCode: 400, headers: CORS, 
    body: JSON.stringify({ error: 'x-whop-key and x-company-id required' }) 
  }

  try {
    const membershipsRes = await fetch(
      `https://api.whop.com/api/v1/memberships?company_id=${companyId}&per=100&page=1`,
      { headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' } }
    )
    const membershipsData = membershipsRes.ok ? await membershipsRes.json() : {}
    const allMembers = membershipsData.data || []

    const PAYING = ['active', 'trialing', 'completed']
    const payingMembers = allMembers.filter((m: any) => PAYING.includes((m.status||'').toLowerCase()))

    let mrr = payingMembers.length * planPrice

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: allMembers.map((m: any) => ({
          id: m.id,
          name: m.user?.name || m.user?.username || 'Member',
          email: m.user?.email || m.email,
          status: m.status,
          tier: PAYING.includes((m.status||'').toLowerCase()) ? 'paid' : 'free',
          plan: m.plan?.name || 'Unknown',
          joinedAt: m.created_at,
        })),
        total_count: allMembers.length,
        active_count: payingMembers.length,
        calculated_mrr: mrr,
      }),
    }
  } catch (err: any) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) }
  }
}
