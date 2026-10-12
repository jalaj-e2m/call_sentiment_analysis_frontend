# Decisions

One line per choice made while building without questions.

## Milestone A: frontend

- Database types are hand-written in `lib/database.types.ts`, because `supabase gen types` needs a logged-in CLI and network access. They cover only the tables the UI reads.
- Embedded Supabase selects are cast to small raw interfaces in `lib/queries.ts` instead of relying on generated relationship types.
- `cacheComponents` and `partialPrefetching` from the Next 16 scaffold are off. Pages use classic dynamic rendering with `loading.tsx` skeletons.
- `getDb()` calls `connection()` so every data page renders per request, including in fixture mode where no cookies are read.
- Fixture mode turns on when `NEXT_PUBLIC_USE_FIXTURES=true` or either Supabase variable is missing. It skips auth, acts as an admin and shows a banner.
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
