// FNAHS — WHO Health Centre news edge function
//
// Deploy:
//   supabase functions deploy who-news
//   supabase secrets set WHO_NEWS_ORIGINS=https://your-site.example   (comma-separated)
//
// Serves WHO's own public news feed (no API key, no third-party provider).
// Callers must be authenticated FNAHS users (JWT); requests are rate-limited
// (bump_rate) and CORS is restricted to WHO_NEWS_ORIGINS.

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

// Vercel preview deployments get a fresh hostname per build.
const PREVIEW_ORIGIN = /^https:\/\/fnahs-[a-z0-9]+-kurunami31s-projects\.vercel\.app$/
const originAllowed = (origin: string) =>
  ALLOWED_ORIGINS.has(origin) || PREVIEW_ORIGIN.test(origin)

const FEED = 'https://www.who.int/rss-feeds/news-english.xml'

const baseHeaders = (origin: string) => ({
  'Access-Control-Allow-Origin': origin || 'null',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Max-Age': '86400',
  'Vary': 'Origin',
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

const decode = (s: string) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&')

const strip = (s: string) => decode(String(s || '').replace(/<!\[CDATA\[|\]\]>/g, '')).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

const tag = (item: string, name: string) => {
  const m = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`).exec(item)
  return m ? strip(m[1]) : ''
}

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
  if (browserRequest && !originAllowed(origin)) {
    // do not echo a disallowed origin back in Access-Control-Allow-Origin
    return json({ error: 'origin not allowed' }, 403, '')
  }
  if (req.method === 'OPTIONS') {
    // 204 is a null-body status — a body here throws and 500s the preflight.
    return new Response(null, { status: 204, headers: baseHeaders(origin) })
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

    const upstream = await fetch(FEED, {
      headers: { 'User-Agent': 'FNAHS-PULSO/1.0 (+https://fnahs.vercel.app)' },
      signal: AbortSignal.timeout(12000),
    })

    if (!upstream.ok) {
      console.error('who feed error', upstream.status)
      return json({ error: 'upstream failed' }, 502, origin)
    }

    const xml = await upstream.text()
    const items = xml.split('<item>').slice(1, 13)

    const articles = items
      .map((it) => {
        const title = tag(it, 'title').slice(0, 180)
        const url = tag(it, 'link')
        if (!title || !url) return null
        const published = tag(it, 'pubDate')
        const parsed = published ? new Date(published) : null
        return {
          title,
          url,
          image: null,
          source: domainOf(url) || 'who.int',
          published_at: parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : null,
        }
      })
      .filter(Boolean)

    return json({ articles }, 200, origin)
  } catch (err) {
    console.error('who-news error', err)
    return json({ error: 'internal error' }, 500, origin)
  }
})
