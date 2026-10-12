import { describe, expect, it } from "vitest";
import { romanize, titleToSlug, validateSlug } from "./slug";

describe("romanize", () => {
  it("한글 음절을 초성·중성·종성 단위로 로마자로 바꾼다", () => {
    expect(romanize("칼의 여행")).toBe("kalui yeohaeng");
    expect(romanize("울라의 길")).toBe("ullaui gil");
    expect(romanize("쌍룡")).toBe("ssangryong");
    expect(romanize("별무검")).toBe("byeolmugeom");
  });

  it("받침은 대표음으로 적는다", () => {
    expect(romanize("밖")).toBe("bak");
    expect(romanize("닭")).toBe("dak");
    expect(romanize("옷")).toBe("ot");
    expect(romanize("앞")).toBe("ap");
  });

  it("ㄹ 받침 뒤의 ㄹ은 ll로 적는다", () => {
    expect(romanize("달라")).toBe("dalla");
  });

  it("한글이 아닌 글자는 그대로 둔다", () => {
    expect(romanize("Sword 3")).toBe("Sword 3");
  });
});

describe("titleToSlug", () => {
  it("띄어쓰기는 하이픈으로, 영문은 소문자로 바꾼다", () => {
    expect(titleToSlug("칼의 여행")).toBe("kalui-yeohaeng");
    expect(titleToSlug("The Sword's Journey")).toBe("the-sword-s-journey");
  });

  it("문장부호와 겹친 구분자를 정리한다", () => {
    expect(titleToSlug("  『칼의 여행』 — 2부!! ")).toBe("kalui-yeohaeng-2bu");
  });

  it("80자를 넘으면 단어 경계에서 자른다", () => {
    const slug = titleToSlug("가나다라마바사 ".repeat(10))!;
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug.endsWith("-")).toBe(false);
    expect(slug.startsWith("ganadaramabasa-ganadaramabasa")).toBe(true);
  });

  it("바꿀 글자가 없거나 3자보다 짧으면 null", () => {
    expect(titleToSlug("!!!")).toBeNull();
    expect(titleToSlug("아")).toBeNull();
    expect(titleToSlug("漢字")).toBeNull();
  });
});

describe("validateSlug", () => {
  it("영문 소문자·숫자·하이픈 3~80자를 받는다", () => {
    expect(validateSlug("kalui-yeohaeng")).toEqual({ ok: true, slug: "kalui-yeohaeng" });
    expect(validateSlug("  Kalui-Yeohaeng ")).toEqual({ ok: true, slug: "kalui-yeohaeng" });
  });

  it("형식이 틀리면 이유를 알려 준다", () => {
    expect(validateSlug("ab").ok).toBe(false);
    expect(validateSlug("a".repeat(81)).ok).toBe(false);
    expect(validateSlug("칼의-여행").ok).toBe(false);
    expect(validateSlug("-abc").ok).toBe(false);
    expect(validateSlug("ab--c").ok).toBe(false);
    expect(validateSlug("abc_d").ok).toBe(false);
  });
});
