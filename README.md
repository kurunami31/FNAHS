# FNAHS · Community Platform

A community platform for the **Faculty of Nursing and Allied Health Sciences**, with a clean clinical design — rebranded with the FNAHS logo and a gold & white palette drawn directly from its two main colors.

> One community for the FNAHS squad — attend org events with a scan, keep up with students, learn from live feeds, and get help from Florence, the in-house AI assistant.

## Features

- **Home** — seal hero with the FNAHS logo, live WHO health news wire, curated clinical feeds, and the next events on the rounds
- **Feed** — org posts with likes, comments, image attachments, archive & delete, search
- **Events** — upcoming org events with RSVP and event creation; click any ticket for full details and the attendee list
- **Directory** — searchable member directory of students and faculty, filterable by program; click any member for their profile (recent posts, events going)
- **Florence** — the org's in-house AI assistant, named after Florence Nightingale, now a floating chat bubble available on every page (chat with streaming replies)
- **My ID** — digital student ID card with a QR code, scannable at events (exportable as an image), plus your attendance history
- **Staff tools** — camera-based QR scanner to log event attendance, per-event tallies, and live scanned counts on event details
- **Admin console** — moderation hub for superadmins, staff, and moderators: manage members (roles, edit, delete), posts (edit, archive, delete), and events (edit, delete)
- **Account sheet** — profile, program/year level, dark/light theme, sign out (slide-over from the avatar)
- **Search** — Ctrl+K command search across posts and members
- Institutional gold &amp; white house style (the logo's two colors, maroon-tinted gold with a printed-circuit grid), PWA-ready

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build
```

**Demo mode:** without any env vars the app runs fully in the browser with seed data (localStorage). Any email + password logs in (`staff@fnahs.edu.ph` gives a staff account, `fnahsadmin@fnahs.edu.ph` a superadmin account — the admin account is gated by the password `dorsufnahs2026`). Demo auth is a local simulation only; real credentials are handled by Supabase Auth in live mode.

## Go live with Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Run `supabase/schema.sql` in the SQL Editor → **Authentication → Providers → enable Email confirmations**.
3. Create `.env.local` (see `.env.example`) with your project URL + anon key.
4. Promote your first staff account — must run in the SQL editor (postgres bypasses RLS):
   `update public.profiles set role = 'superadmin' where id = (select id from auth.users where email = '<your email>');`
   From then on, staff/superadmins manage roles through the Admin console.

## Florence (AI assistant)

1. `npx supabase init && npx supabase functions deploy florence-ai`
2. Set the LLM provider key:
   - **Groq** (recommended — fast, free tier): `npx supabase secrets set OPENAI_API_KEY=gsk_...` — a `gsk_` key is auto-routed to Groq with `llama-3.3-70b-versatile`.
   - **OpenAI**: `npx supabase secrets set OPENAI_API_KEY=sk-...` (default model `gpt-4o-mini`).
   - Optional overrides: `OPENAI_BASE_URL` and `OPENAI_MODEL` for any other OpenAI-compatible API.
3. Restrict CORS to your site (comma-separated): `npx supabase secrets set FLORENCE_ORIGINS=https://your-site.example`
4. Until the function is deployed, the chat falls back to built-in demo replies so the UI always works.

## Security

- **Row-level security is on everywhere.** The `anon` role is fully locked out; only authenticated users can read/post, staff/moderator/superadmin can moderate, and the `rate_limits` table is service-role only.
- **Emails stay private.** Profiles expose only public columns to members; the full row (incl. email) is served by the `admin_get_users()` RPC, which only staff/mod/superadmin may call. Directory data goes through `get_directory()`.
- **Role integrity:** members can never change their own role server-side, and the last superadmin can never be demoted or deleted (trigger).
- **Florence** validates JWTs, is rate-limited (20 calls/min/user via `bump_rate()`), caps payloads, strips client-supplied system roles, and answers only from `FLORENCE_ORIGINS`.
- **Transport:** CSP (script-src 'self', no unsafe-eval), `X-Frame-Options: DENY`, `nosniff`, `no-referrer`, strict `Permissions-Policy`, HSTS, and `upgrade-insecure-requests` — via inlined build-time CSP meta and `public/_headers`/`vercel.json` for hosting headers. Dev mode is intentionally excluded so Vite HMR keeps working.
- **Input guards:** post/comment/profile text is trimmed and length-capped, external URLs must be http(s), and feed images are restricted to JPEG/PNG/WebP/GIF (max 4 MB).
- Demo mode is a **local simulation only** — real auth, RLS, and rate limiting come from Supabase in live mode.

## Stack

React 19 · Vite 6 · Supabase (auth, Postgres + RLS, Edge Functions) · lucide-react · qrcode.react · html5-qrcode · html-to-image · vite-plugin-pwa

Fonts: Fraunces (display), Instrument Sans (body), Share Tech Mono (IDs).
