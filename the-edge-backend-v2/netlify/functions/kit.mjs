// Kit (ConvertKit) API proxy
export const handler = async (event) => {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-kit-key',
  }
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }

  const apiKey = event.headers['x-kit-key']
  const action = event.queryStringParameters?.action || 'subscribers'

  if (!apiKey) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'x-kit-key header required' }) }

  try {
    let res, data

    if (action === 'subscribers') {
      res = await fetch(`https://api.kit.com/v4/subscribers?per_page=1000`, {
        headers: { 'X-Kit-Api-Key': apiKey, 'Accept': 'application/json' }
      })
    } else if (action === 'broadcast' && event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}')
      res = await fetch('https://api.kit.com/v4/broadcasts', {
        method: 'POST',
        headers: { 'X-Kit-Api-Key': apiKey, 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ subject: body.subject, content: body.content, public: false }),
      })
    } else if (action === 'add_subscriber' && event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}')
      res = await fetch('https://api.kit.com/v4/subscribers', {
        method: 'POST',
        headers: { 'X-Kit-Api-Key': apiKey, 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ email_address: body.email, first_name: body.name }),
      })
    } else if (action === 'validate') {
      res = await fetch(`https://api.kit.com/v4/account`, {
        headers: { 'X-Kit-Api-Key': apiKey, 'Accept': 'application/json' }
      })
    } else {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: `Unknown action: ${action}` }) }
    }

    data = await res.json()
    return {
      statusCode: res.status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }
  } catch (err) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) }
  }
}
