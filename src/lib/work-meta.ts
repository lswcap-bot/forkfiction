// 작품 정보의 선택지와 길이 제한. DB 제약(works, revisions)과 같은 값을 쓴다.

export const LICENSES = [
  { value: "CC-BY-SA-4.0", label: "CC BY-SA 4.0", note: "출처를 밝히고 같은 조건으로 열어 두면 누구나 갈래를 낼 수 있습니다. 상업적 이용도 허용합니다." },
  { value: "CC-BY-NC-SA-4.0", label: "CC BY-NC-SA 4.0", note: "갈래는 허용하되 상업적 이용은 금지합니다." },
  { value: "ARR", label: "갈래 금지(모든 권리 보유)", note: "읽기만 할 수 있고 갈래 버튼이 숨겨집니다." },
] as const;
export type License = (typeof LICENSES)[number]["value"];

export const AI_USAGES = [
  { value: "none", label: "없음" },
  { value: "partial", label: "일부" },
  { value: "mostly", label: "대부분" },
] as const;
export type AiUsage = (typeof AI_USAGES)[number]["value"];

export const CHAPTER_STATES = {
  inherited: "물려받음",
  modified: "고침",
  new: "새 장",
} as const;
export type ChapterState = keyof typeof CHAPTER_STATES;

export const TITLE_MAX = 100;
export const SUMMARY_MAX = 300;
export const CHAPTER_TITLE_MAX = 100;
export const CHAPTER_BODY_MAX = 100_000;
export const CHAPTERS_MAX = 300;

export function licenseLabel(value: string) {
  return LICENSES.find((l) => l.value === value)?.label ?? value;
}

export function aiUsageLabel(value: string) {
  return AI_USAGES.find((a) => a.value === value)?.label ?? value;
}

export function isLicense(value: unknown): value is License {
  return LICENSES.some((l) => l.value === value);
}

export function isAiUsage(value: unknown): value is AiUsage {
  return AI_USAGES.some((a) => a.value === value);
}

/** 장 하나의 문제. 없으면 null */
export function chapterProblem(ch: { title: string; body: string }): string | null {
  const title = ch.title.trim();
  if (!title) return "장 제목을 적어 주세요.";
  if (title.length > CHAPTER_TITLE_MAX) return `장 제목은 ${CHAPTER_TITLE_MAX}자까지입니다.`;
  if (ch.body.length > CHAPTER_BODY_MAX) {
    return `한 장은 ${CHAPTER_BODY_MAX.toLocaleString()}자까지입니다. 장을 나눠 주세요.`;
  }
  return null;
}

export const REPORT_REASONS = [
  { value: "plagiarism", label: "표절" },
  { value: "illegal", label: "불법 콘텐츠" },
  { value: "sexual_violent", label: "음란·폭력" },
  { value: "other", label: "기타" },
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number]["value"];
export const REPORT_DETAIL_MAX = 1000;

export function isReportReason(value: unknown): value is ReportReason {
  return REPORT_REASONS.some((r) => r.value === value);
}

export function reportReasonLabel(value: string) {
  return REPORT_REASONS.find((r) => r.value === value)?.label ?? value;
}
