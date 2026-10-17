# Launch audits — synthesis (2026-10-17)

Five read-only audits ran against `roasttube@0d2aaef` before any launch-hardening edits. This file is the evidence source and spec for `docs/superpowers/plans/2026-10-17-roasttube-launch-hardening.md`. Nothing here was verified by writing code; refs are `src/`-relative.

## 0. Open decisions (owner)

- **Q1 Engine:** Gemini free tier risks Limited Use (human review, EEA paid-only clause). Run the head-to-head eval (Task A1) and pick Workers AI (free, same vendor, zero retention) or paid Gemini (billing). If the plan skips A1, the owner picks directly.
  **RESOLVED (eval 2026-10-17, raw + jsonfmt variants, samples in `notes/assets/engine-eval/`):** recommend **keep paid-capable Gemini as primary** (`gemini-3.5-flash`, fallback `gemini-flash-lite-latest`), with **Workers AI `@cf/openai/gpt-oss-120b` as the only viable free fallback**. Evidence: only Gemini's native `responseSchema` produced the full report shape (headline, roastReport, 5 redFlags, channelRoasts, score); all three Workers models returned prose even with an explicit JSON contract + `response_format=json_object` (redFlags/channelRoasts absent, score unparseable), `@cf/qwen/qwen3-30b-a3b-fp8` leaks markdown/em dashes into prose, and `@cf/zai-org/glm-4.7-flash` dumps chain-of-thought and hits 60s timeouts. gpt-oss prose is decent but flat, 6-27s, 1-6 raw em dashes/run (stripAiDashes covers). A2's cost is therefore: if the owner still wants free-only, the Workers path needs a server-side schema-repair layer, not a model swap.
- **Q2 Policy defaults:** reports kept until deletion is requested; deletion confirmed within 30 days; operator "Piyush Mehta"; effective date set at deploy. Veto any.
- **Q3 Turnstile:** real keys require a Cloudflare dashboard/wizard step (owner runs wizard stage 4, or exec runs it with cached auth).
- **Q4 Scale target:** default is design-for-free-tier (15 roasts/day budget, graceful 429s), with documented upgrade path ($5/mo Workers Paid, LLM paid tiers). Confirm.
- **Q5 Execution method:** subagent-driven vs native (asked at handoff).

## 1. Verification fix package (Google rejection)

Rejection findings (verbatim): privacy policy "does not have sufficient content"; home page "behind a login page"; home page "does not explain the purpose".

**Diagnosis.** No gate exists. Anonymous GETs: `/` 200, `/privacy` 200, `/terms` 200, `/report/5uej7f57` 200, zero redirects; `POST /api/roast {source:"demo"}` works with no session (`api/roast/route.ts:46-77`). The finding is presentation: the loudest element is the CTA that goes straight to Google sign-in (`page.tsx:78-84` -> `RoastButtons.tsx:170-184`), nothing says the demo runs without an account, and purpose is stated only in courtroom voice (`page.tsx:45-62`). Owner to re-check in console: Application home page = `https://roasttube.piyushmehta.com`, privacy URL = `/privacy`.

**Google's requirements (current).** Homepage: describe functionality, not "only a login page", privacy link matching the consent screen (support.google.com/cloud/answer/13464321). Privacy policy: disclose all access/use/store/share of Google user data; Limited Use exact sentence required (support.google.com/cloud/answer/13463817; developers.google.com/terms/api-services-user-data-policy).

**Privacy policy replacement draft.** Sections map 1:1 onto `src/app/privacy/page.tsx` (keep its JSX/visual conventions):

