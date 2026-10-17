// 전체 목록(/works)의 주소 규칙. 탭·정렬·쪽을 주소에 남겨 링크로 나눌 수 있게 한다.
//   /works?tab=fork&sort=stars&page=2  기본값(전체·최신순·1쪽)은 주소에서 뺀다.

export const WORKS_TABS = [
  { value: "all", label: "전체" },
  { value: "original", label: "원작" },
  { value: "fork", label: "갈래" },
] as const;
export type WorksTab = (typeof WORKS_TABS)[number]["value"];

export const WORKS_SORTS = [
  { value: "new", label: "최신순" },
  { value: "stars", label: "별 많은 순" },
  { value: "forks", label: "갈래 많은 순" },
] as const;
export type WorksSort = (typeof WORKS_SORTS)[number]["value"];

export const WORKS_PAGE_SIZE = 20;
/** 이 번호 뒤에 광고 한 칸. 2열·3열 모두 줄이 맞는다. */
export const WORKS_AD_AFTER = 12;
const PAGE_MAX = 100_000;

export type WorksQuery = { tab: WorksTab; sort: WorksSort; page: number };

const DEFAULT: WorksQuery = { tab: "all", sort: "new", page: 1 };

type Param = string | string[] | undefined;
const first = (v: Param) => (Array.isArray(v) ? v[0] : v);

export function parseWorksQuery(params: Record<string, Param>): WorksQuery {
  const tab = first(params.tab);
  const sort = first(params.sort);
  const page = first(params.page);
  const n = page && /^[1-9]\d{0,5}$/.test(page) ? Number(page) : NaN;
  return {
    tab: WORKS_TABS.some((t) => t.value === tab) ? (tab as WorksTab) : DEFAULT.tab,
    sort: WORKS_SORTS.some((s) => s.value === sort) ? (sort as WorksSort) : DEFAULT.sort,
    page: n >= 1 && n <= PAGE_MAX ? n : DEFAULT.page,
  };
}

export function worksHref(q: WorksQuery): string {
  const params = new URLSearchParams();
  if (q.tab !== DEFAULT.tab) params.set("tab", q.tab);
  if (q.sort !== DEFAULT.sort) params.set("sort", q.sort);
  if (q.page !== DEFAULT.page) params.set("page", String(q.page));
  const qs = params.toString();
  return qs ? `/works?${qs}` : "/works";
}

/** 쪽 번호 줄: 처음·끝, 지금 쪽 앞뒤 2쪽. 건너뛰는 곳은 '…'(한 쪽만 건너뛰면 그 번호를 그대로 보인다). */
export function pageItems(current: number, total: number): (number | "…")[] {
  if (total <= 0) return [];
  const shown = new Set<number>([1, total]);
  for (let p = current - 2; p <= current + 2; p++) if (p >= 1 && p <= total) shown.add(p);
  const sorted = [...shown].sort((a, b) => a - b);
  const items: (number | "…")[] = [];
  for (const p of sorted) {
    const prev = items[items.length - 1];
    if (typeof prev === "number" && p - prev === 2) items.push(prev + 1);
    else if (typeof prev === "number" && p - prev > 2) items.push("…");
    items.push(p);
  }
  return items;
}
