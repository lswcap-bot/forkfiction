import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { readRun } from "./support";

// 모바일 폭 375px 점검: 화면마다 가로 스크롤이 생기지 않는지 보고, 스크린샷을 test-results/mobile에 남긴다.
// 갈래 지도는 원래 지도 상자 안에서 옆으로 끌어서 보는 화면이라, 상자 밖으로 넘치는지만 본다.

const SHOTS = "test-results/mobile";
mkdirSync(SHOTS, { recursive: true });

test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

type Run = ReturnType<typeof readRun>;
// 실행 정보(run.json)는 global setup이 만들므로 테스트 안에서 읽는다
const screens: { name: string; path: (r: Run) => string; user?: "a" | "b"; expectText?: string }[] = [
  { name: "home", path: () => "/", expectText: "내 소설 올리기" },
  { name: "home-signed-in", path: () => "/", user: "a", expectText: "새 원작" },
  { name: "cover", path: (r) => `/w/${r.fixture.originalSlug}`, expectText: "모바일 점검 원작" },
  { name: "chapter", path: (r) => `/w/${r.fixture.originalSlug}/2`, expectText: "2장 시험 장" },
  { name: "workroom", path: (r) => `/w/${r.fixture.originalSlug}/edit?ch=2`, user: "a", expectText: "2장 시험 장" },
  { name: "compare", path: (r) => `/w/${r.fixture.forkSlug}/2/compare`, expectText: "갈래에서 새로 쓴" },
  { name: "tree", path: (r) => `/w/${r.fixture.originalSlug}/tree`, expectText: "공개 갈래 1개" },
  { name: "notifications", path: () => "/notifications", user: "a", expectText: "공개했습니다" },
  { name: "admin", path: () => "/admin", user: "a", expectText: "열린 신고" },
  { name: "new", path: () => "/new", user: "a", expectText: "MD 형식 예시" },
  { name: "works", path: () => "/works", expectText: "공개된 작품" },
  { name: "works-fork-stars", path: () => "/works?tab=fork&sort=stars", expectText: "공개된 작품" },
  { name: "fork-cover", path: (r) => `/w/${r.fixture.forkSlug}`, expectText: "2장에서" },
  { name: "profile", path: (r) => `/@${r.users.b.handle}`, expectText: "갈래" },
  { name: "terms", path: () => "/terms", expectText: "초안" },
  { name: "privacy", path: () => "/privacy", expectText: "초안" },
  { name: "not-found", path: () => "/@nobody_here", expectText: "페이지를 찾을 수 없습니다" },
];

for (const s of screens) {
  test(`375px: ${s.name}`, async ({ browser }) => {
    const run = readRun();
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
      isMobile: true,
      hasTouch: true,
      storageState: s.user ? run.users[s.user].storageState : undefined,
    });
    const page = await context.newPage();
    await page.goto(s.path(run));
    if (s.expectText) await expect(page.getByText(s.expectText).first()).toBeVisible();
    await page.waitForLoadState("networkidle");

    // 넘치는 요소: 화면 오른쪽 끝을 넘고, 옆으로 끄는 상자(overflow-x auto/scroll/hidden) 안에 있지 않은 것
    const overflow = await page.evaluate(() => {
      const width = document.documentElement.clientWidth;
      const clipped = (el: Element | null): boolean => {
        for (let cur = el?.parentElement; cur && cur !== document.body; cur = cur.parentElement) {
          const ox = getComputedStyle(cur).overflowX;
          if (ox !== "visible" && ox !== "clip") return true;
        }
        return false;
      };
      const offenders = [...document.body.querySelectorAll("*")]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.right > width + 1 && !clipped(el);
        })
        .slice(0, 5)
        .map((el) => `${el.tagName.toLowerCase()}.${String(el.getAttribute("class") ?? "").slice(0, 60)} → ${Math.round(el.getBoundingClientRect().right)}px`);
      return { scrollWidth: document.documentElement.scrollWidth, width, offenders };
    });

    await page.screenshot({ path: `${SHOTS}/${s.name}.png`, fullPage: true });
    expect(overflow.offenders, `넘치는 요소: ${overflow.offenders.join(", ")}`).toEqual([]);
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.width);
    await context.close();
  });
}
