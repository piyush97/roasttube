# RoastTube Launch Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Get RoastTube through Google OAuth verification resubmission and production-ready before real users arrive: fix the verification blockers, close security/ops gaps, fix the live UI defects the audits found (fonts, Turnstile, states), and add per-user report caching.

**Architecture:** Four sequential phases on `main`. Phase A unblocks the Google resubmission (engine decision, font wiring, content, Turnstile rework, deploy + evidence). Phase B hardens security and ops. Phase C fixes live UI defects and elevates the report page. Phase D adds the KV-pointer per-user cache and admission resilience. Lib logic is TDD'd with `node --test` (MapKv + stubbed fetch patterns already in `tests/`); UI/copy tasks verify with build + manual/live evidence.

**Tech Stack:** Next.js 16 on Cloudflare Workers via vinext/`cf`, Workers KV, Tailwind v4, `node --test` (Node 24 type stripping).

**Spec:** `docs/superpowers/notes/2026-10-17-launch-audits.md` (all findings, refs, drafts, cache design, decisions).

## Global Constraints

- Free tiers only for now: Cloudflare free plan; LLM engine per Q1 (Workers AI free allocation preferred; paid Gemini only if chosen).
- No new runtime dependencies unless a task explicitly says so after Q1; justify in the commit message.
- Preserve: roast voice/copy, tabloid metaphor, core flow (sign in, collect, roast, report), demo personas, share card. No em dashes in any product prose.
- Keep `next dev`, `npm test` (90 tests baseline, all green), `npm run lint`, `next build` working after every task.
- Read `node_modules/next/dist/docs/` before writing Next-specific code (this Next version differs from training data; repo `AGENTS.md`).
- Plain git on `main`; one small commit per task; no co-author trailers; repo stays private; never commit `.env*` or `bun.lock`.
- Public URLs stay `/privacy` and `/terms`; contact stays `contact@piyushmehta.com`.
- Deploy path: `npm run build:vinext && npm run deploy:vinext`; record the deployed version id after each deploy (B5 adds the runbook).

## Open Decisions (spec §0)

- **Q1 Engine:** run Task A1 (eval) and pick Workers AI or paid Gemini. If skipped, owner picks directly and A2 collapses to the chosen variant.
- **Q2 Policy defaults:** reports kept until deletion is requested; deletion confirmed within 30 days; operator "Piyush Mehta"; effective date set at deploy. Veto any.
- **Q3 Turnstile:** real keys need a dashboard/wizard step; owner runs wizard stage 4, or the executor runs it if `cf` auth is cached on this machine.
- **Q4 Scale target:** design for free-tier scale (15/day budget, graceful 429s, documented upgrade path). Confirm.
- **Q5 Execution method:** asked at handoff.

## Review Focus

Five failure modes the audits imply, each pinned to a task's tests or verification:

1. Cache pointer alive but pointed report deleted: must silently regenerate, never error or dead-end. (Task D3.)
2. KV write failure (cap / 1s throttle) mid-admission: in-voice 429 "court is full", never a 500. (Task D5 + C4 mapping.)
3. Expired Google token after ~1h: 401 with reauth copy + retry affordance, never a raw upstream string. (Task C4.)
4. Anonymous first visit: purpose and a working no-login demo within five seconds; the demo must not dead-end (fonts + Turnstile tasks land before evidence). (Tasks A3, A5, A6, A7.)
5. Saved report link with JS slow or blocked: full roast text present in the first paint; animation is enhancement only. (Task C1.)

---

## Phase A: Verification resubmission blockers

### Task A1: Engine head-to-head evaluation (conditional on Q1)

**Files:**
- Create: `scripts/eval-engine.ts`
- Create: `docs/superpowers/notes/assets/engine-eval/` (raw samples)
- Modify: `.env.local` (gitignored; add `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`)

**Interfaces:**
- Consumes: `buildSystemPrompt()`, `buildUserPrompt(s, r)` (`src/lib/prompt.ts`); demo persona signals/scores (`src/lib/demo.ts`).
- Produces: raw output samples per candidate per persona; a recorded decision (primary + fallback model ids) appended to the spec's §0.

