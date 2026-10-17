// 작업실 편집기의 임시 보관. 브라우저(localStorage)에만 두고 수정본은 만들지 않는다(F4).
// base: 편집을 시작한 head 수정본. 그 사이 다른 곳에서 저장했는지 가리는 데 쓴다.

export type ChapterText = { title: string; body: string };
export type Draft = ChapterText & { base: string; savedAt: number };

export function draftKey(chapterId: string) {
  return `ff:draft:${chapterId}`;
}

/** 저장본과 지금 글이 다른지. 제목 앞뒤 공백은 저장할 때 지워지므로 따지지 않는다. */
export function isDirty(saved: ChapterText, current: ChapterText) {
  return saved.title.trim() !== current.title.trim() || saved.body !== current.body;
}

export function parseDraft(raw: string | null): Draft | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as Partial<Draft>;
    if (
      typeof d.base === "string" &&
      typeof d.title === "string" &&
      typeof d.body === "string" &&
      typeof d.savedAt === "number"
    ) {
      return { base: d.base, title: d.title, body: d.body, savedAt: d.savedAt };
    }
  } catch {
    // 깨진 보관본은 없는 것으로 본다
  }
  return null;
}

/**
 * none: 알릴 것 없음
 * restorable: 지금 저장본에서 이어 쓰던 글이 있다
 * stale: 임시 보관 뒤에 다른 곳에서 저장했다(불러오면 그 저장을 덮게 된다)
 */
export function draftStatus(draft: Draft | null, head: ChapterText & { id: string }) {
  if (!draft || !isDirty(head, draft)) return "none" as const;
  return draft.base === head.id ? ("restorable" as const) : ("stale" as const);
}
