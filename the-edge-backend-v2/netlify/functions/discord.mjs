// Discord lead scraper — searches public Discord servers for trading communities
// Uses Disboard.org public API (no auth needed) + Discord's public server search
export const handler = async (event) => {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-discord-token',
  }
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }

  const query         = event.queryStringParameters?.query || 'crypto futures trading'
  const discordToken  = event.headers['x-discord-token'] || process.env.DISCORD_BOT_TOKEN

  const results = []

  try {
    // Method 1: Disboard public server search (no auth needed)
    const disboardRes = await fetch(
      `https://disboard.org/api/servers/search?query=${encodeURIComponent(query)}&sort=-online_count&limit=20`,
      { headers: { 'User-Agent': 'TheEdgeCRM/1.0', 'Accept': 'application/json' } }
    )

    if (disboardRes.ok) {
      const data = await disboardRes.json()
      const servers = data?.results || data?.servers || []
      for (const s of servers) {
        results.push({
          id:          s.id || s.snowflake,
          name:        s.name,
          description: s.short_description || s.description || '',
          members:     s.member_count || s.online_count || 0,
          inviteUrl:   s.invite_url || `https://discord.gg/${s.vanity_url || s.id}`,
          tags:        s.tags || [],
          platform:    'Discord',
          type:        'server',
          status:      (s.member_count || 0) > 1000 ? 'hot' : (s.member_count || 0) > 100 ? 'warm' : 'cold',
        })
      }
    }

    // Method 2: If bot token provided, search server members
    if (discordToken && event.queryStringParameters?.guild_id) {
      const guildId = event.queryStringParameters.guild_id
      const membersRes = await fetch(
        `https://discord.com/api/v10/guilds/${guildId}/members?limit=100`,
        { headers: { 'Authorization': `Bot ${discordToken}`, 'Content-Type': 'application/json' } }
      )
      if (membersRes.ok) {
        const members = await membersRes.json()
        const userLeads = members
          .filter((m: any) => !m.user?.bot)
          .map((m: any) => ({
            id:       m.user?.id,
            name:     m.nick || m.user?.global_name || m.user?.username,
            username: m.user?.username,
            platform: 'Discord',
            type:     'member',
            joinedAt: m.joined_at,
            roles:    m.roles,
            status:   'cold',
          }))
        results.push(...userLeads)
      }
    }

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ results, total: results.length, query }),
    }
  } catch (err) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: err.message, results: [] }),
    }
  }
}
