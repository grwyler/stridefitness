# Stride PWA

Stride retains the existing application, database bindings, account isolation, AI/API requests and auth requirements. The manifest uses origin-relative identity, scope and start URL `/`; the current production origin is `https://stridefitness.app`. Existing main sections are tabs on `/`; `/admin` remains the existing protected route.

`/.well-known/assetlinks.json` is intentionally published as a valid empty association list until the Android package name and release signing-certificate SHA-256 fingerprint are known. Replace it with the final Trusted Web Activity statement immediately before the Play release; do not use the old `.org` origin for that association.

## Install

On iPhone/iPad, open Stride in Safari, sign in normally, and choose Share → Add to Home Screen. If offered, leave Open as Web App enabled. Chromium gets a quiet, dismissible install control near the footer only when `beforeinstallprompt` is actually supplied. Instructions are hidden in standalone mode and dismissal is stored independently from training data. No notifications, permissions, background syncing or automatic save replay were added.

## Hosting and cache policy

The current HTTPS custom domain serves public assets independently from the protected application. `public/manifest.webmanifest`, `public/sw.js`, and icons are deployed as static assets. The platform protects standalone HTML too (the deployed offline.html returned a sign-in redirect), so the worker carries a neutral offline document internally instead of precaching authenticated HTML. The root worker scope needs no expanded Service-Worker-Allowed header. Registration is limited to secure production contexts; a registration failure does not affect the application.

Only explicit public assets and content-hashed `/_next/static/` JS/CSS/fonts can enter the PWA cache. HTML navigations always request the network; network failure displays a neutral reconnect screen. API, auth and RSC requests are not intercepted. User data, cookies, tokens and private conversations never enter this cache. Offline account operation is deliberately unavailable: loading private server-rendered HTML offline would undermine freshness and the existing auth gate. Existing local application persistence remains untouched.

New HTML is fetched on navigation, hashed build files have new URLs, and worker checks bypass the HTTP cache and repeat when the app becomes visible. There is no forced reload, skipWaiting or clients.claim. A changed worker activates once all controlled windows close, preserving active workout sessions. Bump the worker cache version whenever the offline page or precached icon content changes. Old Stride public caches are then deleted; other application storage is untouched.

## Validation and remaining device checks

- Production build and TypeScript check pass.
- Cache-policy test covers API/auth/RSC bypass, no cached account HTML, neutral offline navigation fallback, and hashed asset caching.
- Existing account operation and coach-flow regression tests pass.
- Manifest identity, scope, display and icon dimensions checked against emitted files.
- Browser QA was attempted through the supported Sites preview. Existing sign-in redirection loops there, so authenticated visual/keyboard/session checks could not be completed. No authentication workaround was introduced.
- A physical iPhone/Android install, OS standalone launch, returning signed-in session, keyboard/rotation behavior, live saved data and AI requests still require device validation. Browser support and OS cookie handling can require an initial sign-in inside the installed app. No claim of cross-browser cookie sharing is made.

If exported, serve these public assets on HTTPS with correct JSON/JavaScript/PNG MIME types, revalidate sw.js and the manifest, retain server handling for `/` and `/admin`, keep all existing auth/API routes and secrets, and verify the production auth flow on each device. A conventional browser-install test cannot be substituted for physical iOS home-screen verification.
