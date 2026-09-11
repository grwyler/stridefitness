# Stride

Mobile-first strength training tracker. Data lives in the current browser under `stride-v1`. Includes sample sessions; no accounts or cross-device synchronization.

The typed model and progression engine live in `lib/training.ts`. Recommendations use recorded targets and results, prioritize return-after-absence and repeated struggle, and support per-exercise weight, repetition, or set progression. User overrides last until the next completed session. Weight units are pounds; bodyweight exercises use zero added weight.

The interface supports editable workouts, set outcomes and difficulty, exercise defaults, templates, progress charts, and light/dark mode. General fitness guidance only.

Validation: TypeScript check, production build, and progression scenario assertions. Browser QA and WebMCP runtime validation were unavailable under this session's permitted preview workflow.
