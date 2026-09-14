# Daily logging friction pass

Counts below start at the relevant screen/section and exclude typing, scrolling, and field focus. They are interaction comparisons, not measured user analytics.

| Flow | Before | After |
|---|---|---|
| Start suggested/saved workout | One direct start or picker + selection | Preserved; today’s completed workout replaces the Overview repeat prompt |
| Complete a set | One small icon; second tap uncompleted it | One large labeled button; repeated completion cannot undo it |
| Change weight/reps | Clear/retype; numeric input had no explicit input mode | Select-on-focus, decimal/numeric keyboards, Enter advances to reps/completion |
| Failed/modified/skipped | Open result menu + select (2 actions) | Direct result buttons (1 action) |
| Optional difficulty/notes | Always occupied each row | One disclosure, existing difficulty and notes remain editable |
| Move to next set/exercise | Find/scroll to it | Next pending set highlighted and scrolled into view; exercise jump controls |
| Finish without calorie estimate | Open dialog, required weight/time, confirm | One action; remaining sets explicitly indicated as skipped before finishing |
| Finish with calories | Required dialog | Optional existing dialog |
| Correct set/history | Same inline fields; accidental toggle easy | Same record edited inline; explicit Undo; completed sessions remain editable |
| Repeat activity | Template required; past logs not reusable directly | Recent activity + save (2 actions), editable first |
| New activity | Create template, save, open log, save (4 actions) | Open log + save (2 actions); no template required |
| Repeat food | One-tap reuse | Preserved with undo and partial-day clarity |
| Daily total | Could add a second total | Existing daily total opens for editing; overlap warning and full/partial labels |
| Bodyweight | Expand tracking, add check-in, save (3 actions) | Log weight + save (2); today’s existing entry opens directly for correction |
| Find activity/food/weight | Scroll through Progress | Local section shortcuts; Overview remains uncluttered |
| Current recommendation | Guidance plus per-set target | Per-set target remains visible; explanation behind disclosure |

Manual writes still use account coordination/autosave. The sticky account status reports Saving, acknowledged Saved to your account, or Needs attention. AI operation handlers and receipts are unchanged. No analytics service or persistent click telemetry was added: useful future measurements are actions to first completed set, correction counts, started/completed ratio, and abandoned entry drafts.

## Verification

390px iframe browser fixture uses the production logging components and synthetic local React data, without account APIs. Exercised start, several completed sets, value edits, failed/modified/skipped, optional difficulty/note, Undo, second exercise, finish, completed-history correction, repeated/new activity, food reuse, daily total and correction, bodyweight and same-day correction. Visually checked touch controls and no horizontal clipping. This does not emulate a physical mobile keyboard or verify whole-app scroll/navigation and authenticated persistence. Account-operation and Weekly Review integration suites cover durable save/retry/conflict/account isolation and completed-set protection separately. Local-day and latest-activity tests cover the Overview correction and reuse semantics.

Fixture build output must be removed from public/logging-qa before production build. The fixture generator is a test utility, not a published product route. Authenticated preview has a sign-in redirect loop; no authentication protections were changed to make tests work.
