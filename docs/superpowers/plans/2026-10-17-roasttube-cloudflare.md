# RoastTube on Cloudflare Workers — implementation plan

> **For the implementer:** you have not seen this codebase. Read `docs/superpowers/specs/2026-10-17-roasttube-cloudflare-design.md` first; it is the source of truth for decisions. This plan turns it into ordered, testable tasks with exact files, names, and values. Do the tasks in order; the spike comes first because two mechanisms are verified there, not assumed.

**Goal:** publish roasttube.piyushmehta.com on Cloudflare Workers (free plan): demo roasts public and abuse-bounded, Google sign-in limited to OAuth test users, local `next dev` / `next test` untouched.

**Architecture:** vinext (Cloudflare Vite plugin v2) builds the Next 16 app into a Worker. Reports live in one KV namespace (`ROASTTUBE_KV`, key `report:<id>`). Sessions become an AES-GCM sealed httpOnly cookie instead of an in-memory Map. `POST /api/roast` runs per-IP rate limit → Turnstile (demo only) → demo cache (demo only) → global daily budget → generation. `cloudflare.config.ts` (typed, `cf/config`) declares bindings, vars, secrets, and the custom domain; deploy is `npx @vinext/cloudflare deploy` after a one-time `cf auth login`.

**Tech stack:** Next.js 16.4.2 / React 19.3 / TypeScript · vinext + Vite 8 + `@tailwindcss/vite` · Workers `nodejs_compat`, compat date 2026-10-17 · Workers KV · Turnstile · Google OAuth PKCE · Gemini · `node --test` (tests import `../src/lib/x.ts` directly, plain `assert/strict`).

**Repo conventions that bind:** plain git on `main` (`but` is not in use here), never a co-author trailer, small commits, tests in flat `tests/*.test.ts` files, no route-level unit tests exist (route behavior is covered by pure-function tests plus E2E).

**Ground rules discovered during recon (do not re-litigate):**
- Workers with `nodejs_compat` and compat date ≥ 2025-04-01 populate `process.env` from vars and secrets. Existing `process.env` reads keep working; only KV needs `import { env } from "cloudflare:workers"`.
- KV namespaces auto-provision on deploy (`bindings.kv()`), secrets upload with `cf workers secrets update`, local Workers dev reads `.dev.vars`.
- No `postcss.config.*` exists; Tailwind is wired by the turbopack loader rule only, so the Vite build needs `@tailwindcss/vite`.

---

## Task 1: Spike — vinext in this repo, mechanisms recorded

Exploratory by design (approved in the design doc). Two mechanisms are verified, not assumed: the `cloudflare:workers` dynamic-import guard, and env flow under both runtimes. Deliverable: init changes + a notes file.

**Files:** `package.json`, `vite.config.ts` (new), `cloudflare.config.ts` (new), temporary `src/app/api/kv-probe/route.ts`, `docs/superpowers/notes/2026-10-17-vinext-spike.md` (new).

**Steps:**
1. If a package-manager prompt appears, choose **npm** (the repo tests/scripts assume npm; `bun.lock` is a stale untracked file). Defaults elsewhere. Then `npx vinext init --platform=cloudflare`; answer caching prompts **no persistent cache**, image optimization **off**.
2. `npm install`. Confirm generated scripts exist: `dev:vinext`, `build:vinext`, `preview`, `deploy:vinext` (names may vary slightly; record actual ones in the notes file).
3. `npx vinext check` again; record before/after (`cacheComponents` still flagged until Task 2).
4. Add Tailwind for Vite: `npm i -D @tailwindcss/vite`, then in `vite.config.ts` add `import tailwindcss from "@tailwindcss/vite";` and put `tailwindcss()` in `plugins` alongside the vinext plugin.
5. Env probe: add `MESSAGE: bindings.text("env-probe-ok")` to the generated `cloudflare.config.ts` worker `env` (keep it; harmless). Temporarily `console.log("ENV PROBE", process.env.MESSAGE ?? "MISSING")` in `src/app/page.tsx`; run `npm run dev:vinext`; expect `env-probe-ok` in the terminal, not `MISSING`. Remove the log line.
6. KV probe: add `ROASTTUBE_KV: bindings.kv()` to the config `env`, then temporary `src/app/api/kv-probe/route.ts`:
   ```ts
   export async function GET() {
     try {
       const spec = "cloudflare:workers";
       const mod = (await import(/* @vite-ignore */ spec)) as { env?: Record<string, unknown> };
       const kv = mod.env?.ROASTTUBE_KV as { put(k: string, v: string): Promise<void>; get(k: string): Promise<string | null> } | undefined;
       if (!kv) return Response.json({ kv: false });
       await kv.put("spike", "hello");
       return Response.json({ kv: true, v: await kv.get("spike") });
     } catch (e) {
       return Response.json({ kv: false, err: String(e) });
     }
   }
   ```
   Under `npm run dev:vinext`: expect `{kv:true,"v":"hello"}`. Under `npm run dev` (next dev): expect `{kv:false}` — and **`npm run build` must still pass** with this file present (this is the acceptance criterion for the dynamic-import guard; a computed specifier is not statically resolved).