- [ ] Add a Workers-AI-capable token: owner creates one (dash, My Profile, API Tokens, Workers AI template) and puts `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_API_TOKEN` in `.env.local`; smoke-test with one `POST https://api.cloudflare.com/client/v4/accounts/<id>/ai/run/<model>` call.
- [ ] Write `scripts/eval-engine.ts`: for each of the 3 demo personas, call the current Gemini (`gemini-3.5-flash`), `@cf/openai/gpt-oss-120b`, `@cf/qwen/qwen3-30b-a3b-fp8`, `@cf/zai-org/glm-4.7-flash`; write each raw response to the assets dir.
- [ ] Run: `node --env-file=.env.local scripts/eval-engine.ts`; fix call shapes until every candidate returns a parseable roast.
- [ ] Present samples to the owner; record primary + fallback model ids in the spec §0.
- [ ] Commit script + samples (samples are small; keep raw JSON only).

### Task A2: Engine swap (conditional on Q1 outcome)

**(a) If Workers AI wins:**
**Files:**
- Create: `src/lib/roast-text.ts` (move `normalizeParagraphs`, `stripAiDashes`, `cleanOne` out of `src/lib/gemini.ts`; gemini.ts re-imports)
- Create: `src/lib/workers-ai.ts`, `src/lib/engine.ts` (re-exports `roast` from the chosen impl)
- Create: `tests/workers-ai.test.ts`
- Modify: `src/app/api/roast/route.ts` (import from `engine.ts`), `cloudflare.config.ts` (AI access: try `bindings.ai()` via `cf/config`; if the helper does not exist, fall back to REST: `CLOUDFLARE_ACCOUNT_ID` text var + `CLOUDFLARE_AI_TOKEN` secret)

**Interfaces:** produces `roast(s: Signals, r: ScoreResult): Promise<RoastReport>` (identical contract to `src/lib/gemini.ts`).

- [ ] Failing tests first: fetch-mocked success (JSON parsed, cleaned via `roast-text.ts`), retry on 429/503 then next model, code-fenced JSON tolerated, empty response throws.
- [ ] Implement `src/lib/workers-ai.ts` mirroring gemini.ts's retry/fallback shape; model list from the A1 decision; prompt-embedded JSON instruction + tolerant parse (reuse `ROAST_SCHEMA` description in the prompt text).
- [ ] Wire `engine.ts` + swap the route import; battery green; one live dev roast end-to-end with the real persona.
- [ ] Commit.

**(b) If paid Gemini wins:** no code. Owner enables billing; add a one-line note to `README.md` env notes; verify a live roast post-deploy in A7. Commit docs + verification note only.

### Task A3: Font wiring fix (live P0-1)

**Files:** Modify: `src/app/layout.tsx` (move the three `*.variable` classes from `<body>` to `<html>`; alternative: relocate the `@theme` mappings in `src/app/globals.css:3-12`).

- [ ] Move the `anton.variable`, `sourceSerif.variable`, `geistMono.variable` classes from `<body>` to `<html>`.
- [ ] Verify in `npm run dev` (playwright-core + system Chromium, already used by the audit): computed `font-family` of body/masthead/dateline uses Anton/Source Serif/Geist Mono; at 320/360/375/390px `document.documentElement.scrollWidth` equals viewport width; no horizontal scroll.
- [ ] Battery green; commit. (This must land before A7 screenshots so evidence shows the real identity.)

### Task A4: Privacy policy rewrite

**Files:** Modify: `src/app/privacy/page.tsx` (content per spec §1; §7 variant per Q1).

- [ ] Rewrite sections per the spec draft; keep existing JSX/visual conventions; exact Limited Use sentence; set effective date at deploy; §7 uses the Workers AI or paid Gemini variant.
- [ ] Children's section per engine: 18+ while Gemini is in the chain; "not directed to children under 13" if Gemini is fully removed.
- [ ] Verify: `npm run dev` + `curl -s localhost:3000/privacy | grep` the Limited Use sentence; no draft placeholders remain (grep for `[` markers); battery green.
- [ ] Commit.

