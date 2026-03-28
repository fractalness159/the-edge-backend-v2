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

  if (!apiKey || !companyId) return {
    statusCode: 400, headers: CORS,
    body: JSON.stringify({ error: 'x-whop-key and x-company-id required' })
  }

  try {
    // Fetch all members - Whop v1 status filter doesn't work reliably
    // so we fetch all and filter manually
    const res = await fetch(
      `https://api.whop.com/api/v1/memberships?company_id=${companyId}&per=100&page=1`,
      { headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' } }
    )
    if (!res.ok) throw new Error(`Whop API ${res.status}`)
    const data = await res.json()
    const all = data.data || []

    // Whop recurring monthly members show as 'completed' after payment processes
    // 'active' = subscription active, 'completed' = payment completed (recurring)
    // Both mean currently paying. 'canceled', 'expired', 'drafted' = not paying
    const PAYING = ['active', 'completed', 'trialing']
    const NOT_PAYING = ['canceled', 'expired', 'drafted']

    const paying = all.filter((m: any) => PAYING.includes((m.status||'').toLowerCase()))
    const inactive = all.filter((m: any) => NOT_PAYING.includes((m.status||'').toLowerCase()))

    // Remove duplicates by email (same person, multiple membership records)
    const seenEmails = new Set()
    const uniquePaying = paying.filter((m: any) => {
      const email = m.user?.email || m.email || m.id
      if (seenEmails.has(email)) return false
      seenEmails.add(email)
      return true
    })

    const mrr = uniquePaying.length * planPrice

    const memberList = all.map((m: any) => ({
      id: m.id,
      name: m.user?.name || m.user?.username || 'Member',
      email: m.user?.email || m.email || '',
      status: m.status,
      tier: PAYING.includes((m.status||'').toLowerCase()) ? 'paid' : 'inactive',
      joinedAt: m.created_at?.slice(0,10) || '',
    }))

    console.log(`All: ${all.length} | Paying (unique): ${uniquePaying.length} | Inactive: ${inactive.length} | MRR: $${mrr}`)

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: memberList,
        paying: memberList.filter(m => m.tier === 'paid'),
        total_count: all.length,
        active_count: uniquePaying.length,
        calculated_mrr: mrr,
      }),
    }
  } catch (err: any) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) }
  }
}
