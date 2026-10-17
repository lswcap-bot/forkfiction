import { describe, expect, it } from "vitest";
import { parseCheckedRoute } from "./route-check";

describe("parseCheckedRoute", () => {
  it("프로필 주소", () => {
    expect(parseCheckedRoute("/@lswcap")).toEqual({ kind: "profile", handle: "lswcap" });
    expect(parseCheckedRoute("/u/lswcap/")).toEqual({ kind: "profile", handle: "lswcap" });
    expect(parseCheckedRoute("/%40lswcap")).toEqual({ kind: "profile", handle: "lswcap" });
  });

  it("작품 대문·장·갈래 지도·작업실·비교", () => {
    expect(parseCheckedRoute("/w/kalui-yeohaeng")).toEqual({ kind: "work", slug: "kalui-yeohaeng" });
    expect(parseCheckedRoute("/w/kalui-yeohaeng/tree")).toEqual({ kind: "work", slug: "kalui-yeohaeng", page: "tree" });
    expect(parseCheckedRoute("/w/kalui-yeohaeng/edit")).toEqual({ kind: "work", slug: "kalui-yeohaeng", page: "edit" });
    expect(parseCheckedRoute("/w/kalui-yeohaeng/8")).toEqual({ kind: "work", slug: "kalui-yeohaeng", position: 8 });
    expect(parseCheckedRoute("/w/ulla/8/compare")).toEqual({ kind: "work", slug: "ulla", position: 8, page: "compare" });
  });

  it("형식이 틀린 주소는 바로 없는 주소", () => {
    for (const path of [
      "/w/kalui-yeohaeng/0",
      "/w/kalui-yeohaeng/08",
      "/w/kalui-yeohaeng/abc",
      "/w/kalui-yeohaeng/8/edit",
      "/w/kalui-yeohaeng/tree/1",
      "/w/Bad_Slug",
      "/@Bad-Handle",
      "/u/a",
    ]) {
      expect(parseCheckedRoute(path), path).toEqual({ kind: "invalid" });
    }
  });

  it("검사하지 않는 주소", () => {
    for (const path of ["/", "/new", "/admin", "/notifications", "/login", "/w", "/opengraph-image", "/sitemap.xml"]) {
      expect(parseCheckedRoute(path), path).toBeNull();
    }
  });

  it("OG 이미지는 검사하지 않는다(없는 작품이면 이미지가 기본 그림을 그린다)", () => {
    expect(parseCheckedRoute("/w/ulla/opengraph-image")).toBeNull();
    expect(parseCheckedRoute("/w/ulla/8/opengraph-image-1x2y3z")).toBeNull();
  });
});
