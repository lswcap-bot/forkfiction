import { describe, expect, it } from "vitest";
import { pageItems, parseWorksQuery, worksHref } from "./works-query";

describe("parseWorksQuery", () => {
  it("값이 없으면 전체·최신순·1쪽", () => {
    expect(parseWorksQuery({})).toEqual({ tab: "all", sort: "new", page: 1 });
  });

  it("주소의 탭·정렬·쪽을 읽는다", () => {
    expect(parseWorksQuery({ tab: "fork", sort: "stars", page: "2" })).toEqual({ tab: "fork", sort: "stars", page: 2 });
    expect(parseWorksQuery({ tab: "original", sort: "forks", page: "15" })).toEqual({ tab: "original", sort: "forks", page: 15 });
  });

  it("틀린 값은 기본값으로 바꾼다", () => {
    expect(parseWorksQuery({ tab: "draft", sort: "random", page: "0" })).toEqual({ tab: "all", sort: "new", page: 1 });
    expect(parseWorksQuery({ page: "-3" }).page).toBe(1);
    expect(parseWorksQuery({ page: "2.5" }).page).toBe(1);
    expect(parseWorksQuery({ page: "abc" }).page).toBe(1);
    expect(parseWorksQuery({ page: "99999999" }).page).toBe(1);
  });

  it("같은 값이 여러 번 오면 첫 값을 쓴다", () => {
    expect(parseWorksQuery({ tab: ["fork", "original"], page: ["3", "4"] })).toEqual({ tab: "fork", sort: "new", page: 3 });
  });
});

describe("worksHref", () => {
  it("기본값은 주소에서 뺀다", () => {
    expect(worksHref({ tab: "all", sort: "new", page: 1 })).toBe("/works");
    expect(worksHref({ tab: "fork", sort: "new", page: 1 })).toBe("/works?tab=fork");
  });

  it("탭·정렬·쪽 순서로 적는다", () => {
    expect(worksHref({ tab: "fork", sort: "stars", page: 2 })).toBe("/works?tab=fork&sort=stars&page=2");
    expect(worksHref({ tab: "all", sort: "forks", page: 3 })).toBe("/works?sort=forks&page=3");
  });
});

describe("pageItems", () => {
  it("쪽이 적으면 모두 보인다", () => {
    expect(pageItems(1, 1)).toEqual([1]);
    expect(pageItems(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("처음·끝과 지금 쪽 앞뒤 2쪽, 사이는 …", () => {
    expect(pageItems(6, 40)).toEqual([1, "…", 4, 5, 6, 7, 8, "…", 40]);
    expect(pageItems(1, 40)).toEqual([1, 2, 3, "…", 40]);
    expect(pageItems(40, 40)).toEqual([1, "…", 38, 39, 40]);
  });

  it("… 대신 한 쪽만 빠지면 그 쪽 번호를 그대로 보인다", () => {
    expect(pageItems(4, 40)).toEqual([1, 2, 3, 4, 5, 6, "…", 40]);
    expect(pageItems(5, 9)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("작품이 없으면 쪽도 없다", () => {
    expect(pageItems(1, 0)).toEqual([]);
  });
});
