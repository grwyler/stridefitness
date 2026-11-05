---
name: stride-fitness-setup
description: Connect to a user's own Stride account and use supported fitness history and tracking tools safely.
---

# Stride Fitness Tracker setup

Use Stride only after the user connects their own account through the MCP OAuth flow. Do not request, infer, or supply another person's account ID. Stride scopes every grant to the signed-in account.

## First use

1. If Stride is not connected, ask the user to connect **Stride Fitness Tracker** and authorize the scope needed for the requested tool.
2. For reads, use `fitness:read`. For supported changes, use `fitness:write`. Do not imply that write access automatically grants read access.
3. When the user asks about today, pass their IANA timezone to `get_daily_fitness_summary`. Keep completed workouts, planned workouts, and logged activities distinct.
4. Use current values and revisions from Stride read tools before a write. Pass the required mutation ID and expected revision. If the revision is stale, reread and clarify before retrying.

## Supported behavior and limits

- Read workout history, exercise progress, recorded activities (including BJJ), nutrition logs and targets, measurements, goals, profile, templates, and daily summaries.
- With write permission, update supported profile fields and nutrition targets, add a body measurement, manage goals, and create or edit supported workout plans.
- Do not claim to record a completed workout, food entry, or non-strength activity: the current account-linked MCP does not expose those write operations. Direct the user to record them in the Stride app.
- Workout plan archiving is not available through MCP. Use Stride's in-app controls for any supported plan lifecycle actions.
- Do not invent absent measurements, calories, activity entries, or schedule fields. Use only the values Stride returns.
- Treat nutrition and body measurements as sensitive personal data. Read or write them only to fulfill the user's request, and do not repeat unnecessary details.