7. Tailwind probe under `npm run dev:vinext`: fetch the home page, find its CSS asset, assert a utility class (e.g. `\.mx-auto`) is present. Font probe: view the page in a browser (bsk): masthead renders Anton, body renders Source Serif, nothing falls back to Arial. Record both.
8. `npm run build`, `npm run preview` (or the generated preview script; note the port): home renders, `/api/kv-probe` returns `{kv:true}`. Then `npm test`, `npx tsc --noEmit`, `npm run lint` — all green.
9. Write `docs/superpowers/notes/2026-10-17-vinext-spike.md`: each probe, exact command, observed result, port numbers, script names. If the KV probe fails under workerd, stop and take the documented fallback (platform-split module via Vite resolve conditions) before proceeding; record that instead.
10. Delete the temporary probe route and the probe log if any remains.

**Verification:** notes file lists every probe with PASS; `npm test`/`tsc`/`lint`/`next build` green; `next dev` still works.

**Commit:** `chore: vinext init and spike findings`

## Task 2: Drop the cacheComponents-era flags

**Files:** `next.config.ts`, `src/app/page.tsx`, `src/app/report/[id]/page.tsx`.

**Steps:**
1. `next.config.ts`: remove `cacheComponents: true` and `partialPrefetching: true`; keep the `turbopack.rules` CSS loader block.
2. `src/app/page.tsx`: delete `export const instant = false;`, `await connection();`, and the `import { connection } from "next/server";` line.
3. `src/app/report/[id]/page.tsx`: delete the `export const instant = false;` line and its comment.
4. `npm run build` — expect the route summary to show both `/` and `/report/[id]` as dynamic (the `ƒ` marker). If either is prerendered as static instead, add `export const dynamic = "force-dynamic";` to that page (documented fallback) and re-run.
5. `npm test && npx tsc --noEmit && npm run lint`.

**Verification:** build output shows both routes dynamic; all checks green.

**Commit:** `refactor: drop cacheComponents-era flags, both routes render per request`

## Task 3: KV abstraction + report store split (fs / kv / selector)

TDD: write the tests first (they fail until the modules exist), then implement.

