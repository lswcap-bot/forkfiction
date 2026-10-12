// 올린 MD 원고를 장으로 나눈다 (PLAN.md F2 장 분할 규칙).
//
// - 맨 위 `#`이 하나면 작품 제목, 그 아래 `##`를 장으로 본다.
// - `#`이 여러 개면 각 `#`을 장으로 본다. 단 맨 위 `#` 아래에 본문이 없으면 그 `#`은 작품 제목이다.
// - 장 제목 앞의 "N장 — "은 장 번호와 겹치므로 뗀다.
// - 첫 장 앞에 글이 있으면 '머리말' 장으로 앞에 붙인다(미리보기에서 지울 수 있다).
// - 코드 블록 안의 `#`은 제목으로 보지 않는다.

export type SplitChapter = { title: string; body: string };
export type SplitResult = { title: string | null; chapters: SplitChapter[] };

export const PREFACE_TITLE = "머리말";

type Heading = { line: number; level: 1 | 2; text: string };

const HEADING = /^ {0,3}(#{1,2})[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/;
const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const CHAPTER_NUMBER = /^(?:제\s*)?\d+\s*장\s*[—–\-:.]\s*/;

function findHeadings(lines: string[]): Heading[] {
  const headings: Heading[] = [];
  let fence: string | null = null;
  lines.forEach((line, i) => {
    const f = FENCE.exec(line);
    if (f) {
      const marker = f[1];
      if (fence === null) fence = marker;
      else if (marker[0] === fence[0] && marker.length >= fence.length) fence = null;
      return;
    }
    if (fence !== null) return;
    const m = HEADING.exec(line);
    if (m && m[2].trim()) headings.push({ line: i, level: m[1].length as 1 | 2, text: m[2].trim() });
  });
  return headings;
}

function cleanTitle(text: string): string {
  const stripped = text.replace(CHAPTER_NUMBER, "").trim();
  return stripped || text;
}

function block(lines: string[], start: number, end: number): string {
  const text = lines.slice(start, end).join("\n").trim();
  return text ? text + "\n" : "";
}

export function splitChapters(source: string): SplitResult {
  const lines = source.replace(/^﻿/, "").replace(/\r\n?/g, "\n").split("\n");
  if (!lines.some((l) => l.trim())) return { title: null, chapters: [] };

  const headings = findHeadings(lines);
  const h1 = headings.filter((h) => h.level === 1);
  const h2 = headings.filter((h) => h.level === 2);

  let title: string | null = null;
  let titleLine = -1;
  let chapterHeadings: Heading[];

  if (h1.length === 1) {
    title = h1[0].text;
    titleLine = h1[0].line;
    chapterHeadings = h2.filter((h) => h.line > titleLine);
    if (chapterHeadings.length === 0) {
      // 단편: # 아래 전체가 한 장
      return {
        title,
        chapters: [
          ...preface(lines, 0, titleLine),
          { title, body: block(lines, titleLine + 1, lines.length) },
        ],
      };
    }
  } else if (h1.length > 1) {
    const firstEmpty = !block(lines, h1[0].line + 1, h1[1].line);
    if (firstEmpty) {
      title = h1[0].text;
      titleLine = h1[0].line;
      chapterHeadings = h1.slice(1);
    } else {
      chapterHeadings = h1;
    }
  } else if (h2.length > 0) {
    chapterHeadings = h2;
  } else {
    return { title: null, chapters: [{ title: "1장", body: block(lines, 0, lines.length) }] };
  }

  const firstLine = chapterHeadings[0].line;
  const before =
    titleLine >= 0
      ? [...lines.slice(0, titleLine), ...lines.slice(titleLine + 1, firstLine)]
      : lines.slice(0, firstLine);

  const chapters = chapterHeadings.map((h, i) => ({
    title: cleanTitle(h.text),
    body: block(lines, h.line + 1, chapterHeadings[i + 1]?.line ?? lines.length),
  }));

  return { title, chapters: [...preface(before, 0, before.length), ...chapters] };
}

function preface(lines: string[], start: number, end: number): SplitChapter[] {
  const body = block(lines, start, end);
  return body ? [{ title: PREFACE_TITLE, body }] : [];
}