### Task A5: Homepage comprehension copy

**Files:** Modify: `src/app/page.tsx`, `src/components/RoastButtons.tsx` (exact strings in spec §1).

- [ ] Add the plain purpose line after the `<h2>`; the how-it-works strip after the fairness paragraph; the demo subtitle + "runs without a login" label; the CTA clarification; the in-product privacy note.
- [ ] Verify: `curl -s localhost:3000/ | grep` the purpose line and "without a login"; battery green.
- [ ] Commit.

### Task A6: Turnstile rework (live P0-2 + security P0.1)

**Files:** Modify: `src/components/TurnstileWidget.tsx` (current API options, graceful failure), `scripts/setup-cloudflare.sh` (delete the test-key fallback branch ~377-378; validate `^0x[0-9A-Za-z_-]{20,}$` and escape before `sed`), `cloudflare.config.ts` (real site key), `src/lib/turnstile.ts` (only if the client contract needs it).

- [ ] Replace `size: "invisible"` with the current API (`appearance: "interaction-only"`; consult current Cloudflare Turnstile docs while implementing); confirm no `TurnstileError` in the dev console.
- [ ] Client: when no token is obtained, show an in-voice retryable message and allow re-click, instead of surfacing the server 403.
- [ ] Wizard hardening: remove the fallback; validate + escape the site key before `sed`; `bash -n` both scripts.
- [ ] Owner (or executor with cached `cf` auth) runs wizard stage 4 -> real site key in config + real secret uploaded.
- [ ] Lazy-load the Turnstile script on first interaction if trivial; otherwise skip with a note (perf is not the blocker).
- [ ] Verify dev: persona click obtains a token and completes; battery green; commit.

### Task A7: Deploy + anonymous verification + evidence

- [ ] Battery: `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`.
- [ ] `npm run build:vinext && npm run deploy:vinext`; record the deployed version id.
- [ ] Anonymous checks (no cookies): `/` 200 + purpose string; `/privacy` 200 + Limited Use sentence + effective date; `/terms` 200; `/report/5uej7f57` 200; `curl -s https://roasttube.piyushmehta.com | grep -c 1x000000` = 0.
- [ ] Fresh browser profile, no cookies: click a persona -> report renders (proves the Turnstile fix live); one screenshot each of `/` (above-fold + full), `/privacy`, the demo report with URL bar visible -> `docs/superpowers/notes/assets/verification-<date>/`.
- [ ] Update `docs/superpowers/notes/2026-10-17-google-verification.md` with the rejection findings, the fixes, and evidence paths; commit.
- [ ] **Owner actions:** re-check console URLs (Application home page = `https://roasttube.piyushmehta.com`; privacy URL = `/privacy`; published state); add the ~10s no-login demo segment to the video (re-record the opening only if the changed copy is legible in it); resubmit with the justification.

---

## Phase B: Security and ops

### Task B1: Structured logging on admission paths

**Files:** Modify: `src/app/api/roast/route.ts`.

- [ ] Add `console.warn({ evt: "reject", code, source })` at the rate-limit (`:29-34`), Turnstile (`:59-64`), budget (`:96-104`), YouTube (`:118-123`), and Gemini (`:138-143`) branches; add `console.log({ evt: "roast", source, outcome: "ok", ms })` on success. No titles, ids, or IPs in logs.
- [ ] Verify locally (`npm run dev:vinext`): trigger a rejection (rapid demo clicks) and confirm terminal output.
- [ ] Commit. **Owner:** enable an error-level Workers Logs notification in the dashboard.

### Task B2: Fail-closed secrets + cookie Secure fallback

**Files:** Modify: `src/lib/turnstile.ts`, `src/lib/oauth.ts`; Test: `tests/turnstile.test.ts`, `tests/session.test.ts`.