1. **What RoastTube does.** Free entertainment site. With permission it reads your YouTube lists (likes, subscriptions, playlists), scores them, and has an AI model write a comedy roast you can share by link. Demo personas need no account.
2. **Google account and YouTube data.** Sign-in requests exactly one permission, `youtube.readonly`. Per roast we fetch: liked videos (up to 200; titles, channel names, categories, lengths, publish dates), subscriptions (first 50; titles, subscriber counts), playlist titles (up to 50), and Watch Later items (first 50 titles) only when YouTube exposes them via API. We do not receive name, email, profile, contacts, watch history, comments, or uploads. No refresh tokens; the access token is used for one collection pass.
3. **Technical data.** Host processes standard request data (IP) to serve and protect the site; IP used for rate limiting (3 roasts/hour) and Cloudflare Turnstile on demo requests. Cookies: `rt_session` (sealed, HttpOnly, 1 hour) and `rt_oauth` (10 minutes, scoped to `/api/auth`).
4. **How we use it.** Solely to produce the roast, store it so its link works, and stop abuse. No advertising, profiling, or analytics.
5. **Storage and retention (verified in code).** Reports: Cloudflare Workers KV under a random 8-char id; kept until you ask us to delete them (no TTL, `store-kv.ts:28`). Rate-limit counters `rl:<ip>`: ~1 hour (`limits.ts:42-49`). Daily budget counter: 48 hours (`limits.ts:61`). Demo cache: 1 hour (`limits.ts:77`). Session token: never stored server-side (`oauth.ts:127-140`).
6. **Sharing.** Only Google (YouTube Data API; the AI service that writes the roast) and Cloudflare (hosting, KV, Turnstile). Never sold or shared for advertising or surveillance; no data brokers; no credit use.
7. **The AI that writes the roast.** The prompt contains computed statistics plus a limited set of titles/names: longest video's title, up to 8 recent titles from the top channel, up to 12 liked-video titles, playlist titles, top 5 channel names with like counts, category counts (`prompt.ts:85-119`). It never receives video/channel ids, account identity, or raw API responses. Engine-specific sentence:
   - Workers AI: "The model runs on Cloudflare Workers AI. Inputs and outputs are not retained and are not used to train AI models (Cloudflare Workers AI data usage commitments)."
   - Paid Gemini: "Roasts are written by Google's Gemini API on a paid tier. Google does not use paid-tier prompts to improve its products; processing is covered by Google's Data Processing Addendum." (Requires billing enabled before publishing.)
8. **Google Limited Use.** Exact required sentence: "RoastTube's use of information received from Google APIs will adhere to Google API Services User Data Policy, including the Limited Use requirements." Plus: no model training on Google user data; no transfers beyond delivering the roast; no human reading except security/abuse/law.
9. **Your rights.** Revoke at myaccount.google.com/permissions; sign out deletes the session cookie. Deletion: email contact@piyushmehta.com with the case number from `/report/<id>`; we delete the stored report (roast, score, statistics, titles) and confirm within 30 days.
10. **Security.** TLS everywhere; KV under Cloudflare's controls; token only inside an AES-GCM-sealed HttpOnly SameSite=Lax cookie; PKCE; no refresh tokens. Report links are public by nature.
11. **Children.** Gemini in chain: 18+ (Gemini API terms require it). Gemini fully removed: "not directed to children under 13."
12. **Changes.** Updated here with a new effective date.
13. **Not affiliated with YouTube or Google.**

**Homepage copy strings (final, no em dashes).**
- Purpose line, plain, directly after the `<h2>` (`page.tsx` ~line 49): "RoastTube is a free entertainment site that reads your YouTube likes, subscriptions and playlists (with your permission), scores them, and has an AI model write a comedy roast you can share."
- How it works strip, after the fairness paragraph: "1. Sign in with Google (read-only). 2. We read your likes, subscriptions and playlist titles, and compute your Brain Rot Score. 3. The AI writes the roast; the token is discarded."
- Demo subtitle (`RoastButtons.tsx` ~118-121): "Three fabricated defendants, tried in advance. No sign-in, no account: pure demo. Same court, same standards, zero subpoenas." Plus label above the grid: "Start here: the demo runs without a login."
- CTA (same file ~183): anchor text "Roast my YouTube, sign in with Google"; sub-note: "Optional: only needed for a real roast. The demo above needs no account."
- In-product privacy note under the CTA: "When you roast a real account, your computed stats and a limited set of video, channel and playlist titles are sent to the AI service that writes the roast. See Privacy." (link `/privacy`)

**Resubmission checklist.** Deploy; anonymous re-verify; screenshots of `/` (above-fold + full), `/privacy`, one demo report with URL bar visible; console URLs; video (add ~10s showing the no-login demo; re-record the opening only if the changed copy is legible in it); resubmit.

## 2. Security and ops audit

