import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { notFound } from "next/navigation";
import { PenLine } from "lucide-react";
import { AdSlot } from "@/components/ad-slot";
import { LineageLine } from "@/components/lineage-line";
import { buttonVariants } from "@/components/ui/button";
import { getViewer } from "@/lib/auth";
import { describe, getPublicWork } from "@/lib/public-works";
import { aiUsageLabel, CHAPTER_STATES, licenseLabel, type AiUsage } from "@/lib/work-meta";
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

// 작품 대문: 제목, 작가, 계보 줄, 소개, 라이선스, 별, 장 목록. 탭: 목차 · 갈래 지도
// 관리자가 숨긴 작품은 작가·관리자만 읽을 수 있고(RLS), 다른 사람에게는 404다.
export default function WorkPage({ params }: PageProps<"/w/[slug]">) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-12">
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

  return (
    <>
      {work.visibility === "hidden" && <HiddenNotice isOwner={isOwner} />}

      <header className="flex flex-col gap-3">
        <LineageLine lineage={lineage} />
        <div className="flex flex-wrap items-center gap-2">
          {work.visibility === "draft" && <Badge tone="muted">임시 저장</Badge>}
          {work.visibility === "hidden" && <Badge tone="danger">숨김</Badge>}
          {work.is_canon && <Badge tone="canon">정사</Badge>}
        </div>
        <h1 className="font-serif text-3xl font-bold tracking-tight">{work.title}</h1>
        {work.fork_note && <p className="text-muted-foreground">{work.fork_note}</p>}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
          <p>
            <Link href={`/@${work.owner.handle}`} className="font-medium hover:underline">
              {work.owner.display_name}
            </Link>{" "}
            <span className="text-muted-foreground">@{work.owner.handle}</span>
          </p>
          {isOwner && (
            <div className="flex items-center gap-1">
              <Link href={`/w/${work.slug}/edit`} className={buttonVariants({ variant: "outline", size: "sm" })}>
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
        {work.summary && <p className="leading-relaxed whitespace-pre-line">{work.summary}</p>}
        {work.visibility === "public" && (
          <div className="flex flex-wrap items-center gap-2">
            {!isOwner && <StarButton workId={work.id} starred={starred} viewer={viewerState} returnTo={returnTo} />}
            {/* 정사는 공개된 갈래에만 붙인다. 붙어 있는 배지는 언제든 뗄 수 있다. */}
            {isRootOwner && <CanonButton workId={work.id} isCanon={work.is_canon} />}
            {!isOwner && (
              <ReportDialog
                workId={work.id}
                chapterId={null}
                target={`『${work.title}』`}
                viewer={viewerState}
                returnTo={returnTo}
              />
            )}
          </div>
        )}
        {isRootOwner && work.is_canon && work.visibility !== "public" && <CanonButton workId={work.id} isCanon />}
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
          <div className="flex gap-1.5">
            <dt>라이선스</dt>
            <dd className="text-foreground">{licenseLabel(work.license)}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt>AI 활용</dt>
            <dd className="text-foreground">
              {isOwner ? (
                // 갈래는 원작의 표기를 물려받으므로, 공개 전(임시 저장)에 고치라고 한 번 알려 준다
                <AiUsageField workId={work.id} value={work.ai_usage as AiUsage} inherited={isFork && work.visibility === "draft"} />
              ) : (
                aiUsageLabel(work.ai_usage)
              )}
            </dd>
          </div>
          <div className="flex gap-1.5">
            <dt>별</dt>
            <dd className="text-foreground tabular-nums">{work.star_count.toLocaleString()}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt>갈래</dt>
            <dd className="text-foreground tabular-nums">
              {work.allow_fork ? `${work.fork_count.toLocaleString()}개` : "허용 안 함"}
            </dd>
          </div>
        </dl>
      </header>

      {isOwner && work.visibility === "draft" && (
        <DraftPanel
          workId={work.id}
          slug={work.slug}
          slugLocked={work.first_published_at !== null}
          allowFork={work.allow_fork}
        />
      )}

      <WorkTabs slug={work.slug} current="toc" />

      <section aria-label="목차">
        {chapters.length === 0 ? (
          <p className="text-sm text-muted-foreground">아직 장이 없습니다.</p>
        ) : (
          <ol className="flex flex-col divide-y">
            {chapters.map((ch) => (
              <li key={ch.position}>
                <Link
                  href={`/w/${work.slug}/${ch.position}`}
                  className="flex items-baseline gap-3 py-3 hover:bg-muted/50"
                >
                  <span className="w-12 shrink-0 text-sm text-muted-foreground tabular-nums">{ch.position}장</span>
                  <span className="flex-1 font-serif">{ch.title}</span>
                  {/* 원작의 장은 모두 '새 장'이라 갈래에서만 표시한다 */}
                  {isFork && <Badge tone={ch.state === "inherited" ? "muted" : "default"}>{CHAPTER_STATES[ch.state]}</Badge>}
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>

      <AdSlot id="work-below-chapters" />
    </>
  );
}

function Badge({ tone, children }: { tone: "default" | "muted" | "danger" | "canon"; children: ReactNode }) {
  const tones = {
    default: "border-foreground/20 text-foreground",
    muted: "border-transparent bg-muted text-muted-foreground",
    danger: "border-transparent bg-destructive/10 text-destructive",
    canon: "border-transparent bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
  };
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs ${tones[tone]}`}>
      {children}
    </span>
  );
}
