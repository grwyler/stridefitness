# Stride Fitness Tracker — ChatGPT Public Release

**Status date:** 2026-11-03  
**Release state:** Local release draft prepared; public listing not submitted, approved, or published.

## Current integration

Stride is a public Sites-hosted web application at <https://stridefitness.app>. Its current live Site version is 291. The public remote MCP endpoint is:

```text
https://stridefitness.app/api/mcp
```

This is a custom remote MCP server using Streamable HTTP and OAuth 2.1 authorization code with PKCE S256. Protected-resource and authorization-server metadata are available at:

- `https://stridefitness.app/.well-known/oauth-protected-resource/api/mcp`
- `https://stridefitness.app/.well-known/oauth-authorization-server`

OAuth links a grant to the signed-in Stride account. The server uses the existing D1 database and account identity; it does not use a shared developer account. Access tokens are opaque and stored as hashes, refresh tokens rotate, reuse revokes the grant, and the resource URI is checked during authorization and token exchange. `fitness:read` and `fitness:write` are enforced independently per tool. Mutations are account-scoped and use revision checks and mutation IDs to reject stale or repeated writes. Rate limiting is per grant.

The repository also retains `/api/mcp/[token]`, an older private shared-secret prototype with `log_food`, `log_activity`, and `get_daily_log_summary`. It is separate from the OAuth endpoint and is **not** configured in the public package. Do not publish its tokenized URL or use it as the public MCP server.

The Site's `public` visitor setting and a working public HTTPS URL mean the application is publicly reachable. They do not create a public ChatGPT directory listing. The repository had no plugin package manifest or evidence of a public-directory submission. This task did not create a submission or claim an existing portal state; portal status must be checked by the developer.

## MCP tools and listing claims

The production server exposes 25 tool names. Read tools cover profile and nutrition targets, daily summaries, workout and exercise history/progress, logged activities, measurements, goals, and workout templates. Write tools cover supported profile and nutrition-target changes, body measurements, fitness goals, and workout-plan creation/edits. Read tools require `fitness:read`; write tools require `fitness:write`.

Do **not** claim that ChatGPT can currently:

- Record a completed strength workout or its sets.
- Create a food/nutrition log entry.
- Record a non-strength activity such as BJJ.
- Archive a workout plan. The listed `archive_workout_plan` tool returns an explicit unsupported result and changes nothing.

The legacy shared-secret prototype can log food and activities, but it is not account-scoped OAuth and must not be represented as a public-user capability. The listing draft describes only the supported account-linked tools and calls out those limitations.

## Draft package created

`chatgpt-plugin-release/` is a portable Agent Plugins package draft:

- `plugin.json` — display name, proposed listing text, supported capabilities, icon, starter prompts, and five positive / three negative review-case drafts.
- `mcp.json` — one production remote MCP server using OAuth and DCR, with no embedded headers or credentials.
- `skills/get-started/SKILL.md` — onboarding instructions and explicit capability limits.
- `assets/stride-512.png` — existing Stride app icon.

