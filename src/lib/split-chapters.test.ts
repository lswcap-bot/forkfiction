import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { splitChapters } from "./split-chapters";

const md = (...lines: string[]) => lines.join("\n");

describe("splitChapters", () => {
  it("맨 위 # 하나는 작품 제목, 그 아래 ##를 장으로 본다", () => {
    const result = splitChapters(
      md("# 칼의 여행", "", "## 시작의 검", "", "첫 장 본문", "", "## 일곱 가지의 칼", "", "둘째 장 본문"),
    );
    expect(result.title).toBe("칼의 여행");
    expect(result.chapters).toEqual([
      { title: "시작의 검", body: "첫 장 본문\n" },
      { title: "일곱 가지의 칼", body: "둘째 장 본문\n" },
    ]);
  });

  it("#이 하나일 때 ### 이하 제목은 장 안의 소제목으로 남는다", () => {
    const result = splitChapters(md("# 제목", "## 1장", "### 소제목", "본문"));
    expect(result.chapters).toEqual([{ title: "1장", body: "### 소제목\n본문\n" }]);
  });

  it("#이 여러 개면 각 #을 장으로 보고, ##는 장 안에 남긴다", () => {
    const result = splitChapters(md("# 첫째", "첫 본문", "## 구성", "개요", "# 둘째", "둘째 본문"));
    expect(result.title).toBeNull();
    expect(result.chapters).toEqual([
      { title: "첫째", body: "첫 본문\n## 구성\n개요\n" },
      { title: "둘째", body: "둘째 본문\n" },
    ]);
  });

  it("#이 여러 개이고 맨 위 # 아래에 본문이 없으면 그 #을 작품 제목으로 본다", () => {
    const result = splitChapters(md("# 칼의 여행", "", "  ", "# 시작의 검", "본문1", "# 쌍룡", "본문2"));
    expect(result.title).toBe("칼의 여행");
    expect(result.chapters.map((c) => c.title)).toEqual(["시작의 검", "쌍룡"]);
  });

  it("장 제목 앞의 'N장 — ' 같은 번호는 뗀다", () => {
    const result = splitChapters(
      md("# 작품", "## 1장 — 시작의 검", "a", "## 2장 - 둘", "b", "## 제3장: 셋", "c", "## 10장 – 쌍룡", "d"),
    );
    expect(result.chapters.map((c) => c.title)).toEqual(["시작의 검", "둘", "셋", "쌍룡"]);
  });

  it("번호만 있는 장 제목은 그대로 둔다", () => {
    const result = splitChapters(md("# 작품", "## 1장", "a", "## 2장 —", "b"));
    expect(result.chapters.map((c) => c.title)).toEqual(["1장", "2장 —"]);
  });

  it("코드 블록 안의 #은 제목으로 보지 않는다", () => {
    const result = splitChapters(
      md("# 작품", "## 장", "```", "# 주석", "## 이것도", "```", "~~~", "# 물결", "~~~", "끝"),
    );
    expect(result.chapters).toHaveLength(1);
    expect(result.chapters[0].body).toBe("```\n# 주석\n## 이것도\n```\n~~~\n# 물결\n~~~\n끝\n");
  });

  it("CRLF 줄바꿈과 BOM을 정리한다", () => {
    const result = splitChapters("﻿# 작품\r\n## 장\r\n본문\r\n둘째 줄\r\n");
    expect(result.title).toBe("작품");
    expect(result.chapters).toEqual([{ title: "장", body: "본문\n둘째 줄\n" }]);
  });

  it("제목 끝의 닫는 #과 앞 공백 3칸까지 허용한다", () => {
    const result = splitChapters(md("   # 작품 #", "## 장 ##", "본문"));
    expect(result.title).toBe("작품");
    expect(result.chapters[0].title).toBe("장");
  });

  it("#뒤에 띄어쓰기가 없거나 4칸 들여쓴 줄은 제목이 아니다", () => {
    const result = splitChapters(md("# 작품", "## 장", "#해시태그", "    # 코드"));
    expect(result.chapters).toEqual([{ title: "장", body: "#해시태그\n    # 코드\n" }]);
  });

  it("첫 장 앞의 글은 '머리말' 장으로 앞에 붙인다", () => {
    const result = splitChapters(md("# 작품", "", "작가의 소개 글", "", "## 1장 — 시작", "본문"));
    expect(result.chapters).toEqual([
      { title: "머리말", body: "작가의 소개 글\n" },
      { title: "시작", body: "본문\n" },
    ]);
  });

  it("# 위에 있는 글도 머리말에 들어간다", () => {
    const result = splitChapters(md("들머리", "# 작품", "## 장", "본문"));
    expect(result.chapters[0]).toEqual({ title: "머리말", body: "들머리\n" });
  });

  it("#이 하나뿐이고 ##가 없으면 # 아래 전체를 한 장으로 본다", () => {
    const result = splitChapters(md("# 단편", "", "본문 전체"));
    expect(result.title).toBe("단편");
    expect(result.chapters).toEqual([{ title: "단편", body: "본문 전체\n" }]);
  });

  it("#이 없고 ##만 있으면 ##를 장으로 본다", () => {
    const result = splitChapters(md("## 하나", "a", "## 둘", "b"));
    expect(result.title).toBeNull();
    expect(result.chapters.map((c) => c.title)).toEqual(["하나", "둘"]);
  });

  it("제목이 하나도 없으면 전체를 '1장' 하나로 본다", () => {
    const result = splitChapters(md("그냥 글", "", "둘째 문단"));
    expect(result.title).toBeNull();
    expect(result.chapters).toEqual([{ title: "1장", body: "그냥 글\n\n둘째 문단\n" }]);
  });

  it("빈 글이면 장이 없다", () => {
    expect(splitChapters("  \n\n").chapters).toEqual([]);
  });

  it("본문이 빈 장도 남긴다(미리보기에서 지울 수 있다)", () => {
    const result = splitChapters(md("# 작품", "## 빈 장", "## 장", "본문"));
    expect(result.chapters).toEqual([
      { title: "빈 장", body: "" },
      { title: "장", body: "본문\n" },
    ]);
  });

  it("『칼의 여행』 시드는 제목 하나와 10개 장으로 나뉜다", () => {
    const source = readFileSync(new URL("../../seed/kalui-yeohaeng.md", import.meta.url), "utf8");
    const result = splitChapters(source);
    expect(result.title).toBe("칼의 여행");
    expect(result.chapters.map((c) => c.title)).toEqual([
      "시작의 검",
      "일곱 가지의 칼",
      "보이지 않는 날",
      "하늘이 실린 칼",
      "별무검",
      "천 번째 칼",
      "들어가지 못한 칼",
      "범의 시간",
      "석 자의 맹세",
      "쌍룡",
    ]);
    expect(result.chapters[0].body.startsWith("## 구성\n")).toBe(true);
  });
});