- **P0.1** Production ships Turnstile TEST keys (`cloudflare.config.ts:25`; live RSC payload contains `1x000000...`). Wizard uploads matching always-pass secret whenever config holds test key (`setup-cloudflare.sh:377-378`). The widget also passes the removed `size: "invisible"` option (`TurnstileWidget.tsx:97`), throwing `TurnstileError` on 3/3 live page loads; demo clicks can dead-end on 403 `turnstile_failed`. Fix in A6: real keys + delete the fallback + current API options (`appearance: "interaction-only"`) + client retryable message + verify `grep -c 1x000000` = 0 live.
- **P1.1** `.env.local` was 0644 with four real secrets (fixed manually 2026-10-17; wizard fix queued: chmod 600 after `write_env`; docs use `install -m 600`).
- **P1.2** Secrets passed to `cf` CLI via `--text` -> argv-visible (`setup-cloudflare.sh:241`). Prefer stdin/file if supported.
- **P1.3** Rejection paths log nothing (`route.ts:29-34,59-64,96-104,118-123,138-143`). Add structured logs + error-level alert.
- **P2** XFF fallback attacker-controllable (`route.ts:24-27`, take last element); GET logout CSRF-able (`logout/route.ts:11-14`) + sealed tokens can't be revoked server-side (accept); fail-open missing secrets (`turnstile.ts:11`, `oauth.ts:84-89,116`); budget drain by one user (S4 below); no CI; wizard `sed` can corrupt config (`setup-cloudflare.sh:328`); Turnstile drift dev vs prod; no rollback runbook; no nosniff/frame-deny headers; Secure flag relies on NODE_ENV inlining (`oauth.ts:13-15`).
- **Clean bill:** session crypto, OAuth flow (PKCE, state, youtube.readonly only), POST CSRF posture, git history hygiene, report id safety, HTTPS/HSTS.

## 3. Scale and cache design

**Chosen: KV pointer, no new vendors.** Rejected: Durable Objects (does not earn its complexity), Upstash (new vendor/secrets/hop; $5/mo Workers Paid is cheaper if ever needed), do-nothing, full-report-under-user-key.

- Keys: `user-cache:<youtubeChannelId>` -> report id, `expirationTtl: 86_400` (24h). Demo cache unchanged (1h).
- `limits.ts` helpers mirror demo helpers (`:65-78`): `USER_CACHE_TTL_SECONDS = 86_400`; `getCachedUserReportId(kv, channelId): Promise<string|null>`; `cacheUserReportId(kv, channelId, reportId): Promise<void>`.
- `youtube.ts`: extract first collect call into `identify(token)` -> `{channelId, ...}`; `collect(token, identity?)` skips the first call when given one (backward compatible).
- Route order (youtube branch): IP rate limit -> parse -> session -> `identify` -> unless `force`, cache read; hit responds `{id, report, signals, score, persona, cached:true, cachedAt}`; pointer-but-missing report falls through silently -> budget -> `collect(token, identity)` -> generate -> save + pointer (awaited) -> `cached:false`. Demo hit response gains `cached:true`. `force` skips cache read, pays full cost.
- Client: cached response shows an inline panel ("verdict still stands, filed <t> ago" + Open verdict / Demand a retrial) instead of auto-redirect; force only offered after a cached response.
- Identity = channelId, NOT OAuth `sub` (no scope change while verification is in flight).
- Failure modes all degrade to one extra generation, never wrong data: pointer write invisible cross-colo (<=60s), stale/expired pointer, double-click race, pointer write failure.
- Companion: wrap KV admission writes so a cap/throttle failure returns in-voice 429 (not 500); one structured log per POST.
- Budget window: Gemini resets at midnight Pacific (`America/Los_Angeles`); Workers AI resets at 00:00 UTC. Align to the chosen engine.
- Cliffs: CPU 10ms free vs 12-32ms measured (report page KV data cache deferred until earned); KV writes 1k/day first hard cliff (~C+3G); Gemini RPD is the real 100x wall. $5/mo covers Cloudflare side to ~1000x.
- Not now: report-page KV data cache, DO, Upstash, budget raise, per-user budget accounting, `listReports` UI, prompt-injection filter, report-id rate limit.

## 4. UX critique

