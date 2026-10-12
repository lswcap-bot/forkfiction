import { configDefaults, defineConfig } from "vitest/config";

// npm test: 단위 테스트만. 원격 DB를 쓰는 tests/db는 npm run test:db로 따로 돌린다.
export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, "tests/db/**"],
  },
});
