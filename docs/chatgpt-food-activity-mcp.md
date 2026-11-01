# Stride Fitness MCP for ChatGPT

Stride exposes a read-only, OAuth-protected MCP server at:

`https://stridefitness.app/api/mcp`

The OAuth authorization server reuses Stride sign-in. OAuth grants are bound to the signed-in Stride account, access tokens expire after one hour, refresh tokens rotate and expire after 30 days, and users can revoke a grant through the OAuth revocation endpoint or Stride account settings. Token hashes, authorization codes, grants, and rate-limit counters are stored in Stride's existing D1 database. No bearer token is placed in a URL.

The server publishes protected-resource metadata at `https://stridefitness.app/.well-known/oauth-protected-resource/api/mcp`, authorization-server metadata at `https://stridefitness.app/.well-known/oauth-authorization-server`, and supports the current stateless MCP protocol (`2026-07-28`) plus the prior handshake versions. The `fitness:read` scope is read-only. MCP tools are limited to 60 calls per connected grant per minute.

The published Stride Site also exposes the same tools at `https://stridefitness.app/mcp` for its Sites-managed ChatGPT app. That endpoint relies on the existing Stride/Sites authenticated user identity on tool calls; unauthenticated calls receive HTTP 401. The OAuth-protected `/api/mcp` URL remains available for adding a custom MCP connection directly.

## Connect in ChatGPT

1. Open ChatGPT on the web and go to **Settings → Apps** (or **Plugins**, if that is the label shown in your workspace).
2. Choose **Add custom MCP server** / **Create app**, then enter `https://stridefitness.app/api/mcp` as the server URL.
3. Select **OAuth** authentication. ChatGPT discovers Stride's OAuth endpoints from the MCP protected-resource metadata. Do not append a token or secret to the server URL.
4. Continue to Stride, sign in to the account whose fitness data you want to share, and approve the read-only access request.
5. Install or enable the resulting app for your personal workspace, then start a new chat and select the Stride app when using its tools.
6. Try: “Use Stride to give me today's fitness summary for America/New_York.”

The authorization page shows the Stride account identity and the categories ChatGPT can read. If you cancel, no grant is created. To disconnect later, revoke Stride access in ChatGPT's app settings; Stride's OAuth revocation endpoint also invalidates the entire grant when called with either its access or refresh token.

## Read-only tools

- `get_daily_fitness_summary(date?, timezone?)` — completed and planned strength workouts separately, logged activities, BJJ sessions identified from activity names, available nutrition totals, measurements, active goals, and a factual seven-day completed-workout count. `date` is a calendar date in the supplied IANA timezone; omitted dates use today in that timezone.
- `get_workout_history(startDate?, endDate?, status?, limit?, offset?)` — workouts, exercises, set weights/reps, set status, and recorded RPE/RIR.
- `get_exercise_progress(exerciseId?, exerciseName?, startDate?, endDate?, limit?, offset?)` — completed exercise history, recorded-set PRs, volume, and explicitly labeled estimated one-rep max.
- `get_activity_history(startDate?, endDate?, activityType?, limit?, offset?)` — recorded non-strength activity, including BJJ when the activity name identifies it.
- `get_nutrition_summary(startDate?, endDate?, limit?, offset?)` — logged foods and totals. A nutrient total is `null` when any entry in the range lacks that nutrient.
- `get_body_measurements(startDate?, endDate?, limit?, offset?)` — recorded weight and body-fat check-ins.
- `get_fitness_goals(asOf?, includeArchived?)` — goals and progress using Stride's existing goal calculation.
- `get_workout_templates(limit?, offset?)` — saved planned workout templates, clearly separate from workout history.

All date ranges are inclusive ISO calendar dates. List tools default to a recent date range and use bounded pagination. The MCP integration only returns fields stored by Stride; it does not infer RPE, calories, body composition, or psychological state. Logged activity is presented as a recorded activity; workout records with `completed: false` are reported as planned.

## Deployment configuration

The deployment needs the existing Stride D1 binding (`DB`), authentication session secret (`AUTH_SESSION_SECRET`), and the account sign-in providers already configured for the site. `MCP_PUBLIC_BASE_URL` is optional and defaults to `https://stridefitness.app`; set it to the canonical HTTPS origin if deploying this server under another production hostname. OAuth tables are initialized lazily in D1. No new long-lived OAuth signing secret is required because token material is random and only its SHA-256 hash is stored.

## Existing private logging prototype

The prior `/api/mcp/[token]` endpoint remains available for compatibility with existing private connections. It retains its original `log_food`, `log_activity`, and `get_daily_log_summary` behavior and is **not** the account-linked ChatGPT connection described above. Existing users of that prototype should migrate their ChatGPT connection to `/api/mcp` and OAuth before removing its `MCP_LOG_TOKEN` and `MCP_ACCOUNT_ID` deployment settings. Treat those legacy URL credentials as secrets and rotate them if exposed.
