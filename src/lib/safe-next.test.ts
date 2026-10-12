import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-next";

describe("safeNextPath", () => {
  it("사이트 안 경로는 그대로 돌려준다", () => {
    expect(safeNextPath("/w/kalui-yeohaeng/8")).toBe("/w/kalui-yeohaeng/8");
    expect(safeNextPath("/@ulla?tab=forks")).toBe("/@ulla?tab=forks");
  });

  it("비었거나 없으면 홈으로", () => {
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath(undefined)).toBe("/");
    expect(safeNextPath("")).toBe("/");
  });

  it("다른 사이트로 가는 주소는 홈으로 바꾼다", () => {
    for (const bad of [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "javascript:alert(1)",
      "evil.example",
    ]) {
      expect(safeNextPath(bad)).toBe("/");
    }
  });

  it("로그인·온보딩 화면으로는 되돌아가지 않는다", () => {
    expect(safeNextPath("/login")).toBe("/");
    expect(safeNextPath("/onboarding?next=/x")).toBe("/");
    expect(safeNextPath("/auth/callback")).toBe("/");
  });
});
