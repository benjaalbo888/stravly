import { defineConfig } from "@playwright/test";

const app = "http://127.0.0.1:3141";
const url = new URL(process.env.SUPABASE_URL ?? app);
if (url.href !== "http://127.0.0.1:54321/") throw new Error("Estas pruebas solo admiten Supabase local en 127.0.0.1:54321.");

export default defineConfig({
  testDir: "./tests/multi-e2e",
  workers: 1,
  timeout: 150_000,
  expect: { timeout: 12_000 },
  use: { baseURL: app, viewport: { width: 1440, height: 1000 }, trace: "off" },
  webServer: {
    command: "npm run start -- --hostname 127.0.0.1 --port 3141", url: app, timeout: 45_000,
    env: { STRAVLY_MULTI_BUSINESS: "1", NEXT_TELEMETRY_DISABLED: "1" },
  },
});
