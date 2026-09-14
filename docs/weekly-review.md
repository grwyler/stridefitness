# Weekly Intelligent Review

Weekly Review is an Overview entry point. Opening a review reads the latest account-scoped review; generating or refreshing it examines seven inclusive local calendar dates and up to three preceding weeks for comparison. It never changes fitness records automatically. A due message appears seven days after the last review; there are no background jobs or notifications.

## Grounding and selection

The server reads the authoritative stored account, rather than accepting a browser-supplied fitness snapshot. It summarizes completed strength sessions, every set status, actual versus saved targets, effort, external activity logs, active goals, recent body measurements, logged nutrition, and prior weekly recommendations. Evidence buttons show the exact records used; workouts can be opened directly. Internal IDs are not displayed.

Conservative deterministic eligibility rules produce possible next focuses. Repeated failures outrank increases; misses after prior recommendations prevent blind progression; nearby vigorous activity can hold an otherwise successful progression. Increases require two comparable, successful recorded sessions and reuse the existing adaptive progression calculation. If several equally eligible options remain, the existing AI connection may select one using goals and observed outcomes. The model returns only a validated candidate key, never prose, numbers, or mutations. Unavailable AI falls back to the highest-ranked grounded option, labeled as performance-rule selection. Exactly one primary recommendation is retained.

The first version directly applies one exercise's existing next-workout target override (load, reps, and set count). This intentionally uses the target actually read when a session starts, rather than editing a template that the existing adaptive behavior would override. No automatic goal, calorie, or template rewriting is introduced. Those records inform the review. Holds, continuing, and collecting more data are valid outcomes.

## Missing data

- No records means no *recorded* activity; it does not prove inactivity.
- Activity logging completeness is unknown. Lower recorded activity is not described as an actual decline.
- Nutrition averages require at least five days with a single explicit “Daily total” entry containing both calories and protein. Multiple entries, missing nutrients, or individual meals remain partial/unknown; calories are never used to assert an energy deficit or surplus. This is a conservative inference from existing entry labels, not a new completeness-tracking feature.
- Measurements need four distinct dates over at least a week within the comparison window, including a recent point. Values and dates are shown without medical or tissue-change conclusions.
- Fewer than two comparable exercise sessions cannot justify progression or reduction.
- Effort uses the existing difficulty fields; no sleep, HRV, readiness, fatigue score, or invented RPE is added.

## Review → action → outcome

Reviews and current-experience feedback are retained in an account-scoped D1 table. Edit before applying only edits a proposed target. Preparing a target checks the review's account revision, validates the existing exercise and numeric bounds, and locks its stable operation ID and payload. It then stages through AccountCoordinator and POST /api/coach-operations. Only that existing transactional endpoint commits a fitness change and receipt. Navigation/refresh can reopen the prepared action. Double submission uses the same operation identity. Reset/delete also removes weekly reviews.

Later reviews join prior prepared recommendations to their account-scoped confirmed receipts and compare subsequent completed workouts for that exercise against the exact recommended target. Different targets, modified/skipped/unfinished work, and insufficient later records produce explicit uncertainty. Matching performance without a receipt is described as observation, not proof of application or causation. A date-only record on the recommendation date is not ordered after it. Edited targets are evaluated as actually proposed. Legacy conversation promises are never treated as evidence of a saved change; structured outcome evaluation begins with Weekly Review history.

## Verification

`tests/weekly-review.cjs` exercises synthetic histories for successful progression, repeated failed sets, mixed completed/modified/failed/skipped sets, high external activity, conflicting signals, empty and sparse records, sufficient/sparse bodyweight history, explicit/partial nutrition, holds/no-change, and successful/unsuccessful prior recommendations. It executes the actual review endpoint, operation endpoint, and coordinator with disposable SQLite, checking authoritative reads, no silent mutation, editable proposals, first-payload locking, stable identity, held-acknowledgement lifecycle, duplicate receipts, refresh persistence, invalid-target rejection, feedback persistence, and account isolation.

The existing account-operation, adaptive-progression, and training-persistence regression suites pass. TypeScript and production build pass.

## Boundaries

This version offers one directly applicable exercise target, not arbitrary AI edits across all account fields. Nutrition and measurement completeness remains limited by existing logging metadata. Historical evidence is retained with the review and may differ from subsequently corrected records; users can refresh against current data. No background changes, scheduling, notifications, new goal types, nutrition systems, scores, or integrations are added.
