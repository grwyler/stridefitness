# Weekly Review (retired)

The Weekly Review feature has been retired. Its Overview entry point, generation and refresh UI, API route, recommendation rules, and integration tests were removed. Do not use this document as a description of current app behavior.

The `weekly_reviews` table remains in the database schema so existing records are preserved. Reset and account-migration maintenance still handles those records. No current application flow reads them or generates new review records.

Progression recommendations now come from the canonical engine in `lib/progression.ts`. See the current progression tests in `tests/progression.cjs` and coaching integration tests in `tests/adaptive-coach.cjs`.
