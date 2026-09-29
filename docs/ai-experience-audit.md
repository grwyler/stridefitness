# Stride AI experience audit

**Audit date:** 2026-09-29  
**Scope:** Current source in this checkout. Product/UX audit only; no product behavior was changed.

## Evidence labels

- **Code finding:** directly visible in current source.
- **Observed behavior:** reported by the requester, not independently reproduced here.
- **Hypothesis:** plausible explanation that needs testing.
- **Recommendation:** proposed direction, not a statement about current behavior.

## A. Executive Summary

**Code finding:** Stride already has a broad AI action layer. It can generate and refine plans; propose edits to templates and active workouts; add library exercises; parse natural-language food, water, and activity logs; propose goals, nutrition tracking, and activity templates; explain progress; update recovery state; save profile facts; and provide next-set advice. Most in-app changes require review and approval. A private ChatGPT MCP integration can directly log food/activity and return daily summaries.

The product problem is not missing capability. Most capabilities are reached through separate “Your coach” launchers or a generic “Coach” destination. Users must infer which surface handles which job. Logs has a clearer “Log with AI” label, but users still need to open a coach. Ordinary forms do not consistently reveal the natural-language shortcut at the moment it could save effort.

**Highest-level opportunity:** keep direct controls prominent; use natural language where it removes multiple fields, navigation, or interpretation work; reveal that capability in context with a small example. Keep full chat optional for advice, explanation, and follow-up rather than the default path for every action.

Current onboarding is not AI-only: it offers immediate “Start logging,” coach/routine/manual modes, “skip coaching,” optional profile settings, saved drafts, and editable results. The AI path still asks the user to write a brief, wait, judge a result, and decide whether to save before they have used the product. The reported 98/100 skip rate matters, but the repository does not include the study protocol, cohort, instrumentation, or exact tested build; it cannot explain why users skipped or establish that they reject AI.

## B. Current AI Architecture

| Capability / entry point | UI and trigger | Server / domain path | Action and persistence |
|---|---|---|---|
| First-run workout creation | `components/onboarding.tsx`; coach/routine mode; user submits a brief and can refine | `POST /api/plan` with `onboarding: true`; `lib/onboarding.ts` | Returns plan/profile/tracking proposals. User reviews profile and workout cards, can edit sets/reps/load, then explicitly saves. Draft persists separately; completion conditionally applies accepted data. |
| General workout planning | Main Coach toolbar opens a right-side `PlanChat`; other Create plan actions enter it | `POST /api/plan`; `lib/plan.ts` | Generates/refines catalog-validated templates using training context. Draft remains unsaved until “Save plan.” Related food/progress/profile proposals have their own approval UI. |
| Template questions and edits | Library coach launcher, “Adjust with coach,” or selected-template coach panel | `POST /api/plan` with `templateEdit: true`; `lib/template-coach.ts` | Proposed full-template edit is shown; user approves or discards. May also return tracking proposals. |
| Active workout advice/editing | Workout screen `SessionCoach`; prompts include approach, set review, goals | `POST /api/session-coach`; `lib/session-coach.ts`, `lib/apply-session-changes.ts` | Advice is conversational. Structured edits to exercises/workout/targets are listed for approval; stale workout snapshots are rejected. |
| Progress, goals, nutrition, recovery, activities | Progress view launcher | `POST /api/progress-coach` with performance, goals, nutrition, measurements, and activity context | May answer, propose goals/targets/templates, recovery marker, or natural-language logs. Changes have approve/discard UI. |
| Food, water, activity capture | Logs view has a separate ProgressCoach mode titled “Log with AI” | Same `/api/progress-coach`; validated structured `logs` | Parses described items and shows a review card before saving. Activity calories use known body weight when available; no weight is invented. Normal forms remain. |
| Exercise Q&A / add exercise | Exercise library coach launcher; describes advice, alternatives, adding a movement | `POST /api/exercise-coach` | Answers questions; a new exercise is proposed with defaults and requires approval. Advice itself does not automatically replace a workout movement. |
| Next-set advice | Inline in active workout when deterministic `nextSetAdvice` finds an adjustment; omitted for “Just log workouts” style | `lib/adaptive-coach.ts`; no generative request | Shows reason and suggested target, user applies or keeps current target. Branded Coach, but deterministic. |
| Adapted targets and progression explanations | Overview/exercise displays and coach prompts | `lib/progression.ts`, `lib/adaptive-coach.ts`; read-only `read_training_recommendations` model-context tool in `app/page.tsx` when host supports it | Normal target calculation is deterministic. Coach can explain supplied history; read tool only exposes current recommendations. |
| Profile interview acknowledgement | `ProfileGate`; only selected goal/equipment/limitations answers call AI, if available and not “Just log workouts” | `POST /api/interview` | Acknowledges answer; user still reviews and saves structured profile. It does not itself extract structured profile fields. |
| Coaching preferences/offers | Coach style picker and save-offer cards | Coaching update schemas and coach memory | User reviews/saves selected profile or coaching updates; not every response writes memory. |
| External ChatGPT food/activity tools | Private MCP integration documented in `docs/chatgpt-food-activity-mcp.md` | `app/api/mcp/[token]/route.ts`; `log_food`, `log_activity`, `get_daily_log_summary` | Configured private account tool can write directly into synced Stride data. Unlike in-app proposals, the documented tool logs when invoked. Private URL is a credential. |

