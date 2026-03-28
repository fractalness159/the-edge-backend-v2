// Quick validation endpoint — tests all API keys are working
export const handler = async (event) => {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-whop-key, x-kit-key, x-sd-key, x-company-id',
  }
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }

  const results = { whop: null, kit: null, socialdata: null }
  const whopKey   = event.headers['x-whop-key']
  const companyId = event.headers['x-company-id']
  const kitKey    = event.headers['x-kit-key']
  const sdKey     = event.headers['x-sd-key']

  const check = async (name, fn) => {
    try { results[name] = await fn(); } catch(e) { results[name] = { ok: false, error: e.message } }
  }

  await Promise.all([
    whopKey && companyId && check('whop', async () => {
      const r = await fetch(`https://api.whop.com/api/v5/company/${companyId}/memberships?pagination[per]=1`, {
        headers: { 'Authorization': `Bearer ${whopKey}` }
      })
      return { ok: r.ok, status: r.status, message: r.ok ? 'Connected' : `Error ${r.status}` }
    }),
    kitKey && check('kit', async () => {
      const r = await fetch('https://api.kit.com/v4/account', {
        headers: { 'X-Kit-Api-Key': kitKey, 'Accept': 'application/json' }
      })
      const d = await r.json()
      return { ok: r.ok, status: r.status, message: r.ok ? `Connected — ${d.account?.email || 'OK'}` : `Error ${r.status}` }
    }),
    sdKey && check('socialdata', async () => {
      const r = await fetch('https://api.socialdata.tools/twitter/search?query=test&count=1', {
        headers: { 'Authorization': `Bearer ${sdKey}`, 'Accept': 'application/json' }
      })
      return { ok: r.ok, status: r.status, message: r.ok ? 'Connected' : `Error ${r.status}` }
    }),
  ].filter(Boolean))

  return {
    statusCode: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify(results),
  }
}
