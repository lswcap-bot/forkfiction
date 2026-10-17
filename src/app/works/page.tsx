import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { WorkCardGrid } from "@/components/work-card";
import { getWorksPage } from "@/lib/discover";
import {
  pageItems,
  parseWorksQuery,
  WORKS_AD_AFTER,
  WORKS_PAGE_SIZE,
  WORKS_SORTS,
  WORKS_TABS,
  worksHref,
  type WorksQuery,
} from "@/lib/works-query";

// 전체 목록: 공개된 원작·갈래(임시 저장·숨김은 빠진다). 탭·정렬·쪽은 주소에 남겨 링크로 나눌 수 있다.
// 한 쪽에 20개, 12번째 카드 뒤에 광고 한 칸(F10).

export async function generateMetadata({ searchParams }: PageProps<"/works">): Promise<Metadata> {
  const q = parseWorksQuery(await searchParams);
  const tab = WORKS_TABS.find((t) => t.value === q.tab)!.label;
  const sort = WORKS_SORTS.find((s) => s.value === q.sort)!.label;
  return {
    title: q.tab === "all" ? "전체 목록" : `${tab} · 전체 목록`,
    description: `ForkFiction에 공개된 ${q.tab === "all" ? "원작과 갈래" : tab}를 ${sort}으로 봅니다.`,
    alternates: { canonical: worksHref(q) },
  };
}

export default function WorksPage({ searchParams }: PageProps<"/works">) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">전체 목록</h1>
      <Suspense fallback={<div className="h-96 rounded-lg bg-muted/40" />}>
        <WorksList searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function WorksList({ searchParams }: Pick<PageProps<"/works">, "searchParams">) {
  const q = parseWorksQuery(await searchParams);
  const { works, total } = await getWorksPage(q);
  const pages = Math.ceil(total / WORKS_PAGE_SIZE);

  return (
    <>
      <nav className="flex gap-1 border-b" aria-label="작품 종류">
        {WORKS_TABS.map((t) => (
          <Link
            key={t.value}
            href={worksHref({ ...q, tab: t.value, page: 1 })}
            aria-current={q.tab === t.value ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${q.tab === t.value ? "border-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-sm text-muted-foreground tabular-nums">공개된 작품 {total.toLocaleString()}개</p>
        <nav className="flex flex-wrap gap-1" aria-label="정렬">
          {WORKS_SORTS.map((s) => (
            <Link
              key={s.value}
              href={worksHref({ ...q, sort: s.value, page: 1 })}
              aria-current={q.sort === s.value ? "page" : undefined}
              className={`rounded-full border px-3 py-1 text-sm ${q.sort === s.value ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
            >
              {s.label}
            </Link>
          ))}
        </nav>
      </div>

      {works.length === 0 && q.page > 1 ? (
        <p className="rounded-lg bg-muted/50 px-4 py-6 text-center text-sm text-muted-foreground">
          이 페이지에는 작품이 없습니다.{" "}
          <Link href={worksHref({ ...q, page: 1 })} className="underline underline-offset-4">
            첫 페이지로
          </Link>
        </p>
      ) : (
        <WorkCardGrid works={works} empty="아직 공개된 작품이 없습니다." adAfter={WORKS_AD_AFTER} />
      )}

      {pages > 1 && <Pagination q={q} pages={pages} />}
    </>
  );
}

function Pagination({ q, pages }: { q: WorksQuery; pages: number }) {
  const cell = "flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-sm tabular-nums";
  const prev = q.page > 1 ? Math.min(q.page - 1, pages) : null;
  const next = q.page < pages ? q.page + 1 : null;
  return (
    <nav className="flex flex-wrap items-center justify-center gap-1 pt-2" aria-label="쪽 이동">
      {prev ? (
        <Link href={worksHref({ ...q, page: prev })} className={`${cell} hover:bg-muted`} aria-label="이전 쪽">
          <ChevronLeft className="size-4" />
        </Link>
      ) : (
        <span className={`${cell} text-muted-foreground/40`} aria-hidden>
          <ChevronLeft className="size-4" />
        </span>
      )}
      {pageItems(Math.min(q.page, pages), pages).map((p, i) =>
        p === "…" ? (
          <span key={`gap-${i}`} className={`${cell} text-muted-foreground`} aria-hidden>
            …
          </span>
        ) : (
          <Link
            key={p}
            href={worksHref({ ...q, page: p })}
            aria-current={p === q.page ? "page" : undefined}
            aria-label={`${p}쪽`}
            className={`${cell} ${p === q.page ? "bg-foreground font-medium text-background" : "hover:bg-muted"}`}
          >
            {p}
          </Link>
        ),
      )}
      {next ? (
        <Link href={worksHref({ ...q, page: next })} className={`${cell} hover:bg-muted`} aria-label="다음 쪽">
          <ChevronRight className="size-4" />
        </Link>
      ) : (
        <span className={`${cell} text-muted-foreground/40`} aria-hidden>
          <ChevronRight className="size-4" />
        </span>
      )}
    </nav>
  );
}
