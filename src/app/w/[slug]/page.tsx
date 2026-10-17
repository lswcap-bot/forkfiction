import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ChevronRight, PenLine } from "lucide-react";
import { AdSlot } from "@/components/ad-slot";
import { Chip, EmptyState, InitialAvatar } from "@/components/ff";
import { LineageLine } from "@/components/lineage-line";
import { buttonVariants } from "@/components/ui/button";
import { getViewer } from "@/lib/auth";
import { chapterBar } from "@/lib/chapter-bar";
import { describe, getPublicWork } from "@/lib/public-works";
import { cn } from "@/lib/utils";
import { aiUsageLabel, CHAPTER_STATES, licenseLabel, type AiUsage, type ChapterState } from "@/lib/work-meta";
import { getChapterList, getLineage, getWorkBySlug, hasStarred } from "@/lib/works";
import { AiUsageField } from "./ai-usage-field";
import { DeleteWorkButton } from "./delete-work-button";
import { DraftPanel } from "./draft-panel";
import { HiddenNotice } from "./hidden-notice";
import { CanonButton, StarButton } from "./reaction-buttons";
import { ReportDialog } from "./report-dialog";
import { WorkTabs } from "./work-tabs";

// 검색·공유용 제목과 소개. 공개 작품만 채우고, 아니면 검색에서 뺀다.
export async function generateMetadata({ params }: PageProps<"/w/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const work = await getPublicWork(decodeURIComponent(slug));
  if (!work) return { robots: { index: false } };
  const title = `『${work.title}』 ${work.owner.display_name}`;
  const from = work.isFork
    ? `${work.parentTitle ? `『${work.parentTitle}』` : "숨겨진 작품"} ${work.fork_chapter_position}장에서 갈라진 갈래. `
    : "";
  const description = describe(`${from}${(work.isFork ? work.fork_note : work.summary) ?? ""}`) || "ForkFiction에서 읽기";
  return {
    title,
    description,
    alternates: { canonical: `/w/${work.slug}` },
    openGraph: { type: "article", title, description, url: `/w/${work.slug}` },
  };
}

// 작품 대문: 제목, 작가, 계보, 소개, 라이선스, 별, 장 목록. 탭: 목차 · 갈래 지도
// 관리자가 숨긴 작품은 작가·관리자만 읽을 수 있고(RLS), 다른 사람에게는 404다.
export default function WorkPage({ params }: PageProps<"/w/[slug]">) {
  return (
    <main className="mx-auto flex w-full max-w-[912px] flex-1 flex-col gap-3.5 px-4 pt-2 pb-20">
      <Suspense fallback={null}>
        <WorkCover params={params} />
      </Suspense>
    </main>
  );
}

