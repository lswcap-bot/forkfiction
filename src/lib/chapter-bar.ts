// 작품 카드의 분절 막대(장 하나 = 칸 하나). 원작은 모든 칸이 진하고,
// 갈래는 물려받은 장(진한 칸) 다음에 고친 장·새로 쓴 장(연한 칸)을 놓는다.
// 장이 아주 많으면 칸이 너무 가늘어지지 않게 MAX_BAR_CELLS로 줄이되, 비율과 두 종류가 다 보이게 한다.

export const MAX_BAR_CELLS = 30;

export type ChapterCounts = { inherited: number; modified: number; new: number };
export type BarCell = "inherited" | "new";

export function chapterBar(
  counts: ChapterCounts | undefined,
  isFork: boolean,
): { cells: BarCell[]; caption: string | null } {
  if (!counts) return { cells: [], caption: null };
  const total = counts.inherited + counts.modified + counts.new;
  if (total === 0) return { cells: [], caption: isFork ? null : "아직 장이 없음" };

  if (!isFork) {
    return { cells: Array(Math.min(total, MAX_BAR_CELLS)).fill("inherited"), caption: `${total}장` };
  }

  const changed = counts.modified + counts.new;
  let dark = counts.inherited;
  let light = changed;
  if (total > MAX_BAR_CELLS) {
    dark = Math.round((counts.inherited / total) * MAX_BAR_CELLS);
    if (counts.inherited > 0) dark = Math.max(dark, 1);
    if (changed > 0) dark = Math.min(dark, MAX_BAR_CELLS - 1);
    light = MAX_BAR_CELLS - dark;
  }

  const parts = [
    counts.inherited > 0 && `${counts.inherited}장 물려받음`,
    counts.modified > 0 && `${counts.modified}장 고침`,
    counts.new > 0 && `${counts.new}장 새로 씀`,
  ].filter(Boolean);

  return {
    cells: [...Array<BarCell>(dark).fill("inherited"), ...Array<BarCell>(light).fill("new")],
    caption: parts.join(" · "),
  };
}
