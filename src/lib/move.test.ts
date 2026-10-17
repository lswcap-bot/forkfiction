import { describe, expect, it } from "vitest";
import { moveItem } from "./move";

describe("moveItem", () => {
  it("뒤의 항목을 앞으로 옮기면 사이 항목이 한 칸씩 밀린다", () => {
    expect(moveItem(["1", "2", "3", "4", "5"], 4, 1)).toEqual(["1", "5", "2", "3", "4"]);
  });

  it("앞의 항목을 뒤로 옮기면 사이 항목이 한 칸씩 당겨진다", () => {
    expect(moveItem(["1", "2", "3", "4"], 0, 2)).toEqual(["2", "3", "1", "4"]);
  });

  it("같은 자리나 범위 밖이면 그대로 둔다", () => {
    const list = ["1", "2"];
    expect(moveItem(list, 1, 1)).toEqual(list);
    expect(moveItem(list, 0, 5)).toEqual(list);
    expect(moveItem(list, -1, 0)).toEqual(list);
  });

  it("원래 배열은 바꾸지 않는다", () => {
    const list = ["1", "2", "3"];
    moveItem(list, 0, 2);
    expect(list).toEqual(["1", "2", "3"]);
  });
});
