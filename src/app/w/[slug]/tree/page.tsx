import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { AdSlot } from "@/components/ad-slot";
import { LineageLine } from "@/components/lineage-line";
import { layoutForkTree, type TreeWork } from "@/lib/fork-tree";
import { getLineage, getTreeEntries, getWorkBySlug, type TreeEntry } from "@/lib/works";
import { WorkTabs } from "../work-tabs";
import { ForkMap, type MapEntry } from "./fork-map";

export const metadata: Metadata = { title: "갈래 지도" };

// 갈래 지도(F6): 뿌리 원작에서 뻗어 나간 공개 갈래 전체를 장 번호 축 위에 나무처럼 그린다.
// 갈래에서 열어도 뿌리 원작의 지도 전체를 보여 주고 지금 갈래를 강조한다. 광고는 지도 아래 1개(F10).
export default function TreePage({ params }: PageProps<"/w/[slug]/tree">) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-12">
      <Suspense fallback={null}>
        <TreeView params={params} />
      </Suspense>
    </main>
  );
}

async function TreeView({ params }: Pick<PageProps<"/w/[slug]/tree">, "params">) {
  const { slug } = await params;
  const work = await getWorkBySlug(decodeURIComponent(slug));
  if (!work) notFound();

  const [entries, lineage] = await Promise.all([getTreeEntries(work.root_work_id), getLineage(work.id)]);
  const root = entries.find((e) => e.id === work.root_work_id);
  const forks = entries.filter((e) => e.id !== work.root_work_id);

  const header = (
    <header className="flex flex-col gap-3">
      <LineageLine lineage={lineage} />
      <h1 className="font-serif text-3xl font-bold tracking-tight">{work.title}</h1>
      {work.fork_note && <p className="text-muted-foreground">{work.fork_note}</p>}
    </header>
  );

  if (!root) {
    return (
      <>
        {header}
        <WorkTabs slug={work.slug} current="tree" />
        <p className="rounded-lg bg-muted/50 px-4 py-6 text-center text-sm text-muted-foreground">
          원작이 공개되어 있지 않아 갈래 지도를 볼 수 없습니다.
        </p>
      </>
    );
  }

  const layout = layoutForkTree(toTreeWork(root), forks.map(toTreeWork));
  const mapEntries: Record<string, MapEntry> = Object.fromEntries(
    entries.map((e) => [
      e.id,
      { slug: e.slug, title: e.title, author: e.owner.display_name, stars: e.star_count, note: e.fork_note, isCanon: e.is_canon },
    ]),
  );
  const onMap = new Set(layout.branches.map((b) => b.id));
  const byId = new Map(entries.map((e) => [e.id, e]));
  // 목록은 지도와 같은 순서(정사 → 별 → 먼저 만든 순, 갈래의 갈래는 부모 아래)에 잘린 갈래를 별 순으로 덧붙인다
  const listed = [
    ...layout.branches.slice(1).map((b) => byId.get(b.id)!),
    ...forks.filter((f) => !onMap.has(f.id)).sort((a, b) => b.star_count - a.star_count),
  ];

  return (
    <>
      {header}
      <WorkTabs slug={work.slug} current="tree" />

      <section className="flex flex-col gap-3" aria-label="갈래 지도">
        <p className="text-sm text-muted-foreground">
          『{root.title}』에서 뻗어 나간 공개 갈래 {forks.length.toLocaleString()}개. 가지를 누르면 그 갈래로 갑니다.
          동그라미 숫자는 그 장에서 갈라진 갈래 수입니다. 옆으로 끌어서 볼 수 있습니다.
        </p>
        {work.visibility !== "public" && (
          <p className="text-sm text-amber-800 dark:text-amber-300">이 작품은 아직 공개되지 않아 지도에 없습니다.</p>
        )}
        <ForkMap layout={layout} entries={mapEntries} currentId={work.id} />
        {layout.hidden > 0 && (
          <p className="text-sm text-muted-foreground">
            지도에는 별이 많은 갈래 {layout.branches.length - 1}개만 그렸습니다. 나머지 {layout.hidden}개는 아래 목록에 있습니다.
          </p>
        )}
      </section>

      <AdSlot id="tree-below-map" />

      {forks.length > 0 && (
        <details open={layout.hidden > 0} className="rounded-lg border">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
            갈래 목록 ({forks.length.toLocaleString()}개)
          </summary>
          <ol className="flex flex-col divide-y border-t">
            {listed.map((f) => (
              <li key={f.id}>
                <ForkListItem fork={f} parent={byId.get(f.parent_work_id!)} current={f.id === work.id} />
              </li>
            ))}
          </ol>
        </details>
      )}
    </>
  );
}

function toTreeWork(e: TreeEntry): TreeWork {
  return {
    id: e.id,
    parentId: e.parent_work_id,
    forkPoint: e.fork_chapter_position,
    chapterCount: e.chapterCount,
    stars: e.star_count,
    isCanon: e.is_canon,
    createdAt: e.created_at,
  };
}

function ForkListItem({ fork, parent, current }: { fork: TreeEntry; parent: TreeEntry | undefined; current: boolean }) {
  return (
    <Link href={`/w/${fork.slug}`} className={`flex flex-col gap-0.5 px-4 py-3 hover:bg-muted/50 ${current ? "bg-muted" : ""}`}>
      <span className="flex flex-wrap items-baseline gap-x-2">
        {fork.is_canon && (
          <span className="rounded bg-amber-100 px-1 text-xs text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">정사</span>
        )}
        <span className="font-serif font-medium">『{fork.title}』</span>
        <span className="text-sm text-muted-foreground">
          {fork.owner.display_name} · ★ {fork.star_count.toLocaleString()}
        </span>
      </span>
      <span className="text-sm text-muted-foreground">
        {parent ? `『${parent.title}』 ` : ""}
        {fork.fork_chapter_position}장에서 갈라짐{fork.fork_note && ` · ${fork.fork_note}`}
      </span>
    </Link>
  );
}
