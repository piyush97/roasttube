# RoastTube on Cloudflare Workers — design

Date: 2026-10-17 · Status: awaiting approval · Follows the local-app build (docs/superpowers/plans/2026-10-16-roasttube.md)

## Intent

RoastTube already works locally: sign in with Google, collect likes/subs/playlists, compute hard signals and a Brain Rot Score in TypeScript, let Gemini write a tabloid roast, store reports as JSON files. The next step is publishing it as a real product at **https://roasttube.piyushmehta.com**, without letting strangers burn through the free Gemini quota (roughly 20 generations/day on the free tier).

The public experience: three demo personas anyone can roast instantly, and Google sign-in limited to the owner's OAuth test users. The repo gains a live link, deploy instructions, and copy that stays true in both the local and the hosted environment.

## Goals

1. Live, shareable app on Cloudflare Workers free plan at roasttube.piyushmehta.com.
2. The app survives Workers: no in-memory sessions, no filesystem assumptions, no per-isolate state that matters.
3. Abuse protection tuned to the free Gemini limit: bot check, per-IP limit, global daily budget, demo caching.
4. Local development stays exactly as it is today (`npm run dev`, `npm test`, `npm run build` all keep working).
5. Repo metadata, README, and app copy are truthful for the hosted version.

## Non-goals

- Google OAuth verification / public sign-in. The OAuth app stays in Testing mode (max 100 test users); the demo personas are the public experience. Verification is a future project (needs privacy policy, review).
- Paid Cloudflare features. Free plan only; if the CPU ceiling bites, optimize.
- Changes to roast quality, scoring math, signals, or the Gemini prompt pipeline.
- Multi-user accounts, admin UI, analytics.
- Migrating off GitHub, adding CI.

## Verified facts (recon, 2026-10-17)

- Cloudflare docs recommend **vinext** (their Vite-based Next.js runtime) for new Next.js deployments; OpenNext is documented as the maintenance path for existing OpenNext apps. Both support Next 16 features. (developers.cloudflare.com, pages fetched today; OpenNext page updated Oct 12, vinext page Aug 25.)
- `vinext check` on this repo: **92% compatible, 0 hard issues.** Partials: `cacheComponents` ("experimental, incomplete"), turbopack `rules` ignored under Vite (Tailwind handled differently there).
- `wrangler` 4.124.0 is installed and authenticated (me@piyushmehta.com, account 038769a528a64af1b4207aa46960c248).
- piyushmehta.com nameservers are Cloudflare; zone-to-account membership gets confirmed at deploy time.
- GitHub repo `piyush97/roasttube`: description + topics updated today; visibility still private; homepage gets set after the first successful deploy.

## Decisions locked

| # | Decision | Why |
|---|----------|-----|
| 1 | Target: Cloudflare Workers via **vinext** | CF-recommended path; compat check clean; OpenNext kept as fallback if vinext blocks (see Risks). |
| 2 | Domain: **roasttube.piyushmehta.com** | Clean OAuth redirect and share URLs. |
| 3 | Demo personas cached **1 hour per persona** (shared report id) | Visitor bursts cost one generation instead of N. Cache hits do not consume budget. |
| 4 | Hard global budget **15 generations/day** (env-tunable) | Leaves headroom under ~20/day plus lite-model fallback; friendly "court is closed" message when hit. |
| 5 | **Free plan only** | 10ms CPU per request; page work stays lean, caching tactics below. |
| 6 | Sessions: **encrypted cookie**, no server store | Token sealed (AES-GCM) into an httpOnly cookie. Removes the in-memory Map, the globalThis hack, and the whole class of cross-instance session bugs. |
| 7 | Sign-in stays Test-mode | Only test users can log in; matches anti-abuse goal and avoids Google verification in this project. |

## Design

### 1. Runtime and build path

