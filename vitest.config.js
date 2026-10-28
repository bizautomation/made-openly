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
