import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { LineageItem } from "@/lib/works";
import { LineageLine } from "./lineage-line";

// 계보 줄: 원작이 아니면 늘 그리고, 숨겨진 조상은 자리를 남긴 채 '숨겨진 작품'으로만 적는다.

const item = (depth: number, over: Partial<LineageItem> = {}): LineageItem => ({
  depth,
  ancestor_slug: `work-${depth}`,
  ancestor_title: `작품 ${depth}`,
  ancestor_owner_handle: `writer${depth}`,
  ancestor_owner_display_name: `작가 ${depth}`,
  fork_chapter_position: depth === 2 ? null : 8,
  ancestor_hidden: false,
  ...over,
});

const render = (lineage: LineageItem[]) => renderToStaticMarkup(createElement(LineageLine, { lineage }));

describe("LineageLine", () => {
  it("원작(자기 자신뿐)이면 그리지 않는다", () => {
    expect(render([item(0)])).toBe("");
  });

  it("뿌리부터 갈림점과 함께 모두 그린다", () => {
    const html = render([item(2), item(1, { fork_chapter_position: 3 }), item(0)]);
    expect(html).toContain('href="/w/work-2"');
    expect(html).toContain("『작품 2』");
    expect(html).toContain("(작가 2)");
    expect(html).toContain("3장에서");
    expect(html).toContain('href="/w/work-0"');
    expect(html.match(/장에서/g)).toHaveLength(2);
  });

  it("숨겨진 조상은 자리를 남기고 제목·링크·작가 없이 '숨겨진 작품'으로 적는다", () => {
    const hidden = item(1, {
      ancestor_slug: null,
      ancestor_title: null,
      ancestor_owner_handle: null,
      ancestor_owner_display_name: null,
      ancestor_hidden: true,
      fork_chapter_position: 3,
    });
    const html = render([item(2), hidden, item(0)]);
    expect(html).toContain("숨겨진 작품");
    expect(html).not.toContain("work-1");
    expect(html).not.toContain("null");
    // 숨겨진 자리 앞뒤의 갈림점은 그대로 남는다
    expect(html.match(/장에서/g)).toHaveLength(2);
    expect(html).toContain('href="/w/work-2"');
    expect(html).toContain('href="/w/work-0"');
  });
});