**Shared infrastructure:** plan/session/progress/exercise/interview routes call OpenAI Responses with structured schemas and use coach style/profile context, AI funding limits, usage accounting, and provider errors. `app/api/coach-operations/route.ts` validates and revision-checks approved operations. `components/account-sync.tsx` exposes a review dock and confirmed-action history, not general undo. `app/api/shared-ai/route.ts` serves a distinct shared assistant path, not a primary in-product action surface.

**Distinctions:** progression, recovery, energy, and next-set calculations are rule-based, not generative AI. The measurement form itself is deterministic. The private MCP is not ordinary PWA discoverability.

## C. AI Capability Map

| User intent | Normal UI path | AI path | Relative advantage | Classification |
|---|---|---|---|---|
| Start from an existing routine or goal | Create template, search library, configure days/exercises/sets/reps, save | Describe routine/goals/equipment; receive catalog-based templates for review | Fewer screens and less structured entry; interprets free-form constraints. Still involves waiting and reviewing. | **High-value** when starting/rebuilding a plan |
| Change a planned template | Open template, edit several fields/exercises | Describe swap, shorten, or adjust; receive full proposal | Stronger for compound, ambiguous edits; direct control is faster for one field. | **High-value** for multi-part edits |
| Modify today’s workout | Edit exercises/sets/targets directly | Session coach proposes add/remove/replace/rename/target changes | Saves navigation and multiple edits; approval adds trust step. | **High-value** for compound change; secondary for simple edit |
| Log meal with macros | Open Logs, expand food form, enter name/numbers/date | Describe meal/portion; AI estimates macros and presents proposal | Removes macro lookup and multiple fields; uncertainty needs visible estimates and correction. | **High-value** |
| Log water | Tap water action and enter amount | Say “I drank 24 oz” in chat | Little advantage over one numeric control. | **Low-value AI**; optional parsing only |
| Log weight | Open Body measurements, enter date/weight | State a weight update in a coach surface and review proposal | Saves a little navigation; form is already short. | **Useful secondary**; parsing can be invisible in existing command surface |
| Log external activity | Select/create activity template; enter date, duration, effort and other values | Describe sport/class/walk; propose log or reusable template | Interprets varied activity and reduces fields; do not invent weight or effort. | **High-value** for first-time/unusual activity |
| Understand progression / training context | Inspect workout history and deterministic reason | Ask coach with supplied history and goals | Explains comparisons across sessions in plain language. | **Useful secondary**, high where explanation is otherwise hard to find |
| Find exercise alternative | Search/filter library and read exercise help | Describe constraint and ask for substitute | Interprets equipment/goal constraints, but user still selects/applies. | **Useful secondary** |
| Add non-catalog exercise | Create exercise and enter category/mode/defaults | Describe movement; receive editable proposal | Reduces schema knowledge and typing. | **Useful secondary** |
| Apply next-set adjustment | Edit target manually | Deterministic inline coach suggestion and apply button | No model AI; localized recommendation can still reduce choice. | **Potentially unnecessary as AI**; retain deterministic logic |
| Mark soreness/recovery | Use recovery map/direct controls where available | Tell progress coach; approve 72-hour marker | May help locate region, but the task is a simple direct action. | **Low-value AI** absent accessibility need |
| Create goal / nutrition target | Open goals/nutrition settings forms | Describe intent; receive structured target proposal | Helps convert vague intent to a measurable setup; estimates require context/review. | **Useful secondary** |
| Log from another ChatGPT conversation | Return to Stride and use form | Private MCP tools log and return summary | Convenient outside the PWA; separate setup and not generally discoverable. | **High-value integration**, not PWA entry point |

