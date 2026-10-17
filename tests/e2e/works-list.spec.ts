import { expect, test } from "@playwright/test";
import { readRun } from "./support";

// 전체 목록: 탭·정렬을 누르면 주소에 남고, 홈 '전체 보기'는 맞는 탭·정렬로 연다
test("전체 목록의 탭·정렬과 홈 전체 보기", async ({ page }) => {
  const run = readRun();

  await page.goto("/");
  await page.getByRole("banner").getByRole("link", { name: "전체 목록" }).click();
  await page.waitForURL(/\/works$/);
  await expect(page.getByRole("link", { name: "전체", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("link", { name: "최신순" })).toHaveAttribute("aria-current", "page");

  // 갈래 탭: 시험 갈래는 있고 시험 원작은 없다
  await page.getByRole("link", { name: "갈래", exact: true }).click();
  await page.waitForURL(/\/works\?tab=fork$/);
  const card = (title: string) => page.getByRole("heading", { level: 3, name: `『${title} ${run.runId}』` });
  await expect(card("모바일 점검 갈래")).toBeVisible();
  await expect(card("모바일 점검 원작")).toHaveCount(0);
  // 갈래 카드에는 어디서 갈라졌는지가 붙는다
  await expect(page.getByText(`『모바일 점검 원작 ${run.runId}』 2장에서 갈라짐`)).toBeVisible();

  // 정렬을 바꿔도 탭은 그대로
  await page.getByRole("link", { name: "별 많은 순" }).click();
  await page.waitForURL(/\/works\?tab=fork&sort=stars$/);

  // 원작 탭
  await page.getByRole("link", { name: "원작", exact: true }).click();
  await page.waitForURL(/\/works\?tab=original&sort=stars$/);
  await expect(card("모바일 점검 원작")).toBeVisible();

  // 쪽 번호가 마지막을 넘으면 안내
  await page.goto("/works?page=9999");
  await expect(page.getByText("이 페이지에는 작품이 없습니다.")).toBeVisible();

  // 홈 '전체 보기'
  for (const [section, href] of [
    ["새 원작", "/works?tab=original"],
    ["별 많은 갈래", "/works?tab=fork&sort=stars"],
    ["요즘 갈래가 많이 나는 원작", "/works?tab=original&sort=forks"],
  ] as const) {
    await page.goto("/");
    await expect(page.getByRole("link", { name: `${section} 전체 보기` })).toHaveAttribute("href", href);
  }
});