- `vinext init` (non-destructive) adds the Vite config, `dev:vinext` / `build:vinext` scripts, and the Workers config. `npm run dev` (next dev) and the existing `next build` / `next start` local-prod flow keep working.
- **Drop `cacheComponents` + `partialPrefetching`** from next.config and the related `instant = false` / `connection()` lines. Two of the only three compat partials disappear, and nothing is lost: under classic Next rules both routes render per request anyway (`/` reads cookies; `/report/[id]` has no `generateStaticParams`), so `next build` must show `ƒ (Dynamic)` for both. If it disagrees, `export const dynamic = "force-dynamic"` is the fallback per route. Freshness (today's dateline, live report reads) is re-verified under `vinext dev`/`preview` in the spike.
- Tailwind works in both builds: keep the current turbopack CSS loader for `next dev`, add the official `@tailwindcss/vite` plugin for the Vite/vinext build. (Exact wiring during the spike.)
- `next/font/google` is supported by vinext (self-hosted with fallbacks). No change expected.
- `nodejs_compat` compatibility flag + compat date 2026-10-17 in the Workers config (code uses `node:crypto`). Prefer WebCrypto where trivial.

### 2. Report storage: Workers KV (with filesystem fallback)

- One KV namespace, binding `ROASTTUBE_KV`, key scheme `report:<id>` → `StoredReport` JSON. No TTL (share links must live).
- `src/lib/store.ts` becomes a selector:
  - `store-fs.ts`: today's implementation, untouched behavior, used when no KV binding is present (plain `next dev`, `next start`, node tests).
  - `store-kv.ts`: pure functions taking a KV-like interface (`get` / `put` / `delete` / `list` subset), so they are unit-testable with a fake.
  - `store.ts`: picks KV when the binding is reachable, else fs. The binding lookup happens only here; nothing else in the app touches it.
- Reads happen on the report page (`getReport`), writes on roast creation, deletes unused by the UI (kept for parity).
- Undeployed `next dev` and tests never evaluate Workers-only imports (mechanism verified in the spike; see Risks).

### 3. Sessions: sealed cookie

- Replace the session Map + `newSessionId` / `putSession` / `getSession` / `dropSession` with two functions: `sealSession({token, expiresAt})` and `openSession(value)`, AES-GCM via WebCrypto, key from a new `SESSION_SECRET`.
- Cookie: `rt_session`, httpOnly, sameSite lax, secure in prod, maxAge 3600 (matches token expiry). Payload embeds expiry; expired or tampered values read as signed-out.
- Logout clears the cookie (no server revocation; the token was ephemeral anyway).
- This deletes the `globalThis.__roasttubeSessions` hack entirely. Nothing else changes: home page, roast route, callback, logout keep their call sites, only the internals swap.
- Payload is exactly `{token, expiresAt}`. No profile fields and no silent refresh: a session ends with the Google token, roughly an hour, same as today.
- SameSite note: `lax` is required for the OAuth redirect back from Google to carry the state cookie; the session cookie follows the same setting for consistency.

### 4. Abuse protection (order of checks in POST /api/roast)

1. **Rate limit, per IP**: KV counter `rl:<ip>` with 1h TTL, 3 roasts/hour (matches current copy), applied to both sources. IP from `CF-Connecting-IP` header, `x-forwarded-for` fallback (this also fixes localhost header trust).
2. **Turnstile, demo path only**: for `source:"demo"`, verify the token via siteverify before any work; skipped when keys are absent (plain local dev). Signed-in roasts skip it on purpose: the Google test-user allowlist plus the two limits below cover that path, and the auto-run-after-login flow stays frictionless. Client uses an invisible/managed widget on the demo buttons with a fresh token per POST (tokens are single-use, 300s TTL). The widget is created for `roasttube.piyushmehta.com`; local Workers-shaped testing uses Turnstile's always-pass test keypair in `.dev.vars`. Setup + wiring follows the turnstile-spin skill.
3. **Demo cache** (demo source only): `demo-cache:<persona>` → report id, TTL 3600. Hit: re-read `report:<id>` and return the exact response shape of a fresh demo roast (no generation, no budget consumption). If CPU pressure ever materializes, the escape hatch is one line: return `{id}` alone, since the client already reads nothing but `.id`. Miss: continue.
4. **Global daily budget**: KV counter `budget:<YYYY-MM-DD>`, cap 15 (env `DAILY_ROAST_BUDGET`). One unit per roast admitted to generation, for both sources. Internal model retries and the lite-model fallback do not consume extra units; that headroom is exactly what the 15-vs-quota margin is for. Cache hits never count. Exhausted → 429 "The court has heard enough cases today" copy. A generation that later fails at Gemini keeps its unit (conservative).
5. Generate → save report → for demos also write the cache key.

- KV counters are eventually consistent; small overshoot is acceptable and covered by the margin (budget 15 vs quota ~20). No Durable Objects.
- Local (no binding): in-process Map equivalents with the same shapes, committed as small fallbacks; node tests use fakes with injectable clocks.

### 5. Free-plan tactics

- Report pages are immutable once written: give them a modest `Cache-Control` / vinext ISR cache (builder verifies the exact mechanism in the spike; `export const revalidate` is the candidate) so repeat views don't re-render in the Worker.
- Home page and roast route stay uncached.
- Set `observability.enabled` in the Workers config to watch CPU time, and check `wrangler tail` during smoke tests. If 10ms CPU is exceeded, options in order: cache more, trim render work, simplify the roast route's JSON handling.

### 6. Deploy mechanics and environment

- `wrangler.jsonc`: worker `roasttube`, KV binding, `routes = [{ pattern: "roasttube.piyushmehta.com", custom_domain: true }]`, vars (`NEXT_PUBLIC_APP_URL=https://roasttube.piyushmehta.com`, `DAILY_ROAST_BUDGET=15`), `nodejs_compat`, observability.
- Secrets (via `wrangler secret put`, wizard script automates from `.env.local` where possible): `GEMINI_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET` (new, generated), `TURNSTILE_SECRET_KEY`. Public var: `NEXT_PUBLIC_TURNSTILE_SITE_KEY`. `GEMINI_MODEL` stays unset in prod (default + lite fallback apply); it remains a documented optional override in `.env.example`.
- `NEXT_PUBLIC_*` values must exist at build time; the spike confirms how vinext surfaces env (`.env.local` vs vars vs `.dev.vars`) and the deploy script sets what the build needs.
- Google console (human step, wizard): add `https://roasttube.piyushmehta.com/api/auth/callback/google` to the OAuth client's redirect URIs. Localhost URI stays.
- `scripts/setup-cloudflare.sh` (wizard-style, generated with the wizard skill): creates the KV namespace, uploads secrets, checks the zone, walks the Google console step, runs the first deploy.
- `.workers.dev` URL is the fallback if the custom domain attach fails on zone-account mismatch; the OAuth redirect for that URL is added at that point if needed.
- E2E on the live site with the browser (bsk): home renders, demo roast works, second click within 1h returns the **same** report id (cache proof), report page + share card render, rate-limit and budget messages appear when forced locally with a temporary low cap, login round-trip works with the new redirect URI.

### 7. Repo, metadata, and copy truth

- After deploy: `gh repo edit --homepage https://roasttube.piyushmehta.com`; description/topics already done.
- README: live link at top; "Deploy your own" section (Cloudflare); updated storage/privacy wording (KV + sealed cookie + Turnstile + budget); date line; exact test count.
- Copy fixes so nothing lies in prod:
  - Home footer ("Runs entirely on your machine. Reports live in ./data/reports...") → wording true in both environments.
  - OAuth error message hardcodes `http://localhost:3000` → derive from the app URL.
  - README + `.env.example` header comments about where things are stored.
- `.env.example` gains `SESSION_SECRET`, `TURNSTILE_*`, and the budget var (all optional locally).
- `.gitignore` gains `.wrangler/`, `.dev.vars`, Vite build output.

## Files expected to change

- `package.json` (scripts, vinext/Vite/Tailwind-Vite deps), `vite.config.ts`, `wrangler.jsonc` (new), `next.config.ts` (drop cacheComponents/partialPrefetching).
- `src/lib/store.ts` → selector + `store-fs.ts` + `store-kv.ts`; new `src/lib/kv.ts` (binding accessor, limiter, budget, demo cache; all pure over a KV-like interface).
- `src/lib/oauth.ts` (sealed cookie; delete session Map), callback + logout routes, `src/app/api/roast/route.ts` (checks + headers), `src/app/page.tsx` (copy, URL), `RoastButtons.tsx` + new `TurnstileWidget.tsx`, report page (caching export only).
- Tests: `tests/helpers/fake-kv.ts`; new suites for sealing, KV store, limiter, budget, demo cache.
- `scripts/setup-cloudflare.sh` (new), `README.md`, `.env.example`, `.gitignore`.

## Verification plan

1. Local: `npm test` (all existing + new), `npx tsc --noEmit`, `npm run lint`, `npm run build`, then `next start` smoke (fs storage path unchanged).
2. Workers-shaped local: `vinext dev` + `preview` smoke, including KV binding behavior and Turnstile-off path.
3. Deployed: the E2E list in section 6, plus `wrangler tail` CPU inspection.
4. Proxy checks: report ids still 8-char base36; roast text pipeline untouched (snapshot a demo roast locally before/after migration to confirm identical shape).

## Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Binding access mechanics under plain `next dev` (Workers-only module) | Spike step 0 before any refactor; leading approach: runtime selector with the binding import isolated in `store-kv.ts` / `kv.ts`; fallback: small build-time switch. |
| vinext beta quirks beyond the compat report | Spike exercises dev + build + binding + Tailwind + fonts before the refactor; OpenNext adapter is the documented fallback. |
| Env flow differences (.env.local vs wrangler vars vs .dev.vars) | Spike confirms; deploy script sets what the build needs; documented in README. |
| KV eventual consistency on counters | Limits are soft by design; margins absorb overshoot. |
| Free-plan 10ms CPU | Lean pages, report caching, observability from day one; escalation path above. |
| Turnstile adds client weight / friction | Demo path only, invisible mode, skipped entirely when keys absent; signed-in roasts rely on the Google allowlist instead. |
| Custom domain zone mismatch | Deploy falls back to workers.dev; zone fix is a one-line wizard step. |

## Left to the builder

Exact import mechanics for KV access (spike outcome), Tailwind-Vite wiring details, Turnstile widget provisioning route (API vs dashboard), ISR/cache mechanism for report pages, wording for new copy, and CPU tuning if smoke shows pressure. Everything else above is decided.
