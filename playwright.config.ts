import { defineConfig, devices } from "@playwright/test";

const app = "http://127.0.0.1:3140";
export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  timeout: 35_000,
  use: { baseURL: app, trace: "retain-on-failure", channel: process.env.STRAVLY_BROWSER_CHANNEL || undefined },
  projects: [
    { name: "escritorio", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1050 } } },
    { name: "movil", use: { ...devices["Pixel 7"] } },
  ],
  webServer: [
    { command: "node tests/e2e/supabase-fixture.mjs", url: "http://127.0.0.1:54123/health" },
    {
      command: "npm run start -- --hostname 127.0.0.1 --port 3140", url: app, timeout: 45_000,
      env: {
        SUPABASE_URL: "http://127.0.0.1:54123",
        SUPABASE_PUBLISHABLE_KEY: "sb_publishable_stravly_fixture_only",
        SUPABASE_SECRET_KEY: "sb_secret_stravly_fixture_only",
        NEXT_TELEMETRY_DISABLED: "1",
      },
    },
  ],
});
