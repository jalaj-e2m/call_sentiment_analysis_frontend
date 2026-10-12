# E2M Call Sentiment: frontend

Internal dashboard for client call sentiment. Next.js App Router, Tailwind, Supabase (RLS), recharts.

## Setup

```bash
npm install
cp .env.local.example .env.local   # fill in the two public Supabase values
npm run dev
```

Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` belong here. Never put the service role key or the OpenRouter key in this app.

## Fixture mode

If either Supabase variable is empty, or `NEXT_PUBLIC_USE_FIXTURES=true`, the app runs on fake data in `lib/fixtures.ts` with no login. Use it for UI work and demos.

## Access

Login is invite-only (email and password, no sign-up). Users with an active profile and the role admin, specialist or associate see the app. Engineers, inactive users and users without a profile see "No access". Settings is admin-only.

## Checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

None of these need network access or env variables.

## Layout

- `lib/queries.ts`: all data access, which returns fixtures in fixture mode.
- `lib/sentiment.ts`: pure logic (badges, scores, trends, low evidence, transcript matching), with tests next to it.
- `lib/analyze.ts`: invokes the `analyze-call` Edge Function for Analyze and Retry.
- `app/(app)/*`: the authenticated screens.

See `DECISIONS.md` for the choices made during the build.