**Files:** `src/lib/ids.ts` (new), `src/lib/kv.ts` (new), `src/lib/store-kv.ts` (new), `src/lib/store-fs.ts` (new; today's `store.ts` moved), `src/lib/store.ts` (replaced with selector), `tests/map-kv.test.ts` (new), `tests/store-kv.test.ts` (new).

**Interfaces (exact):**
```ts
// src/lib/kv.ts
export interface KvLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
  list(opts?: { prefix?: string; limit?: number }): Promise<{ keys: { name: string }[] }>;
}
export class MapKv implements KvLike { constructor(now: () => number = Date.now) {} }
export function getKvBinding(): Promise<KvLike | null>; // memoized module load, see below
export function getKv(): Promise<KvLike>;              // binding ?? process-wide MapKv

// src/lib/ids.ts
export const ID_RE = /^[a-z0-9]{8}$/;
export function newId(): string; // 8 chars, crypto, 36-char alphabet (moved from store.ts)

// src/lib/store-kv.ts
export function createKvStore(kv: KvLike): {
  saveReport(report: RoastReport, signals: Signals, score: ScoreResult, source: StoredReport["source"], persona?: string): Promise<string>;
  getReport(id: string): Promise<StoredReport | null>;
  listReports(limit?: number): Promise<StoredReport[]>;
  deleteReport(id: string): Promise<boolean>;
};
```

**Implementation notes (pinned):**
- `kv.ts` binding lookup — the guard verified in Task 1:
  ```ts
  type WorkersModule = { env?: Record<string, unknown> };
  let modulePromise: Promise<WorkersModule | null> | null = null;
  function loadWorkersModule(): Promise<WorkersModule | null> {
    modulePromise ??= (async () => {
      try {
        const spec = "cloudflare:workers";
        return (await import(/* @vite-ignore */ spec)) as WorkersModule;
      } catch {
        return null;
      }
    })();
    return modulePromise;
  }
  export async function getKvBinding(): Promise<KvLike | null> {
    const m = await loadWorkersModule();
    const kv = m?.env?.ROASTTUBE_KV;
    return kv && typeof (kv as KvLike).get === "function" ? (kv as KvLike) : null;
  }
  ```
  Read `.env` fresh per call (do not cache the env object itself). `getKv()` returns `(await getKvBinding()) ?? localKv` where `localKv` is one module-level `new MapKv()`.
- `MapKv`: `Map<string, { value: string; expiresAt: number | null }>`; `get` returns `null` and deletes when expired for the injected clock; `put` sets `expiresAt = ttl ? now() + ttl * 1000 : null`; `list` filters expired, honors `prefix`, `limit` (default unlimited).
- `store-kv.ts`: key `report:<id>`; `saveReport` uses `newId()` once (no create-exclusive loop needed; collision probability is negligible — noted in a comment); `getReport`/`deleteReport` gate on `ID_RE` like the fs version; `deleteReport` returns `true` after a valid-id delete even if the key was absent (KV delete is idempotent; comment the difference); `listReports` lists with `{ prefix: "report:", limit: 1000 }`, parses, drops corrupt entries, sorts `createdAt` desc, slices like the fs version.
- `store-fs.ts`: today's `store.ts` verbatim except importing `ID_RE`/`newId` from `./ids.ts`. Keep behavior identical (`wx` loop included).
- `store.ts`: selector with the same four exported function names/signatures as today (`saveReport`, `getReport`, `listReports`, `deleteReport`); resolves `getKvBinding()` per call, memoizes the `createKvStore(kv)` result once a binding exists, otherwise delegates to `store-fs.ts`. Every existing consumer (`route.ts`, `report/[id]/page.tsx`, `tests/store.test.ts`) keeps compiling unchanged.

**Tests (write first):**
- `tests/map-kv.test.ts`: missing key → null; put/get roundtrip; TTL expiry via injected clock (put ttl 60, advance 61000 → null); list honors prefix and limit; delete removes.
- `tests/store-kv.test.ts` (fresh `MapKv` per test): save → get roundtrip with matching id (`ID_RE`); get unknown → null; get malformed id → null; corrupt JSON → null; list sorted newest-first and limited; delete → get null.
- Existing `tests/store.test.ts` must pass untouched (fs path).

**Verification:** `npm test` green (old + new); `npx tsc --noEmit`; `npm run build`.

**Commit:** `feat: KV-backed report store behind an fs/KV selector`

## Task 4: Sealed-cookie sessions

TDD again: `tests/session.test.ts` first.

**Files:** `src/lib/oauth.ts`, `tests/session.test.ts` (new), `src/app/api/auth/callback/google/route.ts`, `src/app/api/auth/logout/route.ts`, `src/app/page.tsx`, `src/app/api/roast/route.ts`.

**Interfaces (exact):**
```ts
// src/lib/oauth.ts — new exports, replacing newSessionId/putSession/getSession/dropSession
export function sealSession(session: { token: string; expiresAt: number }): Promise<string>;
export function openSession(value: string): Promise<{ token: string; expiresAt: number } | null>;
```

**Implementation notes (pinned):**
- AES-GCM via WebCrypto (global `crypto` — present in Node ≥ 20 and workerd; no `node:crypto` needed here). Key = `SHA-256(process.env.SESSION_SECRET ?? devSecret)` imported raw for AES-GCM; cache `{ secret, key }` and re-derive when the secret string changes (tests switch it).
- `devSecret()`: one per-process random 32-byte hex value (module-level); local dev needs no setup, and sessions ending at restart matches today's behavior. Comment says production requires `SESSION_SECRET`.
- Payload: exactly `JSON.stringify({ token, expiresAt })`. Wire format: `base64url(iv (12 bytes) || ciphertext)` via `btoa`/`atob` helpers, `=` stripped. `openSession` returns null on: empty/invalid base64, decrypt failure (GCM tag), unparseable JSON, wrong shape, or `expiresAt <= Date.now()`.
- Cookie name stays `rt_session`; call sites keep the current cookie options (`httpOnly`, `sameSite: "lax"`, `secure: cookieSecure()`, `path: "/"`, `maxAge: 3600`).
- Call sites: callback route sets `await sealSession({ token: accessToken, expiresAt })` as the cookie value; `page.tsx` uses `const session = await openSession(jar.get(SESSION_COOKIE)?.value ?? "")`; roast route replaces `getSession(sid)` with `sid ? await openSession(sid) : null`; logout routes drop the `dropSession` calls and just delete the cookie. Delete the `globalThis.__roasttubeSessions` block and `newSessionId`.

**Tests (`tests/session.test.ts`):**
- roundtrip preserves `{token, expiresAt}`; sealed value is not plaintext (does not contain the token).
- expired seal → null.
- tampered value (mutate a middle character) → null.
- empty string and junk → null.
- different `SESSION_SECRET` between seal and open → null (set/restore `process.env.SESSION_SECRET` per test).
- dev fallback: with `SESSION_SECRET` unset, seal → open roundtrips.
- size: sealing a 200-char token stays under 1024 chars (cookie budget).

**Verification:** `npm test`; `npx tsc --noEmit`; `npm run lint`; `npm run build`.

**Commit:** `feat: sealed-cookie sessions replace the in-memory session map`

## Task 5: Limits and Turnstile — pure functions + tests

TDD: tests first.

**Files:** `src/lib/limits.ts` (new), `src/lib/turnstile.ts` (new), `tests/limits.test.ts` (new), `tests/turnstile.test.ts` (new).

**Interfaces (exact):**
```ts
// src/lib/limits.ts
export const RATE_LIMIT_PER_HOUR = 3;
export const DAILY_BUDGET_DEFAULT = 15;
export function ipRateLimited(kv: KvLike, ip: string, now: number, limit?: number, windowMs?: number): Promise<boolean>; // true = reject
export function consumeBudget(kv: KvLike, now: number, cap: number): Promise<boolean>; // true = admitted (unit consumed)
export function getCachedDemoReportId(kv: KvLike, persona: string): Promise<string | null>; // demo-cache:<persona>
export function cacheDemoReportId(kv: KvLike, persona: string, id: string): Promise<void>;   // TTL 3600
export function dailyBudgetCap(env?: NodeJS.ProcessEnv): number; // parse, clamp to >= 1, default 15

// src/lib/turnstile.ts
export function verifyTurnstile(opts: {
  secret: string | undefined; token: string | undefined; remoteIp?: string; fetchFn?: typeof fetch;
}): Promise<boolean>;
```

**Implementation notes (pinned):**
- Rate limit value: `JSON.stringify({ n, reset })`, key `rl:<ip>`, `expirationTtl` = window + 60s. `now >= reset` starts a fresh window. Rejected requests do not write (never extend a window by hammering).
- Budget key: `budget:<UTC date>`, date via `new Date(now).toISOString().slice(0, 10)`; `expirationTtl` 2 days. Corrupt/missing value counts as 0. The read-then-write race can overshoot by one under concurrency — accepted (design: soft limits, margin covers it); say so in a comment.
- `turnstile.ts`: skipped (`true`) when `secret` is unset; missing token with a secret → `false`; POST `https://challenges.cloudflare.com/turnstile/v0/siteverify` with `secret` + `response` (+ `remoteip` when given); any throw / non-OK / `success !== true` → `false`. `fetchFn` default `fetch`.

**Tests:**
- `tests/limits.test.ts` (fresh `MapKv` + fake clock): three roasts allowed, fourth rejected; window rollover (advance 3600001 ms) allows again; IPs are independent; budget cap 2 admits twice then rejects; next UTC day admits again; `dailyBudgetCap` default 15, respects env, clamps junk/zero to 1.
- `tests/turnstile.test.ts`: no secret → true even without token; secret + missing token → false; mocked `fetchFn` success true / success false / HTTP 500 / throw → expected; `remoteip` lands in the posted body when provided.

**Verification:** `npm test`; `npx tsc --noEmit`.

**Commit:** `feat: pure rate-limit, budget, demo-cache, and Turnstile helpers`

## Task 6: Wire the abuse stack into POST /api/roast, add the Turnstile widget

**Files:** `src/app/api/roast/route.ts`, `src/components/TurnstileWidget.tsx` (new), `src/components/RoastButtons.tsx`, `src/app/page.tsx`.

**Route — exact new check order:**
1. `const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";` then `await ipRateLimited(await getKv(), ip, Date.now())` → 429 `{error:"rate_limited", message:"3 roasts per hour. Breathe. Try again later."}` (existing copy).
2. Parse body `{source, persona, turnstileToken}` (existing `bad_json` behavior).
3. Demo branch: validate persona; then `verifyTurnstile({ secret: process.env.TURNSTILE_SECRET_KEY, token: body.turnstileToken, remoteIp: ip })` → `403 {error:"turnstile_failed", message:"Bot check failed. Reload the page and try again."}`.
4. Demo branch: cache — `const cachedId = await getCachedDemoReportId(kv, persona); if (cachedId) { const stored = await getReport(cachedId); if (stored) return NextResponse.json({ id: stored.id, report: stored.report, signals: stored.signals, score: stored.score, persona }); }` (stale id falls through).
5. Budget — `await consumeBudget(kv, Date.now(), dailyBudgetCap())` → `429 {error:"budget_exhausted", message:"The court has heard enough cases today. Come back tomorrow."}`.
6. Existing flow (youtube session via `openSession`, signals, score, roast, save), then `if (source === "demo" && persona) await cacheDemoReportId(kv, persona, id);` before returning the existing JSON.
- Delete the in-memory `hits` Map and the old `rateLimited` function. Read the kv once per request (`const kv = await getKv()`).

**`TurnstileWidget.tsx` (pinned API):**
```tsx
"use client";
export type TurnstileHandle = { execute(): Promise<string | null> };
export function TurnstileWidget({ siteKey, ref }: { siteKey?: string; ref?: React.Ref<TurnstileHandle> });
```
- Loads `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit` once (`id="cf-turnstile-script"`), script `onload` → `window.turnstile.render(container, { sitekey, size: "invisible", callback, "error-callback", "timeout-callback" })`; renders nothing when `siteKey` is empty.
- `execute()`: resolves the next token; `reset(widgetId)` then `execute(widgetId)` for a fresh single-use token; resolves `null` on error/timeout (8s guard) or when the widget is unavailable. Cleanup removes the widget.
- `RoastButtons.tsx`: new prop `turnstileSiteKey?: string`; keep a `ref` to the handle; in `runDemo`, before the fetch: `const turnstileToken = turnstileSiteKey ? (await widget.current?.execute()) ?? undefined : undefined;` and include `turnstileToken` in the JSON body only when defined. `setBusy` before execute. On failure keep the existing error rendering (server message wins).
- `page.tsx`: pass `turnstileSiteKey={process.env.TURNSTILE_SITE_KEY}`.
- No route unit tests (repo convention — routes aren't unit-tested); the pure logic is covered in Task 5 and the wiring is proven in Task 9's E2E.

**Verification:** `npm test`; `npx tsc --noEmit`; `npm run lint`; `npm run build`.

**Commit:** `feat: Turnstile, IP rate limit, demo cache, and daily budget gate the roast route`

## Task 7: Worker config, env plumbing, setup wizard

**Files:** `cloudflare.config.ts`, `scripts/setup-cloudflare.sh` (new), `.env.example`, `.gitignore`, `package.json` (only if scripts drifted).

**Steps:**
1. `cloudflare.config.ts` (extend the generated file, keep generated fields): `compatibilityDate: "2026-10-17"`, `compatibilityFlags: ["nodejs_compat"]`, observability enabled, and worker `env`:
   - `ROASTTUBE_KV: bindings.kv()`
   - `NEXT_PUBLIC_APP_URL: bindings.text("https://roasttube.piyushmehta.com")`, `TURNSTILE_SITE_KEY: bindings.text("<from Turnstile widget>")`, `DAILY_ROAST_BUDGET: bindings.text("15")`
   - the five `bindings.secret()` entries: `GEMINI_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET`, `TURNSTILE_SECRET_KEY`
   - **No `domains` yet** — the custom domain is added in Task 11 after the workers.dev smoke.
2. `scripts/setup-cloudflare.sh` — generate it with the **wizard skill** (it walks a human through steps only they can do). It must: check `cf` exists and run `cf auth login` if not authenticated; verify the `piyushmehta.com` zone is in the account; write `.dev.vars` from `.env.local` plus the Turnstile test keypair (`TURNSTILE_SITE_KEY=1x00000000000000000000AA`, `TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA`); generate `SESSION_SECRET` (`openssl rand -base64 32`) when absent; upload all five secrets with `cf workers secrets update`; open the Google console redirect-URI page and the Turnstile widget page with exact instructions; finish with the first `npx @vinext/cloudflare deploy`. Values must never be echoed back to the terminal.
3. `.env.example`: add `SESSION_SECRET` (optional locally; per-process random fallback), `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` (optional locally; checks are skipped when unset), `DAILY_ROAST_BUDGET` (optional, default 15), and a comment that `vinext dev` reads `.dev.vars` while `next dev` reads `.env.local`.
4. `.gitignore`: add `.dev.vars`, `.wrangler/`, `dist/`, `/bun.lock` (untracked leftover).

**Verification:** `npm run build:vinext` succeeds with the edited config; the wizard script passes `bash -n` and runs end-to-end during Tasks 10–11 (iterate it there if a command drifted).

**Commit:** `chore: worker bindings, env plumbing, and Cloudflare setup wizard`

## Task 8: Copy that stays true in both environments

**Files:** `src/app/page.tsx`, `src/components/RoastButtons.tsx`.

**Steps:**
1. Footer (`page.tsx`): replace the "Runs entirely on your machine. Reports live in ./data/reports" line with: `RoastTube — entertainment, barely. Roasts are stored so links keep working; sign-in tokens are dropped once the evidence is collected.`
2. `oauth_state` error copy: replace the hardcoded `http://localhost:3000` with `the front page` ("Open the front page and click Roast my YouTube again.").
3. `RoastButtons.tsx` reason strings: drop `.env.local` from `demoReason` → `"Needs GEMINI_API_KEY — the roast engine runs on Gemini."`; `oauthReason` → `"Needs GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET. Until then, the demo cases below are fully admissible."`

**Verification:** `npm run lint`; `npx tsc --noEmit`; visual pass under `next dev`.

**Commit:** `polish: copy that stays true in the hosted version`

## Task 9: Local Workers E2E + full local verification

**Steps:**
1. `npm test && npx tsc --noEmit && npm run lint && npm run build && npm run build:vinext` — all green.
2. Ensure `.dev.vars` exists (Task 7 script, or copy `.env.local` + Turnstile test keys by hand).
3. `npm run preview` (workerd; port from the spike notes). Browser (bsk):
   - home renders with fonts and styles;
   - run a demo roast → lands on `/report/<id>`, page renders;
   - click the same persona again within the window → **same id** in the URL (cache proof);
   - on a third persona → new id; fourth demo request → rate-limit message;
   - stop preview, start it again, re-open the cached report → still renders (KV-backed, not in-memory);
   - set `DAILY_ROAST_BUDGET=0` in `.dev.vars`, restart preview, demo roast → "The court has heard enough cases today." message; set back to 15.
4. `npm run dev` (next dev) smoke, fs path: home, one demo roast, report page; login round-trip with the real Google account (test user) → auto-run YouTube roast (one real Gemini generation — acknowledged) → report renders; sign out. This proves the sealed cookie across the real OAuth flow.
5. Fix anything red, then commit fixes only.

**Verification:** every bullet above observed; no code left uncommitted besides intentional artifacts (`.dev.vars` is gitignored).

**Commit:** only if fixes were needed (e.g. `fix: preview-mode issues found in local E2E`).

## Task 10: First deploy to workers.dev + live smoke

**Steps:**
1. Run `scripts/setup-cloudflare.sh` (or its steps) — the `cf auth login` browser click is the one interactive moment; hand it to the user if the script can't complete it.
2. `npx @vinext/cloudflare deploy`. Record the workers.dev URL from the output.
3. Smoke on workers.dev: `curl -I` home → 200; browser: demo roast → report; second click same id; rate-limit message; re-open a report after a few minutes.
4. Observe CPU: live logs via the Cloudflare dashboard (Workers → roasttube → Logs) or `wrangler tail --name roasttube` if it works; record per-request CPU for home, report, and POST in the notes file. Baseline: everything well under 10ms; if not, Task 13.
5. If deploy fails before smoke: read the error, fix config, redeploy; do not proceed to the domain with a broken workers.dev.

**Verification:** workers.dev URL serves the full demo flow; notes file has CPU numbers.

**Commit:** config fixes only, if any.

## Task 11: Custom domain + production E2E

**Steps:**
1. Human step (wizard script): add `https://roasttube.piyushmehta.com/api/auth/callback/google` as an authorized redirect URI on the Google OAuth client; keep the localhost URI.
2. Add `domains: ["roasttube.piyushmehta.com"]` to `cloudflare.config.ts`; `npx @vinext/cloudflare deploy`; wait for the DNS record + certificate, then `curl -I https://roasttube.piyushmehta.com` → 200.
3. Production E2E (bsk), on the real domain: home; demo roast → report; second click same id; report URL shareable; rate-limit message; Google login round-trip (test user) → auto-run → report; sign-out returns home. Skip the budget test in prod (it would burn a real generation; covered locally in Task 9).
4. If the domain attach fails (zone-account mismatch), keep the workers.dev URL as the smoke carrier, surface the exact error to the user, and park the domain (design's documented fallback).
5. Re-run `npx vinext check` for the record.

**Verification:** `https://roasttube.piyushmehta.com` serves the app over TLS; all E2E bullets observed.

**Commit:** `chore: attach the custom domain`

## Task 12: Repo polish after deploy

**Files:** `README.md`, then repo metadata.

**Steps:**
1. README: live link at the top (`https://roasttube.piyushmehta.com`); storage/privacy wording (local: `./data/reports`; Cloudflare: Workers KV; sessions: sealed cookie, no server store; demo path: Turnstile + 3/hour/IP + 15 roasts/day budget); a "Deploy your own" section (Cloudflare account, `cf auth login`, `scripts/setup-cloudflare.sh`, Google OAuth client + redirect URI, Turnstile widget, free-tier caveats); date line; exact test count from `npm test`.
2. `gh repo edit --homepage https://roasttube.piyushmehta.com`.
3. Ask the user before flipping the repo public (`gh repo edit --visibility public --accept-visibility-change-consequences`); never do it unasked.
4. Final `npm test && npx tsc --noEmit && npm run lint`; commit; push.

**Verification:** README statements match reality on the live site; homepage set; repo state pushed.

**Commit:** `docs: live link and deploy-your-own for the hosted launch`

## Task 13 (contingency): report-page KV data cache — only if Task 10/11 shows CPU pressure

**Steps:** add `kvDataAdapter()` from `@vinext/cloudflare/cache/kv-data-adapter` to `vinext({ cache: ... })` in `vite.config.ts`; add `VINEXT_KV_CACHE: bindings.kv()` to the worker `env`; on `src/app/report/[id]/page.tsx` add `export const revalidate = 3600;` and `export async function generateStaticParams() { return []; }`; `npm run build:vinext`; redeploy; re-check the tail. If it does not measurably help, revert it.

---

## Review focus (where a reviewer should push back)

1. **Sealed-cookie security** — AES-GCM with SHA-256-derived keys, no nonce reuse (fresh 12-byte IV per seal), httpOnly + lax + secure-in-prod. Tamper/expiry/different-secret tests are the guardrail; if SESSION_SECRET is ever missing in prod, sessions silently become per-isolate (documented, but worth a deploy check: the wizard always generates one).
2. **Budget semantics** — one unit per admitted roast, cache hits free, failed generations keep their unit, retries/fallback ride in the margin. The KV read-then-write overshoot (one unit under a race) is accepted by design; the 15-vs-20 margin covers it.
3. **Turnstile lifecycle** — tokens are single-use and expire in 300s; the widget resets+re-executes per click; server failures return 403 before any budget spend; the client shows the server message and never auto-retries.
4. **Dual-runtime env access** — the `cloudflare:workers` dynamic import must stay non-analyzable (no static string in a way a bundler resolves) and keep `next build` green; the spike is the proof, Task 3 preserves the shape.
5. **KV list pagination** — `listReports` reads one page (limit 1000); at 15/day it is years away from mattering, but the cap is a deliberate choice, not an accident.

## Final verification (after all tasks)

- `npm test` (existing + new suites, exact count noted in the README), `npx tsc --noEmit`, `npm run lint`, `npm run build`, `npm run build:vinext`.
- `next dev` smoke: demo roast, report, login round-trip (fs path).
- `vinext preview` smoke: demo roast, cache proof, rate limit, budget refusal (local).
- Live E2E on `https://roasttube.piyushmehta.com` per Task 11.
- Repo: README live link, homepage set, `git status` clean (except gitignored `.dev.vars`, `data/reports/`).
