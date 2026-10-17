import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PillLink, SegmentedNav } from "@/components/ff";
import { WorkCardGrid } from "@/components/work-card";
import { cn } from "@/lib/utils";
import { getSiteStats, getWorksPage } from "@/lib/discover";
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
    <main className="ff-container flex flex-1 flex-col gap-6 pb-20">
      <Suspense fallback={<div className="h-96 rounded-card bg-mute/60" />}>
        <WorksList searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function WorksList({ searchParams }: Pick<PageProps<"/works">, "searchParams">) {
  const q = parseWorksQuery(await searchParams);
  // 탭 알약의 개수는 홈 통계와 같은 site_stats로 센다
  const [{ works, total }, stats] = await Promise.all([getWorksPage(q), getSiteStats()]);
  const pages = Math.ceil(total / WORKS_PAGE_SIZE);
  const tabCount = { all: stats.originals + stats.forks, original: stats.originals, fork: stats.forks };

  return (
    <>
      <header className="flex flex-col gap-1.5 pt-6 sm:pt-10">
        <p className="text-[13px] font-medium text-ink-3">작품 둘러보기</p>
        <h1 className="text-[28px] leading-tight font-bold tracking-[-0.05em] sm:text-4xl">전체 목록</h1>
      </header>

      <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" aria-label="작품 종류">
        {WORKS_TABS.map((t) => (
          <PillLink
            key={t.value}
            href={worksHref({ ...q, tab: t.value, page: 1 })}
            current={q.tab === t.value}
            count={tabCount[t.value]}
          >
            {t.label}
          </PillLink>
        ))}
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <p className="text-[13px] font-medium text-ink-3 tabular-nums">
          공개된 작품 <span className="text-ink">{total.toLocaleString()}개</span>
        </p>
        <SegmentedNav
          label="정렬"
          items={WORKS_SORTS.map((s) => ({
            href: worksHref({ ...q, sort: s.value, page: 1 }),
            label: s.label,
            current: q.sort === s.value,
          }))}
        />
      </div>

      {works.length === 0 && q.page > 1 ? (
        <p className="rounded-card border-[1.5px] border-dashed border-kind-draft-line px-4 py-10 text-center text-sm text-ink-2">
          이 페이지에는 작품이 없습니다.{" "}
          <Link href={worksHref({ ...q, page: 1 })} className="font-semibold underline underline-offset-4">
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
  const cell = "flex size-11 items-center justify-center rounded-full text-sm font-medium tabular-nums";
  const prev = q.page > 1 ? Math.min(q.page - 1, pages) : null;
  const next = q.page < pages ? q.page + 1 : null;
  return (
    <nav className="flex flex-wrap items-center justify-center gap-1 pt-2" aria-label="쪽 이동">
      {prev ? (
        <Link href={worksHref({ ...q, page: prev })} className={cn(cell, "hover:bg-ink/5")} aria-label="이전 쪽">
          <ChevronLeft className="size-4" />
        </Link>
      ) : (
        <span className={cn(cell, "text-ink-3/40")} aria-hidden>
          <ChevronLeft className="size-4" />
        </span>
      )}
      {pageItems(Math.min(q.page, pages), pages).map((p, i) =>
        p === "…" ? (
          <span key={`gap-${i}`} className={cn(cell, "text-ink-3")} aria-hidden>
            …
          </span>
        ) : (
          <Link
            key={p}
            href={worksHref({ ...q, page: p })}
            aria-current={p === q.page ? "page" : undefined}
            aria-label={`${p}쪽`}
            className={cn(cell, p === q.page ? "bg-ink text-surface" : "hover:bg-ink/5")}
          >
            {p}
          </Link>
        ),
      )}
      {next ? (
        <Link href={worksHref({ ...q, page: next })} className={cn(cell, "hover:bg-ink/5")} aria-label="다음 쪽">
          <ChevronRight className="size-4" />
        </Link>
      ) : (
        <span className={cn(cell, "text-ink-3/40")} aria-hidden>
          <ChevronRight className="size-4" />
        </span>
      )}
    </nav>
  );
}
