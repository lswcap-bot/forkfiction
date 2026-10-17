import Link from "next/link";
import { Fragment } from "react";
import { AdSlot } from "@/components/ad-slot";
import type { WorkCardData } from "@/lib/discover";

// 홈·프로필의 작품 카드. 갈래면 어디서 갈라졌는지와 한 줄 소개, 정사면 배지를 보여 준다.

export function CanonBadge() {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
      정사
    </span>
  );
}

const VISIBILITY_LABEL = { draft: "임시 저장", hidden: "숨김", public: null } as const;

export function WorkCard({ work }: { work: WorkCardData }) {
  const isFork = work.parent_work_id !== null;
  const status = VISIBILITY_LABEL[work.visibility];
  return (
    <Link
      href={`/w/${work.slug}`}
      className="flex h-full flex-col gap-2 rounded-lg border p-4 transition-colors hover:bg-muted/50"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        {work.is_canon && <CanonBadge />}
        {status && (
          <span className="inline-flex shrink-0 items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {status}
          </span>
        )}
      </div>
      <h3 className="font-serif text-lg leading-snug font-semibold">『{work.title}』</h3>
      {isFork && (
        <p className="text-xs text-muted-foreground">
          {work.parentTitle === undefined ? "" : work.parentTitle ? `『${work.parentTitle}』 ` : "숨겨진 작품 "}
          {work.fork_chapter_position}장에서 갈라짐
        </p>
      )}
      {(isFork ? work.fork_note : work.summary) && (
        <p className="line-clamp-2 text-sm text-muted-foreground">{isFork ? work.fork_note : work.summary}</p>
      )}
      <p className="mt-auto flex flex-wrap gap-x-3 pt-1 text-xs text-muted-foreground">
        <span>{work.owner.display_name}</span>
        <span className="tabular-nums">★ {work.star_count.toLocaleString()}</span>
        <span className="tabular-nums">갈래 {work.fork_count.toLocaleString()}</span>
        {work.recentForks !== undefined && (
          <span className="tabular-nums text-foreground">최근 갈래 {work.recentForks.toLocaleString()}</span>
        )}
      </p>
    </Link>
  );
}

export function WorkCardGrid({ works, empty, adAfter }: { works: WorkCardData[]; empty: string; adAfter?: number }) {
  if (works.length === 0) {
    return <p className="rounded-lg bg-muted/50 px-4 py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {works.map((w, i) => (
        <Fragment key={w.id}>
          <li>
            <WorkCard work={w} />
          </li>
          {/* 목록 중간 광고 한 칸(F10). 뒤에 카드가 더 있을 때만 넣는다. */}
          {adAfter !== undefined && i + 1 === adAfter && i + 1 < works.length && (
            <li className="col-span-full py-2">
              <AdSlot id="works-list-middle" />
            </li>
          )}
        </Fragment>
      ))}
    </ul>
  );
}