- **P0** Roast body types out ~10s on EVERY report view (`RoastStream.tsx:6,14-21`, 24ms x 400 ticks). Saved links show empty content at first paint; screenshots catch fragments; throttled tabs look stuck.
- **P1** No per-report metadata/OG (only global `layout.tsx:21-25`); busy state off-screen after OAuth redirect, unannounced, uncancellable (`RoastButtons.tsx:46-74,105-112`); raw upstream error strings reach users (`route.ts:139-142`, `gemini.ts:71,77,81`, `page.tsx:73`, `RoastButtons.tsx:76-79,197`); report page has no CTA into the product (`report/[id]/page.tsx:31-35`).
- **P2** Stock 404 for bad case numbers; red-flag grid orphans 4th card (`report/[id]/page.tsx:76` sm:grid-cols-3); justified body without hyphens (`:67`); share PNG lacks URL, can silently truncate, no download state (`ShareCard.tsx:90,113-118`); title-only disabled reasons + tiny sign-out target (`RoastButtons.tsx:129,154,162-167`); stale screenshots in `docs/screenshots/`.
- **Leave alone:** identity system, contrast, focus, reduced-motion, gauge visuals, persona cards, happy-path voice, demo cache.

## 5. UI technical audit (final, live-measured)

Method: source read + live fetches + headless Chromium (playwright-core, mobile UA, 320-1280px DOM measurements). Score 11/20. This final report supersedes the interim code-only pass; one interim finding survives and is kept (see last bullet).

- **P0-1 Custom fonts never render on the live site.** next/font variable classes sit on `<body>` (`layout.tsx:35`) while Tailwind `@theme inline` resolves at `:root` (`globals.css:3-12`), so `--font-display/serif/mono` compute to empty strings, every `font-family: var(...)` declaration is dropped, and the whole site renders in system sans. 85KB of Anton/Source Serif/Geist Mono downloads unused; 18 faces, 3 preloads. Side effect: the fallback-font masthead overflows (379px in a 320px box at 360px viewport) causing horizontal scroll. Forcing Anton at runtime drops it to 254px and scrollWidth = viewport at 320/360/375/390. Fix in A3: attach the variable classes to `<html>` (or move the `@theme` mappings onto `body`); re-measure computed fonts + scrollWidth.
- **P0-2 Turnstile dead-ends persona buttons.** See section 2 P0.1. Fix in A6.
- **P1-1** No OG/Twitter tags anywhere; report links preview as the generic homepage title; `/opengraph-image` 404; `metadataBase` missing. Static fallback is a quick win; per-report OG image needs satori/workers-og/resvg feasibility on vinext (unverified).
- **P1-2** Typewriter: 1442-char roast takes ~9s; live HTML has an empty `<p>`; JS-blocked shows a verdict with no roast; no aria-live. (Matches UX P0.)
- **P1-3** Keyboard focus is dropped when a button goes busy (`disabled` steals focus to `<body>` within 120ms); no aria-live regions anywhere. Fix: `aria-disabled` + guarded handler (button stays focusable); busy label through an aria-live status element.
- **P2-1** Report datelines wrap raggedly at 360px (reuse the `hidden sm:inline` pattern from `page.tsx:33`).
- **P2-2** No branded 404 or error boundary (stock Next pages). (Matches UX P2.)
- **P2-3** Turnstile script loads eagerly on mount; occasional anonymous tab stops near the widget container; footer Privacy/Terms links 61x12 / 48x12px, under WCAG 2.5.8's 24x24 AA target.
- **Interim code-only finding kept for C2:** ScoreGauge needle animates around the SVG origin instead of the dial center on first paint in Safari / non-rotated re-renders (`ScoreGauge.tsx:31,38-44`; missing `transform-box: fill-box`).
- **Leave alone (measured):** palette/contrast (ink 15.65:1, ink-soft 7.54:1, red 5.77:1, focus ring 5.77:1); performance envelope (LCP 92-408ms, CLS ~0, TBT 0ms, ~146KB brotli JS); motion hygiene (reduced-motion verified); server state machine (400/401/403/429 with human messages); the tabloid furniture (halftone, clippings, stamps, drop cap, columns); no dark mode (correct).
- **Confidence:** perf single-run headless from one edge (TTFB optimistic); Turnstile intermittent (failing script version unidentified); signed-in OAuth path not exercised end-to-end; OG-image feasibility on vinext unverified.
- **Rate-limit note:** audit probing used this machine's 3/hour IP budget; demo clicks from this machine may 429 for up to an hour afterward. Not a bug.

## 6. Deferred with reasons

Covered above: report-page KV data cache (CPU not yet hitting), DO/Upstash (not earned), budget raise (LLM RPD wall), logout revocation (sealed cookies; accepted), package pinning (lockfile + CI suffices), `listReports` (dead code, free-tier landmine if wired), prompt-injection filter (satire + safety settings cap impact).
