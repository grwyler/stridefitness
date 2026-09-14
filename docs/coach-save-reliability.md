# Coach save reliability

Structured coach mutations are reviewed as account operations. Plan creation and plan changes, template edits, session edits, next-set targets, exercise creation, goals, nutrition targets/adjustments, profile updates, body measurements, and reusable activity templates all use `POST /api/coach-operations`.

Each operation contains a UUID, action family, record/field patches (with prior and proposed values), and the expected account revision. Patches are applied to freshly loaded server state; they are not whole-account replacements. The server checks authorization, account identity, revision, allowed fields, schemas, references, unique IDs, numeric bounds, and logged-set preservation. A D1 transaction commits the compare-and-swap update and its receipt together. A repeated account/operation ID returns the original receipt; changing its payload is rejected. Receipts are checked before revision validation, so a lost response can be reconciled after subsequent account changes.

One per-page coordinator serializes account autosaves and coach operations. It flushes preceding edits, waits for server acknowledgement, adopts authoritative data, and merges unsaved field/record changes, including edits made before retrying an uncertain operation. A conflicting field stops synchronization instead of overwriting it. Different tabs still use the server revision guard. Old tabs without the account identity header must reload.

Proposals and uncertain saves are journaled before network requests, under the authenticated account ID. They remain available after navigation and refresh. A pending or uncertain operation keeps its ID and payload. Unknown outcomes must be checked before they can be discarded. The profile editor keeps the training subtree mounted and sends saves through the same coordinator. No unscoped `stride-v1` cache is loaded.

The UI distinguishes Proposed, Saving, Saved to your account, and Needs attention. Review details and affected-area links are provided. Native nullable nutrition render blocks were replaced by a safe shared change renderer. Coach panels and operation cards have local error boundaries.

## Published-browser verification — 2026-09-14

Performed against the actual published stride-fitness application, using its normal UI and clearly labeled QA-0914 disposable records. No mock browser responses or production history reset were used. Browser checks began on version 63, verified the runtime repair on version 64, and verified manual profile/status cleanup on version 65.

| Live scenario | Observed result |
| --- | --- |
| Account loading | Initially FAILED with native fetch “Illegal invocation”; fixed the coordinator’s fetch receiver. Published reload then loaded the existing account normally. |
| Activity-only | Proposed card rendered, survived Templates/profile navigation, double Apply showed Saving with disabled controls, then Saved to your account. Refresh showed exactly one reusable activity. |
| Goal-only | Rendered; a second tab manually created a custom exercise before Apply. The stale goal showed Needs attention. Reviewed retry saved it once; refresh retained both the goal and unrelated exercise. |
| Measurement-only | Body-fat-only historical proposal rendered with null weight; Saving then Saved to your account; refresh retained exactly one measurement. |
| Nutrition-only | Base target 2200 → 2201 rendered and saved with the visible lifecycle; refresh retained 2201 with protein 165 and activity adjustment 50% unchanged. Restored 2200 manually. |
| Template/workout | Created a disposable manual workout/template. Coach revised its target to 2 × 6 at 5 lb. Saving preceded Saved to your account. Refresh showed one template; starting it produced the expected two sets. |
| Combined changes | Goal + activity in one card and measurement in another rendered together; both remained Proposed after refresh and were discarded. |
| No changes | A set-versus-rep explanation rendered normally, with no new operation card. |
| Completed-set protection | Session coach changed only set 5 from 10 × 8 to 5 × 6. After refresh, sets 1–4 remained 10 × 8 completed, 10 × 3 failed, 5 × 8 modified, and 10 × 8 skipped. |
| Invalid/outdated target | Proposed template reps 6 → 7, then manually changed reps to 8. Apply produced Needs attention with a same-information explanation. Refresh preserved both the rejected proposal and manual 8 reps; discard recovered normally. |
| Manual workout/history | Created/edited a workout, logged all four attempted/skipped statuses, completed it, then edited completed historical reps and note. Refresh retained the manual correction. |
| Manual activity/nutrition | Logged a disposable activity and food; both were present after refresh. Activity verified on its historical date. |
| Manual goals/measurements | Edited goal target to 3 and body-fat check-in to 20.2; refresh retained both. |
| Manual profile | Changed nickname temporarily, saw Saving, then acknowledged account status; refresh/profile reopen retained it. Restored original nickname. No AI operation card was created. |
| Adaptive behavior | Baseline and next-set recommendations rendered during manual logging; existing progression regression tests also passed. |

