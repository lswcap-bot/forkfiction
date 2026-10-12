import { describe, expect, it } from "vitest";
import { RESERVED_HANDLES, validateHandle } from "./handle";

describe("validateHandle", () => {
  it("영문 소문자·숫자·밑줄 3~20자는 통과한다", () => {
    expect(validateHandle("abc")).toEqual({ ok: true, handle: "abc" });
    expect(validateHandle("writer_01")).toEqual({ ok: true, handle: "writer_01" });
    expect(validateHandle("a".repeat(20))).toEqual({ ok: true, handle: "a".repeat(20) });
  });

  it("앞뒤 공백은 지운다", () => {
    expect(validateHandle("  ulla  ")).toEqual({ ok: true, handle: "ulla" });
  });

  it("3자 미만, 20자 초과는 막는다", () => {
    expect(validateHandle("ab")).toMatchObject({ ok: false, reason: "length" });
    expect(validateHandle("a".repeat(21))).toMatchObject({ ok: false, reason: "length" });
    expect(validateHandle("")).toMatchObject({ ok: false, reason: "length" });
  });

  it("대문자, 한글, 하이픈, 공백, 기호는 막는다", () => {
    for (const bad of ["Ulla", "울라의길", "ulla-road", "ul la", "ulla!", "ulla.k"]) {
      expect(validateHandle(bad)).toMatchObject({ ok: false, reason: "format" });
    }
  });

  it("예약어는 막는다", () => {
    for (const word of ["admin", "new", "login", "me", "null", "ads", "forkfiction"]) {
      expect(validateHandle(word)).toMatchObject({ ok: false, reason: "reserved" });
    }
  });

  it("2자 예약어(me, w, u)도 길이보다 먼저 예약어로 알린다", () => {
    expect(validateHandle("me")).toMatchObject({ ok: false, reason: "reserved" });
  });

  it("예약어 목록은 모두 소문자이고 중복이 없다", () => {
    for (const word of RESERVED_HANDLES) expect(word).toBe(word.toLowerCase());
    expect(new Set(RESERVED_HANDLES).size).toBe(RESERVED_HANDLES.length);
  });
});
