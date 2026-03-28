export const handler = async (event) => {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-whop-key, x-company-id',
  }
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }

  const apiKey    = event.headers['x-whop-key']
  const companyId = event.headers['x-company-id']
  const action    = event.queryStringParameters?.action || 'members'

  if (!apiKey)    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'x-whop-key header required' }) }
  if (!companyId) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'x-company-id header required' }) }

  try {
    let url

    if (action === 'members' || action === 'validate') {
      // Whop v5 API - list memberships for a company
      url = `https://api.whop.com/api/v5/company/${companyId}/memberships?pagination[per]=100`
    } else {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: `Unknown action: ${action}` }) }
    }

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    })

    const text = await res.text()
    
    // Log for debugging
    console.log('Whop status:', res.status)
    console.log('Whop response:', text.slice(0, 200))

    if (!text || text.trim() === '') {
      return {
        statusCode: 500,
        headers: CORS,
        body: JSON.stringify({ error: 'Whop returned empty response — check API key permissions' })
      }
    }

    let data
    try {
      data = JSON.parse(text)
    } catch {
      return {
        statusCode: 500,
        headers: CORS,
        body: JSON.stringify({ error: `Whop returned non-JSON: ${text.slice(0, 100)}` })
      }
    }

    if (!res.ok) {
      const msg = data?.message || data?.error || data?.detail || `Whop API error ${res.status}`
      return { statusCode: res.status, headers: CORS, body: JSON.stringify({ error: msg }) }
    }

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }
  } catch (err) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: `Proxy error: ${err.message}` })
    }
  }
}
