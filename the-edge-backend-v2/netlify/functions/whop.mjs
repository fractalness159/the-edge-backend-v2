// Whop API proxy — handles CORS so browser can call Whop
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

  if (!apiKey) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'x-whop-key header required' }) }
  if (!companyId) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'x-company-id header required (your biz_xxx ID)' }) }

  try {
    let url, body
    if (action === 'members') {
      url = `https://api.whop.com/api/v5/company/${companyId}/members?pagination[per]=100`
    } else if (action === 'memberships') {
      url = `https://api.whop.com/api/v5/company/${companyId}/memberships?pagination[per]=100&filter[status]=active`
    } else if (action === 'validate') {
      url = `https://api.whop.com/api/v5/company/${companyId}/memberships?pagination[per]=1`
    } else {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: `Unknown action: ${action}` }) }
    }

    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    })

    const data = await res.json()
    return {
      statusCode: res.status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }
  } catch (err) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) }
  }
}