## D. High-Value AI Capabilities

1. Natural-language workout creation and revision: maps goals, schedule, equipment, and movement constraints to a structured catalog; manual template setup spans more screens.
2. Multi-field workout edits: “replace X, make it 30 minutes, keep the rest” benefits from intent interpretation and a reviewable diff.
3. Food capture with macro estimates: removes manual macro lookup and form filling; the value is interpretation, not conversation.
4. First-time/nonstandard activity logging and reusable-template setup: maps varied activity descriptions to type, duration, effort, and reusable records.
5. Contextual training explanations: compare history and explain why a deterministic target held or changed. AI is explanation, not progression logic.

## E. Low-Value or Redundant AI

- Water entry: one numeric quick action is more direct and reliable.
- One-field weight or set/rep/load change: direct controls are faster; language matters for compound requests.
- Progression/recovery/energy calculations: keep transparent deterministic logic; a model may explain it but should not be credited with calculating it.
- Basic known exercise facts: prefer existing library help; use AI for comparison or personal constraints.
- Proactive adjacent offers in task-focused chat: `/api/plan` can offer a related feature after fulfilling a request. Even bounded offers can make completion feel like a funnel, especially in first run. Keep only when directly relevant and not declined.

## F. Discoverability Problems

- Global toolbar’s “Coach” label does not signal logging, workout editing, account updates, or exercise creation.
- Examples are mostly behind chat launchers, after the user has decided to enter.
- Separate plan/session/template/progress/log/exercise doors fragment a broad capability set. Contextual separation is reasonable, but users may miss capabilities outside a door’s home area.
- Food and body-measurement forms do not advertise that natural language can populate values; “Log weight” and the ordinary food form compete with the hidden chat shortcut.
- Exercise launcher describes general help, but alternatives still require opening a conversational panel.
- Proposal cards and the account-level review dock are safe but introduce a second review destination users must understand.
- AI connection/funding affordance appears inside opened coach/planning surfaces; AI may be discoverable but unavailable without setup.
- MCP capability is invisible to regular PWA users and should not be counted as in-product discovery.

## G. Coach / Chat Audit

Before opening, the main toolbar says “Coach,” with a small context indicator for an active workout or recovery state. Other launchers say “Your coach,” a context hint, and “Ask coach” or “Continue chat.” In Logs, the expanded panel is more explicit: “Log with AI.”

The full `PlanChat` surface is a mixture of conversational advisor, command interface, and action layer. The empty state mentions training, food logs, and next workout; quick prompts vary by context. History, photos, free-text messages, and structured proposals all live alongside one another.

**Strengths:** model gets relevant context; prompt examples help after entry; data changes are distinct proposals; plans are editable; selected session/template scopes the action; conversation can continue.