The OpenAI-specific package format is based on the official [package guide](https://developers.openai.com/plugins/build/plugins). The short description is **“Fitness tracking & progress”** (the requested longer short-description text exceeds the current 30-character listing limit). The long description does not claim workout, food, or activity logging.

This is a **draft**, not a ready-to-submit ZIP. `developerName` is a proposed brand value and must match the verified individual/business identity selected in the portal. Legal/support pages exist at `/privacy.html`, `/terms.html`, and `/support.html`; they were approved by the operator for production deployment in the current release. Cloudflare Email Routing is configured with an active rule from `support@stridefitness.app` to the verified `grwyler@gmail.com` destination. End-to-end message delivery has not been tested. The `review.test_cases` are drafts, not completed reviewer runs. No demo recording or reviewer account credentials are included.

## Public release requirements and current blockers

Official OpenAI documentation says remote MCP plugin submissions use the Plugins portal and go through package checks, MCP connection/domain verification, tool scan, review, approval, and then a separate publish action. A successful upload is not approval; approval does not itself publish the listing. After publishing, the plugin can be found by exact name or its directory URL; enhanced directory placement is not guaranteed.

The following prerequisites remain:

1. **Publisher identity and access:** individual verification is currently in review in the portal. Wait for approval; ensure the submitter has `api.apps.write` or is an organization owner.
2. **Verified listing publisher name:** confirm the organization/developer display name. The package's current `Stride Fitness` value is only a proposal.
3. **Privacy, terms, and support pages:** approved pages are deployed at `/privacy.html`, `/terms.html`, and `/support.html`. The support route is active to the verified Gmail destination, but has not been tested with a real message. OpenAI requires HTTPS website, support, privacy-policy, and terms URLs for remote MCP review. The publisher should confirm the final public copy and route details before submission.
4. **Domain proof:** after creating the draft in the portal, obtain its exact domain challenge token and host that token as plain text at the URL shown by the portal, normally `https://stridefitness.app/.well-known/openai-apps-challenge`. No challenge token was available during this work, so no token or production environment setting was added.
5. **Reviewer access:** create a dedicated fully featured demo Stride account with synthetic sample data and immediate sign-in (no inaccessible MFA, email/SMS code, or private-network step). Do not provide a developer's personal account or real user data.
6. **Review validation:** run and record exactly the five positive and three negative draft test cases against the reviewer account. The positive nutrition-target write must run only against that demo account. Confirm the tool scan and annotation findings in the portal.
7. **Walkthrough:** record a reviewer-accessible video demonstrating the supported workflows and add its URL. No recording exists yet.
8. **Logging gaps:** either keep the listing constrained as drafted or implement and test account-scoped workout logging, food logging, and activity logging before claiming those capabilities.
9. **Legal/product readiness:** review privacy, health-data handling, user deletion/retention, age, billing, support, and terms disclosures with the responsible publisher. This repository audit is not a legal approval.

## Listing draft

**Name:** Stride Fitness Tracker  
**Short description:** Fitness tracking & progress  
**Category:** Other (the current official category list does not include a dedicated fitness category)  
**Website:** <https://stridefitness.app>  
**Capabilities:**

- Review completed and planned workout history.
- Analyze exercise progress and recorded personal records.
- Review logged activities, including BJJ.
- Review nutrition logs and targets; update supported targets with write access.
- Read and add body measurements.
- Create and manage fitness goals.
- Create and edit workout plans (archiving is unavailable).
- Get timezone-aware daily fitness summaries.

**Starter prompts:**

- “Summarize my training and activities today.”
- “Show my recent bench press progress.”
- “Review my nutrition totals this week.”

The listing's long description is in `chatgpt-plugin-release/plugin.json` and explicitly discloses the missing logging and archive operations.

## Exact developer submission steps

1. Complete the unresolved identity, policy/support URL, reviewer-demo, and recording items above. Update the portable package with the final verified developer name and all four working HTTPS listing URLs.
2. Validate the final package and create a ZIP containing the root `plugin.json`, root `mcp.json`, and referenced assets. Keep secrets, demo passwords, tokens, and domain challenge values out of the ZIP.
3. Open the [OpenAI Plugins portal](https://platform.openai.com/plugins), select the verified developer identity, and upload the ZIP as a new plugin draft.
4. In **MCPs**, connect `https://stridefitness.app/api/mcp` with OAuth/DCR. Complete the portal's domain-verification challenge, authorize a dedicated demo account, and scan the tools. Fix connection and required scan findings, then rescan.
5. Complete review details with dedicated demo credentials through the portal's secure form, the five tested positive cases, three tested negative cases, the video URL, release notes, and required policy attestations.
6. Select **Submit for review**. Track the result in the portal and respond to findings. At this stage the plugin is **submitted**, not approved or discoverable.
7. After approval, explicitly select **Publish plugin**. Only then is it publicly listed. Check the portal's directory URL or search the exact name to verify discoverability.

OpenAI's current requirements are documented at [Submit plugins](https://developers.openai.com/plugins/deploy/submission), [Remote MCP server review](https://developers.openai.com/plugins/deploy/app-review), [Plugin guidelines](https://developers.openai.com/plugins/plugin-guidelines), and [Submission errors](https://developers.openai.com/plugins/deploy/submission-errors). The process is a portal workflow; no public submission API or completed portal authorization was available in this repository session.

## Validation and release state

- Source code audit and current production Site metadata checked; production remains at Site version 291.
- Production OAuth endpoint and 25-tool MCP server are already deployed and reachable; no production code, credential, or OAuth configuration was changed for this preparation.
- Draft manifest constraints and content are covered by `tests/chatgpt-public-package.cjs`.
- The existing OAuth/MCP automated suite covers account isolation, PKCE, resource binding, scopes, token refresh/revocation, and tool execution; run it before submitting.
- TypeScript errors already exist outside this package in `app/page.tsx`, `components/coach-conversation.tsx`, and `tests/fixtures/logging-qa.tsx`; report the current `tsc --noEmit` result at submission time.
- Current stage: **ready for local review of the package draft**. It is not ready for submission until blockers 1–7 are cleared. It has not been submitted, approved, published, or verified as publicly discoverable.

## Rollback

This release-preparation change does not modify production. To abandon it, remove `chatgpt-plugin-release/`, `tests/chatgpt-public-package.cjs`, and this document, or revert the source commit containing those paths. If a draft is later uploaded, delete or withdraw it in the Plugins portal. If a future MCP code change is deployed, roll the Site back to the last known-good version through the existing Sites deployment workflow; changing the public listing does not roll back the Stride website.
