# Stride Fitness Tracker — ChatGPT Public Release

**Status date:** 2026-11-04

**Release state:** Local release draft prepared; public listing not submitted, approved, or published.

## Current integration

Stride is a public Sites-hosted web application at <https://stridefitness.app>. Its current live Site version is 305. The public remote MCP endpoint is:

```text
https://stridefitness.app/api/mcp
```

This is a custom remote MCP server using Streamable HTTP and OAuth 2.1 authorization code with PKCE S256. Protected-resource and authorization-server metadata are available at:

- `https://stridefitness.app/.well-known/oauth-protected-resource/api/mcp`
- `https://stridefitness.app/.well-known/oauth-authorization-server`

OAuth links a grant to the signed-in Stride account. The server uses the existing D1 database and account identity; it does not use a shared developer account. Access tokens are opaque and stored as hashes, refresh tokens rotate, reuse revokes the grant, and the resource URI is checked during authorization and token exchange. `fitness:read` and `fitness:write` are enforced independently per tool. Mutations are account-scoped and use revision checks and mutation IDs to reject stale or repeated writes. Rate limiting is per grant.

The repository also retains `/api/mcp/[token]`, an older private shared-secret prototype with `log_food`, `log_activity`, and `get_daily_log_summary`. It is separate from the OAuth endpoint and is **not** configured in the public package. Do not publish its tokenized URL or use it as the public MCP server.

The Site's `public` visitor setting and a working public HTTPS URL mean the application is publicly reachable. They do not create a public ChatGPT directory listing. The OpenAI Plugins portal has a Stride Fitness Tracker draft; the last observed status was **Not submitted** and **Not published**. A public directory listing still requires review approval and a separate publish action.

## MCP tools and listing claims

The production server exposes 24 tool names. Read tools cover profile and nutrition targets, daily summaries, workout and exercise history/progress, logged activities, measurements, goals, and workout templates. Write tools cover supported profile and nutrition-target changes, body measurements, fitness goals, and workout-plan creation/edits. Read tools require `fitness:read`; write tools require `fitness:write`. Profile, nutrition-target, goal, and workout-plan update tools advertise `destructiveHint: true` because they replace saved values and Stride MCP does not provide an undo operation. Their OAuth scope checks remain enforced.

Do **not** claim that ChatGPT can currently:

- Record a completed strength workout or its sets.
- Create a food/nutrition log entry.
- Record a non-strength activity such as BJJ.
- Archive a workout plan. No MCP archive tool is exposed; use Stride's available in-app plan controls.

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
5. **Reviewer access:** use the dedicated synthetic reviewer account configured in the portal. Verify it signs in immediately without inaccessible MFA, email/SMS codes, or private-network steps; never provide a developer's personal account or real user data.
6. **Review validation:** run and record exactly the five positive and three negative draft test cases against the reviewer account. The positive nutrition-target write must run only against that demo account. After each MCP server deployment, reconnect or rescan the server in the portal so its tool list and annotations refresh. Confirm the five update tools are marked destructive and that `archive_workout_plan` is absent.
7. **Walkthrough:** the supplied video URL is <https://youtu.be/nelPlq05vSE>. Verify that reviewers can access it and that it demonstrates the supported workflows.
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
- Create and edit workout plans. Plan archiving is unavailable through MCP.
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
4. In **MCPs**, connect `https://stridefitness.app/api/mcp` with OAuth/DCR. Complete the portal's domain-verification challenge, authorize the isolated reviewer demo account, and scan the tools. The server now returns 24 tools, marks profile/target/goal/plan updates as destructive, and omits the unsupported plan archive tool. Rescan the deployed endpoint and confirm these results in the portal.
5. Reviewer login details belong in the portal's **Review details** form: Login URL `https://stridefitness.app/test-access`, Tenant `Stride Fitness reviewer demo`, Username `reviewer`, plus the password held in the production `REVIEWER_DEMO_PASSWORD` secret. Sign-in steps: open the login URL; enter username and password; choose **Open demo workspace**; return to ChatGPT and retry **Connect Stride**; review and approve the requested scopes. The account is synthetic and all OAuth grants are pinned to its isolated `:test` data key.
5. Complete review details with dedicated demo credentials through the portal's secure form, the five tested positive cases, three tested negative cases, the video URL, release notes, and required policy attestations.
6. Select **Submit for review**. Track the result in the portal and respond to findings. At this stage the plugin is **submitted**, not approved or discoverable.
7. After approval, explicitly select **Publish plugin**. Only then is it publicly listed. Check the portal's directory URL or search the exact name to verify discoverability.

OpenAI's current requirements are documented at [Submit plugins](https://developers.openai.com/plugins/deploy/submission), [Remote MCP server review](https://developers.openai.com/plugins/deploy/app-review), [Plugin guidelines](https://developers.openai.com/plugins/plugin-guidelines), and [Submission errors](https://developers.openai.com/plugins/deploy/submission-errors). The process is a portal workflow; no public submission API or completed portal authorization was available in this repository session.

## Validation and release state

- Source commit `8a5ffd7727fc6b7b1bc684039442eb4a29952572` was pushed and deployed as public Site version 305.
- A read-only `tools/list` request to `https://stridefitness.app/api/mcp` returned 24 tools, all five affected update annotations had `destructiveHint: true`, and `archive_workout_plan` was absent. The Plugins portal still needs to rescan the endpoint; this deployment did not submit or publish the listing.
- Draft manifest constraints and content are covered by `tests/chatgpt-public-package.cjs`.
- The existing OAuth/MCP automated suite covers account isolation, PKCE, resource binding, scopes, token refresh/revocation, and tool execution; run it before submitting.
- TypeScript errors already exist outside this package in `app/page.tsx`, `components/coach-conversation.tsx`, and `tests/fixtures/logging-qa.tsx`; report the current `tsc --noEmit` result at submission time.
- Current stage: **ready for local review of the package draft**. It is not ready for submission until blockers 1–7 are cleared. It has not been submitted, approved, published, or verified as publicly discoverable.

## Rollback

Site version 305 contains the MCP annotation and discovery changes. To roll back the website, deploy the last known-good saved Site version through the existing Sites workflow; changing or withdrawing a Plugins portal draft does not roll back the Stride website.
