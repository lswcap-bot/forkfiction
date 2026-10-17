import { describe, expect, it } from "vitest";
import { FORK_NOTE_MAX, forkInputProblem } from "./fork-input";

describe("forkInputProblem", () => {
  it("제목과 한 줄 소개가 있으면 통과한다", () => {
    expect(forkInputProblem({ title: "울라의 길", note: "울라가 떠나지 않았다면" })).toBeNull();
  });

  it("한 줄 소개는 반드시 적는다", () => {
    expect(forkInputProblem({ title: "울라의 길", note: "   " })).toMatch(/한 줄 소개/);
  });

  it("한 줄 소개는 100자, 제목은 100자까지", () => {
    expect(forkInputProblem({ title: "갈래", note: "가".repeat(FORK_NOTE_MAX) })).toBeNull();
    expect(forkInputProblem({ title: "갈래", note: "가".repeat(FORK_NOTE_MAX + 1) })).toMatch(/100자/);
    expect(forkInputProblem({ title: "가".repeat(101), note: "소개" })).toMatch(/제목/);
    expect(forkInputProblem({ title: " ", note: "소개" })).toMatch(/제목/);
  });

  it("한 줄 소개에 줄바꿈은 넣을 수 없다", () => {
    expect(forkInputProblem({ title: "갈래", note: "첫 줄\n둘째 줄" })).toMatch(/한 줄/);
  });
});