**Weaknesses:** full chat is the discovery gate; some contexts have no prompt chips; simple jobs use the same chat/send interaction as open-ended advice; separate instances and memory areas fragment the mental model. General planner conversations are archived when closed/reopened; other coach contexts keep their own histories, which can support continuity but also obscure a quick one-off task.

**Direction:** use task-specific “Describe”/“Change” entry for logging and object edits. Keep full coach chat optional for “why,” “what next,” and follow-up. Do not make a universal chat the default interaction for every capability.

## H. First-Run / Onboarding Audit

**Current code:** a new user sees three modes (“Help me get started,” “I already have a routine,” “I’ll set things up myself”), an immediate “Start logging” path, a brief input, optional profile review, and visible “Skip coaching.” AI can return structured plan/profile proposals; users can refine and edit sets/reps/load. Drafts persist. AI unavailability/errors preserve manual continuation. Existing-profile and legacy-profile routes differ.

**Remaining cost:** the AI route asks users to understand the brief prompt, formulate a description, wait, assess the result, review assumptions, and decide whether to save. Before generation, value is described broadly (“Get a workout made for you”); the example contains several facts. The alternate “Start logging” promises immediate action and explicitly removes setup.

**Hypotheses:** a blank brief may feel like homework/prompting; payoff and result size are unclear; users may not know their schedule/equipment yet; trust may be low before using product; “Start logging” is simply a better match for users who already have a routine. Conversely, users with a clear goal and no routine may value generated plans.

The evidence does not distinguish timing, presentation, information density, trust, commitment, readiness, or feature fit. It does not support removing plan generation.

## I. Interpretation of the 98/100 Skip Rate

**Observed behavior (reported):** 98/100 test users skipped an initial AI workout-generation interaction.

**Establishes:** under tested conditions, nearly all participants chose the available skip path over that screen. The interaction did not earn sufficient attention/confidence in that context.

**Does not establish:** users dislike AI; reject workout generation after seeing product value; would not use AI for food, activity, or editing; or prefer manual setup overall. It does not identify what “skip” meant cognitively or whether the tested UI is current.

**Evidence gap:** current onboarding tracks `onboarding_skip_coach`, mode choice, start logging, request, ready/error, and save events. This repo has no study report mapping the supplied count to events, cohort, exposure, or build. `docs/onboarding-audit.md` reports a September 15 redesign and says live browser/mobile verification was incomplete; it does not validate the study. Confirm study date/build and definitions before applying the result to current UI.

**Useful hypotheses:** perceived cost/value mismatch; task/readiness differences; immediate logging can beat an upfront AI task.

**Distinguishing tests:** brief-first versus useful editable default; immediate logging versus same screen without that route; segment by routine/goal clarity/prior training; compare one free-text entry with guided choices; measure task success, time, output quality, and later use, not only clicks.

## J. Contextual AI Opportunities

| Moment | Small discovery mechanism | Rationale / interaction |
|---|---|---|
| Food form | Optional “Describe a meal” entry beside normal form, with a short example | Parses several values. Show editable estimates and one add action; ask follow-up only for material ambiguity. |
| Frequent/recent foods | No AI; recent/saved meals and duplicate/edit controls | Deterministic recall is faster. |
| Weight check-in | Keep current form; parse explicit weight only if a natural-language field already exists | One value is simple; avoid a separate chat. |
| Template detail | “Describe a change” beside edit controls; example “Swap X” or “shorten to 30 min” | Context scopes a compound request; show diff and preserve manual editing. |
| Active workout | Clarify existing launcher as “Adjust today’s workout” and retain “Ask why” | Chat/follow-up helps for multi-change requests, not in-set control. |
| Progression | Inline “Why this target?” near deterministic reason | Show product explanation first; allow AI follow-up when needed. |
| Activity form | “Describe activity” alternate input | Useful for varied sports and template setup; ask only for missing duration/effort. |
| Post-workout | Existing deterministic completion summary plus optional “Ask about this session” | Do not interrupt completion with proactive chat. |

