# First-run audit and implementation — 2026-09-15

## Findings and decisions

| Journey area | Finding | Change / decision |
| --- | --- | --- |
| Authentication / signup | Existing dispatch-owned ChatGPT authentication; onboarding starts after identity resolution. Local authenticated preview loops through redirects. | Preserve authentication and server-side account scope. No auth bypass added. Live signup/sign-in remains unverified in this session. |
| First login | Welcome required a body-map choice before choosing a task, then plan creation presented another choice plus five questions. | Open directly on a short training brief. Offer an existing-routine branch and manual setup on the same surface. Collect the existing required body-map field at review. |
| Profile / goals / history / experience | Profile interview and plan setup overlap. Interview replies acknowledge answers without extracting structured profile values. | Reuse the real planner's structured profile proposals. Show editable values before they enter the normal profile. Only explicit facts are extracted; unknown fields remain null. |
| Equipment / schedule / preferences / limitations | Useful constraints are spread over multiple optional interview screens. | Accept them naturally in the brief. AI asks one essential follow-up only when needed. Optional manual fields remain available. Users can revise the workout after correcting a constraint. |
| Nutrition / body composition | Planner proactively introduces adjacent nutrition and goal configuration, which can delay the first workout. | First-run instructions defer unrelated features and nutrition questions. Explicit tracking requests still produce reviewable proposals. Existing nutrition and body-measurement features are unchanged. |
| AI experience | Core plan generation already uses real structured model output with catalog validation, provider funding controls and explicit save actions. | Reuse this system; add a first-run context that can run before a completed profile exists. No simulated responses in production. Missing AI access or provider errors preserve setup and offer manual continuation. |
| First useful result | Plan arrives after setup rather than providing value during setup. | Show real workout cards as soon as enough context exists. User can change sets, reps and loads directly or request exercise/schedule changes. Unknown loads remain unset in the preview; existing target calibration applies during logging. |
| First workout / library discovery | Existing template picker, searchable exercise library, exercise help, quick set logging and optional effort fields are already functional. | Accepted onboarding workouts become real saved templates and open the normal workout picker. Preserve the library, logging and advanced controls. Improve empty workout and progress copy/actions. |
| Overview / empty states | Welcome mainly describes capabilities and offers a tour. | Give the empty-state coach a concrete workout task. Keep the optional tour. Existing ready-to-train card and unfinished-session resume remain available. |
| After first workout | Completion returns to Overview with a transient completion message. | Add a concise first-session card with actual successful/failed set counts and targets/reasons from the existing adaptive engine. Explicitly distinguish a baseline from a trend. |
| Optional integrations / permissions | AI connection and optional photos already exist. | Preserve these systems; no new permissions or integrations. Photos are not required or surfaced in the new intake. |
| Interrupted onboarding | Initial welcome, setup answers and unfinished planner questions are held in component state. | Save brief, follow-up text, profile proposal, conversation, stage and generated plan in account-scoped D1 drafts. Debounced saving has visible status and recoverable errors. Unsaved work warns before navigation. |
| Existing users | Existing profile is the gate into the main app; legacy profiles can require body-map completion. | Preserve existing-user behavior and profile editor. New completion refuses to replace an already populated profile or training account. |
| Acceptance / data integrity | Existing account coordinator protects normal training writes. | Initialize first-run profile, accepted templates, optional explicitly requested tracking proposals and planner history in one conditional account write. Cross-device draft and account revisions prevent stale overwrites. Repeat completion cannot append duplicates. Rejected workout suggestions remain a draft in the ordinary planner, never active templates. |
| Analytics | Existing telemetry covers account activity and AI request counts, not an onboarding funnel. | Retain existing telemetry; do not introduce a separate invasive event pipeline. Draft timestamps support resumption, not claims of funnel analytics. |

## Verification

- `tests/onboarding.cjs`: executes real onboarding domain code and route handlers against SQLite. Covers auth/origin guards, separate draft state, refresh/device resumption, stale revisions, cross-account and live/test isolation, structured extraction, manual and skipped optional fields, beginner and experienced-routine cases, direct review edits, accepted/declined plans, valid catalog references, existing accounts, duplicate completion and the first-run AI route. AI provider transport is mocked in tests; assertions verify the actual request context and catalog mapping.
- Profile route regression suite passed.
- Existing coach flow regression suite passed.
- Account operations regression suite passed, including acknowledged persistence, retries, concurrent edits and isolation.
- TypeScript and production build passed.
- The existing “New account” test scenario now omits its prefilled profile so it enters the real first-run flow.
- Existing `training-persistence.cjs` and `adaptive-coach.cjs` harnesses fail to resolve newly referenced path aliases (`account-scope` and `fitness-clock`) before assertions. These unrelated harness failures are not represented as passing.
- Browser end-to-end and visual/mobile interaction verification are **not completed**. The preview initially hit an authentication redirect loop; automatic approval review subsequently rejected isolated browser fixture navigation because it did not recognize the attached testing request as explicit browser authorization. No bypass was attempted.
- A reproducible 390px isolated UI fixture is retained under `tests/fixtures`; simulated provider responses are labeled and fixture output is removed from public assets before publication. It is not evidence of a live AI or sign-in test.

## Remaining verification

With explicit browser authorization, test the complete authenticated new-user flow on mobile and desktop, all eight requested personas/paths, real provider output quality, installed-PWA resume and a second-device session. Existing-account data is protected by tested route checks, but production behavior and visual polish should not be called browser-verified until those runs are completed.
