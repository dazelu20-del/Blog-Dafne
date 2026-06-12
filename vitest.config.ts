import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          bindings: {
            SECRET_KEY: "test-secret-key-for-vitest-only",
            DISABLE_CSRF: "1",
          },
        },
      },
    },
  },
});
