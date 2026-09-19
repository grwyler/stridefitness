# Stride

Mobile-first strength training tracker. Data lives in the current browser under `stride-v1`. Includes sample sessions; no accounts or cross-device synchronization.

The typed model and progression engine live in `lib/training.ts`. Recommendations use recorded targets and results, prioritize return-after-absence and repeated struggle, and support per-exercise weight, repetition, or set progression. User overrides last until the next completed session. Weight units are pounds; bodyweight exercises use zero added weight.

The interface supports editable workouts, set outcomes and difficulty, exercise defaults, templates, progress charts, and light/dark mode. General fitness guidance only.

Validation: TypeScript check, production build, and progression scenario assertions. Browser QA and WebMCP runtime validation were unavailable under this session's permitted preview workflow.

## Authentication configuration

Google sign-in requires `GOOGLE_CLIENT_ID` and `AUTH_SESSION_SECRET`. Passwordless email is implemented with Resend and requires `RESEND_API_KEY` plus a verified `EMAIL_FROM` sender address. Until those two email settings are configured, the UI returns a clear unavailable message and users can still use Google or guest access. Magic links expire in 15 minutes, are stored only as SHA-256 hashes, and are single-use.
