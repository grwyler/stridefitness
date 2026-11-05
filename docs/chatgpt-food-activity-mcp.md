# Stride Fitness MCP for ChatGPT

Stride exposes an account-linked MCP server at:

```text
https://stridefitness.app/api/mcp
```

Use that exact URL when adding a custom MCP server. It uses the same Stride account and D1 training snapshot as the web app. Never add a token or account identifier to the URL.

## Connect or upgrade in ChatGPT

1. In ChatGPT on the web, open **Plugins**, select the **+** button, then choose **Add custom MCP server**.
2. Set the server URL to `https://stridefitness.app/api/mcp` and name it **Stride Fitness**.
3. Choose **OAuth**. Keep the generated Client ID Metadata Document or DCR choice selected; Stride supports both public-client flows.
4. Connect and sign in to the Stride account you want to use. Review the permission page. Select **read and write** access to update your profile, nutrition targets, goals, body measurements, or workout plans. Read-only grants continue to work for all existing read tools.
5. Finish the connection, then start a chat with Stride enabled. To upgrade an existing read-only connection, reconnect/reauthorize it and grant `fitness:write`; read-only tokens remain read-only until that step.

The ChatGPT connection uses OAuth authorization code flow with PKCE S256. Discovery is available at `/.well-known/oauth-protected-resource/api/mcp` and `/.well-known/oauth-authorization-server`. Access tokens are short-lived, opaque, and stored only as hashes; refresh tokens rotate and replay revokes the grant. Stride binds each grant to the authenticated account and checks the required scope on every tool call.

## Available tools

Read tools require `fitness:read`:

- `get_profile` — stable account identity for the authenticated connection.
- `get_fitness_profile`, `get_nutrition_targets` — current editable values and write revision.
- `get_daily_fitness_summary` — date/timezone aware daily record; completed workouts, planned workouts, and logged activities remain separate.
- `get_workout_history`, `get_exercise_progress`, `get_training_progress`, `get_activity_history`, `get_nutrition_summary`, `get_body_measurements`, `get_fitness_goals`, `get_workout_templates`.

Write tools require both `fitness:read` and `fitness:write`:

- `update_fitness_profile` — updates the fields in Stride’s real profile schema: name, sex, age range, goal, experience, days per week, session minutes, equipment, limitations, use style, coach style/intensity, plus existing strength context (bodyweight, height, comparison, recovery figure).
- `set_nutrition_targets` — daily calories, protein, carbohydrate/fat pair, hydration, and activity-calorie adjustment. Food logs are not changed.
- `add_body_measurement` — weight (lb) and/or body-fat check-in. Only call when the user clearly asks to log this sensitive data.
- `create_fitness_goal`, `update_fitness_goal`, `record_goal_progress`, `set_fitness_goal_status`, `delete_fitness_goal` — uses the existing goal model/progress rules. Completion preserves a goal as archived history. Goal deletion requires `confirmDelete: true` and an explicit user request.
- `create_workout_plan`, `update_workout_plan`, `edit_workout_plan_exercises`, `duplicate_workout_plan` — saved Stride templates and supported exercise prescriptions. Edits can add/remove/replace/reorder exercises and update weight, reps, sets, rep ranges, set schemes, and progression policies.

Each write includes a UUID `mutationId` and the latest `expectedRevision` from a read tool. This prevents stale overwrites and duplicate create operations on retried calls. Successful write results list the changed paths before and after. On a revision conflict, reread the relevant profile, target, goal, or plan and ask before reapplying a broad change. For unclear or multi-part requests, read the current configuration and confirm the specific changes before writing.

## Model-supported limits

Stride’s existing profile stores training availability as `days` and `minutes`, not selected weekdays. Workout templates do not currently store weekdays, a selected active plan, or an archive flag. The MCP will not fabricate those fields. No plan-archiving tool is exposed; use the in-app controls available for plan lifecycle. Plans are never activated automatically when created. Existing app schedule/selection behavior remains unchanged.

The service returns only facts already stored in Stride. It does not infer RPE, calories, body composition, schedule days, or training preferences. Nutrient totals remain unknown where source logs lack a value. Goal and plan edits remain scoped to the current OAuth account, and tools do not accept caller-supplied account IDs.

## Legacy connection

The previous private `/api/mcp/[token]` prototype remains available for compatibility with its `log_food`, `log_activity`, and `get_daily_log_summary` behavior. It is separate from the account-linked server above. Existing prototype users should migrate to `/api/mcp` and OAuth before the legacy token settings are removed. Treat any legacy URL credential as a secret and rotate it if exposed.

## Deployment configuration

The integration uses the existing Stride D1 `DB` binding, sign-in providers, and existing account identity. OAuth token/grant tables initialize lazily; no new long-lived OAuth signing secret is needed. `MCP_PUBLIC_BASE_URL` is optional and defaults to `https://stridefitness.app`; set it to the canonical HTTPS origin only when deploying elsewhere.