- [ ] Failing tests first: (a) `verifyTurnstile` with no secret and `NODE_ENV=production` rejects (dev still allows with a warning); (b) cookie options return `Secure` when `NEXT_PUBLIC_APP_URL` starts with `https://` even if `NODE_ENV` is not inlined.
- [ ] Implement: turnstile missing-secret in prod -> `{ success: false }` + `console.error`; `oauth.ts` throws if `SESSION_SECRET` is unset in prod; Secure flag adds the `NEXT_PUBLIC_APP_URL` condition.
- [ ] Tests pass; battery green; commit.

### Task B3: HTTP hygiene (XFF trust, logout POST, headers)

**Files:** Modify: `src/app/api/roast/route.ts`, `src/app/api/auth/logout/route.ts`, `src/components/RoastButtons.tsx`, `next.config.ts`.

- [ ] XFF fallback: use the last element (`xf.split(",").at(-1).trim()`) and comment the Cloudflare guarantee.
- [ ] Logout POST-only (405 on GET); UI sign-out becomes a form POST button (with the same styling).
- [ ] `next.config.ts` headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`.
- [ ] Verify dev: sign-out works; battery green; commit. Contingency: if vinext ignores `next.config` headers on deploy, note it for a follow-up and move on (do not block).

### Task B4: Wizard secret handling

**Files:** Modify: `scripts/setup-cloudflare.sh`, `scripts/setup-google-oauth.sh`, `README.md`.

- [ ] Append `chmod 600 "$ENV_FILE"` after `write_env` in both scripts; README setup uses `install -m 600 .env.example .env.local`.
- [ ] Check `cf workers secrets update --help` for stdin/file input; switch off `--text` if available, else keep and print a one-line exposure caveat.
- [ ] Note the Turnstile dual-file drift (secret in `.dev.vars` only) in README's env table.
- [ ] `bash -n` both scripts; commit.

### Task B5: CI + rollback runbook

**Files:** Create: `.github/workflows/ci.yml`; Modify: `README.md`.

- [ ] Workflow on push/PR: Node 24, `npm ci`, `npm test`, `npx tsc --noEmit`, `npm run lint`, `shellcheck scripts/*.sh` (preinstalled on ubuntu runners).
- [ ] README: "Rollback" section (list versions / roll back via the cf tooling per its `--help`; record the version id after each deploy).
- [ ] Commit; push when the owner approves; verify the workflow run is green.

---

## Phase C: UI defects, states, elevation

Read `/home/piyush/.agents/skills/impeccable/reference/craft-floor.md` before the first edit in this phase. The detector runs in C9.

### Task C1: Report typewriter fix (P0)

**Files:** Modify: `src/components/RoastStream.tsx`, `src/app/report/[id]/page.tsx`, `src/components/RoastButtons.tsx`.

- [ ] Server-render the full roast text; no animation by default. Animate only when the page receives `?fresh=1` (RoastButtons appends it when navigating to a freshly generated report); cap the animation at <=1.5s total; click/keypress completes instantly; `prefers-reduced-motion` never animates.
- [ ] Strip `?fresh` from the URL after the animation (`history.replaceState`).
- [ ] Verify: `curl -s localhost:3000/report/<id> | grep` a known sentence from the roast body (full text present without JS); fresh flow animates briefly; no-JS render shows everything.
- [ ] Battery green; commit.

### Task C2: ScoreGauge needle origin fix

**Files:** Modify: `src/components/ScoreGauge.tsx`.

- [ ] Fix the animated transform so it rotates around the dial center (`transform-box: fill-box` + `transform-origin: center` on the animated wrapper, or animate inside the existing rotate wrapper).
- [ ] Verify a fresh render and a re-render in Chromium (needle stays on dial); Safari-safe by construction; reduced-motion unaffected.
- [ ] Battery green; commit.

### Task C3: Busy, focus, and status (P1-3)

**Files:** Modify: `src/components/RoastButtons.tsx`, `src/app/page.tsx`.

- [ ] Replace `disabled` with `aria-disabled` + a guarded click handler so the focused button keeps focus.
- [ ] Top status strip with `role="status"` / `aria-live="polite"`: "The court is hearing your case..." -> after ~8s "The court is still deliberating... (Ns elapsed)"; `scrollIntoView` on the auto-run after OAuth redirect; `aria-busy` on the button container.
- [ ] Verify keyboard flow: focus stays on the button; devtools a11y tree shows the status region updating.
- [ ] Battery green; commit.

### Task C4: In-voice errors + retry (P1)

**Files:** Modify: `src/app/api/roast/route.ts`, `src/components/RoastButtons.tsx`.

- [ ] Route returns stable codes with short public messages (no upstream text; detail goes to logs per B1). Expired/missing session on the youtube path -> 401 with a reauth code.
- [ ] Client maps codes to voice copy ("Your Google session went stale. Sign in again and the court will resume." / "The roast engine is oversubscribed right now. Give it a minute and demand a retrial.") and shows a Retry button that re-fires the same request.
- [ ] Verify by forcing failures locally (bogus `GEMINI_MODEL`; tokenless youtube POST); battery green; commit.

### Task C5: Branded 404 + error boundary

**Files:** Create: `src/app/not-found.tsx`, `src/app/error.tsx`.

- [ ] `not-found.tsx`: tabloid "CASE DISMISSED" + "this case number is not on file" + front-page link + get-your-own CTA. `error.tsx`: minimal client boundary with reset, in voice.
- [ ] Verify: `curl -s -o /dev/null -w "%{http_code}" localhost:3000/report/zzzzzzzz` = 404 and the styled page contains "CASE DISMISSED".
- [ ] Battery green; commit.

### Task C6: Report composition pass

**Files:** Modify: `src/app/report/[id]/page.tsx`, `src/app/globals.css`.

- [ ] Primary CTA into the product in the share block and footer ("Get your own verdict", links to `/?run=1`).
- [ ] Deck line under the headline (`shareCardLine`); case number gets a small-caps treatment; flag glyphs become small inline SVG markers instead of Unicode symbols; flag grid switches to a wrap layout that cannot orphan the last card; `hyphens-auto` + `lang` on the body and drop `text-justify` below `md`; dateline wrap fix (`hidden sm:inline`); footer link tap targets >=24px.
- [ ] Verify with the demo report at 360px and 1280px, plus a 5-flag sample; battery green; commit.

### Task C7: Report metadata + ShareCard PNG

**Files:** Modify: `src/app/layout.tsx` (`metadataBase`), `src/app/report/[id]/page.tsx` (`generateMetadata`), `src/components/ShareCard.tsx`.

- [ ] Read `node_modules/next/dist/docs/` for the Next 16 metadata API first.
- [ ] `generateMetadata`: title = stored headline; description = "Brain Rot Score N/100, <Tier>"; canonical `/report/<id>`; `openGraph` + `twitter` with the static OG image fallback.
- [ ] ShareCard: `await document.fonts.load(...)` for Anton before painting; paint the report URL; shrink-to-fit instead of silently dropping lines; add a "Downloaded" state.
- [ ] Verify: `curl -s localhost:3000/report/<id> | grep og:title`; open a downloaded PNG and confirm the URL is on it; battery green; commit.

### Task C8: Per-report OG image (feasibility-gated)

**Files:** Create: `src/app/report/[id]/opengraph-image.tsx` (or a static fallback asset + metadata wiring).

- [ ] Timebox 45 minutes: verify satori / `workers-og` / resvg feasibility on this vinext deploy. If supported: render headline, score, tier, URL in the share-card visual language; verify the live `og:image` returns 200 image/png.
- [ ] If unsupported: ship a static branded OG image and note the deferral in the spec §6.
- [ ] Battery green; commit.

### Task C9: Finish pass

- [ ] Run the impeccable detector (`detect.mjs --json src`) -> expect zero findings.
- [ ] Spawn the impeccable finish reviewer + documenter subagents; write `DESIGN.md` from the built world.
- [ ] Retake `docs/screenshots/` (home + report) against the live URL post-deploy.
- [ ] Battery green; commit.

---

## Phase D: Per-user cache + admission resilience

### Task D1: limits.ts user-cache helpers (TDD)

**Files:** Modify: `src/lib/limits.ts`; Test: `tests/limits.test.ts`.

**Interfaces:** Produces `USER_CACHE_TTL_SECONDS = 86_400`, `getCachedUserReportId(kv, channelId): Promise<string | null>`, `cacheUserReportId(kv, channelId, reportId): Promise<void>`; consumed by D3.

- [ ] Failing tests first (mirror the demo-cache tests at `limits.test.ts:72-81`): round-trip; isolation between two channel ids; expiry boundary at 86 399s vs 86 401s with `MapKv` + injected clock.
- [ ] Implement the two helpers; tests pass; commit.

### Task D2: youtube.ts identify() extraction (TDD)

**Files:** Modify: `src/lib/youtube.ts`; Test: `tests/youtube.test.ts` (new).

**Interfaces:** Produces `identify(token): Promise<{ channelId, ... }>`; `collect(token, identity?)` skips its first call when identity is passed (backward compatible); consumed by D3.

- [ ] Failing tests first (stubbed fetch): `identify` parses `channelId`; `collect(token, identity)` saves exactly the remaining calls; existing error paths (quota, no channel) preserved.
- [ ] Implement; tests pass; commit.

### Task D3: Route cache integration

**Files:** Modify: `src/app/api/roast/route.ts`.

**Interfaces:** Consumes D1 + D2.

- [ ] Reorder the youtube branch per spec §3: rate limit -> parse -> session -> `identify` -> unless `force`, cache read; hit responds `{ id, report, signals, score, persona, cached: true, cachedAt }`; dangling pointer falls through silently; budget -> `collect(token, identity)` -> save + pointer (awaited) -> `cached: false`. Demo hit response gains `cached: true`. `force` accepted only for youtube.
- [ ] Manual: seed `user-cache:<channelId>` via local KV tooling; a repeat click serves the cached report with no budget change; `force` regenerates and updates the pointer; a dangling pointer regenerates silently.
- [ ] Battery green; commit.

### Task D4: Client cached panel + retrial

**Files:** Modify: `src/components/RoastButtons.tsx`.

- [ ] On `cached: true`, render an inline panel ("Your verdict still stands, filed <relative time>." + "Open verdict" / "Demand a retrial") instead of auto-redirecting; offer `force` only after a cached response.
- [ ] Verify in dev with a seeded pointer; battery green; commit.

### Task D5: Admission resilience: KV-failure 429 + budget window

**Files:** Modify: `src/lib/limits.ts`, `src/app/api/roast/route.ts`; Test: `tests/limits.test.ts`.

- [ ] Failing test first: admission KV writes wrapped; a throwing `MapKv` yields the in-voice 429 ("The court is full for now. Come back tomorrow.") instead of a thrown error.
- [ ] Align the budget day key to the chosen engine's reset (America/Los_Angeles for Gemini; UTC for Workers AI, current behavior).
- [ ] Tests pass; battery green; commit.

---

## Deferred (documented, not now)

Report-page KV data cache (CPU headroom held at demo traffic); Durable Objects; Upstash; budget raise (LLM RPD wall); per-user budget accounting; `listReports` UI; prompt-injection filter; report-id rate limit / CDN caching; server-side token revocation (sealed cookies, accepted); package pinning (lockfile + CI suffices); Workers Paid upgrade (documented ~$5/mo path).

## Execution Notes

- Ledger: `.superpowers/sdd/2026-10-17-roasttube-launch-hardening/progress.md`, updated per task.
- Commits: plain git on `main`, one per task, concise messages, no co-author trailers.
- Deploys: `npm run build:vinext && npm run deploy:vinext`; record version ids (A7, B5).
- Owner dashboard steps: error-level Workers Logs alert (B1); Turnstile wizard stage (A6); Gemini billing if Q1 lands there (A2b).
