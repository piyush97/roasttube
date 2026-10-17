# Vinext spike — 2026-10-17

Goal: verify the mechanisms the design depends on before the refactor. Environment: Next 16.4.2, vinext 1.2.1, Vite 8.3.0, @cloudflare/vite-plugin 2.0.0-beta, workerd 1.20261012.1, all probes in `/home/piyush/Projects/roasttube`.

## Init

- Command: `npx vinext init --platform=cloudflare --cdn-cache=none --data-cache=none --image-optimization=none --name=roasttube` — non-interactive with flags: no persistent cache, image optimization off, worker name `roasttube`.
- Scripts added: `dev:vinext` (`vite dev --port 3001`), `build:vinext` (`vite build`), `start:vinext` (`vite preview`), `deploy:vinext` (`vinext-cloudflare deploy`).
- Files generated: `vite.config.ts` (`vinext()` + `cloudflare()` plugins), `cloudflare.config.ts` (worker `roasttube`, compat date `2026-10-17`, `nodejs_compat`, assets config with `runWorkerFirst`, `ASSETS: bindings.assets()`), `postcss.config.mjs` (`@tailwindcss/postcss`; vinext does not run `turbopack.rules` loaders, so it wires Tailwind via PostCSS).
- `package.json`: `"type": "module"` added; react bumped to `^19.3.1`; `react-server-dom-webpack` added.
- `vinext check` after init: 92% (partials: `cacheComponents` — dropped in Task 2; `turbopack` rules — the loader rule was removed, see Ruling 2).

## Probes (all PASS)

1. **Env flow.** `MESSAGE: bindings.text("env-probe-ok")` in the worker config `env`, temporary `console.log(process.env.MESSAGE)` in the home page.
   - `dev:vinext` (3001): log shows `env-probe-ok` — Worker vars populate `process.env` under workerd, no accessor layer needed.
   - `next dev` (3000): log shows `MISSING` — expected (`MESSAGE` only exists in the Worker config), app unaffected.
2. **KV binding + dynamic-import guard.** Temporary `/api/kv-probe` doing `await import(/* @vite-ignore */ spec)` with the specifier in a variable (`const spec = "cloudflare:workers"`), then put/get round-trip.
   - `vite dev`: `{"kv":true,"v":"hello"}`.
   - `vite preview` (built worker, port 4173): `{"kv":true,"v":"hello"}`.
   - `next dev`: import throws `Cannot find module 'cloudflare:workers'`, caught by the guard → `{"kv":false}`. Production code maps this to `null` → fs store.
   - `next build` with the probe route present: exit 0 — Turbopack leaves the non-analyzable dynamic import alone. Acceptance criterion met.
   - Note: a GET route handler with no dynamic APIs got statically evaluated at build (route table showed `○ Static`). Irrelevant for the POST roast route, but future GET handlers that read KV need dynamic signals.
3. **Tailwind under Vite.** Home CSS served transformed: 23,923 bytes with `.mx-auto` / `.mt-10` utilities present.
4. **Fonts.** `next/font/google` self-hosts: 18 `@font-face`, 36 woff2 references in the HTML, no network font fetch. bsk screenshot confirms Anton masthead + Source Serif body, no Arial fallback.
5. **next dev CSS after the root fix.** Served asset 29,424 bytes with utilities present.

## Rulings (also recorded in the ledger)

1. **Keep init's PostCSS Tailwind wiring for both toolchains.** The plan's `@tailwindcss/vite` step is dropped: init generated `postcss.config.mjs` and Vite reads PostCSS config automatically (verified working), while `next dev`/`next build` also apply it. Cost if wrong: swap to `@tailwindcss/vite` and delete the PostCSS config.
2. **Removed the `turbopack.rules` `*.css` loader from `next.config.ts`.** With `postcss.config.mjs` present, Next ran the postcss transform on the rule's output (`globals.css.css`), which failed module resolution and 500'd the home page. Supersedes Task 2's "keep the rule" step; drop the `@tailwindcss/turbopack` dependency in Task 2.
3. **Pinned `turbopack.root` to the project directory in `next.config.ts`.** A stray `/home/piyush/package-lock.json` made Next infer `/home/piyush` as the root, breaking PostCSS plugin resolution from the transform worker.
4. **Did NOT add `.cloudflare/types` to the tsconfig include** (init's recommended next step). The generated file embeds the full workerd runtime types, which override DOM `fetch` types (`res.json()` becomes `unknown`) and broke `next build` type-checking in four app files. Nothing statically imports Workers modules; `kv.ts` types its dynamic import locally with `KvLike`. Cost if wrong: fix the seven `res.json()` call sites deliberately, or reference the `.cloudflare/types` Env interface selectively.
5. **eslint `globalIgnores` extended** with `.cloudflare/**`, `.vinext/**`, `dist/**` — init generates these; eslint was linting bundled output (3,248 problems before the ignore).

Observations:
- Stale `.next` type artifacts caused phantom tsc errors (`validator.ts`, `routes.js`); `rm -rf .next` before standalone `tsc` after config changes heals it.
- The `MESSAGE` probe binding stays in the config for now; Task 7's config edit drops it.
- Ports: next dev 3000, vinext dev 3001, vinext preview 4173.
- Vite preview exposes a local observability explorer at `/cdn-cgi/local/explorer` — useful for request logs during preview smoke tests.

## Full battery at the time of writing (probes still present, since removed)

- `npm test` 58/58 · `npx tsc --noEmit` exit 0 (after `rm -rf .next`) · `npm run lint` exit 0 · `npm run build` exit 0 · `npm run build:vinext` exit 0.

Update (Task 2): with `cacheComponents`/`partialPrefetching` removed and the turbopack CSS rule gone, `vinext check` stays clean except one partial — the `turbopack` key itself, kept for the `root` pin that `next dev` needs (Vite ignores it). `next build` after the removal shows `ƒ /` and `ƒ /report/[id]`, both dynamic.
