import Link from "next/link";
import { Fragment } from "react";
import { ArrowRight, GitFork, Star, TrendingUp } from "lucide-react";
import { AdSlot } from "@/components/ad-slot";
import { Chip, EmptyState, InitialAvatar } from "@/components/ff";
import { chapterBar } from "@/lib/chapter-bar";
import { TRENDING_DAYS, type WorkCardData } from "@/lib/discover";
import { cn } from "@/lib/utils";

// 작품 카드(홈·전체 목록·프로필). 바탕색이 작품 종류다: 원작 연보라, 갈래 연분홍, 정사 노랑,
// 공개 전·숨김은 흰 바탕 + 테두리(본인·관리자만 보인다). 색만으로 구분하지 않도록 정사·상태는 칩 글자를 함께 쓴다.
// 갈래면 어디서 갈라졌는지와 한 줄 소개, 막대는 물려받은 장(진한 칸)과 고친·새 장(연한 칸).

export function CanonBadge() {
  return <Chip tone="canon">정사</Chip>;
}

const VISIBILITY_LABEL = { draft: "임시 저장", hidden: "숨김", public: null } as const;

const dateFormat = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Seoul" });
/** 2026.10.16 */
export function formatDay(iso: string) {
  const parts = Object.fromEntries(dateFormat.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return `${parts.year}.${parts.month}.${parts.day}`;
}

function cardTone(work: WorkCardData) {
  if (work.visibility !== "public") return "border-[1.5px] border-kind-draft-line bg-surface";
  if (work.is_canon) return "bg-kind-canon";
  return work.parent_work_id !== null ? "bg-kind-fork" : "bg-kind-original";
}

export function WorkCard({ work }: { work: WorkCardData }) {
  const isFork = work.parent_work_id !== null;
  const status = VISIBILITY_LABEL[work.visibility];
  const bar = chapterBar(work.chapterCounts, isFork);
  const note = isFork ? work.fork_note : work.summary;
  return (
    <Link
      href={`/w/${work.slug}`}
      className={cn(
        // relative: 카드 안 sr-only 글자의 기준을 카드로 잡는다. 없으면 페이지 기준으로 자리 잡아 모바일 띠에서 화면이 넓어진다
        "relative flex h-full min-h-[204px] flex-col gap-3 rounded-card p-[18px] transition-[filter] hover:brightness-[0.97] sm:min-h-[210px]",
        cardTone(work),
      )}
    >
      {(work.is_canon || status) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {work.is_canon && <CanonBadge />}
          {status && <Chip tone={work.visibility === "hidden" ? "danger" : "line"}>{status}</Chip>}
        </div>
      )}
      <h3 className="pt-1 text-base leading-[1.35] font-bold tracking-[-0.02em] break-keep">『{work.title}』</h3>
      {isFork && (
        <p className="flex items-center gap-1.5 text-xs leading-snug text-ink-2">
          <GitFork className="size-3.5 shrink-0" aria-hidden />
          <span>
            {work.parentTitle === undefined ? "" : work.parentTitle ? `『${work.parentTitle}』 ` : "숨겨진 작품 "}
            {work.fork_chapter_position}장에서 갈라짐
          </span>
        </p>
      )}
      {work.recentForks !== undefined && (
        <p className="flex items-center gap-1.5 text-xs font-semibold tabular-nums">
          <TrendingUp className="size-3.5 shrink-0" aria-hidden />
          최근 {TRENDING_DAYS}일 새 갈래 +{work.recentForks.toLocaleString()}
        </p>
      )}
      {bar.cells.length > 0 && (
        <div className="ff-bar mt-1" aria-hidden>
          {bar.cells.map((kind, i) => (
            <span key={i} data-kind={kind} />
          ))}
        </div>
      )}
      {bar.caption && <p className="-mt-1 text-xs text-ink-2 tabular-nums">{bar.caption}</p>}
      {note && <p className="line-clamp-2 text-[13px] leading-relaxed text-ink-2">{note}</p>}
      <div className="mt-auto flex items-center gap-2.5 pt-1">
        <InitialAvatar name={work.owner.display_name} className={work.visibility !== "public" ? "bg-line-soft" : undefined} />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-semibold">{work.owner.display_name}</span>
          <span className="text-xs text-ink-2 tabular-nums">{formatDay(work.first_published_at ?? work.created_at)}</span>
        </div>
        <div className="flex shrink-0 gap-2.5 text-xs font-semibold tabular-nums">
          <span className="inline-flex items-center gap-1">
            <Star className="size-3.5" aria-hidden />
            <span className="sr-only">별</span>
            {work.star_count.toLocaleString()}
          </span>
          <span className="inline-flex items-center gap-1">
            <GitFork className="size-3.5" aria-hidden />
            <span className="sr-only">갈래</span>
            {work.fork_count.toLocaleString()}
          </span>
        </div>
      </div>
    </Link>
  );
}

const GRID = "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

export function WorkCardGrid({
  works,
  empty,
  emptyHint,
  emptyAction,
  adAfter,
}: {
  works: WorkCardData[];
  empty: string;
  emptyHint?: string;
  emptyAction?: { href: string; label: string };
  adAfter?: number;
}) {
  if (works.length === 0) return <EmptyState title={empty} hint={emptyHint} action={emptyAction} />;
  return (
    <ul className={GRID}>
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

/** 홈 칸: 넓은 화면은 격자, 좁은 화면(모바일)은 옆으로 넘기는 띠(스크롤 스냅)이고 끝에 '전체 보기' 카드를 둔다 */
export function WorkCardStrip({
  works,
  empty,
  emptyHint,
  emptyAction,
  more,
  moreLabel,
}: {
  works: WorkCardData[];
  empty: string;
  emptyHint?: string;
  emptyAction?: { href: string; label: string };
  more: string;
  moreLabel: string;
}) {
  if (works.length === 0) return <EmptyState title={empty} hint={emptyHint} action={emptyAction} />;
  return (
    <ul className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:snap-none sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3 xl:grid-cols-4">
      {works.map((w) => (
        <li key={w.id} className="flex w-[286px] shrink-0 snap-start sm:w-auto [&>a]:flex-1">
          <WorkCard work={w} />
        </li>
      ))}
      <li className="flex w-[160px] shrink-0 snap-start sm:hidden">
        <Link
          href={more}
          aria-label={moreLabel}
          className="flex flex-1 flex-col items-center justify-center gap-2 rounded-card border-[1.5px] border-dashed border-kind-draft-line text-sm font-semibold"
        >
          <span className="grid size-11 place-items-center rounded-full bg-ink text-surface">
            <ArrowRight className="size-5" aria-hidden />
          </span>
          전체 보기
        </Link>
      </li>
    </ul>
  );
}
