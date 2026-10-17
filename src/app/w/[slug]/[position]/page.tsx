import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AdSlot } from "@/components/ad-slot";
import { LineageLine } from "@/components/lineage-line";
import { Markdown } from "@/components/markdown";
import { ReadingSize } from "@/components/reading-size";
import { buttonVariants } from "@/components/ui/button";
import { getViewer } from "@/lib/auth";
import { splitAtMiddle } from "@/lib/middle-break";
import { licenseLabel } from "@/lib/work-meta";
import { countForksAt, getChapter, getChapterList, getLineage, getWorkBySlug } from "@/lib/works";
import { ForkDialog } from "./fork-dialog";

// 장 읽기: 본문, 이전·다음, 글자 크기, 끝에 '여기서 갈라지기'와 '이 장에서 갈라진 갈래 N개'.
// 광고: 본문 끝('다음 장'과 '여기서 갈라지기' 사이), 긴 장은 본문 중간 문단 경계, 넓은 화면은 오른쪽 여백.
export default function ChapterPage({ params }: PageProps<"/w/[slug]/[position]">) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 justify-center gap-10 px-4 py-10">
      <Suspense fallback={<div className="flex-1" />}>
        <ChapterView params={params} />
      </Suspense>
    </main>
  );
}

async function ChapterView({ params }: Pick<PageProps<"/w/[slug]/[position]">, "params">) {
  const { slug, position: positionParam } = await params;
  if (!/^[1-9]\d{0,3}$/.test(positionParam)) notFound();
  const position = Number(positionParam);

  const work = await getWorkBySlug(decodeURIComponent(slug));
  if (!work) notFound();

  const [chapter, chapters, lineage, forkCount, viewer] = await Promise.all([
    getChapter(work.id, position),
    getChapterList(work.id),
    getLineage(work.id),
    countForksAt(work.id, position),
    getViewer(),
  ]);
  if (!chapter) notFound();

  const index = chapters.findIndex((c) => c.position === position);
  const prev = chapters[index - 1];
  const next = chapters[index + 1];
  const halves = splitAtMiddle(chapter.body);
  const base = `/w/${work.slug}`;

  return (
    <>
      {/* 본문 폭은 .reading이 40em으로 잡는다(보통 글자 크기에서 45rem) */}
      <article className="flex w-full max-w-[45rem] min-w-0 flex-col gap-8">
        <header className="flex flex-col gap-2">
          <LineageLine lineage={lineage} />
          <p className="text-sm text-muted-foreground">
            <Link href={base} className="hover:underline">
              『{work.title}』
            </Link>{" "}
            · {work.owner.display_name}
            {work.visibility === "draft" && " · 임시 저장"}
          </p>
          <h1 className="font-serif text-2xl font-bold tracking-tight">
            <span className="mr-2 text-muted-foreground">{chapter.position}장</span>
            {chapter.title}
          </h1>
        </header>

        <ReadingSize>
          {halves ? (
            <>
              <div className="reading">
                <Markdown>{halves[0]}</Markdown>
              </div>
              <AdSlot id="chapter-middle" />
              <div className="reading">
                <Markdown>{halves[1]}</Markdown>
              </div>
            </>
          ) : (
            <div className="reading">
              <Markdown>{chapter.body}</Markdown>
            </div>
          )}
        </ReadingSize>

        <nav className="flex items-center justify-between gap-2 border-t pt-6" aria-label="장 이동">
          {prev ? (
            <Link href={`${base}/${prev.position}`} className={buttonVariants({ variant: "ghost" })}>
              <ChevronLeft />
              이전 장
            </Link>
          ) : (
            <span />
          )}
          <Link href={base} className="text-sm text-muted-foreground hover:underline">
            목차
          </Link>
          {next ? (
            <Link href={`${base}/${next.position}`} className={buttonVariants({ variant: "default", className: "min-w-0" })}>
              <span className="truncate">다음 장: {next.title}</span>
              <ChevronRight />
            </Link>
          ) : (
            <span className="text-sm text-muted-foreground">마지막 장입니다</span>
          )}
        </nav>

        <AdSlot id="chapter-end" />

        {/* 공개 작품만 갈라질 수 있다(fork_work) */}
        {work.allow_fork && work.visibility === "public" && (
          <section className="flex flex-col items-center gap-2 rounded-lg bg-muted/40 p-6 text-center">
            <p className="text-sm text-muted-foreground">이 이야기, 여기서부터 당신 버전으로.</p>
            <ForkDialog
              workId={work.id}
              workTitle={work.title}
              position={chapter.position}
              licenseLabel={licenseLabel(work.license)}
              viewer={!viewer ? "anon" : !viewer.profile ? "onboarding" : "ready"}
              returnTo={`${base}/${chapter.position}`}
            />
            <p className="text-sm text-muted-foreground">이 장에서 갈라진 갈래 {forkCount.toLocaleString()}개</p>
          </section>
        )}
      </article>

      <div className="hidden w-[160px] shrink-0 xl:block">
        <div className="sticky top-6">
          <AdSlot id="chapter-side" size="skyscraper" />
        </div>
      </div>
    </>
  );
}
