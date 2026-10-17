import { expect, test, type Browser } from "@playwright/test";
import { readRun } from "./support";

// 핵심 흐름: 로그인 → 올리기 → 다른 계정으로 갈라지기 → 고치기 → AI 활용 표기 고치기 → 공개 → 비교 → 갈래 지도 → 원작자 알림

async function as(browser: Browser, storageState: string) {
  const context = await browser.newContext({ storageState });
  return { context, page: await context.newPage() };
}

test("올리기부터 갈래 지도까지", async ({ browser }) => {
  const run = readRun();
  const title = `흐름 시험 원작 ${run.runId}`;
  const forkTitle = `흐름 시험 갈래 ${run.runId}`;
  const md = [
    `# ${title}`,
    "## 첫째 장",
    "첫째 장의 문단입니다.",
    "## 둘째 장",
    "둘째 장의 문단입니다.",
    "## 셋째 장",
    "원래 셋째 장의 문단입니다. 여기서 이야기가 갈라집니다.",
  ].join("\n\n");

  // ── A: 로그인한 상태로 올리기 ──
  const a = await as(browser, run.users.a.storageState);
  await a.page.goto("/new");
  await expect(a.page.getByRole("button", { name: run.users.a.displayName })).toBeVisible();
  await a.page.getByLabel("또는 본문 붙여넣기").fill(md);
  await a.page.getByRole("button", { name: "장 나누기" }).click();
  await expect(a.page.getByLabel("3장 제목")).toHaveValue("셋째 장");
  await expect(a.page.getByLabel("제목", { exact: true })).toHaveValue(title);
  await a.page.getByRole("checkbox", { name: /올릴 권리가 있습니다/ }).click();
  const publish = a.page.getByRole("button", { name: "공개", exact: true });
  await expect(publish).toBeEnabled();
  await publish.click();
  await a.page.waitForURL(/\/w\/[a-z0-9-]+$/);
  const slug = new URL(a.page.url()).pathname.split("/")[2];
  await expect(a.page.getByRole("heading", { level: 1, name: title })).toBeVisible();

  // ── B: 3장에서 갈라지기 ──
  const b = await as(browser, run.users.b.storageState);
  await b.page.goto(`/w/${slug}/3`);
  await b.page.getByRole("button", { name: "여기서 갈라지기" }).click();
  await b.page.getByLabel("갈래 제목").fill(forkTitle);
  await b.page.getByLabel("한 줄 소개").fill("셋째 장부터 다르게 간다면");
  const create = b.page.getByRole("button", { name: "갈래 만들기" });
  await expect(create).toBeEnabled();
  await create.click();
  await b.page.waitForURL(/\/w\/[a-z0-9-]+\/edit\?ch=3$/);
  const forkSlug = new URL(b.page.url()).pathname.split("/")[2];

  // ── B: 3장 고치기 ──
  const editor = b.page.getByRole("textbox", { name: "3장 본문" });
  await editor.click();
  await b.page.keyboard.press("ControlOrMeta+a");
  await b.page.keyboard.type("갈래에서 새로 쓴 셋째 장의 문단입니다.");
  await b.page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(b.page.getByText("저장했습니다.")).toBeVisible();

  // ── B: 물려받은 AI 활용 표기를 고친다 ──
  await b.page.goto(`/w/${forkSlug}`);
  await expect(b.page.getByText("갈래는 원작의 표기를 물려받습니다")).toBeVisible();
  const aiUsage = b.page.getByLabel("AI 활용 표기 바꾸기");
  await aiUsage.selectOption("partial");
  await expect(b.page.getByText("저장하는 중…")).toBeHidden();
  await b.page.reload();
  await expect(b.page.getByLabel("AI 활용 표기 바꾸기")).toHaveValue("partial");

  // ── B: 공개 ──
  await b.page.getByRole("button", { name: /주소로 공개하기/ }).click();
  await expect(b.page.getByText("임시 저장 중인 작품입니다")).toBeHidden();
  // 계보: 『원작』(A) → 3장에서 → 『갈래』(B)
  await expect(b.page.getByLabel("계보")).toContainText(`『${title}』`);
  await expect(b.page.getByLabel("계보")).toContainText("3장에서");

  // 다른 사람(A)에게는 고친 표기가 글자로 보인다
  await a.page.goto(`/w/${forkSlug}`);
  await expect(a.page.getByText("AI 활용").locator("..")).toContainText("일부");
  await expect(a.page.getByLabel("AI 활용 표기 바꾸기")).toHaveCount(0);

  // ── 비교: 바뀐 문단이 양쪽에 강조된다 ──
  await b.page.goto(`/w/${forkSlug}/3/compare`);
  await expect(b.page.locator("mark", { hasText: "갈래에서 새로 쓴" }).first()).toBeVisible();
  await expect(b.page.locator("mark", { hasText: "원래 셋째 장" }).first()).toBeVisible();

  // ── 갈래 지도: 원작에서 갈래가 뻗는다 ──
  await b.page.goto(`/w/${slug}/tree`);
  await expect(b.page.getByText("공개 갈래 1개")).toBeVisible();
  await expect(b.page.getByText(forkTitle).first()).toBeVisible();

  // ── A: 새 갈래 알림 ──
  await a.page.goto("/notifications");
  await expect(a.page.getByText(`『${forkTitle}』`).first()).toBeVisible();
  await expect(a.page.getByRole("link", { name: /안 읽은 알림/ })).toBeVisible();

  await a.context.close();
  await b.context.close();
});