## K. Invisible AI Opportunities

- Parse language entered into normal food/activity forms and map it into editable fields without requiring a coach destination.
- Parse explicit weight/date in an existing natural-language action surface, leaving the normal form canonical.
- Translate plain-language exercise swaps into library IDs and show a before/after diff.
- Keep progression, energy, recovery, and target calculations deterministic; use AI to explain or interpret language.
- Do not call a model for one-click water, saved meals, or other known deterministic choices.

## L. AI Action / Trust Model

**Current safeguards:** schemas validate outputs; exercises map to catalog IDs; plans and logs remain proposals; template edits validate the selected template; session edits compare current workout entries; server actions are account-scoped, revision-checked, idempotent, and validated; users can inspect confirmed coach changes. An AI reply alone does not mutate in-app training data.

**Limits:** no general undo of a confirmed coach action is evident in the account review UI; it is history, not reversal. Estimates (macros, activity effort/MET) should remain visibly marked and correctable. Approval UI varies by action and not all cards provide the same before/after diff. Recovery changes show their 72-hour effect, but should remain exact and reviewable.

**Recommendation:** proportion confirmation to risk. Low-risk explicit logs can use an editable one-tap confirmation. Ambiguous or multi-field workout/nutrition changes need a concise diff. Provide a short undo window or reliable reverse action with a receipt; do not add repeated confirmation for trivial changes.

## M. Naming and Positioning

- **Coach** suggests advice, not that it can write logs or edit workouts.
- **AI Coach** adds technology but not clarity; avoid as primary label.
- **Assistant** is broad and still implies chat.
- **Ask coach** works for advice/questions but undersells actions.
- **Log with AI** is technically accurate but centers implementation. Prefer task labels such as **Describe a meal** or **Describe activity**.
- **Describe a change** / **Adjust this workout** communicates the action and can live beside direct controls.

Use task verbs and state the result. Users should think “I can type what I want here,” not “I need to learn AI.” Keep “Coach” for optional advice and open-ended training help.

## N. Recommended Product Direction

Adopt **direct controls first; natural language where it removes work**:

1. Preserve deterministic controls for sets, weight, water, targets, and one-field edits.
2. Put language entry inside or beside food/activity capture, where it removes several fields or interprets arbitrary descriptions.
3. Put “Describe a change” on the workout/template object for scoped, reviewable edits.
4. Keep coach chat optional for explanation, multi-part requests, and follow-up.
5. Reveal one relevant capability with one short example at the moment of need; do not teach the full inventory in onboarding.
6. Optimize first run for time to first useful workout and product value, not AI engagement. Keep generation optional; test a useful editable default/result before asking for a detailed brief.
7. Use models for language interpretation, generation, and explanation; keep stored facts and product calculations deterministic.

## O. Prioritized Opportunities

| Rank | Opportunity | Expected user benefit | Complexity |
|---:|---|---|---|
| 1 | Inline natural-language meal entry with editable macro proposal | High: fewer lookups/fields at a recurring task | Medium |
| 2 | Contextual “Describe a change” for saved/active workout with consistent diff | High: reduces multi-screen editing | Medium; proposal logic exists |
| 3 | First-run value-first experiment and reliable funnel definition | High strategic value; avoids deleting useful capability prematurely | Low–medium |
| 4 | Activity description entry and reusable-template proposal | High for varied activity tracking | Medium |
| 5 | Inline “Why this target?” near deterministic explanation | Medium; avoids chat detour | Low–medium |
| 6 | Reversible confirmed coach actions | Medium-high trust benefit | Medium–high due to account revision semantics |
| 7 | Clarify context-specific coach launcher labels | Medium discovery benefit | Low |
| 8 | Parse explicit weight only within existing natural-language surface | Low–medium; direct form already efficient | Low–medium |

## P. Experiments to Run

