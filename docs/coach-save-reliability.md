# Coach save reliability

Structured coach mutations are reviewed as account operations. Plan creation and plan changes, template edits, session edits, next-set targets, exercise creation, goals, nutrition targets/adjustments, profile updates, body measurements, and reusable activity templates all use `POST /api/coach-operations`.

Each operation contains a UUID, action family, record/field patches (with prior and proposed values), and the expected account revision. Patches are applied to freshly loaded server state; they are not whole-account replacements. The server checks authorization, account identity, revision, allowed fields, schemas, references, unique IDs, numeric bounds, and logged-set preservation. A D1 transaction commits the compare-and-swap update and its receipt together. A repeated account/operation ID returns the original receipt; changing its payload is rejected. Receipts are checked before revision validation, so a lost response can be reconciled after subsequent account changes.

One per-page coordinator serializes account autosaves and coach operations. It flushes preceding edits, waits for server acknowledgement, adopts authoritative data, and merges unsaved field/record changes, including edits made before retrying an uncertain operation. A conflicting field stops synchronization instead of overwriting it. Different tabs still use the server revision guard. Old tabs without the account identity header must reload.

Proposals and uncertain saves are journaled before network requests, under the authenticated account ID. They remain available after navigation and refresh. A pending or uncertain operation keeps its ID and payload. Unknown outcomes must be checked before they can be discarded. The profile editor keeps the training subtree mounted and sends saves through the same coordinator. No unscoped `stride-v1` cache is loaded.

The UI distinguishes Proposed, Saving, Saved to your account, and Needs attention. Review details and affected-area links are provided. Native nullable nutrition render blocks were replaced by a safe shared change renderer. Coach panels and operation cards have local error boundaries.

## Verification

Disposable in-memory SQLite and the actual route/coordinator code are used by `tests/account-operations.cjs`; proposal/card rendering uses React server rendering.

| Scenario | Result / verification |
| --- | --- |
| 1. Activity-only proposal | Passed: validation and actual card rendering |
| 2. Goal-only proposal | Passed: validation and actual card rendering |
| 3. Measurement-only proposal | Passed: validation and actual card rendering |
| 4. No proposed mutation | Passed: parsing and conversation rendering |
| 5. Acknowledgement before Saved | Passed: held response; neither success nor mutation appears early |
| 6. Refresh/reopen after save | Passed: fresh coordinator loads committed database data |
| 7. Double-click Apply | Passed: shared in-flight promise, one request |
| 8. Retry same operation | Passed: same receipt, no duplicate records |
| 9. Commit with lost response | Passed: exact original operation reconciled; edits before retry retained |
| 10. Failure before commit | Passed: no mutation or success, then retry succeeds |
| 11. Another tab writes | Passed: stale revision rejected; reviewed reapply preserves other tab's edit |
| 12. Edit during save | Passed: subsequent local edit and queued autosave preserve AI result |
| 13. Navigate/remount/refresh pending | Passed: coordinator remount and uncertain-save recovery; browser navigation not exercised |
| 14. Profile/settings interruptions | Passed: profile save integration and source check that training subtree remains mounted; not a live browser test |
| 15. Invalid mutations | Passed: bad references and numeric bounds rejected without state changes |
| 16. Completed sets | Passed: logged sets preserved, destructive payload rejected |
| 17. Account switch | Passed: scoped journal loading plus server identity rejection |

Every action family was separately committed and retried. Injecting a failure between receipt insertion and state update rolled both back. Existing training-persistence, template-coach, adaptive-coach, activity-coach, and measurement schema regression tests also passed.

## Limits

- These are route, coordinator, renderer, and source-structure checks, not authenticated live-browser end-to-end tests.
- Pending proposals are device-local until committed; clearing browser storage removes uncommitted drafts. Storage failures block proposal submission rather than pretending it is recoverable.
- Overlapping same-field changes require review, discarding local changes, or a new coach proposal; they are never force-merged. Downloadable recovery copies remain available, including legacy account-scoped backups.
- The production build passes. A full TypeScript check still reports the two pre-existing response-typing errors in `components/ai-connection.tsx` and `components/reset-user-button.tsx`, outside this save flow.
