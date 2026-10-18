import { bindings, defineConfig, defineWorker } from "cf/config";

export default defineConfig({
  worker: defineWorker({
    name: "roasttube",
    entrypoint: "vinext/server/fetch-handler",
    // Attached in Task 11, after the workers.dev smoke passed.
    domains: ["roasttube.piyushmehta.com"],
    compatibilityDate: "2026-10-17",
    compatibilityFlags: ["nodejs_compat"],
    observability: { enabled: true },
    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*"],
    },
    env: {
      ASSETS: bindings.assets(),
      ROASTTUBE_KV: bindings.kv(),
      // Vars are versioned constants per deploy. The Turnstile site key is
      // public (it ships in the HTML); the test key below always passes and is
      // for local and smoke runs only. scripts/setup-cloudflare.sh validates a
      // real widget key (0x + 20 URL-safe chars) and swaps it in at deploy
      // time; the matching secret is uploaded only after that swap, so the
      // always-pass test secret can never ship.
      NEXT_PUBLIC_APP_URL: bindings.text("https://roasttube.piyushmehta.com"),
      TURNSTILE_SITE_KEY: bindings.text("0x4AAAAAAFaPFiXm7R1WDAWg"),
      DAILY_ROAST_BUDGET: bindings.text("15"),
      // Declared secrets (validation + typing). Values are uploaded with
      // `cf workers secrets update` — see scripts/setup-cloudflare.sh.
      GEMINI_API_KEY: bindings.secret(),
      GOOGLE_CLIENT_ID: bindings.secret(),
      GOOGLE_CLIENT_SECRET: bindings.secret(),
      SESSION_SECRET: bindings.secret(),
      TURNSTILE_SECRET_KEY: bindings.secret(),
    },
  }),
});
