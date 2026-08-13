// FNAHS — WHO Health Centre news edge function
//
// Deploy:
//   supabase functions deploy who-news
//   supabase secrets set APITUBE_KEY=api_live_...          (APITube News API)
//   supabase secrets set WHO_NEWS_ORIGINS=https://fnahs.vercel.app,http://localhost:5173
//
// Proxies the APITube News API (top headlines, health category) so the API key
// never ships to the browser. Callers must be authenticated FNAHS users (JWT);
// requests are rate-limited (bump_rate) and CORS is restricted to WHO_NEWS_ORIGINS.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const ALLOWED_ORIGINS = new Set(
  (Deno.env.get('WHO_NEWS_ORIGINS') || Deno.env.get('SUPABASE_URL') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
)

const baseHeaders = (origin: string) => ({
  'Access-Control-Allow-Origin': origin || 'null',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Max-Age': '86400',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
  'X-Frame-Options': 'DENY',
})

const json = (body: unknown, status = 200, origin = '') =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...baseHeaders(origin), 'Content-Type': 'application/json' },
  })

const domainOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin') || ''
  const browserRequest = origin !== ''
  if (browserRequest && !ALLOWED_ORIGINS.has(origin)) {
    return json({ error: 'origin not allowed' }, 403, origin)
  }
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 204, headers: baseHeaders(origin) })
  }

  try {
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return json({ error: 'unauthorized' }, 401, origin)
    }

    // Rate limit: 10 calls per minute per user (Postgres-backed, via service role).
    const { data: allowed, error: rateError } = await supabase.rpc('bump_rate', {
      p_bucket: `whonews:${user.id}`,
      p_max: 10,
      p_window_minutes: 1,
    })
    if (rateError || allowed === false) {
      return json({ error: 'rate limited — slow down' }, 429, origin)
    }

    const apiKey = Deno.env.get('APITUBE_KEY')
    if (!apiKey) {
      return json({ error: 'APITUBE_KEY not set' }, 503, origin)
    }

    const upstream = await fetch(
      'https://api.apitube.io/v1/news/top-headlines?category=health&language=en&per_page=12',
      { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(12000) }
    )

    if (!upstream.ok) {
      const detail = await upstream.text()
      console.error('apitube error', upstream.status, detail.slice(0, 300))
      return json({ error: 'upstream failed' }, 502, origin)
    }

    const body = await upstream.json()
    const articles = (body.results || [])
      .map((a: Record<string, unknown>) => {
        const title = String(a.title || '').replace(/<[^>]+>/g, '').trim().slice(0, 180)
        const url = String(a.href || '').trim()
        if (!title || !url) return null
        return {
          title,
          url,
          image: a.image ? String(a.image) : null,
          source: domainOf(url),
          published_at: a.published_at ? String(a.published_at) : null,
        }
      })
      .filter(Boolean)

    return json({ articles }, 200, origin)
  } catch (err) {
    console.error('who-news error', err)
    return json({ error: 'internal error' }, 500, origin)
  }
})