import { defineConfig } from "vitest/config";

// npm run test:db: .env.local의 Supabase 프로젝트에 임시 사용자를 만들어 RLS와 DB 함수를 검사한다.
// 끝나면 만든 데이터를 지운다.
export default defineConfig({
  test: {
    include: ["tests/db/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
