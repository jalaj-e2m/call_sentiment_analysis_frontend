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

With `NEXT_PUBLIC_USE_FIXTURES=true` and both Supabase variables empty, the app runs on fake data in `lib/fixtures.ts` with no login (8 clients, 12 weeks). Use it for UI work and demos. Fixture data is never shown while the Supabase variables are set. Add `FIXTURE_ROLE=executor`, `engineer` or `new` (an engineer before the first sync) to preview what those users see.

## Access

Login is invite-only (email and password, no sign-up). Three roles, enforced by the database (RLS), not just the UI:

- **Admin** sees every call and client, can filter any page by person (`?person=`), and manages users on the Users page (role, job title, deactivate). Settings and Users are admin-only.
- **Executor** and **Engineer** see only their own calls (synced with their Fathom key, or they were invited) and the clients on those calls. Until their first Fathom sync they only see the setup page. They can analyse any of their calls, manual-only included. Each call has one analysis shared by everyone on it; only an admin can re-run it.

New users with a company email start as active engineers; anyone else, inactive users and users without a profile see "No access".

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
