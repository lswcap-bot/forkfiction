import { randomBytes } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { admin, anon, cleanup, createTestUser, runId, type TestUser } from "./helpers";

// 가입 막기(forkfiction_signup_guard): 구글 가입만 받고, 이메일·전화·익명 가입은 @forkfiction.test만 허용한다.

const created: TestUser[] = [];
const strayIds: string[] = [];

afterAll(async () => {
  await cleanup(created);
  // 막혀야 했는데 만들어진 사용자가 있으면 지운다
  for (const id of strayIds) await admin.auth.admin.deleteUser(id);
});

const password = () => randomBytes(18).toString("base64url");

async function userExists(email: string) {
  for (let page = 1; ; page++) {
    const res = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (res.error) throw res.error;
    if (res.data.users.some((u) => u.email === email)) return true;
    if (res.data.users.length < 1000) return false;
  }
}

describe("가입 막기", () => {
  it("방문자는 일반 이메일로 가입할 수 없다", async () => {
    const email = `ff-signup-${runId}@example.com`;
    const res = await anon.auth.signUp({ email, password: password() });
    if (res.data.user?.id) strayIds.push(res.data.user.id);
    expect(res.error).not.toBeNull();
    expect(await userExists(email)).toBe(false);
  });

  it("관리 API로도 일반 이메일 사용자는 만들 수 없다", async () => {
    const email = `ff-signup-admin-${runId}@example.com`;
    const res = await admin.auth.admin.createUser({ email, password: password(), email_confirm: true });
    if (res.data.user?.id) strayIds.push(res.data.user.id);
    expect(res.error).not.toBeNull();
  });

  it("테스트 사용자(@forkfiction.test)는 만들고 로그인할 수 있다", async () => {
    const user = await createTestUser("signup");
    created.push(user);
    const me = await user.db.auth.getUser();
    expect(me.data.user?.id).toBe(user.id);
  });

  it("규칙: 구글 등 외부 계정은 허용, 이메일·전화·익명은 테스트 주소만", async () => {
    const cases: [string | null, string | null, boolean, boolean][] = [
      ["google", "someone@gmail.com", false, true],
      ["google", "someone@naver.com", false, true],
      ["email", "someone@gmail.com", false, false],
      ["email", "Seed-Origin@ForkFiction.test", false, true],
      ["phone", null, false, false],
      [null, null, true, false],
      ["email", "x@forkfiction.test.evil.com", false, false],
    ];
    for (const [provider, email, isAnonymous, allowed] of cases) {
      const res = await admin.rpc("signup_allowed", { p_provider: provider, p_email: email, p_is_anonymous: isAnonymous });
      expect(res.error).toBeNull();
      expect(res.data, `${provider} ${email}`).toBe(allowed);
    }
  });

  it("규칙 함수는 방문자·로그인 사용자가 부를 수 없다", async () => {
    const res = await anon.rpc("signup_allowed", { p_provider: "email", p_email: "a@b.c" });
    expect(res.error).not.toBeNull();
  });
});
