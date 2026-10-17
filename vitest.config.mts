import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

// npm test: 단위 테스트만. 원격 DB를 쓰는 tests/db는 npm run test:db로, 흐름 테스트 tests/e2e는 npx playwright test로 따로 돌린다.
export default defineConfig({
  resolve: {
    // tsconfig의 @/* 경로와 같다
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    exclude: [...configDefaults.exclude, "tests/db/**", "tests/e2e/**"],
  },
});