async function WorkCover({ params }: Pick<PageProps<"/w/[slug]">, "params">) {
  const { slug } = await params;
  const work = await getWorkBySlug(decodeURIComponent(slug));
  if (!work) notFound();

  const [chapters, lineage, viewer, starred] = await Promise.all([
    getChapterList(work.id),
    getLineage(work.id),
    getViewer(),
    hasStarred(work.id),
  ]);
  const isOwner = viewer?.userId === work.owner_id;
  const isFork = work.parent_work_id !== null;
  // 필명은 바꿀 수 없으므로 계보 맨 앞(뿌리 원작)의 작가 필명으로 뿌리 원작자를 알아본다
  const isRootOwner = isFork && !!viewer?.profile && lineage[0]?.ancestor_owner_handle === viewer.profile.handle;
  const viewerState = !viewer ? "anon" : !viewer.profile ? "onboarding" : "ready";
  const returnTo = `/w/${work.slug}`;

  const counts = { inherited: 0, modified: 0, new: 0 };
  for (const ch of chapters) counts[ch.state]++;
  const bar = chapterBar(counts, isFork);

  return (
    <>
      {work.visibility === "hidden" && <HiddenNotice isOwner={isOwner} />}

      {/* 대문 머리: 바탕색이 작품 종류(원작 연보라, 갈래 연분홍, 정사 노랑, 공개 전·숨김은 흰 바탕 + 테두리) */}
      <header className={cn("flex flex-col gap-4 rounded-[28px] p-6 sm:gap-[18px] sm:rounded-panel sm:px-9 sm:py-8", coverTone(work))}>
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="line" className="h-[26px] border-0 bg-surface/70 px-[11px] text-xs text-ink">
            {isFork ? "갈래" : "원작"}
          </Chip>
          {work.is_canon && (
            <Chip tone="canon" className="h-[26px] px-[11px] text-xs">
              정사
            </Chip>
          )}
          {work.visibility === "draft" && (
            <Chip tone="line" className="h-[26px] px-[11px] text-xs">
              임시 저장
            </Chip>
          )}
          {work.visibility === "hidden" && (
            <Chip tone="danger" className="h-[26px] px-[11px] text-xs">
              숨김
            </Chip>
          )}
        </div>
        <h1 className="font-serif text-[32px] leading-[1.2] font-bold tracking-[-0.04em] break-keep sm:text-[44px]">{work.title}</h1>
        {work.fork_note && <p className="text-[15px] font-medium text-ink-2">{work.fork_note}</p>}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <InitialAvatar name={work.owner.display_name} className="size-11 text-sm" />
          <p className="text-[15px]">
            <Link href={`/@${work.owner.handle}`} className="font-bold hover:underline">
              {work.owner.display_name}
            </Link>{" "}
            <span className="text-ink-2">@{work.owner.handle}</span>
          </p>
          {isOwner && (
            <div className="flex items-center gap-1">
              <Link href={`/w/${work.slug}/edit`} className={buttonVariants({ variant: "outline" })}>
                <PenLine />
                작업실
              </Link>
              {/* 한 번도 공개하지 않았고 갈래도 없는 작품만 지울 수 있다(delete_work) */}
              {work.first_published_at === null && work.fork_count === 0 && (
                <DeleteWorkButton workId={work.id} title={work.title} isFork={isFork} />
              )}
            </div>
          )}
        </div>
        {work.summary && <p className="max-w-[680px] text-base leading-[1.75] whitespace-pre-line">{work.summary}</p>}
        <dl className="flex flex-wrap gap-2 text-[13px] text-ink-2">
          <div className={META}>
            <dt>라이선스</dt>
            <dd className="font-semibold text-ink">{licenseLabel(work.license)}</dd>
          </div>
          <div className={META}>
            <dt>AI 활용</dt>
            <dd className="font-semibold text-ink">
              {isOwner ? (
                // 갈래는 원작의 표기를 물려받으므로, 공개 전(임시 저장)에 고치라고 한 번 알려 준다
                <AiUsageField workId={work.id} value={work.ai_usage as AiUsage} inherited={isFork && work.visibility === "draft"} />
              ) : (
                aiUsageLabel(work.ai_usage)
              )}
            </dd>
          </div>
          <div className={META}>
            <dt>별</dt>
            <dd className="font-semibold text-ink tabular-nums">{work.star_count.toLocaleString()}</dd>
          </div>
          <div className={META}>
            <dt>갈래</dt>
            <dd className="font-semibold text-ink tabular-nums">
              {work.allow_fork ? `${work.fork_count.toLocaleString()}개` : "허용 안 함"}
            </dd>
          </div>
        </dl>
        {bar.cells.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="ff-bar [--ff-bar-height:6px]" aria-hidden>
              {bar.cells.map((kind, i) => (
                <span key={i} data-kind={kind} />
              ))}
            </div>
            <p className="text-[13px] text-ink-2 tabular-nums">{bar.caption}</p>
          </div>
        )}
      </header>

      <LineageLine lineage={lineage} variant="panel" />

      <div className="flex flex-wrap items-center gap-2.5 empty:hidden">
        {chapters.length > 0 && (
          <Link href={`/w/${work.slug}/${chapters[0].position}`} className={buttonVariants({ size: "lg", className: "px-7" })}>
            첫 장부터 읽기
          </Link>
        )}
        {work.visibility === "public" && !isOwner && (
          <StarButton workId={work.id} starred={starred} viewer={viewerState} returnTo={returnTo} />
        )}
        {/* 정사는 공개된 갈래에만 붙인다. 붙어 있는 배지는 언제든 뗄 수 있다. */}
        {isRootOwner && (work.visibility === "public" || work.is_canon) && (
          <CanonButton workId={work.id} isCanon={work.is_canon} />
        )}
        {work.visibility === "public" && !isOwner && (
          <ReportDialog workId={work.id} chapterId={null} target={`『${work.title}』`} viewer={viewerState} returnTo={returnTo} />
        )}
      </div>

      {isOwner && work.visibility === "draft" && (
        <DraftPanel
          workId={work.id}
          slug={work.slug}
          slugLocked={work.first_published_at !== null}
          allowFork={work.allow_fork}
        />
      )}

      <WorkTabs slug={work.slug} current="toc" />

      <section aria-label="목차" className="flex flex-col gap-3">
        {chapters.length === 0 ? (
          <EmptyState title="아직 장이 없습니다." />
        ) : (
          <>
            {/* 원작의 장은 모두 '새 장'이라 갈래에서만 표시한다 */}
            {isFork && (
              <ul className="mx-1 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-2" aria-label="장 표시">
                <li className="inline-flex items-center gap-1.5">
                  <ChapterBadge state="inherited" />
                  원작 그대로
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <ChapterBadge state="modified" />
                  원작 장을 고쳐 씀
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <ChapterBadge state="new" />이 갈래에서 새로 씀
                </li>
              </ul>
            )}
            <ol className="overflow-hidden rounded-card bg-surface">
              {chapters.map((ch) => (
                <li key={ch.position} className="border-t border-line-soft first:border-t-0">
                  <Link
                    href={`/w/${work.slug}/${ch.position}`}
                    className="flex min-h-[60px] items-center gap-3 px-4 py-2 hover:bg-[#FAF9F6] sm:px-[22px]"
                  >
                    <span className="w-11 shrink-0 text-[13px] font-medium text-ink-3 tabular-nums sm:w-12">{ch.position}장</span>
                    <span className="min-w-0 flex-1 truncate font-serif text-base font-semibold">{ch.title}</span>
                    {isFork && <ChapterBadge state={ch.state} />}
                    <ChevronRight className="size-[18px] shrink-0 text-ink-3" aria-hidden />
                  </Link>
                </li>
              ))}
            </ol>
          </>
        )}
      </section>

      <AdSlot id="work-below-chapters" className="mt-6" />
    </>
  );
}

function coverTone(work: { visibility: string; is_canon: boolean; parent_work_id: string | null }) {
  if (work.visibility !== "public") return "border-[1.5px] border-kind-draft-line bg-surface";
  if (work.is_canon) return "bg-kind-canon";
  return work.parent_work_id !== null ? "bg-kind-fork" : "bg-kind-original";
}

const META = "inline-flex min-h-8 items-center gap-1.5 rounded-full bg-surface/60 px-3";

// 장 배지: 물려받음 검은 바탕, 고침 흰 바탕 + 검은 테두리, 새 장 연분홍
const CHAPTER_BADGE = {
  inherited: "bg-ink text-surface",
  modified: "border-[1.5px] border-ink bg-surface",
  new: "bg-kind-fork",
} as const;

function ChapterBadge({ state }: { state: ChapterState }) {
  return (
    <span className={cn("inline-flex h-[26px] shrink-0 items-center rounded-full px-2.5 text-xs font-semibold", CHAPTER_BADGE[state])}>
      {CHAPTER_STATES[state]}
    </span>
  );
}
