import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { LineageLine } from "@/components/lineage-line";
import { getViewer } from "@/lib/auth";
import { getChapterHistory, getChapterList, getEditorChapter, getLineage, getWorkBySlug } from "@/lib/works";
import { Workroom } from "./workroom";

export const metadata: Metadata = { title: "작업실" };

// 작업실: 왼쪽 장 목록, 가운데 편집기, 오른쪽 미리보기, 수정 기록. 작가 본인만 들어온다.
// 글 쓰는 사람을 방해하지 않도록 광고를 넣지 않는다(F10).
export default function EditPage({ params, searchParams }: PageProps<"/w/[slug]/edit">) {
  return (
    <main className="mx-auto flex w-full max-w-[96rem] flex-1 flex-col px-4 py-6">
      <Suspense fallback={null}>
        <WorkroomLoader params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function WorkroomLoader({ params, searchParams }: PageProps<"/w/[slug]/edit">) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const work = await getWorkBySlug(decodeURIComponent(slug));
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${encodeURIComponent(`/w/${slug}/edit`)}`);
  if (!work || work.owner_id !== viewer.userId) notFound();

  const [chapters, lineage] = await Promise.all([getChapterList(work.id), getLineage(work.id)]);
  if (chapters.length === 0) notFound();

  // ?ch=장 번호. 없거나 맞지 않으면 갈래는 갈림점, 원작은 1장을 연다.
  const asked = typeof query.ch === "string" && /^[1-9]\d{0,3}$/.test(query.ch) ? Number(query.ch) : null;
  const fallback = work.fork_chapter_position ?? chapters[0].position;
  const position = chapters.some((c) => c.position === asked) ? asked! : fallback;
  if (asked !== position) redirect(`/w/${work.slug}/edit?ch=${position}`);

  const chapter = await getEditorChapter(work.id, position);
  if (!chapter) notFound();
  const history = await getChapterHistory(chapter);

  const isFork = work.parent_work_id !== null;
  const header = (
    <header className="flex flex-col gap-2">
      <LineageLine lineage={lineage} />
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="font-serif text-2xl font-bold tracking-tight">
          <span className="mr-2 text-base font-normal text-muted-foreground">작업실</span>
          {work.title}
        </h1>
        {isFork && work.fork_chapter_position !== null && (
          <span className="text-sm text-muted-foreground">갈림점 {work.fork_chapter_position}장</span>
        )}
        <Link href={`/w/${work.slug}`} className="text-sm underline-offset-4 hover:underline">
          {work.visibility === "draft" ? "대문에서 공개하기 →" : "대문으로 →"}
        </Link>
      </div>
    </header>
  );

  return (
    <Workroom
      work={{
        id: work.id,
        slug: work.slug,
        title: work.title,
        isFork,
        forkPoint: work.fork_chapter_position,
      }}
      header={header}
      chapters={chapters}
      chapter={chapter}
      history={history}
    />
  );
}
