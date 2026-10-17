import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { WorkCardData } from "@/lib/discover";
import { WORKS_AD_AFTER } from "@/lib/works-query";
import { WorkCardGrid } from "./work-card";

const card = (n: number): WorkCardData => ({
  id: `w${n}`,
  slug: `work-${n}`,
  title: `작품 ${n}`,
  summary: null,
  fork_note: null,
  parent_work_id: null,
  fork_chapter_position: null,
  is_canon: false,
  visibility: "public",
  star_count: 0,
  fork_count: 0,
  owner: { handle: "writer", display_name: "작가" },
});

// 목록 칸 순서: 카드는 'c', 광고는 'ad'
function cells(count: number) {
  const html = renderToStaticMarkup(
    createElement(WorkCardGrid, { works: Array.from({ length: count }, (_, i) => card(i + 1)), empty: "없음", adAfter: WORKS_AD_AFTER }),
  );
  return [...html.matchAll(/<li[^>]*>(.*?)<\/li>/g)].map((m) => (m[1].includes("data-ad-slot") ? "ad" : "c"));
}

describe("WorkCardGrid 광고 자리", () => {
  it("12번째 카드 뒤에 광고 한 칸(2열·3열 모두 줄이 맞는다)", () => {
    const list = cells(20);
    expect(list.indexOf("ad")).toBe(12);
    expect(list.filter((c) => c === "ad")).toHaveLength(1);
    expect(list.filter((c) => c === "c")).toHaveLength(20);
  });

  it("카드가 12개 이하면 광고를 넣지 않는다(목록 끝에 광고만 남지 않게)", () => {
    expect(cells(12)).not.toContain("ad");
    expect(cells(5)).not.toContain("ad");
    expect(cells(13).indexOf("ad")).toBe(12);
  });
});
