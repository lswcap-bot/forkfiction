import { describe, expect, it } from "vitest";
import { notificationHref, notificationText, withParticle } from "./notifications";

describe("withParticle", () => {
  it("받침이 있으면 앞 조사(을·이), 없으면 뒤 조사(를·가)", () => {
    expect(withParticle("칼의 여행", "을", "를")).toBe("『칼의 여행』을");
    expect(withParticle("울라의 길", "을", "를")).toBe("『울라의 길』을");
    expect(withParticle("단이의 마을", "이", "가")).toBe("『단이의 마을』이");
    expect(withParticle("그 뒤 이야기", "이", "가")).toBe("『그 뒤 이야기』가");
  });

  it("끝 글자가 한글이 아니면 둘 다 적는다", () => {
    expect(withParticle("Road 9", "을", "를")).toBe("『Road 9』을(를)");
    expect(withParticle("…", "이", "가")).toBe("『…』이(가)");
  });
});

const fork = {
  title: "울라의 길",
  slug: "ulla",
  forkPosition: 8,
  parentTitle: "칼의 여행",
};

describe("notificationText", () => {
  it("새 갈래 공개", () => {
    expect(notificationText({ kind: "fork", actorName: "아무개", work: fork })).toBe(
      "아무개님이 『칼의 여행』 8장에서 갈라진 『울라의 길』을 공개했습니다.",
    );
  });

  it("별", () => {
    expect(notificationText({ kind: "star", actorName: "아무개", work: fork })).toBe(
      "아무개님이 『울라의 길』에 별을 주었습니다.",
    );
  });

  it("정사 인정", () => {
    expect(notificationText({ kind: "canon", actorName: "이석원", work: fork })).toBe(
      "『울라의 길』이 정사로 인정되었습니다.",
    );
  });

  it("관리자 숨김과 복구(관리자는 이름을 밝히지 않는다)", () => {
    expect(notificationText({ kind: "hidden", actorName: null, work: fork })).toBe(
      "『울라의 길』이 관리자에 의해 숨겨졌습니다.",
    );
    expect(notificationText({ kind: "restored", actorName: null, work: fork })).toBe(
      "『울라의 길』의 숨김이 풀렸습니다.",
    );
  });

  it("작품을 볼 수 없거나 보낸 사람이 탈퇴했으면 그렇게 적는다", () => {
    expect(notificationText({ kind: "star", actorName: null, work: null })).toBe(
      "누군가가 『볼 수 없는 작품』에 별을 주었습니다.",
    );
    expect(notificationText({ kind: "fork", actorName: "아무개", work: { ...fork, parentTitle: null } })).toBe(
      "아무개님이 8장에서 갈라진 『울라의 길』을 공개했습니다.",
    );
  });
});

describe("notificationHref", () => {
  it("볼 수 있는 작품이면 그 대문, 아니면 null", () => {
    expect(notificationHref({ kind: "fork", actorName: "아무개", work: fork })).toBe("/w/ulla");
    expect(notificationHref({ kind: "star", actorName: "아무개", work: null })).toBeNull();
  });
});
