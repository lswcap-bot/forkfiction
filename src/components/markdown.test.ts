import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Markdown } from "./markdown";

// 사용자 MD 보안: 어떤 입력이 와도 스크립트가 실행될 수 있는 HTML이 나오지 않아야 한다.
const render = (md: string) => renderToStaticMarkup(createElement(Markdown, null, md));

describe("Markdown 보안", () => {
  it.each([
    ["script 태그", "<script>alert(1)</script>"],
    ["img onerror", '<img src="x" onerror="alert(1)">'],
    ["iframe", '<iframe src="https://evil.example"></iframe>'],
    ["svg onload", '<svg onload="alert(1)"></svg>'],
    ["style 태그", "<style>body{display:none}</style>"],
    ["a onclick", '<a href="#" onclick="alert(1)">눌러</a>'],
  ])("원시 HTML(%s)은 태그로 그리지 않는다", (_, md) => {
    const html = render(md);
    expect(html).not.toMatch(/<(script|iframe|svg|style|img)\b/i);
    expect(html).not.toMatch(/\son\w+=/i);
  });

  it.each([
    ["javascript: 링크", "[눌러](javascript:alert(1))"],
    ["대소문자 섞은 javascript:", "[눌러](JaVaScRiPt:alert(1))"],
    ["data: 링크", "[눌러](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)"],
    ["vbscript: 링크", "[눌러](vbscript:msgbox(1))"],
    ["javascript: 이미지", "![그림](javascript:alert(1))"],
    ["자동 링크", "<javascript:alert(1)>"],
  ])("위험한 주소(%s)는 걸러진다", (_, md) => {
    const html = render(md);
    expect(html).not.toMatch(/(href|src)="\s*(javascript|data|vbscript):/i);
  });

  it("보통 MD는 그대로 그린다", () => {
    const html = render("## 장\n\n**굵게** [링크](https://example.com)\n\n- 하나");
    expect(html).toContain("<strong>굵게</strong>");
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain("<li>하나</li>");
  });

  it("제목에 붙는 id는 사용자 문서 밖의 id와 겹치지 않게 접두사가 붙는다", () => {
    expect(render("[^1]\n\n[^1]: 각주")).not.toMatch(/id="(?!user-content-)/);
  });
});
