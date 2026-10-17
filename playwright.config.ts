import { defineConfig, devices } from "@playwright/test";

// 흐름 테스트(npx playwright test). 로컬에서 운영 빌드를 띄워 .env.local의 Supabase 프로젝트로 돈다.
// 로그인은 tests/e2e/support.ts가 @forkfiction.test 임시 사용자로 쿠키를 만들어 넣고, 끝나면 지운다.
// 이미 띄운 서버로 돌리려면 E2E_BASE_URL=http://localhost:3000 처럼 준다.
const PORT = 3100;
const external = process.env.E2E_BASE_URL;
const baseURL = external ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  use: {
    baseURL,
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: external
    ? undefined
    : {
        command: `npm run build && npx next start -p ${PORT}`,
        url: baseURL,
        timeout: 300_000,
        reuseExistingServer: false,
      },
});