1. **First-run choice:** current brief-first vs ready-to-edit starter workout with “Use this / describe a change / start logging.” Measure time to first workout, start rate, edits, quality, and later retention; retain no-AI path.
2. **Readiness segment:** compare “I have a routine” vs “I’m starting fresh” cohorts for request, skip, completion, and usefulness.
3. **Value copy:** current broad promise vs “Describe your routine; get an editable workout; nothing saves until approval.” Measure comprehension and trust before click.
4. **Input burden:** free-text brief vs generated default plus optional change vs guided questions. Measure completion and workout quality.
5. **Meal capture:** direct form vs Describe a meal vs both co-located. Measure median time, correction rate, confidence, abandonment, repeat use.
6. **Workout edits:** direct controls vs contextual language for compound changes. Measure time, unintended changes, approval, correction/discard.
7. **Discoverability:** ask participants to log a meal, change a template, and explain a target without telling them AI exists; observe discovery and beliefs about saving.
8. **Trust:** compare summary vs before/after proposal diff; measure comprehension, confidence, error detection; test undo separately.

For each test record build/version, exposure definition, denominator, event definitions, and confidence intervals. Distinguish “not now” from “does not want AI.” Avoid recording prompt text in analytics.

## Q. Recommended MVP

1. Add an optional task-oriented “Describe a meal” entry beside the normal food form; return editable estimated values and explicit add confirmation.
2. Clarify existing context-specific launchers: “Ask coach” for advice, “Describe a change” or “Adjust this workout” for mutations, with one example before opening chat.
3. Keep workout generation as an onboarding option, but test a useful editable starting point and preserve immediate logging/explore paths. Do not remove based on skip rate alone.
4. Make estimates/source labels and post-save undo consistent before expanding action entry points.
5. Add minimal funnel events for exposure, selected path, brief submit, first useful result, edit/approve/discard, workout start, and failure; never include prompt text.

## R. What Not to Build

- Multiple floating AI buttons, persistent glowing assistant widgets, or app-wide AI badges.
- A general command bar before repeated jobs demonstrate the need.
- Chat-only replacements for existing food, weight, activity, set, and workout forms.
- Model calls for progression, recovery, hydration totals, or saved-food selection.
- Silent saves of uncertain macros, effort, targets, or workout rewrites.
- A five-question wizard as the only first-run route or a lesson listing all capabilities.
- Unrequested nutrition/goal advice during first workout setup.
- Removal of plan generation based only on the reported skip percentage.

## S. Implementation Considerations

Likely systems if recommendations proceed (none changed here):

- First run: `components/onboarding.tsx`, `components/profile-gate.tsx`, `lib/onboarding.ts`, `app/api/onboarding/route.ts`, `app/api/plan/route.ts`, event definitions.
- Coach/discovery: `components/coach-launcher.tsx`, `components/plan-chat.tsx`, session/progress/exercise/template coach components, and contextual placement in `app/page.tsx`.
- Meal parsing: `components/nutrition.tsx`, `components/progress-coach.tsx`, `app/api/progress-coach/route.ts`, schemas, account operation review.
- Workout edits: template/session coach components, `lib/template-coach.ts`, `lib/apply-session-changes.ts`, `lib/account-operations.ts`, `components/coach-operation-card.tsx`.
- Trust/reversal: `components/account-sync.tsx`, `lib/account-coordinator.ts`, `app/api/coach-operations/route.ts`, receipts and history UI. Undo must respect cross-device revisions and stale state.
- Analytics: existing `useLandingAnalytics` and `app/api/landing-analytics/route.ts`; check retention/privacy before funnel events.
- PWA: verify keyboard, narrow screens, interruption/resume, and returning account state for contextual entry.

### Audit limitations

This traces source and docs, not live production behavior or browser UI. Provider quality/latency, AI connection prevalence, production usage, and the 98/100 study build were not independently observed. The existing onboarding audit says live browser/mobile verification remained incomplete; it is project history, not study validation.
