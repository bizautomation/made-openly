import { defineConfig } from "vitest/config";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";

export default defineConfig({
  test: {
    projects: [
      // Plain Node: tests that read repo files or evaluate the reference generator.
      { test: { name: "node", include: ["test/node/**/*.test.js"], environment: "node" } },
      // Workers runtime with local D1, migrated fresh for each test file.
      {
        plugins: [
          cloudflareTest(async () => ({
            wrangler: { configPath: "./wrangler.toml" },
            miniflare: {
              bindings: {
                TEST_MIGRATIONS: await readD1Migrations("./migrations"),
                // Tests mock siteverify; this never reaches Cloudflare.
                TURNSTILE_SECRET: "test-secret",
                STATS_CACHE: "off",
                TURNSTILE_HOSTNAMES: "madeopenly.com,www.madeopenly.com,madeopenly.bizat.co",
                // Test-only values; tests mock Resend, so nothing is sent.
                RESEND_API_KEY: "test-resend-key",
                ADMIN_EMAIL: "owner@example.com",
                ADMIN_SIGNING_KEY: "test-signing-key",
              },
            },
          })),
        ],
        test: {
          name: "worker",
          include: ["test/worker/**/*.test.js"],
          setupFiles: ["./test/worker/apply-migrations.js"],
        },
      },
    ],
  },
});
