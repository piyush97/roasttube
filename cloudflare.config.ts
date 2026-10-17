import { bindings, defineConfig, defineWorker } from "cf/config";

export default defineConfig({
  worker: defineWorker({
    name: "roasttube",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-10-17",
    compatibilityFlags: ["nodejs_compat"],
    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*"],
    },
    env: {
      ASSETS: bindings.assets(),
      MESSAGE: bindings.text("env-probe-ok"),
      ROASTTUBE_KV: bindings.kv(),
    },
  }),
});