The live duplicate tests used rapid double Apply on activity and goal. The UI suppressed duplicate submission; after refresh each had one logical record. A read-only inspection of the production operation table confirmed a committed receipt for the activity. Forced duplicate POST replay, response loss, held acknowledgements, and account switching were verified by the actual route/coordinator test harness, not by live network interception.

All disposable goals, measurements, activities/logs, nutrition entries, workouts, and templates were deleted through the UI, and the original calorie target/profile restored. One clearly named unused custom exercise, QA-0914-Movement, remains because the app has no exercise-delete control. QA conversations and durable operation receipts remain as audit history. The pre-existing real workout was not edited.

## Cleanup and TypeScript findings

- `lib/account-coordinator.ts`: invoking a stored native fetch as an instance method bound it to the coordinator, causing a browser-only account-loading failure. The default transport now invokes fetch as a global function. Added a receiver-sensitive regression test; injected transports alone had hidden this bug.
- `components/ai-connection.tsx`, original line 77: `Response.json()` returned unknown, but the billing state setter expected a specific object. Added Zod validation before state updates. This was a typing error with a latent runtime malformed-response risk in AI funding/connection display.
- `components/reset-user-button.tsx`, original line 12: error handling accessed `.error` on unknown JSON, and HTTP 200 was treated as a confirmed admin action without validating its result. Added validated error extraction and exact successful action acknowledgement. This was a typing error plus a latent malformed-response/false-confirmation bug in admin reset/delete/AI-access actions. No real admin reset was performed.
- No `any`, suppression directives, disabled checks, or broad casts were introduced to fix either TypeScript error. Shared response schemas live in `lib/api-responses.ts`.
- Manual profile saves now use the serialized manual account-save path instead of creating coach operation records. Interrupted uncertain AI saves explicitly explain why manual synchronization is waiting; local edits remain recoverable.
- Removed optimistic manual “saved/updated” toasts, exposed account synchronization status, standardized plan acknowledgement text, and removed operation-ID wording from user-facing errors.
- Strengthened the shared coach instructions after one live response said “I've created” while its action was still Proposed. Model-authored prose is not a durable acknowledgement; only the application status is authoritative. Historical conversation text was not rewritten.
- Replaced an obsolete profile test that extracted the former SQL statement with actual endpoint execution and assertions for initialization, preservation, revision rejection, and invalid payload rejection.

## Automated verification

Production build and full `tsc --noEmit` pass. `tests/account-operations.cjs` exercises the actual route and coordinator against disposable in-memory SQLite, including all supported action families, stable duplicate receipts, commit-with-lost-response recovery, pre-commit network failure, concurrent/local in-flight edits, refresh recovery, account isolation, invalid references/numbers, protected logged sets, and atomic rollback of both receipt and account update. It also covers default fetch receiver behavior, manual profile persistence without AI receipts, and malformed API response schemas.

Training-persistence, template-coach, adaptive-coach, activity-coach, coaching-measurements, and profile regression tests pass.

## Remaining limits / beta assessment

- Live offline/response-loss injection and a second test-account identity were unavailable. Those paths passed automated tests but still need real-browser release-gate coverage before an unrestricted external beta.
- Live UI observation confirms Saving before Saved and refresh persistence. Precise held-response acknowledgement ordering was proven in the transport harness rather than browser network interception.
- Proposed work survived main-page/profile navigation and refresh. Navigation during a deliberately stalled save, and editing while a deliberately stalled save is in flight, were covered by the coordinator harness rather than a live stalled network.
- Pending proposals are device-local until committed; clearing browser storage removes uncommitted drafts.
- Same-field conflicts require review, discard, or a fresh proposal; the system never force-merges them. Unknown commit outcomes must be checked before discarding.
- Generative coach prose can still be imperfect despite explicit instructions. The four application-owned save states are the confirmation contract.

The observed save paths are substantially safer, but the remaining live network/account-isolation gates mean this pass does not certify an unrestricted external beta.
