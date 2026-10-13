# Decisions

One line per choice made while building without questions.

## Milestone A: frontend

- Database types are hand-written in `lib/database.types.ts`, because `supabase gen types` needs a logged-in CLI and network access. They cover only the tables the UI reads.
- Embedded Supabase selects are cast to small raw interfaces in `lib/queries.ts` instead of relying on generated relationship types.
- `cacheComponents` and `partialPrefetching` from the Next 16 scaffold are off. Pages use classic dynamic rendering with `loading.tsx` skeletons.
- `getDb()` calls `connection()` so every data page renders per request, including in fixture mode where no cookies are read.
- Fixture mode needs `NEXT_PUBLIC_USE_FIXTURES=true` and both Supabase variables empty (changed in the UI/UX redesign). It skips auth, acts as an admin and shows a banner. Missing env without the flag shows a setup message.
- The proxy (Next 16's name for middleware) only refreshes the session and redirects signed-out users. Role and active checks happen in the `(app)` layout, which renders "No access".
- "Last 30 days" KPIs and moment counts use the call's `started_at`, not the analysis `created_at`.
- The average score and the rolling score skip analyses with a null score, which is how low-evidence analyses will be stored after Milestone C.
- Rolling score = average of the newest 3 scored calls by call date. Trend = rolling score minus the average of the 3 scored calls before it: ±0.5 or more is up/down, otherwise flat. With fewer than 4 scored calls there is no trend.
- "Needs attention" = label unhappy OR any negative moment with intensity 3, newest first, capped at 10.
- Low evidence = 0 moments or a null score. The notice also names dropped non-client moments when `dropped.non_client >= 5`.
- A moment maps to the transcript segment whose `start_seconds` is closest to its timestamp. Ties go to the earlier segment, and segments without a start are skipped.
- The transcript is paginated at 100 segments per page instead of virtualised, so no extra dependency is needed. Clicking a moment opens the right page and scrolls to the segment.
- The Analyze button shows only for manual calls with no current analysis that are not running, queued or failed. Failed calls get Retry instead.
- Polling uses `router.refresh()` every 5 s while any visible call is queued or running.
- Calls list loads at most 2000 calls (client calls, not excluded) and filters client-side.
- Dark mode uses a `.dark` class with a localStorage toggle, defaulting to the system preference, with an inline script to avoid a flash.
- Google fonts were removed so the build needs no network. The UI uses the system font stack.
- `@types/node` is ^24 because vitest 5 requires it as a peer dependency.
- Transcript speaker emails are never selected into the UI. Only names and text are shown.

## Fathom connect, manual sync and UI redesign

- Each staff user connects their own Fathom account on the new Fathom page. The key goes once to the `fathom` Edge Function, which tests it with Fathom and stores it in Supabase Vault. The browser only ever sees the last 4 characters; `fathom_accounts` is read through RLS (owner can read own row).
- "Sync now" lives in the sidebar and on the Fathom page; both share one `SyncProvider` so a sync started anywhere shows progress everywhere. The first sync takes the last 20 meetings; later syncs take everything since the previous one (the backend owns these numbers).
- After a sync the browser analyses new non-manual calls itself, two at a time, through `analyze-call`. Edge Functions have a short wall clock, so chaining analysis server-side was not an option without a queue. If the tab closes early, the remaining calls keep an Analyze button.
- The Analyze button now shows for any call without an analysis (not only manual-only calls), so calls left over from an interrupted sync can be analysed by hand. This supersedes the Milestone A rule above.
- The sidebar treats a missing `fathom_accounts` column (migration not pushed) as "not connected" rather than failing every page; the Fathom page shows the error.
- A truncated sync (more than 100 new meetings) imports the newest 100 and says so; the older ones need the backend backfill script. Clicking Sync again would not recover them because the sync point moves forward.
- Sync results shown in the UI are counts only, never titles, names or emails.
- UI: left sidebar (drawer on mobile), neutral zinc greys with one indigo accent, Geist Sans via the `geist` package (bundled locally, so the build still needs no network), icons from `lucide-react`. Sentiment colours are unchanged.

## Meeting people on the call page

- The call page has a collapsible "People in this meeting" list (closed by default): name and email of every Fathom calendar invitee across the call's recordings, plus the recorder, one row per email. Staff can already read `recordings` through RLS, so no migration was needed.
- Showing attendee emails to staff was requested explicitly; it supersedes the earlier "no emails in the UI" note for this list only. Transcript speaker emails are still not selected. Emails never go into logs or tests (tests use invented addresses).
- Client vs E2M comes from the `e2m_domains` setting, not Fathom's `is_external`. "Spoke" means the name appears as a transcript speaker; invitees are from the calendar, so someone listed may not have joined.

## UI/UX redesign

- Fixture data shows only when `NEXT_PUBLIC_USE_FIXTURES=true` and both Supabase variables are empty; with neither set, pages show a "Supabase is not configured" message.
- Date range lives in `?range=` (7/30/90/all, default 30 and omitted from the URL); dashboard, clients and client detail use it, and nav links keep it.
- Client rolling score = newest 3 scored calls of any date; coverage, sparkline and negative moments use the selected period.
- "Provisional" = fewer than 3 analysed calls for the client.
- Clients sort by attention: latest call unhappy +4, rolling score <=4 +3 or <=6 +1, +0.5 per negative moment (max 6), quiet >21 days +1.
- Needs attention = unhappy calls or a negative moment of intensity 3 in the period; the Watchlist (lowest 5, intensity >=2 negatives, quiet clients) shows only when that list is empty.
- Heatmap columns are whole ISO weeks (Monday, UTC) overlapping the period, capped at 26.
- Score timeline shows the 5 lowest-average clients by default; client colours avoid red, amber and green so they never read as sentiment.
- Bulk "Analyze selected" skips manual-only calls and reuses the per-call analyze path at concurrency 2.
- Manual reason labels ("Leader attended") are computed on the server so attendee emails never reach the client.
- Calls filters and sorting are client-side state seeded from URL params (`client`, `label`, `status`, `manual=1`); 25 rows per page.
- Radix Popover and Tooltip are used directly instead of a full shadcn/ui setup.
- Layout: content max-w-[1400px]; full sidebar from `lg`, icon rail on `md`, drawer below `md`.

## Role-based access (frontend)

- The database (RLS) decides what each user sees; the frontend only mirrors it. Executors and engineers get their own calls from the same queries, with no extra filtering.
- `lib/session.ts` loads the viewer and their Fathom account once per request (React `cache`), shared by the layout and pages. Pages call `requireUnlocked()` / `requireAdmin()` and render nothing when the layout is already showing a gate.
- Setup lock: an executor or engineer without `fathom_accounts.last_sync_at` is redirected from Dashboard, Calls, Clients and call/client pages to the Fathom page, which becomes "Set up your workspace". The nav shows those links locked with a tooltip. After the first sync, the page shows "Open dashboard".
- Person filter: admins only, `?person=<user id>` next to `?range=`, on Dashboard, Calls, Clients and client detail. Ownership comes from `admin_call_people()`, the same rule as RLS. Nav links and range links keep it. An unknown id means everyone.
- If the RBAC migration is not applied yet, the person filter is hidden and the Users page shows a "run db push" message; other pages keep working (profiles are read with `*`, so a missing `job_title` column is harmless).
- Users page (admin): one table with a role control, inline job title edit, Fathom status, period numbers (analysed / total, coverage, average score, unhappy) and deactivate / reactivate. Role and active changes need an inline confirmation; title edits do not. Your own role and active flag are disabled. Saving goes through a server action that calls `admin_update_user`, which re-checks everything and writes the audit log; recent changes come from `audit_log`.
- Executors and engineers can analyse manual-only calls they are on (this replaces the earlier "Admin only" rule). The first person to click Analyze creates the one shared analysis; everyone else on the call sees it, and only an admin can re-run it.
- The sidebar shows the job title when set, otherwise the role.
- Fixtures: six invented members, call ownership by index, and three history entries. `FIXTURE_ROLE=executor|engineer|new` previews those views; scoping in fixture mode copies the RLS rule.

## Pitch deck

- `/demo` is a hard-coded slide deck (sample data only) for pitching the product: arrow keys move, N toggles speaker notes, F goes full screen, and the slide number lives in the URL hash. It is the one page reachable without signing in, because it holds no real data.
