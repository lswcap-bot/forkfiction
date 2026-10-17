import { expect, test } from "@playwright/test";

// 로그인 전: 헤더의 '작품 올리기'는 로그인 화면으로, 로그인 뒤 /new로 돌아오게 한다
test("로그인 전 작품 올리기는 로그인을 거쳐 /new로", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("banner").getByRole("link", { name: "작품 올리기" }).click();
  await page.waitForURL(/\/login\?next=%2Fnew$|\/login\?next=\/new$/);
  await expect(page.getByRole("heading", { name: "로그인" })).toBeVisible();

  // 홈의 '내 소설 올리기'도 /new가 로그인으로 보낸다
  await page.goto("/");
  await page.getByRole("main").getByRole("link", { name: "내 소설 올리기" }).click();
  await page.waitForURL(/\/login\?next=%2Fnew$|\/login\?next=\/new$/);
});
